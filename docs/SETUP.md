# OpsPilot — Setup & Onboarding

The detailed version of the README quickstart: every step, what it does, how to
verify it, and the problems you might hit. If you just want the commands, the
README's **Quickstart** is the same sequence in short form.

---

## 1. Prerequisites

| Need | Why | Check |
| --- | --- | --- |
| **Docker Desktop + WSL2** (Linux containers) | The entire stack runs in containers | `docker version` and `docker compose version` |
| ~3 GB free disk | Images + volumes | — |
| Ports free on the host: **8080, 5173, 5672, 15672, 33061, 63790** | Service bindings (see `docs/ENVIRONMENT.md`) | `ss -ltn` / `netstat -an` |
| **Node ≥ 20** on the host (optional) | Only to run the `apps/web` and `services/agent` test gates on the host; the containers don't need it | `node --version` |

You do **not** need PHP, Composer, or a database installed on the host — all of
that is containerized.

Reference machine (see `docs/ENVIRONMENT.md` for the full table): WSL2 Ubuntu
26.04, Docker 29.1.3, Compose 2.40.3, Node v24.20.0.

---

## 2. Clone

```bash
git clone <repo> opspilot
cd opspilot
```

`vendor/` and every `node_modules/` are gitignored, so a fresh clone has no
dependencies yet — the steps below install them.

---

## 3. Root environment file

```bash
cp .env.example .env
```

This file is **injected into the PHP containers by Docker Compose** (`env_file:`)
and also read by Compose itself for ports and image args. The committed
`.env.example` has safe demo values for everything (DB `opspilot`/`opspilot`,
RabbitMQ `opspilot`/`opspilot`, `AGENT_DRIVER=fake`).

It deliberately has **no `APP_KEY`** — see step 6 for why.

`.env` is gitignored; never commit it.

---

## 4. Build images and start the stack

```bash
docker compose up -d --build
```

Wait until the infra services report healthy:

```bash
docker compose ps
# mysql, redis, rabbitmq must show "(healthy)" before continuing
```

The `web` and `agent` containers run `npm install` on their first start (source
is bind-mounted, `node_modules` lives on a named volume). Give them a minute;
watch with `docker compose logs -f web` / `docker compose logs -f agent`.

---

## 5. PHP dependencies

```bash
docker compose exec -T php-cli composer install
```

Installs Laravel + dev tooling (Pest, Larastan, Pint, Boost, `php-amqplib`) into
`apps/api/vendor/`.

---

## 6. Laravel env file + application key

```bash
cp apps/api/.env.example apps/api/.env
docker compose exec -T php-cli php artisan key:generate
```

**Why a separate file:** Compose injects the root `.env` into the PHP containers
as real environment variables. Laravel's dotenv loader will not override a real
env var, so if the root `.env` had `APP_KEY=` (blank) it would permanently
shadow whatever `key:generate` writes. The root `.env` therefore has no `APP_KEY`
line at all, and the key lives only in `apps/api/.env` (also gitignored).

Verify:

```bash
docker compose exec -T php-cli php artisan tinker --execute="echo config('app.key');"
# -> base64:....  (non-empty)
```

---

## 7. Database schema

```bash
docker compose exec -T php-cli php artisan migrate --force
docker compose exec -T php-cli php artisan migrate:status   # all "Ran"
```

---

## 8. Verify each service

```bash
# API (direct, through nginx)
curl -s http://localhost:8080/api/health
# {"status":"ok","service":"opspilot-api","checks":{"database":"ok","redis":"ok"}}

# Web dev server + its /api proxy
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/        # 200
curl -s http://localhost:5173/api/health                              # same JSON

# MySQL
docker compose exec -T mysql mysql -uopspilot -popspilot -e "SELECT 1;" opspilot

# Redis
docker compose exec -T php-cli php artisan tinker --execute="Cache::put('p','ok',60);echo Cache::get('p');"
docker compose exec -T redis redis-cli PING                           # PONG

# RabbitMQ end-to-end (publish -> agent consumes -> result)
docker compose exec -T php-cli php artisan opspilot:analyze-ticket T-1001 --wait --timeout=20
# prints the request JSON, then the AnalysisResult and RESULT_OK
docker compose logs --tail=15 agent    # "msg":"Analysis completed" ... "ticketId":"T-1001"

# RabbitMQ Management UI
open http://localhost:15672            # user opspilot / pass opspilot
```

