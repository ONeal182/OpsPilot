# OpsPilot Messaging Contract

**This file is the single source of truth for the RabbitMQ topology and message
shapes shared by the Laravel side (phase E) and the Node Agent Runtime
(`services/agent`).** Both sides assert the same topology (idempotently) and both
sides (de)serialize the same JSON.

All messages on the PHP <-> Node boundary are **JSON** (UTF-8). PHP-serialized
payloads are never used (see DECISIONS D3).

## Topology

| Object | Name | Type / kind | Options |
| --- | --- | --- | --- |
| Primary exchange | `opspilot.events` | `topic`, durable | — |
| Dead-letter exchange | `opspilot.dlx` | `topic`, durable | — |
| Work queue | `agent.analysis.requested` | classic, durable | `x-dead-letter-exchange=opspilot.dlx`, `x-dead-letter-routing-key=agent.analysis.requested.dlq` |
| Dead-letter queue | `agent.analysis.requested.dlq` | classic, durable | — |

### Bindings

| Queue | Exchange | Routing key |
| --- | --- | --- |
| `agent.analysis.requested` | `opspilot.events` | `agent.analysis.requested` |
| `agent.analysis.requested.dlq` | `opspilot.dlx` | `#` (catch-all) |

### Routing keys

| Routing key | Direction | Meaning |
| --- | --- | --- |
| `agent.analysis.requested` | Laravel -> agent | "Please analyze this ticket." Published to `opspilot.events`. |
| `agent.analysis.completed` | agent -> (future consumer) | "Analysis finished, here is the result." Published to `opspilot.events`. No queue is bound to this key yet; phase E adds the Laravel-side consumer. |

The canonical topology definition in code is
`services/agent/src/messaging/topology.ts` (`assertTopology`). Env var names
(`OPSPILOT_EXCHANGE`, `OPSPILOT_ANALYSIS_QUEUE`, `OPSPILOT_ANALYSIS_ROUTING_KEY`,
`OPSPILOT_DLX`, `OPSPILOT_DLQ`) live in the repo-root `.env`.

## Message: `AnalysisRequest`

Published by Laravel to `opspilot.events` with routing key
`agent.analysis.requested`. Recommended AMQP properties: `contentType:
application/json`, `persistent: true`, `messageId`, `correlationId`.

