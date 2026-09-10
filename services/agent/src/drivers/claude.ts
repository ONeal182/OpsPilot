/**
 * ClaudeAgentDriver — Inactive unless AGENT_DRIVER=claude AND ANTHROPIC_API_KEY set.
 * No API calls happen during bootstrap.
 *
 * This module imports the Claude Agent SDK. It is only ever loaded via a dynamic
 * import() from ./index.ts on the AGENT_DRIVER=claude branch, so the default
 * (fake) runtime never pulls the SDK into its module graph. The constructor
 * requires an ANTHROPIC_API_KEY; analyze() is implemented against the real SDK
 * surface (query()) but is not exercised in this phase.
 *
 * Verified SDK: @anthropic-ai/claude-agent-sdk (ESM). Docs:
 *   https://code.claude.com/docs/en/agent-sdk/typescript
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { AnalysisRequest, AnalysisResult } from '../contracts.js';
import { AnalysisResultSchema, CATEGORIES, PRIORITIES } from '../contracts.js';
import { buildOpspilotMcpServer, OPSPILOT_MCP_SERVER_NAME } from '../mcp/server.js';
import type { AgentDriver } from './types.js';

const SYSTEM_PROMPT = [
  'You are OpsPilot Triage, an assistant that classifies inbound support/ops tickets.',
  'For the given ticket, decide a category and a priority, and write a one-line summary.',
  `Valid categories: ${CATEGORIES.join(', ')}.`,
  `Valid priorities: ${PRIORITIES.join(', ')}.`,
  'You have NO shell and NO filesystem access. Use only the provided MCP tools to',
  'gather context (get_ticket, search_similar_tickets, search_knowledge,',
  'get_demo_service_events). If you want to recommend a change, call propose_action —',
  'it only ever creates a proposal for a human to review and never executes anything.',
  'When done, reply with ONLY a single JSON object with keys:',
  'category, priority, summary.',
].join(' ');

const FINAL_JSON = /\{[\s\S]*"category"[\s\S]*\}/;

export class ClaudeAgentDriver implements AgentDriver {
  readonly name = 'claude' as const;
  readonly #apiKey: string;

  constructor(apiKey: string | undefined) {
    if (!apiKey) {
      throw new Error('ClaudeAgentDriver requires ANTHROPIC_API_KEY.');
    }
    this.#apiKey = apiKey;
  }

  async analyze(request: AnalysisRequest): Promise<AnalysisResult> {
    // Ensure the SDK picks up the key even if the process env was not populated.
    process.env.ANTHROPIC_API_KEY = this.#apiKey;

    const mcpServer = buildOpspilotMcpServer();
    const prompt =
      `Ticket ${request.ticketId} (source: ${request.source ?? 'unknown'}).\n` +
      `Payload:\n${JSON.stringify(request.payload, null, 2)}`;

    let finalText = '';
    for await (const message of query({
      prompt,
      options: {
        systemPrompt: SYSTEM_PROMPT,
        mcpServers: { [OPSPILOT_MCP_SERVER_NAME]: mcpServer },
        allowedTools: [
          `mcp__${OPSPILOT_MCP_SERVER_NAME}__get_ticket`,
          `mcp__${OPSPILOT_MCP_SERVER_NAME}__search_similar_tickets`,
          `mcp__${OPSPILOT_MCP_SERVER_NAME}__search_knowledge`,
          `mcp__${OPSPILOT_MCP_SERVER_NAME}__get_demo_service_events`,
          `mcp__${OPSPILOT_MCP_SERVER_NAME}__propose_action`,
        ],
        maxTurns: 8,
        permissionMode: 'default',
      },
    })) {
      if (message.type === 'result' && 'result' in message && typeof message.result === 'string') {
        finalText = message.result;
      }
    }

    const match = finalText.match(FINAL_JSON);
    if (!match) {
      throw new Error('Claude agent did not return a parseable JSON answer.');
    }
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;

    return AnalysisResultSchema.parse({
      ticketId: request.ticketId,
      category: parsed.category,
      priority: parsed.priority,
      summary: parsed.summary,
      driver: 'claude',
      producedAt: new Date().toISOString(),
      ...(request.correlationId ? { correlationId: request.correlationId } : {}),
    });
  }
}
