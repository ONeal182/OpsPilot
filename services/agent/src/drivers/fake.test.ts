import { describe, expect, it } from 'vitest';
import type { AnalysisRequest } from '../contracts.js';
import { FakeAgentDriver } from './fake.js';

const baseRequest: AnalysisRequest = {
  ticketId: 'T-123',
  source: 'unit-test',
  payload: { subject: 'x', body: 'y' },
  requestedAt: '2026-01-01T00:00:00.000Z',
  correlationId: 'corr-1',
};

describe('FakeAgentDriver', () => {
  it('returns the exact deterministic result fields', async () => {
    const driver = new FakeAgentDriver();
    const result = await driver.analyze(baseRequest);

    expect(result.category).toBe('backend');
    expect(result.priority).toBe('medium');
    expect(result.summary).toBe('Fake agent analysis completed');
    expect(result.driver).toBe('fake');
  });

  it('echoes ticketId and correlationId', async () => {
    const driver = new FakeAgentDriver();
    const result = await driver.analyze(baseRequest);

    expect(result.ticketId).toBe('T-123');
    expect(result.correlationId).toBe('corr-1');
    expect(() => new Date(result.producedAt).toISOString()).not.toThrow();
  });

  it('has the name "fake"', () => {
    expect(new FakeAgentDriver().name).toBe('fake');
  });

  it('is deterministic across calls (category/priority/summary/driver)', async () => {
    const driver = new FakeAgentDriver();
    const a = await driver.analyze(baseRequest);
    const b = await driver.analyze({ ...baseRequest, ticketId: 'T-999' });
    expect({ c: a.category, p: a.priority, s: a.summary, d: a.driver }).toEqual({
      c: b.category,
      p: b.priority,
      s: b.summary,
      d: b.driver,
    });
  });
});
