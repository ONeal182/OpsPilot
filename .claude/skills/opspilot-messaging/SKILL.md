---
name: opspilot-messaging
description: The RabbitMQ contract between Laravel (apps/api) and the Node agent (services/agent) — topology names, JSON-only rule, message shapes, idempotency, and the smoke test path. Use for any change to messaging topology, publishers, consumers, or message shapes.
---

# opspilot-messaging — the RabbitMQ contract

**Source of truth: `docs/contracts/messaging.md`.** The canonical topology in
code is `services/agent/src/messaging/topology.ts` (`assertTopology`), mirrored
line-for-line by `App\Messaging\RabbitMqConnection::declareTopology()` in
`apps/api`. Any change must land in the contract doc **and** both sides.

## Topology (names)

| Object | Name | Kind |
| --- | --- | --- |
| Primary exchange | `opspilot.events` | topic, durable |
| Dead-letter exchange | `opspilot.dlx` | topic, durable |
| Work queue | `agent.analysis.requested` | classic, durable, DLX'd to `opspilot.dlx` / `agent.analysis.requested.dlq` |
| Dead-letter queue | `agent.analysis.requested.dlq` | classic, durable, bound to `opspilot.dlx` with `#` |

Routing keys: `agent.analysis.requested` (Laravel → agent),
`agent.analysis.completed` (agent → future consumer). Both published to
`opspilot.events`.

## Hard rules

- **JSON only** across the PHP↔Node boundary. **Never** PHP `serialize()` /
  `unserialize()`. PHP encodes with `JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES`;
  Node uses the Zod schemas in `services/agent/src/contracts.ts`.
- **Both sides declare identical topology** — same type, durability, and
  `x-arguments`. A mismatched redeclare returns `406 PRECONDITION_FAILED`.
- **Consumers must be idempotent** — processing the same message twice must be
  safe.
- A message that is not valid JSON or fails the schema is `nack`ed without
  requeue → lands in `agent.analysis.requested.dlq`. The worker never crashes on
  a bad message.

## Message shapes

- **`AnalysisRequest`** (Laravel → `opspilot.events` / `agent.analysis.requested`):
  `ticketId` (string, req), `source` (string, opt), `payload` (object, req),
  `requestedAt` (ISO-8601, req), `correlationId` (string, opt).
- **`AnalysisResult`** (agent → `opspilot.events` / `agent.analysis.completed`):
  `ticketId`, `category` (`backend|frontend|infra|billing|unknown`),
  `priority` (`low|medium|high|urgent`), `summary`, `driver` (`fake|claude`),
  `producedAt` (ISO-8601), `correlationId` (opt, echoed).

## Config

`apps/api/config/opspilot.php` → `messaging` (env `RABBITMQ_*` / `OPSPILOT_*`,
mirrored into `.env` + `.env.example`). Do **not** `config:cache` in dev.
Node env: `OPSPILOT_EXCHANGE`, `OPSPILOT_ANALYSIS_QUEUE`,
`OPSPILOT_ANALYSIS_ROUTING_KEY`, `OPSPILOT_DLX`, `OPSPILOT_DLQ`.

## Test path (run after any messaging change)

```bash
docker compose exec -T php-cli php artisan opspilot:analyze-ticket T-1001 --wait
cd services/agent && npm run smoke
```

Expect `RESULT_OK` and `SMOKE_OK` with the deterministic fake result
(`backend` / `medium` / `Fake agent analysis completed` / `fake`). Also run the
Laravel Pest suite and the agent `npm run test`. A significant change to
messaging semantics warrants `opspilot-reviewer`; a topology/contract redesign
warrants `opspilot-architect` first.
