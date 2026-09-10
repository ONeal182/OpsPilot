/**
 * RabbitMQ consumer for analysis requests.
 *
 * - Connects with a bounded retry/backoff loop (survives `rabbitmq` not being
 *   instantly ready).
 * - prefetch(4), asserts the shared topology, then consumes the analysis queue.
 * - Bad message body  -> nack(no requeue) -> DLQ (never crashes the worker).
 * - Driver error       -> nack(no requeue) -> DLQ.
 * - Success            -> publish AnalysisResult to the exchange with routing key
 *                         `agent.analysis.completed`, then ack.
 * - Graceful shutdown on SIGINT / SIGTERM.
 */
import { connect } from 'amqplib';
import type { AppConfig } from '../config.js';
import { parseAnalysisRequest } from '../contracts.js';
import type { AgentDriver } from '../drivers/index.js';
import type { Logger } from '../logger.js';
import { assertTopology, topologyFromConfig } from './topology.js';

type Connection = Awaited<ReturnType<typeof connect>>;

export interface ConsumerHandle {
  stop: () => Promise<void>;
}

async function connectWithRetry(
  url: string,
  logger: Logger,
  { attempts = 15, baseDelayMs = 500, maxDelayMs = 5000 } = {},
): Promise<Connection> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await connect(url);
    } catch (err) {
      lastErr = err;
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      logger.warn(
        { attempt, attempts, delayMs: delay, err: (err as Error).message },
        'RabbitMQ connection failed, retrying',
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(
    `Could not connect to RabbitMQ after ${attempts} attempts: ${(lastErr as Error)?.message}`,
  );
}

export async function startConsumer(
  config: AppConfig,
  driver: AgentDriver,
  logger: Logger,
): Promise<ConsumerHandle> {
  const topology = topologyFromConfig(config);
  const connection = await connectWithRetry(config.rabbitUrl, logger);
  const channel = await connection.createChannel();
  await channel.prefetch(4);
  await assertTopology(channel, topology);

  connection.on('error', (err: Error) => logger.error({ err: err.message }, 'AMQP connection error'));
  connection.on('close', () => logger.warn('AMQP connection closed'));

  const { consumerTag } = await channel.consume(topology.analysisQueue, (msg) => {
    if (!msg) return; // consumer cancelled by the server

    void (async () => {
      const msgId = msg.properties.messageId ?? undefined;
      const correlationId = msg.properties.correlationId ?? undefined;
      let ticketId: string | undefined;
      let log = logger.child({ messageId: msgId, correlationId });

      try {
        let decoded: unknown;
        try {
          decoded = JSON.parse(msg.content.toString('utf8'));
        } catch {
          log.warn('Message body is not valid JSON — routing to DLQ');
          channel.nack(msg, false, false);
          return;
        }

        let request;
        try {
          request = parseAnalysisRequest(decoded);
        } catch (err) {
          log.warn({ err: (err as Error).message }, 'Invalid AnalysisRequest — routing to DLQ');
          channel.nack(msg, false, false);
          return;
        }

        ticketId = request.ticketId;
        log = log.child({ ticketId });

        let result;
        try {
          result = await driver.analyze(request);
        } catch (err) {
          log.error({ err: (err as Error).message }, 'Driver failed — routing to DLQ');
          channel.nack(msg, false, false);
          return;
        }

        const published = channel.publish(
          topology.exchange,
          topology.completedRoutingKey,
          Buffer.from(JSON.stringify(result), 'utf8'),
          {
            persistent: true,
            contentType: 'application/json',
            ...(correlationId ? { correlationId } : {}),
          },
        );
        if (!published) {
          log.warn('publish() returned false (channel buffer full) — waiting for drain');
          await new Promise<void>((resolve) => channel.once('drain', resolve));
        }

        channel.ack(msg);
        log.info({ category: result.category, priority: result.priority }, 'Analysis completed');
      } catch (err) {
        // Last-resort guard: never let the consumer callback throw.
        log.error({ err: (err as Error).message, ticketId }, 'Unexpected consumer error — routing to DLQ');
        try {
          channel.nack(msg, false, false);
        } catch {
          /* channel already gone */
        }
      }
    })();
  });

  logger.info(
    { queue: topology.analysisQueue, prefetch: 4, driver: driver.name, consumerTag },
    'consumer started',
  );

  let stopping = false;
  const stop = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    logger.info('Shutting down consumer');
    try {
      await channel.cancel(consumerTag);
      await channel.close();
      await connection.close();
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Error during shutdown');
    }
  };

  const onSignal = (sig: string) => {
    logger.info({ signal: sig }, 'Signal received');
    void stop().then(() => process.exit(0));
  };
  process.once('SIGINT', () => onSignal('SIGINT'));
  process.once('SIGTERM', () => onSignal('SIGTERM'));

  return { stop };
}
