import type { AnalysisRequest, AnalysisResult } from '../contracts.js';

/**
 * An AgentDriver turns an AnalysisRequest into an AnalysisResult. Implementations
 * must be side-effect free with respect to business data — any real action goes
 * through MCP tools -> Laravel Internal API.
 */
export interface AgentDriver {
  readonly name: 'fake' | 'claude';
  analyze(request: AnalysisRequest): Promise<AnalysisResult>;
}
