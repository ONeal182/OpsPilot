# OpsPilot — Decision Log (ADR-style)

Each entry: context, decision, rationale. Newest decisions appended at the end.

---

## D1 — PHP/Composer/Laravel tooling runs in a container, not on the host

**Context:** The WSL host has no PHP and no Composer. The spec says not to modify
the host when a project-level solution exists.

**Decision:** All PHP, Composer, Laravel, Pint, PHPStan/Larastan, and Pest work
runs inside the `php-cli` container (same image as `php-fpm`,
`docker/php/Dockerfile`, PHP 8.4). No `apt install` on the host.

**Rationale:** Keeps the host clean and the toolchain reproducible for everyone.

---

## D2 — Host port assignments

**Context:** Host port 5432 is already taken by an unrelated `monorepo-postgres`
container. Other local database instances may also be running.

**Decision:** Host ports — nginx **8080**, MySQL **33061**, Redis **63790**,
RabbitMQ **5672** (AMQP) and **15672** (management), web (Vite) **5173**.
Container-internal ports stay standard (80, 3306, 6379, 5672, 15672, 5173).

**Rationale:** OpsPilot uses MySQL, not Postgres, so 5432 is never bound. MySQL
and Redis get non-standard host ports to avoid collisions with other local DBs.

---

## D3 — Cross-language messages are JSON only

**Context:** Laravel (PHP) publishes messages that the Node Agent Runtime
consumes.

