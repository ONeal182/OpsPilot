/**
 * FakeAgentDriver — deterministic, offline, zero-cost.
 *
 * The category / priority / summary / driver fields are FIXED constants (they
 * match the spec example). Only `ticketId`, `correlationId` and `producedAt` are
 * derived from the request / wall clock. No network, no randomness.
 */
import type { AnalysisRequest, AnalysisResult } from '../contracts.js';
import { AnalysisResultSchema } from '../contracts.js';
import type { AgentDriver } from './types.js';

export class FakeAgentDriver implements AgentDriver {
  readonly name = 'fake' as const;

  async analyze(request: AnalysisRequest): Promise<AnalysisResult> {
    const result: AnalysisResult = {
      ticketId: request.ticketId,
      category: 'backend',
      priority: 'medium',
      summary: 'Fake agent analysis completed',
      driver: 'fake',
      producedAt: new Date().toISOString(),
      ...(request.correlationId ? { correlationId: request.correlationId } : {}),
    };
    // Validate our own output against the contract before returning it.
    return AnalysisResultSchema.parse(result);
  }
}
