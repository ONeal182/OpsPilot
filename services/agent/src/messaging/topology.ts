/**
 * ONE shared definition of the OpsPilot messaging topology.
 *
 * Both the Node agent (this file) and the Laravel side (phase E) must assert the
 * exact same exchange / queue / routing-key / DLX / DLQ names. The canonical
 * documentation is docs/contracts/messaging.md. All of this is idempotent.
 */
import type { Channel } from 'amqplib';
import type { AppConfig } from '../config.js';

export interface TopologyConfig {
  exchange: string;
  analysisQueue: string;
  analysisRoutingKey: string;
  completedRoutingKey: string;
  dlx: string;
  dlq: string;
  dlqRoutingKey: string;
}

export function topologyFromConfig(config: AppConfig): TopologyConfig {
  return {
    exchange: config.exchange,
    analysisQueue: config.analysisQueue,
    analysisRoutingKey: config.analysisRoutingKey,
    completedRoutingKey: config.completedRoutingKey,
    dlx: config.dlx,
    dlq: config.dlq,
    dlqRoutingKey: config.dlqRoutingKey,
  };
}

/**
 * Idempotently declare every exchange / queue / binding the agent relies on.
 * Safe to call on every startup and from the smoke test.
 */
export async function assertTopology(channel: Channel, config: TopologyConfig): Promise<void> {
  // Primary + dead-letter exchanges (both topic, both durable).
  await channel.assertExchange(config.exchange, 'topic', { durable: true });
  await channel.assertExchange(config.dlx, 'topic', { durable: true });

  // Dead-letter queue, catch-all bound to the DLX.
  await channel.assertQueue(config.dlq, { durable: true });
  await channel.bindQueue(config.dlq, config.dlx, '#');

  // Work queue: failed/rejected messages dead-letter to the DLX -> DLQ.
  await channel.assertQueue(config.analysisQueue, {
    durable: true,
    deadLetterExchange: config.dlx,
    deadLetterRoutingKey: config.dlqRoutingKey,
  });
  await channel.bindQueue(config.analysisQueue, config.exchange, config.analysisRoutingKey);

  // Results are published back to the SAME topic exchange with routing key
  // `agent.analysis.completed`. No queue/binding is asserted for it here: there
  // is no consumer yet (phase E adds one), and asserting a binding without a
  // queue would fail. Ensuring the exchange exists (above) is sufficient for the
  // publisher side.
}
