---
name: opspilot-agent-runtime
description: The Node + TS agent worker (services/agent) — driver abstraction, the fake vs Claude driver, the 5 MCP tools, the least-privilege security model, and the build/typecheck/test/smoke scripts. Use for any work under services/agent.
---

# opspilot-agent-runtime — the Node agent service (`services/agent`)

Node 22 (container) / 24 (host), TypeScript ESM.

## Driver abstraction (`src/drivers/`)

- **`AgentDriver`** interface — `analyze(request): Promise<AnalysisResult>`.
- **`FakeAgentDriver`** — the **active** driver (`AGENT_DRIVER=fake`, the
  default). Deterministic, no network, no randomness:
  `{ category: 'backend', priority: 'medium', summary: 'Fake agent analysis completed', driver: 'fake' }`,
  echoing `ticketId` / `correlationId`, `producedAt` = now.
- **`ClaudeAgentDriver`** — **inert** unless `AGENT_DRIVER=claude` **and**
  `ANTHROPIC_API_KEY` are both set (config fails fast otherwise). Loaded only via
  dynamic `import()` on that branch. Uses `@anthropic-ai/claude-agent-sdk`
  `query()` plus `createSdkMcpServer` / `tool()`.

## Security model — least privilege

- The agent has **NO shell**, **NO filesystem access**, **NO direct DB access**.
- It reaches business data **only** through 5 MCP tools:
  `get_ticket`, `search_similar_tickets`, `search_knowledge`,
  `get_demo_service_events`, `propose_action`.
- Data flow for every tool: **MCP tool → Laravel Internal API → validation →
  authorization / business rules → MySQL**. The agent never talks to MySQL.
- **`propose_action` only creates a proposal record for human review — it never
  executes** a risky change.
- **Never commit an `ANTHROPIC_API_KEY`** (or any key). It is read only on the
  `AGENT_DRIVER=claude` branch.

## Layout

| Path | Contents |
| --- | --- |
| `src/config.ts` | Zod-parsed env → `AppConfig`; builds the AMQP URL; fails fast on `claude` without a key |
| `src/contracts.ts` | Zod schemas + types for `AnalysisRequest` / `AnalysisResult`; `parseAnalysisRequest` |
| `src/drivers/` | `AgentDriver`, `FakeAgentDriver`, `ClaudeAgentDriver` |
| `src/mcp/tools.ts` | the 5 tool input schemas + handlers (SDK-free map for tests) |
| `src/mcp/server.ts` | SDK wiring (`createSdkMcpServer` / `tool()`) |
| `src/messaging/` | `assertTopology`, consumer, publisher (see `opspilot-messaging`) |
| `src/smoke.ts` | end-to-end publish/consume smoke |

## Scripts (run from `services/agent`)

```bash
npm run build      # tsc -p tsconfig.json
npm run typecheck  # tsc --noEmit
npm run test       # vitest run
npm run smoke      # tsx src/smoke.ts  — needs a live broker
npm run start      # node dist/main.js
npm run dev        # tsx watch src/main.ts
```

`build`, `typecheck`, and `test` must all exit 0. After a messaging change also
run `npm run smoke` and the Laravel `opspilot:analyze-ticket --wait` path.
Significant changes to the driver contract or the MCP permission surface warrant
`opspilot-reviewer`; an architectural change (new tool, changed data-flow)
warrants `opspilot-architect` first.