**Decision:** All messages crossing the PHP <-> Node boundary are JSON. PHP
serialization (`serialize()` / Laravel's serialized job payloads) is never used
on that boundary.

**Rationale:** Node cannot safely read PHP-serialized payloads; JSON is the only
portable, debuggable contract.

---

## D4 — Agent Runtime starts with `AGENT_DRIVER=fake`

**Context:** Bootstrap must be runnable and testable without Claude credentials.

**Decision:** The Agent Runtime defaults to `AGENT_DRIVER=fake`
(`FakeAgentDriver`). No Claude API calls occur during bootstrap and no
`ANTHROPIC_API_KEY` is required.

**Rationale:** Deterministic, offline, zero-cost development and CI.

---

## D5 — Agent has no shell / filesystem / direct-DB access

**Context:** The agent must not be able to act outside its intended surface.

**Decision:** The agent has no shell, no filesystem access, and no direct
database access. It reaches business data only via MCP tool -> Laravel Internal
API -> validation -> authorization/business rules -> MySQL. `propose_action`
creates a proposal record and never auto-executes a risky change.

**Rationale:** Least privilege; every action is mediated and auditable, and risky
changes require human approval.

---

## D6 — Image version pins

**Context:** Reproducible builds require pinned base images.

**Decision:** `mysql:8.0`, `rabbitmq:3-management-alpine`, `redis:7-alpine`,
`node:22-alpine`, `php:8.4-fpm`.

**Rationale:** Current stable releases; matches the spec's PHP 8.4 and Node LTS
requirements.

---

## D7 — Laravel major version is determined in phase B

**Context:** The spec references "Laravel 13", but the installed version depends
on what `composer create-project laravel/laravel` pulls at install time.

**Decision:** Phase B ran `composer create-project laravel/laravel` in the
`php-cli` container. The installer pulled **Laravel Framework 13.31.0** (PHP
8.4.25, Composer 2.10.3). Laravel 13 *is* released and installable, so the spec's
"Laravel 13" is satisfied exactly — no downgrade/substitution was needed.

**Rationale:** Trust the installer and document the real result.

---

## D8 — Redis healthcheck uses a shell PONG assertion

**Context:** `redis-cli ping` exits 0 even in some degraded states; the spec asks
for a check that expects `PONG`.

**Decision:** The Redis healthcheck is
`CMD-SHELL: redis-cli ping | grep -q PONG` so a missing/incorrect reply fails the
check.

**Rationale:** Makes `depends_on: condition: service_healthy` meaningful for
Redis.

---

## D9 — PHP image build dependencies; `amqp` PECL extension deferred

**Context:** The PHP image needs to build several extensions; RabbitMQ access
from PHP can use either the C `amqp` extension or a pure-PHP library.

**Decision:** The image installs `librabbitmq-dev` and `default-mysql-client`
plus the extensions listed in the spec (`pdo_mysql mbstring bcmath gd zip intl
pcntl sockets opcache` + `redis` via PECL). The `amqp` PECL extension is **not**
installed in phase A. The RabbitMQ client library choice for Laravel is made in
phase B/E (pure-PHP `php-amqplib` is the likely default, needing no C extension).

**Rationale:** Keep the phase-A image lean; defer the messaging-library decision
to the phase that actually wires messaging.

---

## D10 — A local `.env` was created from `.env.example` during phase A

**Context:** `docker compose config` warns about unset variables when no `.env`
exists. The spec explicitly permits creating a throwaway `.env`.

**Decision:** `cp .env.example .env` was run so validation is warning-free. `.env`
is gitignored and holds only the safe demo values from `.env.example`.

**Rationale:** Clean validation output; no secrets committed.

---

## D11 — `.gitkeep` added to `docs/plans/` and `docs/contracts/`

**Context:** Git does not track empty directories. `docs/plans/` and
`docs/contracts/` are created in phase A but not populated until later phases.

**Decision:** A `.gitkeep` file was added to both so the directory structure
survives a fresh clone. (The spec explicitly required `.gitkeep` only in `apps/`
and `services/agent/`; this extends the same treatment to the two empty `docs/`
subdirectories.)

**Rationale:** Preserve the intended repo layout without waiting for phase F/E to
create real content.

---

## D12 — Laravel installed via `/tmp` then copied into `apps/api`

**Context:** `apps/api/` held a `.gitkeep`, so `composer create-project` (which
requires an empty or missing target) could not target it directly.

**Decision:** `composer create-project laravel/laravel /tmp/laravel` was run in
the `php-cli` container, then `cp -a /tmp/laravel/. /var/www/html/` and the
`.gitkeep` removed. Result: **Laravel 13.31.0**.

**Rationale:** The bind mount `./apps/api:/var/www/html` means the copy lands on
the host with correct `www` (uid/gid 1000) ownership; no host-side PHP needed.

---

## D13 — Root `.env` `APP_KEY` is populated (was blank)

> **Superseded by D38** (phase G): the `APP_KEY` line was removed from the root
> `.env` / `.env.example` entirely, which is a cleaner fix for the same shadowing
> problem and needs no container recreation during setup.

**Context:** Compose injects the root `.env` into `php-fpm`/`php-cli` via
`env_file:`, so every root-`.env` key becomes a real container environment
variable. `APP_KEY` was blank there. Laravel's dotenv loader does **not** override
real environment variables, so the blank container `APP_KEY=` shadowed the real
key written into `apps/api/.env` by `php artisan key:generate` — encryption/
session code (and the Pest feature tests) failed with `MissingAppKeyException`.

**Decision:** Set `APP_KEY=base64:...` in the root `.env` to the same value
`key:generate` wrote into `apps/api/.env`, and force-recreate `php-cli`/`php-fpm`.
Root `.env` is gitignored; `.env.example` keeps `APP_KEY=` blank. This is a
throwaway local-dev key for a demo database — not a production secret.

**Rationale:** The containerized app has to have a usable app key; keeping the two
`.env` files consistent is the least-surprising fix.

---

## D14 — Test database: sqlite `:memory:`, forced in `phpunit.xml`

**Context:** The Laravel 13 skeleton `phpunit.xml` already sets
`DB_CONNECTION=sqlite` / `DB_DATABASE=:memory:`, but plain `<env>` entries do not
override the real container environment variables (`DB_CONNECTION=mysql`, …), so
tests would otherwise run against the dev MySQL database.

**Decision:** Added `force="true"` to the `phpunit.xml` `<php>` entries for
`DB_CONNECTION`, `DB_DATABASE`, `DB_URL`, `CACHE_STORE`, `SESSION_DRIVER`,
`QUEUE_CONNECTION`, `REDIS_CLIENT`, `APP_ENV`, plus a dedicated deterministic
`APP_KEY`. Tests use an in-memory sqlite DB and the `array` cache/session drivers
and never touch the dev MySQL/Redis state. The `redis` health check in
`HealthTest` still hits the real `redis:6379` container (reachable from
`php-cli`), which is deterministic in this stack.

**Rationale:** Simplest fully reproducible isolation; no `opspilot_test` database
to provision.

---

## D15 — PHPStan / Larastan at level 5

**Context:** The spec asks for a static-analysis gate.

**Decision:** `apps/api/phpstan.neon` includes the Larastan extension, analyses
`app/`, at `level: 5`. The fresh skeleton plus the `HealthController` pass clean
(`[OK] No errors`) — no baseline file was needed.

**Rationale:** Level 5 is a meaningful bar that the skeleton meets without
suppressions.

---

## D16 — Laravel Boost: `boost:install` ran headless in phase B

**Context:** The plan expected `boost:install` might be TUI-only and that MCP
wiring would be deferred to phase F.

**Decision:** `php artisan boost:install --no-interaction` ran non-interactively
and succeeded. It detected Claude Code, wrote `apps/api/.mcp.json` (server
`laravel-boost` → `php artisan boost:mcp`), synced 5 Boost skills into
`apps/api/.claude/skills/`, and regenerated `apps/api/CLAUDE.md` /
`apps/api/AGENTS.md` with Boost guidelines. `laravel/mcp` was pulled in as a
transitive dependency of `laravel/boost`. No repo-root Claude Code config was
touched. Phase F can still refine/verify the MCP wiring.

**Rationale:** It worked headless with no prompts, so there was no reason to skip
it; the generated `.mcp.json` is exactly what phase F would have created.

---

## D17 — No Dockerfile or DB-grant fixes were needed

**Context:** The plan anticipated possibly having to patch
`docker/php/Dockerfile` or grant MySQL privileges.

**Decision:** `docker compose build php-cli` succeeded unmodified; all required
extensions (`pdo_mysql mbstring bcmath gd zip intl pcntl sockets opcache redis`)
loaded first try. The `mysql:8.0` image created the `opspilot` database and user
from `MYSQL_DATABASE`/`MYSQL_USER`, so `migrate --force` worked with no manual
`CREATE DATABASE` / `GRANT`. No changes to record.

**Rationale:** Nothing was broken; documenting the clean result for future
reference.

---

## D18 — Vue app scaffolded with `create-vue`, selected feature set

**Context:** Phase C needs a Vue 3 + TypeScript SPA in `apps/web` (which held only
a `.gitkeep`).

**Decision:** Ran `npm create vue@latest` (`create-vue` **3.23.0**) with
`--ts --router --pinia --vitest --eslint --prettier` into a temp dir, then copied
the contents into `apps/web/` and removed the `.gitkeep`. E2E runners
(Playwright/Cypress/Nightwatch), JSX and SSR were deliberately **not** selected —
Playwright is wired separately in phase F. `create-vue` now always adds **oxlint**
alongside ESLint (not optional) and generates the flat ESLint config; both were
kept as-is. **axios 1.20.0** was added as a runtime dependency. Resulting stack:
Vue 3.5.42, Vite 8.2.2, Vue Router 5.3.1, Pinia 4.0.3, Vitest 4.1.11,
ESLint 10.10.0, Prettier 3.9.5, TypeScript 6.0.3, vue-tsc 3.3.11.

**Rationale:** Official scaffolder = least-surprising, upgrade-friendly baseline
that matches the spec's requested features.

---

## D19 — Frontend calls the API via a relative `/api` path through the Vite proxy

**Context:** The same frontend code must reach the Laravel API both from a browser
on the host (`http://localhost:8080`) and from inside the `web` container (where
`localhost` is the container itself and the API is the `nginx` service).

**Decision:** The axios instance (`src/lib/http.ts`) uses `baseURL: '/api'` — a
relative path — and never reads an absolute API URL at runtime. `vite.config.ts`
adds `server.proxy['/api']` with
`target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8080'` and
`changeOrigin: true`. `docker-compose.yml` sets
`VITE_API_PROXY_TARGET: http://nginx:80` on the `web` service so the in-container
dev server proxies to the `nginx` service; on the host the env var is unset and it
defaults to `http://localhost:8080`. The pre-existing
`VITE_API_URL=${VITE_API_URL:-http://localhost:8080}` line was left in place
(exposed to app code as `import.meta.env.VITE_API_URL`, and mirrored in
`apps/web/.env.example`) but is not used by the health call. Verified:
`curl http://localhost:5173/api/health` from the host returns the health JSON
through the container's proxy to `nginx:80`.

**Rationale:** One code path, no environment branching in the app; the proxy
target is the only thing that differs between host and container, and it is set
declaratively in compose.

---

## D20 — `test` script added; `oxlint` pinned down to match its ESLint plugin

**Context:** (1) `create-vue` only generates `test:unit` (`vitest`, watch mode);
the spec's gates call `npm run test` and want a non-watch run. (2) The freshly
generated `package.json` pinned `oxlint@~1.74.0` but `eslint-plugin-oxlint@~1.73.0`
(no 1.74.x of the plugin exists), and its `peer oxlint@~1.73.0` made
`npm install` fail with `ERESOLVE`.

**Decision:** (1) Added `"test": "vitest run"` to `apps/web/package.json` scripts
(kept `test:unit` as-is). (2) Changed the `oxlint` devDependency from `~1.74.0` to
`~1.73.0` so it satisfies the plugin's peer range; `npm install` then resolves
cleanly with no `--legacy-peer-deps`.

**Rationale:** Minimal, in-tree fixes. Both are deviations from the raw scaffold
output, recorded here. The generated `lint` script keeps `--fix` (oxlint + eslint)
as `create-vue` ships it; it was run once to normalize and then exits 0 clean.
`vitest.config.ts` still `import`s `./vite.config` without a `.ts` extension (as
generated) — Vitest prints a deprecation notice but runs fine; adding the
extension breaks `vue-tsc`, so it was left untouched.

---

## D21 — Agent Runtime scaffold: Node 22 + TypeScript, standalone package

**Context:** Phase D needs a Node + TS worker in `services/agent` (which held only
a `.gitkeep`). Host Node is v24; the container is `node:22-alpine`.

**Decision:** `services/agent` is a standalone ESM package (`"type": "module"`,
`engines.node >=22`). `tsconfig.json`: target ES2022, `module`/`moduleResolution`
`NodeNext`, `strict`, `outDir dist`, `rootDir src`, `resolveJsonModule`,
`skipLibCheck`. Scripts: `build` (`tsc -p tsconfig.json`), `start`
(`node dist/main.js`), `dev` (`tsx watch`), `typecheck` (`tsc --noEmit`), `test`
(`vitest run`), `lint` (`eslint .`), `smoke` (`tsx src/smoke.ts`). Test files are
excluded from the build/typecheck `tsconfig.json` so `dist/` stays free of
`*.test.js`; Vitest transpiles them independently. (They still typecheck clean —
verified once with a throwaway config that re-includes them.)

**Rationale:** Minimal, standard TS project layout; deterministic offline gates.

---

## D22 — Dependency versions pinned by what actually resolved (Sept 2026 registry)

**Context:** "latest" for several packages moved past what the ecosystem can hold
together.

**Decision:** Installed: `@anthropic-ai/claude-agent-sdk` **0.3.266**,
`amqplib` **0.10.9** (registry `latest` is `2.0.1`, but `@types/amqplib` only goes
to **0.10.8**, so the 0.10.x line is used to keep the client and its type
definitions in lock-step — the classic promise API: `connect`, `createChannel`,
`assertExchange/Queue`, `consume`, `ack/nack`, `prefetch`), `zod` **4.5.4**,
`pino` **10.3.1** (+ `pino-pretty` **13.1.3** devDep), `typescript` **5.9.3**
(registry `latest` is **7.0.2**, but `typescript-eslint` **8.70.0** peer-requires
`typescript >=4.8.4 <6.1.0` — `^7` made `npm install` fail with `ERESOLVE`, so TS
is held at 5.9.x), `tsx` **4.23.13**, `vitest` **5.0.0**, `eslint` **10.10.0** +
`@eslint/js` **10.0.1** (versioned separately from `eslint`; `^10.10.0` does not
exist and gave `ETARGET`) + `typescript-eslint` **8.70.0** (flat config),
`prettier` **3.9.6**, `@types/amqplib` **0.10.8**, `@types/node` **26.5.0**.

**Rationale:** Pick the newest set that installs without `--force` /
`--legacy-peer-deps`. Both downgrades (TS 7 -> 5.9, `@eslint/js` 10.10 -> 10.0.1,
amqplib 2.x -> 0.10.x) are conflict fixes, recorded here.

---

## D23 — Claude Agent SDK: `@anthropic-ai/claude-agent-sdk` (present but inert)

**Context:** The SDK was renamed over 2024->2025; step 6 requires verifying the
current name against official sources before installing.

**Decision:** Verified via the official TypeScript reference
(`https://platform.claude.com/docs/en/agent-sdk/typescript`, which 307-redirects
to `https://code.claude.com/docs/en/agent-sdk/typescript`) and the npm page
(`https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk`). Package:
**`@anthropic-ai/claude-agent-sdk`**, installed version **0.3.266**, pure **ESM**,
`engines.node >=18`. It ships platform-specific Claude Code binaries as optional
dependencies (the Linux musl one installs fine in `node:22-alpine`).

**API shape:** the entrypoint is `query({ prompt, options })` where `prompt` is a
`string | AsyncIterable<SDKUserMessage>` and the call returns an
`AsyncGenerator<SDKMessage>` you iterate for streamed messages (the terminal one
has `type: 'result'` with a `result` string). Key `options` fields:
`systemPrompt` (`string | string[] | { type:'preset', preset:'claude_code', append? }`),
`mcpServers` (`Record<string, McpServerConfig>`), `allowedTools` (`string[]`,
e.g. `mcp__<server>__<tool>`), plus `model`, `maxTurns`, `permissionMode`,
`cwd`. Custom in-process tools are built with `tool(name, description,
zodRawShape, handler, extras?)` (handler resolves to
`{ content: [{ type:'text', text }] }`) and grouped with
`createSdkMcpServer({ name, version, tools })`, then passed as
`options.mcpServers[name]`.

**Implementation:** `ClaudeAgentDriver` (`src/drivers/claude.ts`) is written
against this surface — an OpsPilot triage system prompt, the five MCP tools from
`src/mcp/tools.ts` wired via `src/mcp/server.ts` (`createSdkMcpServer`), final
JSON answer parsed through `AnalysisResultSchema`. It is **only** loaded via a
dynamic `import('./claude.js')` from `src/drivers/index.ts` on the
`AGENT_DRIVER=claude` branch, so the default (fake) runtime never pulls the SDK
into its module graph and no API call happens at bootstrap. `createDriver()`
throws before any SDK load if `AGENT_DRIVER=claude` without `ANTHROPIC_API_KEY`.
The SDK installed cleanly — no stub/PENDING fallback was needed.

---

## D24 — `agent` compose command: `sh -c "npm install && npm run build && npm run start"` (option b)

**Context:** `start` runs `node dist/main.js`, which needs a prior build. The
`agent` service bind-mounts `./services/agent` and keeps `node_modules` on the
named volume `agent-node-modules`, so the image cannot bake in deps or `dist/`.

**Decision:** The `agent` service `command:` is
`["sh","-c","npm install && npm run build && npm run start"]` (spec option b).
The Dockerfile CMD is left as `["npm","run","start"]` (compose `command`
overrides it). The stale `# NOTE: phase D switches this…` comment was removed and
replaced with a short note about the bind-mount/named-volume install-on-start.

**Rationale:** For a dev stack with bind-mounted source and a fresh (musl)
`node_modules` volume, installing + building on container start is the simplest
correct option and keeps host (glibc) and container (musl) native binaries
separate. `docker compose config` validates (`COMPOSE_OK`).

---

## D25 — Topic exchanges, DLX/DLQ routing, and result-publishing design

**Context:** The agent needs a work queue with dead-lettering and a way to emit
results.

**Decision:** Both `opspilot.events` and `opspilot.dlx` are **topic** exchanges
(durable). The work queue `agent.analysis.requested` is declared with
`x-dead-letter-exchange=opspilot.dlx` and
`x-dead-letter-routing-key=agent.analysis.requested.dlq`; the DLQ is bound to the
DLX with `#`. The consumer `nack(msg, false, false)` (no requeue) on a
non-JSON body, a schema-invalid `AnalysisRequest`, or a driver error — those go
straight to the DLQ and the worker never crashes. On success it publishes the
`AnalysisResult` JSON back to the **same** `opspilot.events` exchange with routing
key `agent.analysis.completed` (`persistent`, `contentType: application/json`,
`correlationId` echoed) and then `ack`s. No queue is bound to
`agent.analysis.completed` yet — phase E adds the Laravel-side consumer;
`assertTopology` deliberately asserts nothing that would fail without one. The
one topology definition lives in
`services/agent/src/messaging/topology.ts` and is documented in
`docs/contracts/messaging.md`; `src/smoke.ts` reuses it.

**Rationale:** Topic exchanges give phase E room to add more routing keys without
re-declaring exchanges; explicit dead-lettering makes bad messages observable
instead of fatal; publishing results on the same exchange keeps one well-known
exchange for the whole OpsPilot event flow.

---

## D26 — Node version conflict fix during scaffolding (npm ERESOLVE / ETARGET)

**Context:** First `npm install` in `services/agent` failed twice.

**Decision:** (1) `ERESOLVE`: `typescript@^7.0.2` vs `typescript-eslint@8.70.0`
peer `typescript <6.1.0` -> pinned `typescript@^5.9.3`. (2) `ETARGET`:
`@eslint/js@^10.10.0` does not exist (that package's latest is `10.0.1`) ->
pinned `@eslint/js@^10.0.1`. After both, `npm install` resolves with no flags,
`npm run build` / `typecheck` / `test` (17 tests) / `lint` all exit 0, the
`agent` container boots to `consumer started`, and the host `npm run smoke`
prints `SMOKE_OK`. No crashloop occurred; no other fixes were needed.

**Rationale:** Recorded per step 12 (dependency conflict fixes).

---

## D27 — Laravel publisher: JSON envelope, never PHP `serialize()`

**Context:** Phase E adds the Laravel side of the messaging contract. Laravel's
own queue/event machinery would serialize PHP objects; the Node agent cannot read
that.

**Decision:** `App\Messaging\AnalysisRequestPublisher` builds the `AnalysisRequest`
as a plain array and encodes it with
`json_encode($request, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES)` — no
`serialize()`, no `Illuminate\Queue` payloads on the wire. The class doc-comment
states this. The `AMQPMessage` is published with `content_type=application/json`,
`delivery_mode=2` (persistent), `message_id`=ticketId, `correlation_id`=the
request UUID, `timestamp`=`time()`, to `opspilot.events` /
`agent.analysis.requested`.

**Rationale:** Enforces DECISIONS D3 (cross-language = JSON only) at the one place
that writes to the bus; keeps the payload debuggable and identical to what
`services/agent`'s Zod `AnalysisRequestSchema` expects.

---

## D28 — `RabbitMqConnection` + publisher bound as container singletons

**Context:** The command (and any future HTTP path) needs an AMQP publisher.
Options were `new` in the command vs. a service-provider binding.

**Decision:** `App\Providers\AppServiceProvider::register()` binds
`RabbitMqConnection` and `AnalysisRequestPublisher` as `singleton`s (config pulled
from `config('opspilot.messaging')`). The command type-hints
`AnalysisRequestPublisher` in `handle()` and lets the container inject it. The
`--wait` reply path deliberately uses a **separate** `new RabbitMqConnection($config)`
(not the singleton) so its temporary consumer channel and explicit `close()` in a
`finally` never interfere with the publisher's connection.

**Rationale:** A single well-known binding is cleaner and testable (the wrapper is
lazy, so constructing it in a unit test opens no socket); the dedicated wait
connection keeps consume/close lifecycles isolated from publish.

---

## D29 — `--wait` uses a temp exclusive/auto-delete reply queue, declared before publish

**Context:** `opspilot:analyze-ticket --wait` must observe the
`agent.analysis.completed` result, but no durable queue is bound to that routing
key (the contract leaves the results side consumer-less until there is a real
consumer). The fake driver answers in milliseconds.

**Decision:** With `--wait` the command declares an anonymous
`exclusive=true, auto_delete=true` queue, binds it to `opspilot.events` /
`agent.analysis.completed`, **then** publishes — so the result cannot be
published into the void before the binding exists (same ordering as
`services/agent/src/smoke.ts`). It then `basic_consume` + `channel->wait()` in a
`microtime()` deadline loop, matching a message on `ticketId` **and**
`correlationId` (AMQP `correlation_id` property or the body field). Match →
print the `AnalysisResult` JSON + `RESULT_OK`, exit 0. Deadline hit →
`RESULT_TIMEOUT`, exit 1. The queue auto-deletes when the command's connection
closes in `finally`.

**Rationale:** Mirrors the proven Node smoke design; no server-side state to clean
up; deterministic pass/fail for CI and humans.

---

## D30 — No `406 PRECONDITION_FAILED`: identical declarations, no fix needed

**Context:** A mismatched exchange/queue redeclare (type, durability, `x-args`)
across the PHP and Node sides returns `406 PRECONDITION_FAILED`.

**Decision:** `RabbitMqConnection::declareTopology()` replicates
`assertTopology()` (`services/agent/src/messaging/topology.ts`) exactly:
`exchange_declare($name,'topic',false,true,false)` for `opspilot.events` and
`opspilot.dlx`; `queue_declare('agent.analysis.requested', false, true, false,
false, false, AMQPTable(['x-dead-letter-exchange'=>'opspilot.dlx',
'x-dead-letter-routing-key'=>'agent.analysis.requested.dlq']))`;
`queue_declare('agent.analysis.requested.dlq', false, true, false, false)` (no
args); bindings `agent.analysis.requested` ← `opspilot.events` /
`agent.analysis.requested` and `agent.analysis.requested.dlq` ← `opspilot.dlx` /
`#`. Active declarations on both sides — no `passive:true` needed. **No 406 was
ever hit**; `npm run smoke` (`SMOKE_OK`) and `opspilot:analyze-ticket T-1001
--wait` (`RESULT_OK`) both pass against the same live broker after the PHP
declarations run.

**Rationale:** "Replicate the identical active declarations" is the simplest safe
approach; passive declares would only add a failure mode if the worker were down.

---

## D31 — Publisher test strategy: pure method, no broker, no mock

**Context:** The Pest suite must stay green offline (no RabbitMQ), per phase B's
sqlite `:memory:` isolation.

**Decision:** Payload validation + JSON encoding live in the pure
`AnalysisRequestPublisher::validate()` / `encode()` methods (no channel I/O; the
`RabbitMqConnection` is lazy so constructing one in a test opens no socket).
`tests/Feature/AnalysisRequestPublisherTest.php` calls `encode()` directly: one
happy-path assertion (valid compact JSON, slashes unescaped, round-trips) and a
data-driven set of six malformed inputs each expected to throw
`InvalidArgumentException`. No AMQP mock, no broker. Full suite: 10 passed
offline.

**Rationale:** Testing a pure method is simpler and less brittle than mocking
`php-amqplib`'s channel; the live-broker behaviour is already covered by the
end-to-end `opspilot:analyze-ticket --wait` smoke.

---

## D32 — Claude Code MCP servers are project-scoped (`.mcp.json`), not user-scoped

**Context:** MCP servers can be registered per-user (`~/.claude.json`) or
per-project (repo-root `.mcp.json`, committed). Phase B's `laravel/boost` already
wrote `apps/api/.mcp.json` for its own Boost server.

**Decision:** Define the repo's MCP servers in a **repo-root, committed
`.mcp.json`** (`laravel-boost`, `context7`, `playwright`). Nothing is written to
`~/.claude.json` or any other user-level file. `.gitignore` was checked — it does
**not** exclude `.mcp.json`, and the file contains no secrets.

**Rationale:** Reproducibility — every clone gets the same three servers with no
per-machine setup. Trade-off: project `.mcp.json` servers require interactive
approval on first use, so `claude mcp list` shows them "⏸ Pending approval" until
someone runs `claude` and approves. That is expected, not a failure.

---

## D33 — Laravel Boost MCP is wrapped in the `php-cli` container

**Context:** There is no PHP on the WSL host (D1). Boost's own
`apps/api/.mcp.json` uses `{"command":"php","args":["artisan","boost:mcp"]}`,
which cannot run from the repo root.

**Decision:** The root `.mcp.json` `laravel-boost` entry is
`{"command":"docker","args":["compose","exec","-T","php-cli","php","artisan","boost:mcp"]}`.
Verified `boost:mcp` exists (`php artisan list` → `boost:mcp  Starts Laravel
Boost (usually from mcp.json)`) without running the long-lived stdio server to
completion.

**Rationale:** Same containerized-tooling rule as everything else; the stack is
always up during development, so `docker compose exec` resolves.

---

## D34 — PostToolUse formatting hook: per-file, non-blocking, no test suite

**Context:** We want changed files auto-formatted, but a hook that blocks or runs
slow suites would make editing painful. The global `~/.claude/settings.json`
already has a `Notification` hook (`notify.sh 'требует твоего внимания'`) and
`Stop` hooks covering "Claude waits for permission / input".

**Decision:** Project `.claude/settings.json` adds **one** `PostToolUse` hook
matching `Edit|Write|MultiEdit` → `.claude/hooks/format-changed.sh`. The script
parses `.tool_input.file_path` from stdin with `python3`, then formats **only
that one file**: Pint for `apps/api/**.php` (only if the `php-cli` container is
running), `prettier --write` for `apps/web` / `services/agent` source files (only
if a local `node_modules/.bin/prettier` exists). It **never runs a test suite**,
**always `exit 0`** (a formatter failure logs one line to stderr and is ignored,
never blocks Claude), and wraps the docker/npx call in `timeout 60`. **No
`Notification` or `Stop` hooks at project level** — the global settings own
those. No `model` / `permissions` / `env` in the project settings.

**Rationale:** Formatting is a convenience, not a gate; the real gates are Pint
`--test` / PHPStan / Pest / vitest / eslint run by `/workflow` and
`opspilot-reviewer`. Per-file keeps it fast and keeps `git status` to at most the
one file that was edited.

---

## D35 — Subagents are read-only (no Edit/Write)

**Context:** `opspilot-architect` and `opspilot-reviewer` advise on significant
changes. Letting them edit the app would blur responsibility and risk
mass-rewrites.

**Decision:** Both agents' `tools:` frontmatter grants **read-only** sets —
`opspilot-architect`: `Read, Grep, Glob, Bash, WebFetch, WebSearch`;
`opspilot-reviewer`: `Read, Grep, Glob, Bash`. Neither has `Edit` or `Write`.
`Bash` is for read-only inspection and running the test/lint/static-analysis
gates. `opspilot-architect` returns a written recommendation with trade-offs (not
a diff); `opspilot-reviewer` returns a severity-labeled findings list
(blocker / should-fix / nit). **The main agent decides what to act on** and does
the integration.

**Rationale:** Clear separation — analysis and review inform, the main agent
implements. Prevents an agent from silently reshaping the codebase.

---

## D36 — `/workflow` skill vs the built-in `Workflow` tool

**Context:** Claude Code ships a built-in `Workflow` tool (multi-agent
orchestration). This repo also wants a lightweight "run one plan file" command.

**Decision:** The project skill `.claude/skills/workflow/SKILL.md` implements
`/workflow docs/plans/XX-name.md` as a **single-plan executor** run by the main
agent in the current session: read the plan → study the code → todo list → make
the change → **run the area's checks until green** → invoke
`opspilot-architect` / `opspilot-reviewer` if the change is significant → update
`docs/STATUS.md` → compact report. It is explicitly **not** the built-in
`Workflow` tool. Project scope wins, so `/workflow` in this repo means the skill;
the built-in orchestrator is still reachable by calling the `Workflow` tool by
name. No global skill named `workflow` exists (`~/.claude/skills` holds only
find-skills, git-commit, graphify), so there is no clash.

**Rationale:** Most changes here are one plan file at a time; a full
orchestration run is overkill. The skill encodes the repo's real gates so
"done" always means "checks passed", not "code written".

---

## D37 — `web` compose service installs its npm deps on start

**Context (phase G, clean-rebuild verification):** `docker compose down -v` wipes
the `web-node-modules` named volume. The `web` service's `command` was
`["npm", "run", "dev", "--", "--host", "0.0.0.0"]` — no install step — so on the
next `up` the container ran `vite` with an empty `node_modules`, printed
`sh: vite: not found`, and **Exited (127)**. The documented
`docker compose exec web npm install` could not run because the container was
already gone. A fresh developer following the README got a dead web container.

**Decision:** The `web` service `command` is now
`["sh", "-c", "npm install && npm run dev -- --host 0.0.0.0"]`, mirroring the
`agent` service (D24). Source is bind-mounted, `node_modules` is on a named
volume, so deps install on first boot and are cached thereafter. No manual
`npm install` step is needed.

**Rationale:** Makes "clone + `cp .env.example .env` + `docker compose up -d
--build` + documented commands => working stack" literally true, and keeps `web`
and `agent` consistent.

---

## D38 — `APP_KEY` lives only in `apps/api/.env`, never in the root `.env`

**Context:** D13 populated the root `.env` `APP_KEY` because Compose injects the
root `.env` into the PHP containers via `env_file:` and Laravel's dotenv loader
will not override a real env var — so a **blank** root `APP_KEY` shadows whatever
`php artisan key:generate` writes to `apps/api/.env`. That made first-time setup
fragile: `key:generate` appeared to succeed but `config('app.key')` stayed empty,
or the documented step degraded to `key:generate --show` + hand-copying the value
into the root `.env` + recreating containers.

**Decision:** Remove the `APP_KEY` line from the root `.env` / `.env.example`
entirely (a comment there explains why). Compose then injects **no** `APP_KEY`,
so Laravel reads it normally from `apps/api/.env`, which is created from
`apps/api/.env.example` and filled by `php artisan key:generate` during setup.
Root `.env` still owns every infra value (DB/Redis/RabbitMQ/ports/driver).

**Rationale:** `key:generate` now works with zero ceremony and **no container
recreation**, which also sidesteps D40's nginx-upstream problem during setup.
`apps/api/.env` is gitignored; the key is never committed. Supersedes D13.

---

## D39 — PHP `memory_limit` raised to 512M in the image

**Context:** On a cold PHPStan result cache (fresh `composer install`, no
`.phpunit.cache`/phpstan tmp), `./vendor/bin/phpstan analyse` crashed:
`Child process error: PHPStan process crashed because it reached configured PHP
memory limit: 128M`. The base `php:8.4-fpm` image ships the stock 128M and the
project had no custom ini. Part 1 only passed earlier because the cache was warm.

**Decision:** Add `docker/php/conf.d/zz-opspilot.ini` with `memory_limit = 512M`,
`COPY`d into `/usr/local/etc/php/conf.d/` in `docker/php/Dockerfile` (applies to
both `php-fpm` and `php-cli`). Preferred over passing `--memory-limit` on every
phpstan invocation (which the hook, skills, and docs would all have to carry).

**Rationale:** One image-level setting fixes phpstan permanently and also gives
Composer / heavier artisan commands headroom. 512M is comfortably above what
Larastan level 5 needs on this codebase and still bounded.

---

## D40 — nginx re-resolves the `php-fpm` upstream per request

**Context:** `fastcgi_pass php-fpm:9000;` makes nginx resolve the service name
**once** at config load and cache the IP for the worker's life. Any time
`php-fpm` is recreated with a new container IP — `docker compose up -d` after an
`.env` edit, `docker compose build php-fpm && up -d`, etc. — nginx keeps dialing
the dead IP and every request is **502 Bad Gateway** until nginx is also
recreated. Hit repeatedly during phase G.

**Decision:** In `docker/nginx/default.conf`, use Docker's embedded DNS and a
variable so the name is re-resolved at request time:

```
resolver 127.0.0.11 valid=10s ipv6=off;
set $upstream_php php-fpm:9000;
fastcgi_pass $upstream_php;
```

**Rationale:** nginx now survives `php-fpm` restarts/recreations on its own
(verified: recreate `php-fpm` alone, health stays 200). Removes a setup footgun.
The `valid=10s` TTL is fine for a dev stack.

## D41 — Web UI: Tailwind CSS v4 + shadcn-vue (`new-york` / `neutral`)

**Context:** `apps/web` shipped with the create-vue scaffold CSS only. Building
the ticket / proposal UI needs a utility CSS layer and an accessible component
kit. Root `CLAUDE.md` mandates Composition API + TS strict; components must stay
editable in-repo, not hidden behind a dependency.

**Decision:**

- **Tailwind CSS v4** through the `@tailwindcss/vite` plugin — **no
  `tailwind.config.js`**. `src/assets/main.css` holds `@import "tailwindcss"`,
  `tw-animate-css`, the `@theme inline` token map, and the light/`.dark`
  `neutral` palette. The create-vue `base.css` stays for now, imported after
  Tailwind. (Update, landing-page phase 3: `HomeView.vue` — the only consumer of
  `base.css`'s `--color-*` vars — was removed, so `base.css` is now unused; left
  in place, safe to delete later.)
- **shadcn-vue** (`components.json`: style `new-york`, base color `neutral`,
  `cssVariables`, `iconLibrary` `lucide`). Runtime deps: `reka-ui`,
  `class-variance-authority`, `clsx`, `tailwind-merge`. `cn()` in
  `src/lib/utils.ts`.
- Components are **vendored** under `src/components/ui/<name>/` and edited in
  place. Add with `docker compose exec web npx shadcn-vue@latest add <name>`.
  `src/components/ui/**` is exempt from `vue/multi-word-component-names` in
  `eslint.config.ts`; Prettier rewrites generated files to the repo style.
- Icons: **`@lucide/vue`** (current shadcn-vue package; `lucide-vue-next`
  resolves to a deprecated `1.0.0` tombstone — do not use it).
- Path aliases: **`paths` only, no `baseUrl`** in `tsconfig*.json` — TS 6
  (`typescript ~6.0.0`) errors `TS5101` on `baseUrl`. `@` still resolves via
  Vite `resolve.alias`.

**Consequences / gotchas:**

- The `web` container runs as **root**; files the shadcn-vue CLI writes are
  `0:0` — `chown -R 1000:1000` them so host git / editor / hooks can touch
  them.
- `vitest.config.ts` merges `vite.config.ts`, so the `tailwindcss()` plugin also
  loads under Vitest (harmless).
- Gates stay green: `npm run lint` + `type-check` + `test` (9 / 2 files) +
  `build`.
