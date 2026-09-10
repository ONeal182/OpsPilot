/**
 * Agent Runtime entrypoint: load config -> build logger -> create driver ->
 * start the RabbitMQ consumer.
 */
import { loadConfig } from './config.js';
import { createDriver } from './drivers/index.js';
import { logger } from './logger.js';
import { startConsumer } from './messaging/consumer.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const driver = await createDriver(config);

  logger.info(
    {
      driver: driver.name,
      exchange: config.exchange,
      analysisQueue: config.analysisQueue,
      nodeEnv: config.nodeEnv,
    },
    `Agent Runtime starting (driver=${driver.name})`,
  );

  await startConsumer(config, driver, logger);
}

main().catch((err) => {
  logger.error({ err: err instanceof Error ? err.stack : String(err) }, 'Fatal: agent failed to start');
  process.exit(1);
});
