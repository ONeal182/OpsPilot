# Environment

## Detected host facts

- WSL2, Ubuntu 26.04 LTS (Resolute Raccoon), kernel 6.18.33.2-microsoft-standard-WSL2, x86_64
- Docker 29.1.3, Docker Compose 2.40.3
- Node v24.20.0, npm 11.19.0
- git 2.53.0, Claude Code 2.1.266, Python 3.14.4
- PHP: NOT installed on host. Composer: NOT installed on host.
- Host port 5432 is occupied by an unrelated `monorepo-postgres` container.

## Decision: PHP / Composer tooling is containerized

PHP, Composer, Laravel, Pint, PHPStan/Larastan, and Pest are **not installed on
the WSL host** and will not be. All of it runs inside the `php-cli` container
(same image as `php-fpm`, built from `docker/php/Dockerfile`, PHP 8.4).

Run PHP tooling like this:

```bash
docker compose exec php-cli composer <args>
docker compose exec php-cli php artisan <args>
docker compose exec php-cli ./vendor/bin/pest
```

Rationale: the project provides a container-level solution, so the host is left
untouched (no `apt install`).

## Host port mapping

Container-internal ports stay standard; only host-side ports are remapped to
avoid collisions (notably the unrelated container already holding 5432).

| Service              | Host port | Container port |
| ------------------- | --------- | -------------- |
| nginx (API)          | 8080      | 80             |
| MySQL                | 33061     | 3306           |
| Redis                | 63790     | 6379           |
| RabbitMQ (AMQP)      | 5672      | 5672           |
| RabbitMQ (mgmt UI)   | 15672     | 15672          |
| Vite dev server (web)| 5173      | 5173           |

Note on 5432: host port 5432 is already in use by an unrelated
`monorepo-postgres` container. OpsPilot uses MySQL (container port 3306) and does
not bind 5432 at all; MySQL and Redis are additionally given non-standard host
ports (33061, 63790) to stay clear of any other local database instances.

## Changes made to host

**No system packages installed, no host services modified.** The only host-level
artifacts are:

- The Docker Compose stack and the bind-mounted project directory.
- **Playwright browser cache** — `~/.cache/ms-playwright` (~659 MB, Chromium),
  installed with `npx playwright install chromium` for the Playwright MCP server.
  Remove that directory to reclaim the space; re-create it with the same command.

(An earlier note here said "NONE" — corrected: the Playwright browser download is
the one thing that landed outside the repo.)

## PHP toolchain (in container)

Everything below runs inside the `php-cli` / `php-fpm` image
(`docker/php/Dockerfile`). Nothing is installed on the host.

| Tool                          | Version  | Notes                                              |
| ----------------------------- | -------- | -------------------------------------------------- |
| PHP                           | 8.4.25   | NTS; ext: pdo_mysql, redis (PECL), mbstring, bcmath, gd, zip, intl, pcntl, sockets, opcache |
| Composer                      | 2.10.3   | from the `composer:2` image layer                  |
| Laravel Framework             | 13.31.0  | `composer create-project laravel/laravel`          |
| laravel/sanctum               | 4.3.3    | installed via `php artisan install:api`            |
| pestphp/pest                  | 4.7.8    | test runner (`./vendor/bin/pest`)                  |
| pestphp/pest-plugin-laravel   | 4.1.0    |                                                    |
| larastan/larastan             | 3.11.0   | PHPStan wrapper; `phpstan.neon` at level 5         |
| laravel/pint                  | 1.32.0   | ships with skeleton; `./vendor/bin/pint --test`   |
| laravel/boost                 | 2.8.0    | dev; `boost:install` ran headless, `boost:mcp` is the MCP server cmd |
| laravel/mcp                   | (transitive) | pulled in by laravel/boost                     |
| php-amqplib/php-amqplib       | 3.7.4    | pure-PHP AMQP client for phase E messaging         |

Run the toolchain like:

