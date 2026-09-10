# OpsPilot

OpsPilot is an **operations assistant**. Incoming support tickets are analyzed by
a Claude-powered agent that **proposes** actions (categorize, prioritize,
summarize, suggest a fix). A human always approves or rejects the proposal —
nothing risky happens automatically.

## Architecture

```
                +-------------------+
                |   Web (Vue 3)     |
                |   apps/web        |
                +---------+---------+
                          | HTTP (Axios, /api proxied by Vite)
                          v
                +-------------------+        +-----------------+
                |   API (Laravel)   +------->+  MySQL / Redis  |
                |   apps/api        |        +-----------------+
                +---------+---------+
                          | publish JSON: agent.analysis.requested
                          v
                +-------------------+
                |     RabbitMQ      |   exchange: opspilot.events
                |                   |   DLX: opspilot.dlx
                +---------+---------+
                          | consume
                          v
                +-------------------+
                | Agent Runtime     |   services/agent (Node + TS)
                | worker            |
                +---------+---------+
                          |
                 +--------+--------+
                 |                 |
                 v                 v
         +---------------+  +-----------------+
         | FakeAgentDrv  |  | ClaudeAgentDrv  |  (only if AGENT_DRIVER=claude)
         | (default)     |  |                 |
         +-------+-------+  +--------+--------+
                 |                   |
                 +---------+---------+
                           | MCP tools only
                           v
                +---------------------------+
                | Laravel Internal API      |  validation -> authz -> MySQL
                +---------------------------+
```

- `apps/api` — Laravel 13 API (health endpoint, Sanctum, Pest, Larastan, Pint,
  Boost, `php-amqplib`, the `opspilot:analyze-ticket` command).
- `apps/web` — Vue 3 + TypeScript app (start page with a live backend health
  indicator).
- `services/agent` — standalone Node + TypeScript worker. Consumes
  `AnalysisRequest` messages, runs the active driver, publishes `AnalysisResult`.
  `FakeAgentDriver` is the default and makes no API calls.

## Requirements

- **Docker Desktop + WSL2**. That's it.
- PHP, Composer, and Node tooling are **containerized** — nothing is installed on
  the host.

## Quickstart

Clone, then bring the stack up and run first-time setup **exactly** in this
order:

```bash
git clone <repo> && cd opspilot

# 1. Root env for Docker Compose (infra creds, ports, driver selection).
cp .env.example .env

# 2. Build images and start every service.
docker compose up -d --build          # wait until mysql/redis/rabbitmq are (healthy)

# 3. PHP dependencies (vendor/ is gitignored, so a fresh clone has none).
docker compose exec -T php-cli composer install

# 4. Laravel env + app key. The key MUST live in apps/api/.env, not the root
#    .env (Compose injects the root .env into the PHP containers and Laravel
#    will not override a real env var, so a blank root APP_KEY would shadow it).
cp apps/api/.env.example apps/api/.env
docker compose exec -T php-cli php artisan key:generate

# 5. Database schema.
docker compose exec -T php-cli php artisan migrate --force
```

The `web` and `agent` containers install their own npm dependencies on start
(source is bind-mounted, `node_modules` lives on a named volume), so no manual
`npm install` is needed. First boot takes a minute while they install.

Verify:

```bash
curl -s http://localhost:8080/api/health          # {"status":"ok",...,"checks":{"database":"ok","redis":"ok"}}
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/   # 200
```

That is the whole contract: **clone + `cp .env.example .env` + `docker compose up
-d --build` + the five commands above => working stack.**

## Start / Stop

```bash
docker compose up -d --build     # start (build images if needed)
docker compose down              # stop, keep data volumes
docker compose down -v           # stop and WIPE data volumes (mysql, redis,
                                 # rabbitmq, and the web/agent node_modules)
```

After `docker compose down -v` the database is empty again — re-run steps 4–5
from the Quickstart (`apps/api/.env` survives on the host, so if it still has a
valid `APP_KEY` you only need `migrate --force`).

## Migrations

```bash
docker compose exec -T php-cli php artisan migrate --force
docker compose exec -T php-cli php artisan migrate:status
docker compose exec -T php-cli php artisan migrate:fresh --seed
```

## Tests

All three suites, run from the repo root:

```bash
# API — Laravel / Pest / Larastan / Pint
docker compose exec -T php-cli ./vendor/bin/pest
docker compose exec -T php-cli ./vendor/bin/phpstan analyse --no-progress
docker compose exec -T php-cli ./vendor/bin/pint --test

# Web — Vitest / build / lint (run on the host, in apps/web)
cd apps/web && npm run build && npm run test && npm run lint

# Agent Runtime — build / typecheck / test / lint (on the host, in services/agent)
cd services/agent && npm run build && npm run typecheck && npm run test && npm run lint
```

