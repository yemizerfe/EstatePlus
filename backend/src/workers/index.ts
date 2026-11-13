import 'express-async-errors';

import { consumeQueue } from '../infrastructure/rabbitmq/client';
import { ensureTopics } from '../infrastructure/kafka/client';
import { logger } from '../shared/utils/logger';
import { handleImportJob, IMPORT_QUEUE } from './importWorker';
import { startMarketStatsConsumer } from './marketStatsWorker';

async function startWorkers(): Promise<void> {
  logger.info('Starting background workers...');

  await ensureTopics();

  // RabbitMQ consumers
  await consumeQueue(IMPORT_QUEUE, handleImportJob);

  // Kafka consumers
  await startMarketStatsConsumer();

  logger.info('All workers started');
}

startWorkers().catch((err) => {
  logger.error({ msg: 'Worker startup failed', err });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Worker shutting down...');
  process.exit(0);
});
