/**
 * Agent SDK wiring for the custom MCP tools.
 *
 * This module imports the Claude Agent SDK and is therefore only loaded on the
 * `AGENT_DRIVER=claude` code path (via ClaudeAgentDriver). Keep it out of tests.
 */
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { allTools } from './tools.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

function toSdkTool(def: (typeof allTools)[number]) {
  // def.inputSchema is always a z.object(...), so `.shape` is its raw shape.
  const shape = (def.inputSchema as any).shape as Record<string, any>;
  return tool(
    def.name,
    def.description,
    shape,
    async (args: any) => {
      const out = await def.handler(args);
      return { content: [{ type: 'text' as const, text: JSON.stringify(out) }] };
    },
    { annotations: { readOnlyHint: def.name !== 'propose_action' } },
  );
}

/** Build the in-process MCP server that exposes the OpsPilot tools to the agent. */
export function buildOpspilotMcpServer() {
  return createSdkMcpServer({
    name: 'opspilot',
    version: '0.1.0',
    tools: allTools.map((t) => toSdkTool(t)) as any,
  });
}

export const OPSPILOT_MCP_SERVER_NAME = 'opspilot';
