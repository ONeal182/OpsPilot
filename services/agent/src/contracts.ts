/**
 * Message contracts shared across the PHP <-> Node boundary.
 *
 * All payloads on this boundary are JSON (never PHP-serialized). The canonical
 * documentation of these shapes lives in docs/contracts/messaging.md.
 */
import { z } from 'zod';

const isoDateString = z
  .string()
  .min(1)
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'must be an ISO-8601 date-time string' });

export const AnalysisRequestSchema = z.object({
  ticketId: z.string().min(1),
  source: z.string().min(1).optional(),
  payload: z.record(z.string(), z.unknown()),
  requestedAt: isoDateString,
  correlationId: z.string().min(1).optional(),
});

export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;

export const CATEGORIES = ['backend', 'frontend', 'infra', 'billing', 'unknown'] as const;
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export const AnalysisResultSchema = z.object({
  ticketId: z.string().min(1),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  summary: z.string().min(1),
  driver: z.enum(['fake', 'claude']),
  producedAt: isoDateString,
  correlationId: z.string().min(1).optional(),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

/** Thrown when an inbound message body does not match {@link AnalysisRequestSchema}. */
type ZodIssues = z.ZodError['issues'];

export class AnalysisRequestParseError extends Error {
  readonly issues: ZodIssues;
  constructor(issues: ZodIssues) {
    super(
      `Invalid AnalysisRequest: ${issues
        .map((i) => `${i.path.join('.') || '(root)'} ${i.message}`)
        .join('; ')}`,
    );
    this.name = 'AnalysisRequestParseError';
    this.issues = issues;
  }
}

/**
 * Parse an unknown value (already JSON-decoded) into a typed AnalysisRequest.
 * Throws {@link AnalysisRequestParseError} on invalid input so the caller can
 * route the bad message to the DLQ instead of crashing the worker.
 */
export function parseAnalysisRequest(raw: unknown): AnalysisRequest {
  const result = AnalysisRequestSchema.safeParse(raw);
  if (!result.success) {
    throw new AnalysisRequestParseError(result.error.issues);
  }
  return result.data;
}

export function parseAnalysisResult(raw: unknown): AnalysisResult {
  return AnalysisResultSchema.parse(raw);
}
