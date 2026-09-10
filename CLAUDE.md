# OpsPilot — Project Guide (for Claude)

OpsPilot is an operations assistant. Incoming support tickets are analyzed by a
Claude-powered agent that **proposes** actions; humans approve or reject them.

---

## Architecture overview

Three application components plus three infrastructure services, all containerized
and orchestrated by Docker Compose. Nothing runs on the WSL host directly.

**Applications**

| Component          | Path             | Stack                                   |
| ----------------- | ---------------- | --------------------------------------- |
| API               | `apps/api`       | Laravel (PHP 8.4, `php-fpm` + `nginx`)  |
| Web               | `apps/web`       | Vue 3 + TypeScript + Vite               |
| Agent Runtime     | `services/agent` | Node.js + TypeScript worker             |

**Infrastructure**

| Service   | Image                          | Purpose                          |
| --------- | ------------------------------ | -------------------------------- |
| MySQL     | `mysql:8.0`                    | Primary datastore               |
| Redis     | `redis:7-alpine`              | Cache, sessions, queues         |
| RabbitMQ  | `rabbitmq:3-management-alpine` | Message bus (PHP <-> Node)      |

Message flow: **web -> api -> mysql/redis**; **api -> rabbitmq -> agent worker
-> (fake|claude) driver -> MCP tools -> api internal endpoints**.

All three application components are in place and the stack is fully runnable
(phases A–G complete). See `docs/STATUS.md` for what is DONE vs PENDING and
`docs/SETUP.md` for first-time setup.

---

## Directory structure

```
OpsPilot/
├── apps/
│   ├── api/                 # Laravel API            (phase B)
│   └── web/                 # Vue 3 web app          (phase C)
├── services/
│   └── agent/               # Node + TS Agent Runtime (phase D)
├── docker/
│   ├── nginx/default.conf   # nginx -> php-fpm vhost (re-resolving upstream)
│   ├── php/Dockerfile       # php:8.4-fpm + extensions + composer
│   ├── php/conf.d/          # zz-opspilot.ini (memory_limit=512M for PHPStan)
│   ├── web/Dockerfile       # node:22-alpine (vite dev server)
│   └── agent/Dockerfile     # node:22-alpine (worker)
├── docs/
│   ├── SPEC.md              # product + message-flow spec
│   ├── ENVIRONMENT.md       # detected host env + decisions
│   ├── STATUS.md            # phase board
│   ├── DECISIONS.md         # ADR log
│   ├── plans/               # /workflow plan files
│   └── contracts/           # API / message contracts
├── docker-compose.yml
├── .env.example
├── CLAUDE.md                # this file
└── README.md
```

---

## Core commands

```bash
# Bring the stack up / rebuild images
docker compose up -d --build

# Stop the stack   (add -v to also wipe data volumes)
docker compose down
docker compose down -v

# PHP / Laravel tooling — always inside php-cli
docker compose exec php-cli composer <args>
docker compose exec php-cli php artisan <args>
docker compose exec php-cli ./vendor/bin/pest

# Web tooling
docker compose exec web npm run <script>

# Agent Runtime tooling
docker compose exec agent npm run <script>
```

---

## Before changing Laravel

=> **Consult the Laravel Boost MCP first.** Query it for the installed Laravel
version and package APIs before touching any Laravel code or any installed
package's API. Do not guess framework APIs.

## Before using an unknown API

=> **Check docs via the right MCP / official source first.**
- Laravel & first-party Laravel packages -> **Laravel Boost**
- External libraries (PHP, JS, anything on a registry) -> **Context7**
- Never invent method names, config keys, or signatures.

---

## Laravel rules (`apps/api`)

- Consult **Laravel Boost** before touching Laravel or any installed package API.
- Format with **Pint** (`./vendor/bin/pint`). CI runs `pint --test`.
- Tests are written in **Pest**.
- Static analysis: **PHPStan / Larastan** enabled — keep it clean.
- All commands run in the `php-cli` container.

## Vue rules (`apps/web`)

- **TypeScript strict** mode.
- **Composition API** only (`<script setup lang="ts">`).
- State via **Pinia** stores; routing via **Vue Router**; HTTP via **Axios**.
- Lint/format: **ESLint + Prettier**.
- Tests: **Vitest**.

## RabbitMQ conventions

