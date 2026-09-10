/**
 * Custom MCP tools — the COMPLETE set of capabilities the (future) Claude agent
 * is allowed to use.
 *
 * The agent has NO shell and NO filesystem access. These are the ONLY
 * capabilities it gets. Business data flows:
 *   MCP tool -> Laravel Internal API -> validation -> authorization -> MySQL.
 *
 * This module is intentionally SDK-free so it can be unit-tested in isolation.
 * The SDK wiring (createSdkMcpServer) lives in ./server.ts.
 *
 * Every handler currently returns canned/mock data.
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

/** Shape every tool handler resolves to (kept simple + JSON-serializable). */
export type ToolResult = Record<string, unknown>;

export interface McpToolDef<S extends z.ZodTypeAny> {
  name: string;
  description: string;
  inputSchema: S;
  handler: (input: z.infer<S>) => Promise<ToolResult>;
}

function defineTool<S extends z.ZodTypeAny>(def: McpToolDef<S>): McpToolDef<S> {
  return def;
}

// --- get_ticket -------------------------------------------------------------
export const getTicketTool = defineTool({
  name: 'get_ticket',
  description: 'Fetch a single OpsPilot ticket by id (subject, body, status, requester, timestamps).',
  inputSchema: z.object({ ticketId: z.string().min(1) }),
  async handler({ ticketId }) {
    // TODO: call Laravel Internal API — GET /internal/tickets/{ticketId}
    return {
      ticketId,
      subject: 'Example ticket subject',
      body: 'Example ticket body text.',
      status: 'open',
      requester: 'user@example.com',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
  },
});

// --- search_similar_tickets ----------------------------------------------------
export const searchSimilarTicketsTool = defineTool({
  name: 'search_similar_tickets',
  description: 'Find historically similar tickets for a free-text query (for triage context).',
  inputSchema: z.object({ query: z.string().min(1), limit: z.number().int().positive().max(50).optional() }),
  async handler({ query, limit }) {
    // TODO: call Laravel Internal API — GET /internal/tickets/search?q=...
    return {
      query,
      limit: limit ?? 5,
      results: [
        { ticketId: 'T-1001', score: 0.91, subject: 'Similar historical ticket' },
        { ticketId: 'T-0900', score: 0.82, subject: 'Another related ticket' },
      ],
    };
  },
});

// --- search_knowledge --------------------------------------------------------
export const searchKnowledgeTool = defineTool({
  name: 'search_knowledge',
  description: 'Search the OpsPilot knowledge base / runbooks for a free-text query.',
  inputSchema: z.object({ query: z.string().min(1), limit: z.number().int().positive().max(50).optional() }),
  async handler({ query, limit }) {
    // TODO: call Laravel Internal API — GET /internal/knowledge/search?q=...
    return {
      query,
      limit: limit ?? 5,
      results: [
        { id: 'KB-42', title: 'Runbook: restart the queue worker', url: 'https://kb.example/KB-42' },
      ],
    };
  },
});

// --- get_demo_service_events -------------------------------------------------
export const getDemoServiceEventsTool = defineTool({
  name: 'get_demo_service_events',
  description: 'Fetch recent demo service events (deploys, alerts, incidents) for a named service.',
  inputSchema: z.object({
    service: z.string().min(1),
    since: z
      .string()
      .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'must be an ISO-8601 date-time' })
      .optional(),
  }),
  async handler({ service, since }) {
    // TODO: call Laravel Internal API — GET /internal/demo/service-events?service=...&since=...
    return {
      service,
      since: since ?? null,
      events: [
        { at: '2026-01-01T12:00:00.000Z', kind: 'deploy', detail: 'v1.2.3 released' },
        { at: '2026-01-01T12:05:00.000Z', kind: 'alert', detail: 'error rate elevated' },
      ],
    };
  },
});

// --- propose_action -------------------------------------------------------------
export const proposeActionTool = defineTool({
  name: 'propose_action',
  description:
    'Record a PROPOSED action for a ticket for human review. Never executes anything — only creates a pending proposal.',
  inputSchema: z.object({
    ticketId: z.string().min(1),
    action: z.string().min(1),
    rationale: z.string().min(1),
  }),
  async handler({ ticketId, action, rationale }) {
    // TODO: call Laravel Internal API — POST /internal/tickets/{ticketId}/proposals
    //
    // SAFETY INVARIANT: this tool ONLY ever creates a proposal record for a human
    // to review. It performs NO side effect on tickets, infrastructure, billing,
    // or any external system, and it never auto-applies the proposed action.
    const proposal = {
      proposalId: randomUUID(),
      status: 'pending_review' as const,
      ticketId,
      action,
      rationale,
    };
    if (proposal.status !== 'pending_review') {
      throw new Error('propose_action must always produce a pending_review proposal');
    }
    return proposal;
  },
});

/**
 * Plain, SDK-free map of every tool. Keyed by tool name. Import this in tests and
 * anywhere the Agent SDK is not available.
 */
export const toolHandlers = {
  get_ticket: getTicketTool,
  search_similar_tickets: searchSimilarTicketsTool,
  search_knowledge: searchKnowledgeTool,
  get_demo_service_events: getDemoServiceEventsTool,
  propose_action: proposeActionTool,
} as const;

export type ToolName = keyof typeof toolHandlers;

/** Flat list form, convenient for iteration. */
export const allTools = Object.values(toolHandlers);
