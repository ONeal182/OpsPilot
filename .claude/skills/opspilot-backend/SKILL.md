---
name: opspilot-backend
description: Laravel/API conventions for apps/api — how to run artisan/composer/pest in the php-cli container, where files go, the test/static-analysis/format gates, messaging publisher rules. Use for any work under apps/api.
---

# opspilot-backend — Laravel conventions (`apps/api`)

Laravel 13.31, PHP 8.4. Nothing runs on the host.

## Running tools — always in the container

```bash
docker compose exec -T php-cli php artisan <args>
docker compose exec -T php-cli composer <args>
docker compose exec -T php-cli ./vendor/bin/pest
docker compose exec -T php-cli ./vendor/bin/phpstan analyse --no-progress
docker compose exec -T php-cli ./vendor/bin/pint            # format
docker compose exec -T php-cli ./vendor/bin/pint --test     # CI check
```

## Before touching Laravel or an installed-package API

Consult the **Laravel Boost MCP** for the installed version and real method /
config-key / signature facts. Do not guess framework APIs. External (non-Laravel)
libraries → **Context7**.

## Gates that must stay green

- **Pest** — `./vendor/bin/pest`. Feature tests run against sqlite `:memory:`
  (forced in `phpunit.xml` with `force="true"`); do not rely on MySQL in tests.
- **PHPStan / Larastan level 5** — must stay clean (`phpstan.neon`).
- **Pint** — formatting; `pint --test` must pass.

## Repo rules

- **Do not `config:cache` in dev.** The root `.env` is injected into the
  `php-*` containers via compose `env_file`; cached config freezes stale
  `RABBITMQ_*` / `OPSPILOT_*` values.
- Health endpoint: `GET /api/health` → `{status, service, time, checks:{database,redis}}`,
  200 when both checks pass else 503.
- **Messaging** lives in `app/Messaging/` and is **JSON only** — never PHP
  `serialize()` across the PHP↔Node boundary (see `docs/DECISIONS.md` D3/D27 and
  the `opspilot-messaging` skill).
- **Sanctum** (`laravel/sanctum`) is installed for API auth
  (`personal_access_tokens` migrated).

## Where files go

| Kind | Path |
| --- | --- |
| HTTP controllers | `app/Http/Controllers/` |
| Artisan commands | `app/Console/Commands/` (auto-discovered) |
| Messaging (connection, publisher) | `app/Messaging/` |
| Service bindings | `app/Providers/AppServiceProvider.php` |
| Project config | `config/opspilot.php` (env-driven; mirror keys into `.env` + `.env.example`) |
| Routes | `routes/api.php` |
| Migrations | `database/migrations/` |
| Tests | `tests/Feature/`, `tests/Unit/` (Pest) |

## After significant backend changes

Run all three gates, then consider `opspilot-reviewer` (schema, security, auth,
messaging semantics). For contract/architecture questions use `opspilot-architect`
first.