- Messages are **JSON only**. NEVER PHP-serialize payloads between PHP and Node.
- Exchange: `opspilot.events`
- Queue / routing key: `agent.analysis.requested`
- Dead-letter exchange: `opspilot.dlx`
- Dead-letter queue: `agent.analysis.requested.dlq`
- Consumers must be **idempotent** (safe to process the same message twice).

## Agent Runtime conventions (`services/agent`)

- `AgentDriver` abstraction with two implementations: `FakeAgentDriver` and
  `ClaudeAgentDriver`.
- `AGENT_DRIVER=fake` is the **default and the only active driver during
  bootstrap**. `FakeAgentDriver` returns a deterministic
  `{category, priority, summary}` object and makes **no API calls**.
- **No Claude API calls** unless `AGENT_DRIVER=claude` **and** `ANTHROPIC_API_KEY`
  are both set.
- The agent has **no shell** and **no filesystem access**.
- The agent reaches business data **only** via:
  MCP tool -> Laravel Internal API -> validation -> authorization / business rules
  -> MySQL.
- `propose_action` creates a proposal record and **never auto-executes** a risky
  change. A human approves or rejects.

---

## Testing requirements

| Component | Must pass                                                        |
| --------- | --------------------------------------------------------------- |
| api       | `pest` green **+** `phpstan` clean **+** `pint --test`          |
| web       | `vitest` **+** `eslint` **+** `build`                           |
| agent     | its test script **+** typecheck                                 |

---

## Env / APP_KEY

- The **root `.env`** (Compose `env_file:`) owns infra values and is injected as
  real env vars into the PHP containers. It has **no `APP_KEY`** on purpose — a
  blank one there would shadow the real key (DECISIONS D38).
- `APP_KEY` lives in **`apps/api/.env`**, created from `apps/api/.env.example`
  and filled by `php artisan key:generate` during setup. Both `.env` files are
  gitignored.

## Security rules

- Never read or print secrets. Never echo `.env` contents.
- Never commit `.env` (only `.env.example`, with demo values).
- Do not enable the Claude API without an explicit, stated need.
- The agent gets business data only through the Laravel Internal API — no direct
  DB access, no shell, no filesystem.
- `propose_action` never auto-executes risky changes.

---

## Claude Code assets

Project-scoped, committed, at the repo root:

- `.claude/skills/` — `workflow`, `opspilot-backend`, `opspilot-vue`,
  `opspilot-messaging`, `opspilot-agent-runtime`.
- `.claude/agents/` — `opspilot-architect`, `opspilot-reviewer` (both read-only).
- `.claude/settings.json` — one `PostToolUse` hook →
  `.claude/hooks/format-changed.sh` (per-file formatter, non-blocking, never runs
  tests). Notifications for "Claude waits for input" are handled by the global
  `~/.claude/settings.json`, not here.
- `.mcp.json` — `laravel-boost` (wrapped in `php-cli`), `context7`, `playwright`.
  First use in a session prompts for approval.

Working rules:

- Use **`opspilot-architect`** before a big design / contract / topology change
  (analysis only), and **`opspilot-reviewer`** after any significant change
  (findings only — the main agent decides what to fix).
- Use **`/workflow docs/plans/XX-name.md`** to execute a plan file; a step is
  done only when its checks pass.
- Consult the **Laravel Boost MCP** before any Laravel or first-party-package API
  work; **Context7** for other external libraries.

## MCP usage

- **Laravel Boost** — Laravel & first-party package docs / version facts.
- **Context7** — external library documentation.
- **Playwright** — manual browser smoke checks only. NOT a replacement for
  automated tests.

## Skill usage

- `/workflow docs/plans/XX-name.md` — drive a phased plan file.
- `opspilot-backend` — Laravel / API work.
- `opspilot-vue` — Vue / web work.
- `opspilot-messaging` — RabbitMQ topology & messaging.
- `opspilot-agent-runtime` — Node agent worker & drivers.

## Subagent usage

- `opspilot-architect` — analyzes architecture, contracts, and topology. Mostly
  read-only; does not mutate the project.
- `opspilot-reviewer` — reviews significant changes.
- The **main agent** decides what to fix and does final integration.

---

## Do NOT

- No arbitrary destructive DB operations.
- No deleting migrations or data without a stated reason.
- No `git reset --hard`.
- No force push.
- No reading or printing secrets.
- Never commit `.env`.
- Do not enable the Claude API without explicit need.
