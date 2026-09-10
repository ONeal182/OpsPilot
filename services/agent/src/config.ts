/**
 * Typed runtime configuration, parsed from process.env with Zod.
 *
 * The RabbitMQ URL is assembled from the discrete RABBITMQ_* parts unless a
 * single RABBITMQ_URL override is provided. Fails fast (throws) on invalid or
 * inconsistent configuration — notably AGENT_DRIVER=claude without an API key.
 */
import { z } from 'zod';

const rawSchema = z.object({
  RABBITMQ_URL: z.string().min(1).optional(),
  RABBITMQ_HOST: z.string().min(1).default('localhost'),
  RABBITMQ_PORT: z.coerce.number().int().positive().default(5672),
  RABBITMQ_USER: z.string().min(1).default('guest'),
  RABBITMQ_PASSWORD: z.string().min(1).default('guest'),
  RABBITMQ_VHOST: z.string().min(1).default('/'),

  OPSPILOT_EXCHANGE: z.string().min(1).default('opspilot.events'),
  OPSPILOT_ANALYSIS_QUEUE: z.string().min(1).default('agent.analysis.requested'),
  OPSPILOT_ANALYSIS_ROUTING_KEY: z.string().min(1).default('agent.analysis.requested'),
  OPSPILOT_DLX: z.string().min(1).default('opspilot.dlx'),
  OPSPILOT_DLQ: z.string().min(1).default('agent.analysis.requested.dlq'),

  AGENT_DRIVER: z.enum(['fake', 'claude']).default('fake'),
  ANTHROPIC_API_KEY: z.string().trim().optional(),

  NODE_ENV: z.string().optional(),
});

export type AgentDriverName = 'fake' | 'claude';

export interface AppConfig {
  rabbitUrl: string;
  exchange: string;
  analysisQueue: string;
  analysisRoutingKey: string;
  /** Routing key results are published back on. */
  completedRoutingKey: string;
  dlx: string;
  dlq: string;
  /** Routing key the DLQ is dead-lettered with. */
  dlqRoutingKey: string;
  agentDriver: AgentDriverName;
  anthropicApiKey?: string;
  nodeEnv: string;
}

export const COMPLETED_ROUTING_KEY = 'agent.analysis.completed';

function assembleRabbitUrl(v: z.infer<typeof rawSchema>): string {
  if (v.RABBITMQ_URL) return v.RABBITMQ_URL;
  const user = encodeURIComponent(v.RABBITMQ_USER);
  const pass = encodeURIComponent(v.RABBITMQ_PASSWORD);
  // vhost "/" -> empty path segment; anything else is percent-encoded after the slash.
  const vhostPath = v.RABBITMQ_VHOST === '/' ? '' : encodeURIComponent(v.RABBITMQ_VHOST);
  return `amqp://${user}:${pass}@${v.RABBITMQ_HOST}:${v.RABBITMQ_PORT}/${vhostPath}`;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = rawSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid agent configuration:\n${issues}`);
  }
  const v = parsed.data;

  if (v.AGENT_DRIVER === 'claude' && !v.ANTHROPIC_API_KEY) {
    throw new Error(
      'AGENT_DRIVER=claude requires ANTHROPIC_API_KEY to be set. ' +
        'Set the key or switch AGENT_DRIVER back to "fake".',
    );
  }

  return {
    rabbitUrl: assembleRabbitUrl(v),
    exchange: v.OPSPILOT_EXCHANGE,
    analysisQueue: v.OPSPILOT_ANALYSIS_QUEUE,
    analysisRoutingKey: v.OPSPILOT_ANALYSIS_ROUTING_KEY,
    completedRoutingKey: COMPLETED_ROUTING_KEY,
    dlx: v.OPSPILOT_DLX,
    dlq: v.OPSPILOT_DLQ,
    dlqRoutingKey: v.OPSPILOT_DLQ,
    agentDriver: v.AGENT_DRIVER,
    anthropicApiKey: v.ANTHROPIC_API_KEY,
    nodeEnv: v.NODE_ENV ?? 'development',
  };
}
