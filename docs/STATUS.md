# OpsPilot — Status Board

Last updated: landing-page feature (phases 1–3) — `/` landing view, `/login`
stub, docs synced. Baseline below is phase G (smoke tests, clean-rebuild
verification, docs finalization).
Everything under DONE was **re-verified on a freshly rebuilt stack** — `docker
compose down -v` then a clone-equivalent bring-up (`cp .env.example .env` +
`docker compose up -d --build` + the five documented setup commands).

## DONE

### Infrastructure

- [x] **Compose stack up, all 8 services** — `docker compose ps`: nginx, php-fpm,
      php-cli, web, mysql, redis, rabbitmq, agent all `Up`; mysql / redis /
      rabbitmq `(healthy)`.
- [x] **Dockerfiles** — `docker/php/Dockerfile` (+ `docker/php/conf.d/zz-opspilot.ini`,
      `memory_limit=512M`), `docker/nginx/default.conf` (re-resolving `php-fpm`
      upstream), `docker/web/Dockerfile`, `docker/agent/Dockerfile`.
- [x] **Clean-rebuild reproducibility** — from committed files + `.env.example`
      only: `cp .env.example .env` → `docker compose up -d --build` →
      `composer install` → `cp apps/api/.env.example apps/api/.env` +
      `php artisan key:generate` → `php artisan migrate --force` ⇒ fully passing
      stack. Verified twice end-to-end. `web` + `agent` self-install npm deps on
      boot.

### API (`apps/api`) — Laravel 13.31 / PHP 8.4.25

- [x] **Health endpoint** — `curl http://localhost:8080/api/health` → HTTP 200,
      `{"status":"ok","service":"opspilot-api","checks":{"database":"ok","redis":"ok"}}`.
      Also 200 through the Vite proxy (`http://localhost:5173/api/health`).
- [x] **MySQL** — `php artisan migrate:status` all 4 migrations `Ran`;
      `mysql -uopspilot -popspilot -e "SELECT 1" opspilot` → `1`.
- [x] **Redis** — `Cache::put/get` via phpredis → `ok`; `redis-cli SET/GET` → `ok`.
- [x] **Test gates, all clean** —
      `./vendor/bin/pest` → 10 passed (21 assertions);
      `./vendor/bin/phpstan analyse --no-progress` → `[OK] No errors` (level 5, Larastan);
      `./vendor/bin/pint --test` → PASS, 37 files.
- [x] Sanctum installed (`personal_access_tokens` migrated), Boost, `php-amqplib`.

### Web (`apps/web`) — Vue 3.5 / Vite 8 / TS

- [x] **Build / test / lint, all exit 0** — `npm run build` (vue-tsc + vite build);
      `npm run test` (vitest) → 18 passed / 4 files; `npm run lint`
      (oxlint + eslint).
- [x] **Dev server** — `curl http://localhost:5173/` → 200; `/` renders the
      `LandingView` landing page (sticky header, hero with «Войти в личный
      кабинет» → `/login`, ≥4 feature cards, 4-step how-it-works, footer
      «© 2026 OpsPilot»); no horizontal scroll at 375px; no `/api` calls.
      `/login` → 200 renders the `LoginView` stub; `/api` proxied to nginx.
      `HomeView` removed; `useHealthStore` kept but no longer rendered on `/`.
      Sections vendored under `src/components/landing/` (`HeroSection`,
      `FeaturesSection`, `HowItWorksSection`, `SiteFooter`).
- [x] **Styling: Tailwind CSS v4** (`@tailwindcss/vite`, no config file) — theme
      tokens + `@theme` in `src/assets/main.css`; production CSS bundle emitted
      (~19 kB / 4.4 kB gzip).
- [x] **UI kit: shadcn-vue** (`new-york` / `neutral`, `components.json`) —
      `reka-ui` + `class-variance-authority` + `clsx` + `tailwind-merge`, icons
      `@lucide/vue`, `cn()` in `src/lib/utils.ts`. `Button` vendored under
      `src/components/ui/button/` with a Vitest spec. See DECISIONS D41.

