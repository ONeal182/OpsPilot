import { describe, expect, it } from 'vitest';
import { createDriver } from './index.js';

describe('createDriver', () => {
  it('returns the FakeAgentDriver by default', async () => {
    const driver = await createDriver({ agentDriver: 'fake' });
    expect(driver.name).toBe('fake');
  });

  it('throws when agentDriver=claude but ANTHROPIC_API_KEY is missing', async () => {
    await expect(createDriver({ agentDriver: 'claude' })).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });

  it('throws when agentDriver=claude and key is an empty string', async () => {
    await expect(createDriver({ agentDriver: 'claude', anthropicApiKey: '' })).rejects.toThrow(
      /ANTHROPIC_API_KEY/,
    );
  });
});