The web and agent suites also run inside their containers
(`docker compose exec -T web npm run test`,
`docker compose exec -T agent npm test`).

## URLs

| Service              | URL                                              |
| ------------------- | ------------------------------------------------ |
| API                 | http://localhost:8080                            |
| Web                 | http://localhost:5173                            |
| RabbitMQ Management  | http://localhost:15672 — user `opspilot`, pass `opspilot` |

## Messaging / send a test analysis request

The Laravel API and the Node Agent Runtime share one RabbitMQ topology
(`docs/contracts/messaging.md`). Publish an `AnalysisRequest` and block for the
agent's result:

```bash
docker compose exec -T php-cli php artisan opspilot:analyze-ticket T-1001 --wait --timeout=20
```

It prints the published request JSON, then (with `--wait`) the `AnalysisResult`
JSON and `RESULT_OK` once the running `agent` container has processed it. Drop
`--wait` to publish and return immediately; `--source=` and `--timeout=` are
optional. In dev, do **not** run `php artisan config:cache` — it would freeze the
`RABBITMQ_*` / `OPSPILOT_*` env values.

Inspect the queues in the RabbitMQ Management UI at <http://localhost:15672>
(`opspilot` / `opspilot`). The work queue `agent.analysis.requested` is
dead-lettered to `agent.analysis.requested.dlq` via the `opspilot.dlx` exchange;
malformed or unprocessable messages land there.

## Fake agent

The Agent Runtime uses `FakeAgentDriver` (`AGENT_DRIVER=fake`, the default). It
returns a **deterministic** response and makes **no API calls**:

```json
{ "category": "backend", "priority": "medium", "summary": "Fake agent analysis completed", "driver": "fake" }
```

This keeps the whole stack runnable and testable without any Claude credentials.

## Enabling ClaudeAgentDriver later

`ClaudeAgentDriver` is written against `@anthropic-ai/claude-agent-sdk` and is
present but never executed while `AGENT_DRIVER=fake`. To switch it on, set both
of these in the **root `.env`** (never commit real keys — `.env` is gitignored):

```
AGENT_DRIVER=claude
ANTHROPIC_API_KEY=          # your real key here, it starts with sk-ant-
```

Then `docker compose up -d agent`. With `AGENT_DRIVER=fake` (default),
`ANTHROPIC_API_KEY` is not needed and is never read; the config layer fails fast
if `AGENT_DRIVER=claude` and the key is missing.

## MCP servers

Configured in the repo-root, committed `.mcp.json` (no secrets):

| Server | For | Command |
| --- | --- | --- |
| **laravel-boost** | Laravel & first-party package docs / version facts — consult before any Laravel API work | `docker compose exec -T php-cli php artisan boost:mcp` (no host PHP, so it runs in the container) |
| **context7** | Documentation for external libraries (`@upstash/context7-mcp`) | `npx -y @upstash/context7-mcp` |
| **playwright** | Manual browser smoke checks (`@playwright/mcp`) — not a substitute for automated tests | `npx -y @playwright/mcp@latest` |

Project-scoped MCP servers need **interactive approval on first use** — run
`claude` in the repo and approve when prompted. `claude mcp list` shows them as
"⏸ Pending approval" until then; that is expected, not a failure.

Playwright needs a browser binary once per machine. Chromium was installed during
bootstrap (`~/.cache/ms-playwright`, ~659 MB). To (re)install it:

```bash
npx playwright install chromium
```

## Skills & subagents

Phased plans live in `docs/plans/` (see `docs/plans/README.md` for the template).
Drive one with:

```
/workflow docs/plans/XX-name.md
```

`/workflow` (project skill, `.claude/skills/workflow/SKILL.md`) reads the plan,
studies the code, makes the change, **runs the area's checks until they pass**,
invokes a subagent when the change is significant, and updates `docs/STATUS.md`.
"A step is not done just because code was written."

Task-specific skills (`.claude/skills/<name>/SKILL.md`): `opspilot-backend`,
`opspilot-vue`, `opspilot-messaging`, `opspilot-agent-runtime`.

Subagents (`.claude/agents/*.md`, read-only, advisory): **`opspilot-architect`**
— run before a broad design / contract / topology change; **`opspilot-reviewer`**
— run after a significant change. Both report back; the main agent decides what
to act on.

## Docs

| File | What |
| --- | --- |
| `docs/SETUP.md` | Detailed step-by-step onboarding + common issues |
| `docs/STATUS.md` | What is DONE / PENDING / BLOCKED |
| `docs/ENVIRONMENT.md` | Detected host facts, toolchain versions, host ports |
| `docs/DECISIONS.md` | Numbered decision log (D1…) |
| `docs/SPEC.md` | Product spec |
| `docs/contracts/messaging.md` | The RabbitMQ message contract |