```json
{
  "ticketId": "T-12345",
  "source": "api",
  "payload": { "subject": "Login is broken", "body": "500 on POST /login" },
  "requestedAt": "2026-09-09T12:00:00.000Z",
  "correlationId": "b3b1f0e2-..."
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `ticketId` | string (non-empty) | yes | OpsPilot ticket identifier. |
| `source` | string | no | Where the request originated (e.g. `api`, `web`, `cron`). |
| `payload` | object (`Record<string, unknown>`) | yes | Arbitrary ticket data for the agent to analyze. |
| `requestedAt` | string (ISO-8601 date-time) | yes | When the request was created. |
| `correlationId` | string | no | Echoed back on the result and used as the AMQP `correlationId`. |

A message whose body is not valid JSON, or does not satisfy this schema, is
`nack`ed without requeue by the agent and lands in
`agent.analysis.requested.dlq`. The worker never crashes on a bad message.

## Message: `AnalysisResult`

Published by the agent to `opspilot.events` with routing key
`agent.analysis.completed`. AMQP properties: `contentType: application/json`,
`persistent: true`, `correlationId` (echoed from the request when present).

```json
{
  "ticketId": "T-12345",
  "category": "backend",
  "priority": "medium",
  "summary": "Fake agent analysis completed",
  "driver": "fake",
  "producedAt": "2026-09-09T12:00:01.234Z",
  "correlationId": "b3b1f0e2-..."
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `ticketId` | string (non-empty) | yes | Echoed from the request. |
| `category` | enum | yes | one of `backend`, `frontend`, `infra`, `billing`, `unknown`. |
| `priority` | enum | yes | one of `low`, `medium`, `high`, `urgent`. |
| `summary` | string (non-empty) | yes | One-line human-readable summary. |
| `driver` | enum | yes | `fake` or `claude` — which driver produced the result. |
| `producedAt` | string (ISO-8601 date-time) | yes | When the result was produced. |
| `correlationId` | string | no | Echoed from the request when it was present. |

### Deterministic `fake` driver output

With `AGENT_DRIVER=fake` (the default), `category`/`priority`/`summary`/`driver`
are fixed constants:

```
category = "backend"
priority = "medium"
summary  = "Fake agent analysis completed"
driver   = "fake"
```

Only `ticketId`, `correlationId` and `producedAt` vary per request.

## Schemas in code

Zod schemas + inferred TypeScript types: `services/agent/src/contracts.ts`
(`AnalysisRequestSchema`, `AnalysisResultSchema`, `parseAnalysisRequest`).

## Publisher (Laravel) — phase E

The Laravel side (`apps/api`) publishes `AnalysisRequest` messages and shares the
**one** topology defined above. PHP asserts the identical exchange / queue /
binding / argument set as `services/agent/src/messaging/topology.ts`, so a
redeclare from either side is a no-op instead of a `406 PRECONDITION_FAILED`.

### Config

`apps/api/config/opspilot.php` → `messaging` (read from env; do **not**
`config:cache` in dev — the root `.env` is injected into the `php-*` containers
via compose `env_file`, and cached config would freeze stale values):

| Config key | Env var | Value |
| --- | --- | --- |
| `messaging.rabbitmq.host` | `RABBITMQ_HOST` | `rabbitmq` (host: `localhost`) |
| `messaging.rabbitmq.port` | `RABBITMQ_PORT` | `5672` |
| `messaging.rabbitmq.user` | `RABBITMQ_USER` | `opspilot` |
| `messaging.rabbitmq.password` | `RABBITMQ_PASSWORD` | `opspilot` |
| `messaging.rabbitmq.vhost` | `RABBITMQ_VHOST` | `/` |
| `messaging.exchange` | `OPSPILOT_EXCHANGE` | `opspilot.events` |
| `messaging.analysis_queue` | `OPSPILOT_ANALYSIS_QUEUE` | `agent.analysis.requested` |
| `messaging.analysis_routing_key` | `OPSPILOT_ANALYSIS_ROUTING_KEY` | `agent.analysis.requested` |
| `messaging.dlx` | `OPSPILOT_DLX` | `opspilot.dlx` |
| `messaging.dlq` | `OPSPILOT_DLQ` | `agent.analysis.requested.dlq` |
| `messaging.analysis_completed_routing_key` | `OPSPILOT_ANALYSIS_COMPLETED_ROUTING_KEY` | `agent.analysis.completed` |

### Classes

- `App\Messaging\RabbitMqConnection` — thin `php-amqplib` wrapper: lazy
  `AMQPStreamConnection` + channel, `declareTopology()` (asserts exchange + DLX +
  queue + DLQ + bindings, mirroring `assertTopology()` line-for-line), `close()`.
- `App\Messaging\AnalysisRequestPublisher` — `publish(array $request): void`.
  Validates the shape (`ticketId` non-empty string, `payload` array,
  `requestedAt` ISO string → `InvalidArgumentException`), JSON-encodes with
  `JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES`, publishes. **JSON only — never
  PHP `serialize()`** (DECISIONS D3 / D27).

Both are bound as singletons in `App\Providers\AppServiceProvider`.

### `AMQPMessage` properties used

Published to exchange `opspilot.events` with routing key
`agent.analysis.requested`:

| Property | Value |
| --- | --- |
| body | `AnalysisRequest` as compact JSON (`JSON_UNESCAPED_SLASHES`) |
| `content_type` | `application/json` |
| `delivery_mode` | `2` (`AMQPMessage::DELIVERY_MODE_PERSISTENT`) |
| `message_id` | the `ticketId` |
| `correlation_id` | the request `correlationId` (a UUID) |
| `timestamp` | `time()` (unix seconds) |

### Artisan command

```
php artisan opspilot:analyze-ticket {ticketId} {--source=cli} {--wait} {--timeout=15}
```

Builds an `AnalysisRequest` (`requestedAt` = now ISO-8601, `correlationId` = a
UUID, demo `payload` `{title, body}`), publishes it, prints the JSON +
`correlationId`. With `--wait` it declares a temporary **exclusive, auto-delete**
queue bound to `opspilot.events` / `agent.analysis.completed` **before**
publishing, then consumes until a message matching `ticketId` **and**
`correlationId` arrives (`RESULT_OK`, exit 0) or `--timeout` seconds pass
(`RESULT_TIMEOUT`, exit 1).

### `406 PRECONDITION_FAILED` — why it does not happen

RabbitMQ rejects a redeclare whose type / durability / `x-arguments` differ from
the existing entity. It is avoided by declaring **identically** on both sides:

- exchanges `opspilot.events` and `opspilot.dlx`: `topic`, `durable`,
  `auto_delete=false` (PHP `exchange_declare($name, 'topic', false, true, false)`
  ≡ JS `assertExchange(name, 'topic', { durable: true })`).
- queue `agent.analysis.requested`: `durable`, args
  `x-dead-letter-exchange=opspilot.dlx`,
  `x-dead-letter-routing-key=agent.analysis.requested.dlq` — the PHP `AMQPTable`
  keys/values match amqplib's `{ deadLetterExchange, deadLetterRoutingKey }`
  byte-for-byte (both longstr).
- queue `agent.analysis.requested.dlq`: `durable`, no args.

Verified: after the Laravel declarations, `services/agent` `npm run smoke` still
prints `SMOKE_OK` (no 406), and `php artisan opspilot:analyze-ticket T-1001
--wait` prints `RESULT_OK` with the deterministic fake result.
