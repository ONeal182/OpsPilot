import { describe, expect, it } from 'vitest';
import { proposeActionTool, toolHandlers } from './tools.js';

describe('MCP tools (SDK-free)', () => {
  it('exposes exactly the five allowed tools', () => {
    expect(Object.keys(toolHandlers).sort()).toEqual(
      [
        'get_demo_service_events',
        'get_ticket',
        'propose_action',
        'search_knowledge',
        'search_similar_tickets',
      ].sort(),
    );
  });

  it('propose_action returns status "pending_review" and a proposalId, with no side effects', async () => {
    const input = { ticketId: 'T-1', action: 'restart-worker', rationale: 'queue stalled' };
    const snapshot = JSON.stringify(input);

    const out = await proposeActionTool.handler(input);

    expect(out.status).toBe('pending_review');
    expect(typeof out.proposalId).toBe('string');
    expect((out.proposalId as string).length).toBeGreaterThan(0);
    expect(out.ticketId).toBe('T-1');
    // input object was not mutated => no side effect on the caller's data
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('propose_action produces a unique proposalId each call', async () => {
    const a = await proposeActionTool.handler({ ticketId: 'T', action: 'x', rationale: 'y' });
    const b = await proposeActionTool.handler({ ticketId: 'T', action: 'x', rationale: 'y' });
    expect(a.proposalId).not.toBe(b.proposalId);
  });

  it('get_ticket returns canned data keyed by the requested ticketId', async () => {
    const out = await toolHandlers.get_ticket.handler({ ticketId: 'T-42' });
    expect(out.ticketId).toBe('T-42');
  });

  it('tool input schemas reject invalid input', () => {
    expect(proposeActionTool.inputSchema.safeParse({ ticketId: 'T' }).success).toBe(false);
    expect(
      proposeActionTool.inputSchema.safeParse({ ticketId: 'T', action: 'a', rationale: 'r' }).success,
    ).toBe(true);
  });
});
