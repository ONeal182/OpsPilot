# 01 — Ticket ingestion (real ticket rows)

## Goal
Replace the demo-only payload with a real `tickets` table. Add
`POST /api/internal/tickets` to create a ticket, wire
`opspilot:analyze-ticket` to publish from a real row, and make the MCP
`get_ticket` tool fetch that row back through the Laravel Internal API — closing
the loop the SPEC describes.

## Context
- **apps/api** — new migration + `Ticket` model; `Http/Controllers/Internal/`
  for the internal endpoint; route in `routes/api.php` under an
  `internal`-prefixed group; `AnalysisRequestPublisher` already validates the
  `AnalysisRequest` shape — feed it `payload` built from the ticket.
- **services/agent** — `src/mcp/tools.ts` `get_ticket` handler currently returns
  canned data (`// TODO: call Laravel Internal API`); point it at the internal
  endpoint. Keep the agent's least-privilege model: **MCP tool → Laravel
  Internal API → validation → authz → MySQL**, no direct DB.
- Contract: `docs/contracts/messaging.md` — `AnalysisRequest.payload` stays an
  arbitrary object; document the internal API shape there or in a new
  `docs/contracts/internal-api.md`.
- Constraints: JSON-only messaging, fake driver stays default, no host changes,
  Sanctum for auth on the internal route (service token), migrations reversible.
- Decisions to respect: `docs/DECISIONS.md` D3, D5, D27, D30.

## Steps
1. Migration `create_tickets_table` (`id`, `external_ref` nullable unique,
   `subject`, `body`, `status` default `open`, `source`, timestamps) + `Ticket`
   model with fillable + casts.
2. `App\Http\Controllers\Internal\TicketController@store` — validates
   `{subject, body, source?, external_ref?}`, creates the row, returns 201 with
   the ticket JSON. `@show` — returns one ticket by id or 404.
3. Route group `Route::prefix('internal')->middleware(['auth:sanctum'])` with
   `POST /internal/tickets` and `GET /internal/tickets/{ticket}`.
4. Update `opspilot:analyze-ticket` — accept a numeric ticket id, load the
   `Ticket`, build `payload` from `subject`/`body`, publish; keep the `T-<n>`
   demo string working via a fallback so existing smokes pass.
5. Agent `get_ticket` — call `GET /internal/tickets/{id}` with the service
   token (new agent env var, documented, not committed); map the response to the
   tool's output schema; on 404 return a typed "not found" result.
6. Pest feature tests: ticket create (happy + validation fail), show + 404,
   auth required. Agent unit test: `get_ticket` maps a mocked HTTP response.
7. Update `docs/contracts/` with the internal API shape; update
   `docs/STATUS.md`.

## Checks
- `docker compose exec -T php-cli ./vendor/bin/pest`
- `docker compose exec -T php-cli ./vendor/bin/phpstan analyse --no-progress`
- `docker compose exec -T php-cli ./vendor/bin/pint --test`
- `cd services/agent && npm run build && npm run typecheck && npm run test`
- messaging: `docker compose exec -T php-cli php artisan opspilot:analyze-ticket <id> --wait`
  and `cd services/agent && npm run smoke`
- Migration reversibility: `php artisan migrate:fresh` on the test DB.

## Done-criteria
- A ticket can be created via `POST /api/internal/tickets`, analyzed via the
  artisan command, and fetched by the agent's `get_ticket` — all green.
- All gates pass; contract doc + `STATUS.md` updated.
- `opspilot-reviewer` run (schema + new endpoint + auth + agent permission
  surface) and its blockers addressed.
