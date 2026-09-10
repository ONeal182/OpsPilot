/**
 * Real RabbitMQ round-trip smoke test.
 *
 * Publishes ONE valid AnalysisRequest to the exchange with the analysis routing
 * key, then waits on a temporary exclusive queue bound with
 * `agent.analysis.completed` for the matching result. Requires the consumer
 * (the `agent` service, driver=fake) to be running.
 *
 * Exit 0 + `SMOKE_OK` on the expected deterministic fake result; exit 1 +
 * `SMOKE_FAIL` on timeout / mismatch.
 *
 * Connection URL comes from the same config module as the worker, so this runs
 * both on the host (defaults to amqp://opspilot:opspilot@localhost:5672/) and
 * inside the compose network (RABBITMQ_HOST=rabbitmq from env_file).
 */
import { connect } from 'amqplib';
import { loadConfig } from './config.js';
import { parseAnalysisResult, type AnalysisRequest } from './contracts.js';
import { assertTopology, topologyFromConfig } from './messaging/topology.js';

const TIMEOUT_MS = 15_000;

function resolveEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (!env.RABBITMQ_URL && !env.RABBITMQ_HOST) {
    env.RABBITMQ_URL = 'amqp://opspilot:opspilot@localhost:5672/';
  }
  return env;
}

async function main(): Promise<void> {
  const config = loadConfig(resolveEnv());
  const topology = topologyFromConfig(config);
  const ticketId = `smoke-${Date.now()}`;
  const correlationId = `corr-${Date.now()}`;

  const connection = await connect(config.rabbitUrl);
  const channel = await connection.createChannel();
  await assertTopology(channel, topology);

  // Temp exclusive queue for the completed results.
  const { queue: replyQueue } = await channel.assertQueue('', { exclusive: true, autoDelete: true });
  await channel.bindQueue(replyQueue, topology.exchange, topology.completedRoutingKey);

  const got = new Promise<Record<string, unknown>>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
    void channel.consume(
      replyQueue,
      (msg) => {
        if (!msg) return;
        try {
          const body = JSON.parse(msg.content.toString('utf8')) as Record<string, unknown>;
          if (body.ticketId === ticketId) {
            clearTimeout(timer);
            channel.ack(msg);
            resolve(body);
          } else {
            channel.ack(msg);
          }
        } catch (err) {
          clearTimeout(timer);
          reject(err as Error);
        }
      },
      { noAck: false },
    );
  });

  const request: AnalysisRequest = {
    ticketId,
    source: 'smoke',
    payload: { subject: 'Smoke test ticket', body: 'please analyze' },
    requestedAt: new Date().toISOString(),
    correlationId,
  };

  channel.publish(
    topology.exchange,
    topology.analysisRoutingKey,
    Buffer.from(JSON.stringify(request), 'utf8'),
    { persistent: true, contentType: 'application/json', messageId: ticketId, correlationId },
  );
  console.log(`[smoke] published AnalysisRequest ticketId=${ticketId} -> ${config.rabbitUrl}`);

  try {
    const raw = await got;
    const result = parseAnalysisResult(raw);
    const ok =
      result.ticketId === ticketId &&
      result.category === 'backend' &&
      result.priority === 'medium' &&
      result.summary === 'Fake agent analysis completed' &&
      result.driver === 'fake';

    console.log('[smoke] received AnalysisResult:', JSON.stringify(result, null, 2));

    await channel.close();
    await connection.close();

    if (!ok) {
      console.error('SMOKE_FAIL (result did not match the deterministic fake result)');
      process.exit(1);
    }
    console.log('SMOKE_OK');
    process.exit(0);
  } catch (err) {
    console.error('[smoke] error:', (err as Error).message);
    try {
      await channel.close();
      await connection.close();
    } catch {
      /* ignore */
    }
    console.error('SMOKE_FAIL');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[smoke] fatal:', err);
  console.error('SMOKE_FAIL');
  process.exit(1);
});
