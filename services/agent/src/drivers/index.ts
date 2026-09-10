/**
 * Driver factory. Returns the FakeAgentDriver by default; the ClaudeAgentDriver
 * (and, transitively, the Claude Agent SDK) is only loaded via dynamic import()
 * on the AGENT_DRIVER=claude branch.
 */
import type { AgentDriverName } from '../config.js';
import { FakeAgentDriver } from './fake.js';
import type { AgentDriver } from './types.js';

export type { AgentDriver } from './types.js';

export interface DriverConfig {
  agentDriver: AgentDriverName;
  anthropicApiKey?: string;
}

export async function createDriver(config: DriverConfig): Promise<AgentDriver> {
  if (config.agentDriver === 'claude') {
    if (!config.anthropicApiKey) {
      throw new Error(
        'AGENT_DRIVER=claude but ANTHROPIC_API_KEY is missing — refusing to create ClaudeAgentDriver.',
      );
    }
    const { ClaudeAgentDriver } = await import('./claude.js');
    return new ClaudeAgentDriver(config.anthropicApiKey);
  }
  return new FakeAgentDriver();
}