```bash
docker compose exec -T php-cli php artisan <args>
docker compose exec -T php-cli ./vendor/bin/pest
docker compose exec -T php-cli ./vendor/bin/phpstan analyse --no-progress
docker compose exec -T php-cli ./vendor/bin/pint --test
```

### Environment-variable precedence gotcha

Compose injects the **root `.env`** into `php-cli`/`php-fpm` via `env_file:`, so
those keys are real process environment variables. Laravel's dotenv loader does
not override real env vars, so `apps/api/.env` only fills in keys the container
env does not already set. Consequences:

- **`APP_KEY` is deliberately absent from the root `.env` / `.env.example`**
  (DECISIONS **D38**, supersedes D13). Present-but-blank there, it would shadow
  the key `php artisan key:generate` writes to `apps/api/.env`. With no `APP_KEY`
  in the root env, Laravel reads it normally from `apps/api/.env`. First-time
  setup: `cp apps/api/.env.example apps/api/.env && docker compose exec -T
  php-cli php artisan key:generate`.
- The root `.env` still owns every infra value (DB / Redis / RabbitMQ / ports /
  `AGENT_DRIVER`); `apps/api/.env` only carries `APP_KEY` plus any Laravel-only
  keys the root env does not define.
- `docker/php/conf.d/zz-opspilot.ini` sets `memory_limit = 512M` (DECISIONS
  **D39**) — the stock 128M crashes PHPStan on a cold cache.
- `phpunit.xml` uses `force="true"` on DB/cache/session/queue/APP_KEY entries so
  tests get sqlite `:memory:` + `array` drivers regardless of the container env
  (DECISIONS D14).

## Frontend toolchain

The Vue app lives in `apps/web`. It was scaffolded with `create-vue` and its
tooling runs on Node — on the host for scaffolding/iteration, and in the `web`
container (`node:22-alpine`, `docker/web/Dockerfile`) for the real dev server.
The `web` service runs `sh -c "npm install && npm run dev -- --host 0.0.0.0"`, so
it installs into the `web-node-modules` named volume on first boot (mirrors
`agent`; DECISIONS D37) — no manual `npm install` after `docker compose up`.

| Tool               | Version | Notes                                                    |
| ------------------ | ------- | -------------------------------------------------------- |
| create-vue         | 3.23.0  | scaffolder (`npm create vue@latest`)                    |
| Vue                | 3.5.42  | `<script setup>` SFCs                                    |
| Vite               | 8.2.2   | dev server + build; dev proxy for `/api`                 |
| Vue Router         | 5.3.1   | `/` → `LandingView`, `/login` → `LoginView` (stub)       |
| Pinia              | 4.0.3   | `stores/health.ts` (backend health check)               |
| axios              | 1.20.0  | `src/lib/http.ts`, baseURL `/api`                        |
| Vitest             | 4.1.11  | `@vue/test-utils` 2.5.0; `npm run test` = `vitest run`  |
| ESLint             | 10.10.0 | flat config, + oxlint 1.73.x; `npm run lint`             |
| Prettier           | 3.9.5   | as generated by create-vue                               |
| TypeScript         | 6.0.3   | `vue-tsc` 3.3.11 for `npm run build` type-check          |
| Node (host)        | v24.20.0 / npm 11.19.0 | scaffolding + host gates                  |
| Node (web container)| v22.23.2 / npm 10.9.8 | `docker compose run --rm --no-deps web` |

Dev URL: **http://localhost:5173** (host port 5173 → container 5173).

`npm run` targets in `apps/web`: `dev`, `build` (type-check + `vite build`),
`preview`, `test` (`vitest run`), `test:unit` (`vitest` watch), `lint`
(oxlint + eslint, both `--fix`), `format` (prettier).

### API proxy (host vs. container)

The browser and the container both call the API through the relative path `/api`,
which the Vite dev server proxies (`vite.config.ts` → `server.proxy`):

- **Host:** `VITE_API_PROXY_TARGET` unset → proxy target defaults to
  `http://localhost:8080` (the `nginx` host port).