---

## 9. Run the test suites

```bash
# API — in the php-cli container
docker compose exec -T php-cli ./vendor/bin/pest
docker compose exec -T php-cli ./vendor/bin/phpstan analyse --no-progress
docker compose exec -T php-cli ./vendor/bin/pint --test

# Web — on the host, in apps/web
cd apps/web && npm run build && npm run test && npm run lint

# Agent Runtime — on the host, in services/agent
cd services/agent && npm run build && npm run typecheck && npm run test && npm run lint
```

The web/agent suites also work in-container:
`docker compose exec -T web npm run test`, `docker compose exec -T agent npm test`.

---

## 10. Common issues

| Symptom | Cause | Fix |
| --- | --- | --- |
| `curl :8080/api/health` → **502 Bad Gateway** | php-fpm was recreated and nginx cached its old IP (should self-heal within ~10 s thanks to the re-resolving upstream) | `docker compose up -d --force-recreate nginx` |
| `config('app.key')` is empty / "No application encryption key" | `apps/api/.env` missing, or you put `APP_KEY=` back into the **root** `.env` | Remove `APP_KEY` from root `.env`; `cp apps/api/.env.example apps/api/.env`; `php artisan key:generate` |
| `web` container exits with `sh: vite: not found` | `node_modules` volume empty and install didn't finish | `docker compose up -d --force-recreate web` and wait; check `docker compose logs web` |
| `phpstan` → "reached configured PHP memory limit: 128M" | Custom ini not baked in (old image) | `docker compose build php-cli php-fpm && docker compose up -d` — `docker/php/conf.d/zz-opspilot.ini` sets 512M |
| `opspilot:analyze-ticket --wait` times out | `agent` container still installing/building on first boot, or not `Up` | `docker compose logs agent` until `"msg":"consumer started"`, then retry |
| Health check DB/redis `error` | Infra not healthy yet | `docker compose ps`; wait for `(healthy)`; `docker compose restart php-fpm` |
| `RABBITMQ_*` / `OPSPILOT_*` changes not taking effect | Laravel config was cached | Never run `php artisan config:cache` in dev; `php artisan config:clear` |
| Host `npm run build` in `apps/web` fails to write `dist/` | An in-container build left root-owned `dist/` | `docker compose exec web sh -lc "rm -rf /app/dist"` |
| MCP servers show "⏸ Pending approval" | Project-scoped `.mcp.json` servers need first-use approval | Run `claude` in the repo, approve when prompted — expected, not an error |

---

## 11. Stop / reset

```bash
docker compose down       # stop, keep data
docker compose down -v     # stop, WIPE volumes (mysql, redis, rabbitmq, node_modules)
```

After `down -v` the database and the npm volumes are empty again. `apps/api/.env`
survives on the host, so if its `APP_KEY` is still valid you only need:

```bash
docker compose up -d --build
docker compose exec -T php-cli composer install        # vendor/ is on the host, usually still there
docker compose exec -T php-cli php artisan migrate --force
```

---

## 12. Enabling the real Claude driver (later)

In the **root `.env`**:

```
AGENT_DRIVER=claude
ANTHROPIC_API_KEY=        # real key, starts with sk-ant- — never commit
```

Then `docker compose up -d agent`. The agent config fails fast if
`AGENT_DRIVER=claude` and the key is missing. With the default `fake` driver the
key is never read.

---

See also: `README.md` (short form), `docs/ENVIRONMENT.md` (versions & ports),
`docs/DECISIONS.md` (why things are the way they are), `docs/STATUS.md`
(what's done / pending).