### Agent Runtime (`services/agent`) — Node + TS

- [x] **Isolated smoke** — `npm run smoke` publishes one `AnalysisRequest`,
      receives the deterministic fake `AnalysisResult`, prints `SMOKE_OK`.
- [x] **Full gates** — `npm run build` + `npm run typecheck` + `npm run test`
      (17 passed / 4 files) + `npm run lint`, all exit 0.
- [x] `FakeAgentDriver` active (`AGENT_DRIVER=fake`), no network. `ClaudeAgentDriver`
      present but inert.

### Messaging (RabbitMQ)

- [x] **End-to-end publish → consume** —
      `php artisan opspilot:analyze-ticket G-1 --wait --timeout=20` prints the
      request JSON and `RESULT_OK` with the deterministic result
      (`category:backend, priority:medium, summary:"Fake agent analysis completed",
      driver:fake`). `docker compose logs agent` shows
      `"msg":"Analysis completed" … "ticketId":"G-1"`.
- [x] **Topology / DLQ intact** — `rabbitmqctl list_queues` shows
      `agent.analysis.requested` with `x-dead-letter-exchange=opspilot.dlx` /
      `x-dead-letter-routing-key=agent.analysis.requested.dlq`, plus
      `agent.analysis.requested.dlq`. Identical declarations from Laravel and the
      agent — no `406 PRECONDITION_FAILED`.

### Claude Code assets

- [x] **5 skills** — `.claude/skills/{workflow,opspilot-backend,opspilot-vue,opspilot-messaging,opspilot-agent-runtime}/SKILL.md`.
- [x] **2 subagents** — `.claude/agents/{opspilot-architect,opspilot-reviewer}.md`, both read-only.
- [x] **Formatting hook** — `.claude/settings.json` PostToolUse →
      `.claude/hooks/format-changed.sh`; per-file, non-blocking, **exits 0** (verified).
- [x] **MCP** — `.mcp.json` valid JSON, 3 servers (laravel-boost, context7,
      playwright), no secrets. `claude mcp list` lists all 3 as "⏸ Pending
      approval" (expected for project-scoped servers until first-use approval).
- [x] `.claude/settings.json` valid JSON, no secrets.

### Secrets hygiene

- [x] `git status --porcelain` shows **no `.env`** (only `.env.example`).
- [x] `git check-ignore .env apps/api/.env services/agent/.env apps/web/.env` — all ignored.
- [x] No real Anthropic key anywhere — a `grep` for an `ANTHROPIC_API_KEY=`
      value beginning with the live-key prefix, across `*.env*` / `*.md` /
      `*.json`, finds nothing. `.mcp.json` / `.claude/settings.json` contain no
      secrets.

## IN PROGRESS

_(none)_

## PENDING

- [ ] **MCP first-use approval** — the 3 project-scoped servers must be approved
      interactively once (`claude` in the repo, approve when prompted). Config is
      correct; approval is a per-machine action, not a code change.
- [ ] **ClaudeAgentDriver real path** — by design. Needs `AGENT_DRIVER=claude` +
      a real `ANTHROPIC_API_KEY` in the root `.env`. The fake driver covers all
      automated testing.
- [ ] **Playwright MCP browser smoke** — Chromium is installed
      (`~/.cache/ms-playwright`, ~659 MB) but no browser-driven smoke has been run
      through the MCP yet.
- [ ] **`docs/plans/01-ticket-ingestion.md`** — the first real feature plan is
      written but not executed (`/workflow docs/plans/01-ticket-ingestion.md`).
- [ ] **Queue-worker service** — no `queue:work` container yet; `QUEUE_CONNECTION`
      is `redis` but nothing consumes Laravel jobs. Add when a feature needs it.
- [ ] **CI** — all gates are run by hand / by the `/workflow` skill; no pipeline.

## BLOCKED

_(none)_