- **`web` container:** `docker-compose.yml` sets
  `VITE_API_PROXY_TARGET: http://nginx:80` → proxy target is the `nginx` service
  on the `opspilot` network.

`VITE_API_URL` (`${VITE_API_URL:-http://localhost:8080}`, also in
`apps/web/.env.example`) is still exposed to app code as
`import.meta.env.VITE_API_URL` but the health check uses the relative path.

Run the frontend toolchain like:

```bash
cd apps/web && npm install          # or: npm ci  (package-lock.json is committed to disk)
npm run build                        # type-check + vite build
npm run test                         # vitest run
npm run lint                         # oxlint + eslint

# in the container (reproducibility):
docker compose run --rm --no-deps web sh -lc "npm ci; npm run build"
docker compose up -d web             # real dev server on http://localhost:5173
```

Note: the `web` container runs as root, so an in-container `npm run build` writes
`apps/web/dist/` (gitignored) with root ownership; a later **host** `npm run build`
then fails to clear it. Clear it from the container when needed:
`docker compose exec web sh -lc "rm -rf /app/dist"`.

## Agent Runtime toolchain

The Agent Runtime lives in `services/agent` — a standalone Node + TypeScript ESM
package. Its tooling runs on Node on the host for gates/iteration, and in the
`agent` container (`node:22-alpine`, `docker/agent/Dockerfile`) for the real
worker. The container installs deps + builds on start (bind-mounted source,
`node_modules` on the `agent-node-modules` named volume) via the compose
`command: sh -c "npm install && npm run build && npm run start"`.

| Tool                          | Version   | Notes                                                        |
| ----------------------------- | --------- | ----------------------------------------------------------- |
| Node (host)                   | v24.20.0 / npm 11.19.0 | scaffolding + host gates                        |
| Node (agent container)        | v22.x (node:22-alpine) / npm 10.9.8 | musl; runs the worker             |
| TypeScript                    | 5.9.3     | `tsc`; held < 6.1 by `typescript-eslint` peer (DECISIONS D22/D26) |
| tsx                           | 4.23.13   | `npm run dev` (watch) and `npm run smoke`                   |
| Vitest                        | 5.0.0     | `npm run test` = `vitest run`; 17 tests / 4 files           |
| ESLint                        | 10.10.0   | flat config; + `@eslint/js` 10.0.1 + `typescript-eslint` 8.70.0 |
| Prettier                      | 3.9.6     | dev only                                                    |
| `@anthropic-ai/claude-agent-sdk` | 0.3.266 | ESM; runtime dep; only loaded on `AGENT_DRIVER=claude`     |
| amqplib                       | 0.10.9    | promise API; `@types/amqplib` 0.10.8                        |
| zod                           | 4.5.4     | config + message-contract schemas                          |
| pino                          | 10.3.1    | structured logging; `pino-pretty` 13.1.3 (devDep) for TTY   |
| `@types/node`                 | 26.5.0    | dev                                                         |

`npm run` targets in `services/agent`: `build` (`tsc -p tsconfig.json` → `dist/`),
`start` (`node dist/main.js`), `dev` (`tsx watch src/main.ts`), `typecheck`
(`tsc --noEmit`), `test` (`vitest run`), `lint` (`eslint .`), `smoke`
(`tsx src/smoke.ts`).

```bash
cd services/agent && npm install
npm run build && npm run typecheck && npm run test && npm run lint   # all exit 0

docker compose up -d --build agent          # worker; logs → {"msg":"consumer started","driver":"fake"}
docker compose logs --tail=30 agent

npm run smoke                                # host → publishes 1 request, expects SMOKE_OK
# or inside the compose network:
docker compose exec -T agent npx tsx src/smoke.ts
```

The smoke test resolves its AMQP URL from `src/config.ts`: on the host, with no
`RABBITMQ_URL` / `RABBITMQ_HOST` in the environment, it defaults to
`amqp://opspilot:opspilot@localhost:5672/`; inside the `agent` container it uses
`RABBITMQ_HOST=rabbitmq` from the repo-root `.env`.
