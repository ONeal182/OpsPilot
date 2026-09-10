import { describe, expect, it } from 'vitest';
import { AnalysisRequestParseError, parseAnalysisRequest } from './contracts.js';

describe('parseAnalysisRequest', () => {
  it('accepts a valid request', () => {
    const raw = {
      ticketId: 'T-1',
      source: 'api',
      payload: { subject: 'hello' },
      requestedAt: '2026-01-01T12:00:00.000Z',
      correlationId: 'c-1',
    };
    const parsed = parseAnalysisRequest(raw);
    expect(parsed.ticketId).toBe('T-1');
    expect(parsed.payload).toEqual({ subject: 'hello' });
  });

  it('accepts a minimal request (no optional fields)', () => {
    const parsed = parseAnalysisRequest({
      ticketId: 'T-2',
      payload: {},
      requestedAt: '2026-01-01T12:00:00.000Z',
    });
    expect(parsed.ticketId).toBe('T-2');
    expect(parsed.source).toBeUndefined();
  });

  it('throws AnalysisRequestParseError on a malformed request', () => {
    expect(() => parseAnalysisRequest({ ticketId: '', payload: 'not-an-object' })).toThrow(
      AnalysisRequestParseError,
    );
  });

  it('throws on a non-ISO requestedAt', () => {
    expect(() =>
      parseAnalysisRequest({ ticketId: 'T-3', payload: {}, requestedAt: 'not-a-date' }),
    ).toThrow(AnalysisRequestParseError);
  });

  it('throws on completely wrong input', () => {
    expect(() => parseAnalysisRequest(null)).toThrow(AnalysisRequestParseError);
    expect(() => parseAnalysisRequest('string')).toThrow();
  });
});
