# 00 — Bootstrap (retrospective record)

## Goal
Stand up the OpsPilot monorepo: containerized stack, three application
components, the PHP↔Node messaging spine, and the Claude Code tooling — all
runnable and testable with **no Claude credentials** (fake agent driver).

## Context
Touches everything: `docker/`, `apps/api`, `apps/web`, `services/agent`, `docs/`,
and the repo-root `.claude/` + `.mcp.json`. Source of truth for decisions is
`docs/DECISIONS.md` (D1–D31); message contract is `docs/contracts/messaging.md`.
This file is a record, not a to-do — most of it is already DONE (see
`docs/STATUS.md`).

## Steps (phases)
- **A — infra.** `docker-compose.yml` (nginx, php-fpm, php-cli, web, mysql,
  redis, rabbitmq, agent); Dockerfiles under `docker/`; `.env.example`;
  `.gitignore`; root `CLAUDE.md` / `README.md`; docs skeletons. **DONE**
- **B — Laravel API (`apps/api`).** Laravel 13.31 on PHP 8.4; MySQL + Redis
  verified; Sanctum, Pest, Larastan (level 5), Pint, `laravel/boost`,
  `php-amqplib`; `GET /api/health`; test DB sqlite `:memory:`. **DONE**
- **C — Vue app (`apps/web`).** `create-vue` scaffold: Vue 3.5, Vite 8, Router,
  Pinia, Vitest; axios instance `src/lib/http.ts` (baseURL `/api`); start page
  with a live backend indicator; Vite `/api` proxy → nginx. **DONE**
- **D — Agent Runtime (`services/agent`).** Node 22 + TS ESM worker; Zod config
  + contracts; `AgentDriver` with active `FakeAgentDriver` + inert
  `ClaudeAgentDriver`; 5 MCP tool stubs; consumer + shared topology; smoke
  (`SMOKE_OK`). **DONE**
- **E — Laravel messaging spine.** `App\Messaging\RabbitMqConnection` +
  `AnalysisRequestPublisher` (JSON only); `config/opspilot.php`;
  `php artisan opspilot:analyze-ticket {id} --wait`; identical topology both
  sides (no `406`); end-to-end `RESULT_OK`. **DONE**
- **F — Claude Code assets (this phase).** Repo-root `.claude/`: 5 skills
  (`workflow`, `opspilot-backend`, `opspilot-vue`, `opspilot-messaging`,
  `opspilot-agent-runtime`), 2 subagents (`opspilot-architect`,
  `opspilot-reviewer`), 1 non-blocking per-file formatting hook
  (`PostToolUse` → `.claude/hooks/format-changed.sh`), and `.mcp.json`
  (laravel-boost via container, context7, playwright). **DONE** — see
  `docs/DECISIONS.md` D32–D36. Playwright browsers installed; MCP servers show
  "pending approval" until first interactive use.
- **G — Full-stack smoke tests.** End-to-end scenarios across web → api →
  rabbitmq → agent → internal API. **PENDING**

## Checks
- `docker compose config >/dev/null` — compose valid.
- `docker compose exec -T php-cli ./vendor/bin/pest` — green.
- `cd services/agent && npm run test` — green; `npm run smoke` → `SMOKE_OK`.
- `cd apps/web && npm run build && npm run test && npm run lint` — exit 0.
- `docker compose exec -T php-cli php artisan opspilot:analyze-ticket T-1001 --wait`
  → `RESULT_OK`.
- `python3 -c "import json;json.load(open('.mcp.json'))"` and same for
  `.claude/settings.json`.

## Done-criteria
- Stack boots; health endpoint 200; fake driver round-trips a message.
- All per-area gates green.
- Phases A–F marked DONE in `docs/STATUS.md`; G still pending.
