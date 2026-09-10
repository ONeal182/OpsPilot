# OpsPilot — Specification

## Product summary

OpsPilot is an operations assistant for support/ops teams. When a ticket arrives,
the system asks a Claude-powered agent to analyze it and **propose** an action:
categorize it, set a priority, summarize it, and optionally suggest a remediation.
Every proposal is reviewed by a human, who approves or rejects it. OpsPilot never
executes a risky change on its own.

## Components

### Applications

| Component      | Path             | Stack                                  | Phase |
| -------------- | ---------------- | ------------------------------------- | ----- |
| API            | `apps/api`       | Laravel (PHP 8.4), `php-fpm` + `nginx` | B     |
| Web            | `apps/web`       | Vue 3 + TypeScript + Vite             | C     |
| Agent Runtime  | `services/agent` | Node.js + TypeScript worker           | D     |

### Infrastructure services

| Service   | Image                          | Role                              |
| --------- | ------------------------------ | -------------------------------- |
| MySQL     | `mysql:8.0`                    | Primary relational datastore    |
| Redis     | `redis:7-alpine`              | Cache, sessions, Laravel queues |
| RabbitMQ  | `rabbitmq:3-management-alpine` | Message bus between PHP and Node |

All six run as Docker Compose services on the `opspilot` bridge network.

## Message flow

1. Laravel (API) publishes an **`agent.analysis.requested`** message as **JSON**
   to the exchange **`opspilot.events`** (routing key `agent.analysis.requested`).
2. RabbitMQ routes it to the queue **`agent.analysis.requested`**.
3. The Node **Agent Runtime worker** consumes the message.
4. The worker invokes the configured `AgentDriver`. During bootstrap this is
   **`FakeAgentDriver`**, which returns a deterministic result:

   ```json
   { "category": "backend", "priority": "medium", "summary": "Fake agent analysis completed" }
   ```

5. Failed messages are dead-lettered to exchange **`opspilot.dlx`** / queue
   **`agent.analysis.requested.dlq`**.
6. **Future:** the analysis result is published back to the API for persistence
   and human review.

Messages are **JSON only**. PHP serialization is never used across the PHP/Node
boundary. Consumers must be idempotent.

## Agent security model

- The agent has **no shell**, **no filesystem access**, and **no direct database
  access**.
- The agent interacts with the system **only** through a fixed set of MCP tools,
  each backed by a Laravel Internal API endpoint that performs validation,
  authorization, and business-rule checks before touching MySQL:

  | MCP tool                    | Purpose                                        |
  | --------------------------- | -------------------------------------------- |
  | `get_ticket`                | Fetch a single ticket by id                  |
  | `search_similar_tickets`    | Find related historical tickets             |
  | `search_knowledge`          | Search the knowledge base                    |
  | `get_demo_service_events`   | Read recent demo service/telemetry events    |
  | `propose_action`            | Create a proposal record for human review    |

- `propose_action` **only creates a proposal**. A human must approve it before
  anything is executed. No auto-execution of risky changes.
- `ClaudeAgentDriver` is used only when `AGENT_DRIVER=claude` **and**
  `ANTHROPIC_API_KEY` are both set. Otherwise no Claude API calls occur.
