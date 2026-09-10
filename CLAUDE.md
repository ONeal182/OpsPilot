# OpsPilot — Project Guide (for Claude)

## We work TDD

- **Tests first, then code.** Write a failing test before the implementation.
- Red → green → refactor.
- **A task is done only when every test is green** (plus the per-component
  static-analysis / lint / build gates below). No green suite → not done.
- **Every code change updates the docs in the same change.** Touch the relevant
  file(s) under `docs/` (`STATUS.md`, `SPEC.md`, `DECISIONS.md`,
  `docs/contracts/`, plan files) and any affected `CLAUDE.md` / `README.md` /
  skill so behaviour and docs never drift. A change with stale docs is not done.

---

OpsPilot is an operations assistant. Support tickets are analyzed by a
Claude-powered agent that **proposes** actions; humans approve or reject them.

## Architecture

Containerized, orchestrated by Docker Compose. Nothing runs on the WSL host.

**Applications**

| Component     | Path             | Stack                                  |
| ------------- | ---------------- | -------------------------------------- |
| API           | `apps/api`       | Laravel (PHP 8.4, `php-fpm` + `nginx`) |
| Web           | `apps/web`       | Vue 3 + TypeScript + Vite             |
| Agent Runtime | `services/agent` | Node.js + TypeScript worker           |

**Infrastructure**: MySQL `mysql:8.0` (datastore) · Redis `redis:7-alpine`
(cache, sessions, queues) · RabbitMQ `rabbitmq:3-management-alpine` (PHP ↔ Node
bus).

Message flow: **web → api → mysql/redis**; **api → rabbitmq → agent worker →
(fake|claude) driver → MCP tools → api internal endpoints**.

Stack is fully runnable (phases A–G complete). `docs/STATUS.md` = DONE vs
PENDING; `docs/SETUP.md` = first-time setup; `docs/SPEC.md`, `docs/DECISIONS.md`
(ADR log), `docs/contracts/` (API / message contracts), `docs/plans/`
(`/workflow` files). Docker: `docker/{nginx,php,web,agent}` (php conf.d sets
`memory_limit=512M` for PHPStan).

## Core commands

```bash
docker compose up -d --build          # up / rebuild
docker compose down [-v]              # stop (-v also wipes data volumes)

docker compose exec php-cli composer <args>
docker compose exec php-cli php artisan <args>
docker compose exec php-cli ./vendor/bin/pest
docker compose exec web npm run <script>
docker compose exec agent npm run <script>
```

## Docs-first (never guess an API)

- Laravel & first-party Laravel packages → **Laravel Boost MCP**. Query it for
  the installed version and package APIs *before* touching any Laravel code.
- Other external libraries (any registry) → **Context7**.
- Never invent method names, config keys, or signatures.

## Component rules

**Laravel (`apps/api`)** — commands run in `php-cli`. Format with **Pint**
(`./vendor/bin/pint`; CI runs `pint --test`). Tests in **Pest**. **PHPStan /
Larastan** must stay clean.

**Vue (`apps/web`)** — **TypeScript strict**. **Composition API** only
(`<script setup lang="ts">`). **Pinia** state, **Vue Router**, **Axios**.
**ESLint + Prettier**. Tests in **Vitest**.

**RabbitMQ** — payloads are **JSON only**, never PHP-serialize between PHP and
Node. Exchange `opspilot.events`; queue / routing key
`agent.analysis.requested`; DLX `opspilot.dlx`; DLQ
`agent.analysis.requested.dlq`. Consumers must be **idempotent**.

**Agent Runtime (`services/agent`)**

- `AgentDriver` abstraction: `FakeAgentDriver` + `ClaudeAgentDriver`.
- `AGENT_DRIVER=fake` is the default and only active driver during bootstrap —
  deterministic `{category, priority, summary}`, **no API calls**.
- **No Claude API calls** unless `AGENT_DRIVER=claude` **and**
  `ANTHROPIC_API_KEY` are both set.
- Agent has **no shell, no filesystem**. Business data only via:
  MCP tool → Laravel Internal API → validation → authz / business rules → MySQL.
- `propose_action` creates a proposal record and **never auto-executes** a risky
  change — a human approves or rejects.

## Test / gate requirements

| Component | Must pass                                              |
| --------- | ----------------------------------------------------- |
| api       | `pest` green **+** `phpstan` clean **+** `pint --test` |
| web       | `vitest` **+** `eslint` **+** `build`                 |
| agent     | test script **+** typecheck                           |

## Env / APP_KEY

- Root `.env` (Compose `env_file:`) owns infra values, injected as real env vars
  into PHP containers. It has **no `APP_KEY`** on purpose — a blank one there
  shadows the real key (DECISIONS D38).
- `APP_KEY` lives in `apps/api/.env` (from `apps/api/.env.example`, filled by
  `php artisan key:generate` at setup). Both `.env` files are gitignored.

## Security

- Never read or print secrets; never echo `.env`. Never commit `.env` (only
  `.env.example` with demo values).
- Do not enable the Claude API without an explicit, stated need.
- Agent reaches business data only through the Laravel Internal API — no direct
  DB, no shell, no filesystem.
- `propose_action` never auto-executes risky changes.

## Claude Code assets (project-scoped, committed)

- `.claude/skills/` — `workflow`, `opspilot-backend` (Laravel/API),
  `opspilot-vue` (Vue/web), `opspilot-messaging` (RabbitMQ topology),
  `opspilot-agent-runtime` (Node worker & drivers), `tdd`.
- `.claude/agents/` — `opspilot-architect` (design/contract/topology analysis,
  read-only) before a big change; `opspilot-reviewer` (findings only) after any
  significant change. The **main agent** decides what to fix and does final
  integration.
- `.claude/settings.json` — one `PostToolUse` hook →
  `.claude/hooks/format-changed.sh` (per-file formatter, non-blocking, never
  runs tests).
- `.mcp.json` — `laravel-boost` (wrapped in `php-cli`), `context7`,
  `playwright` (manual browser smoke only — not a replacement for automated
  tests). First use per session prompts for approval.
- `/workflow docs/plans/XX-name.md` drives a phased plan file; a step is done
  only when its checks pass.

## Do NOT

- No arbitrary / destructive DB operations; no deleting migrations or data
  without a stated reason.
- No `git reset --hard`, no force push.
- No reading or printing secrets; never commit `.env`.
- Do not enable the Claude API without explicit need.
