import { createApp } from './app';
import { config } from './config';
import { prisma, disconnectDb } from './infrastructure/database/prisma';
import { getRedis, closeRedis } from './infrastructure/redis/client';
import { getRabbitChannel, closeRabbit } from './infrastructure/rabbitmq/client';
import { getKafkaProducer, ensureTopics, disconnectKafka } from './infrastructure/kafka/client';
import { jobQueueService } from './services/job-queue.service';
import {
  backfillNeighborhoodCentroids,
  deriveMarketStatistics,
} from './modules/market/market-stats-derivation.service';
import { logger } from './shared/utils/logger';

async function bootstrap(): Promise<void> {
  // Verify DB connection
  await prisma.$connect();
  logger.info('Database connected');

  // Connect Redis (non-fatal if unavailable)
  await getRedis();

  // Connect RabbitMQ (non-fatal)
  await getRabbitChannel();

  // Connect Kafka producer + ensure topics (non-fatal)
  await getKafkaProducer();
  await ensureTopics();

  // Initialize job queue service (non-fatal)
  try {
    await jobQueueService.initialize();
    logger.info('Job queue service initialized');
  } catch (error) {
    logger.warn({ msg: 'Job queue service initialization failed', error });
  }

  // Refresh the monthly market statistics every page reads from the listings
  // actually in the database (non-fatal: pages still read live listing medians).
  try {
    const derived = await deriveMarketStatistics({ months: 24 });
    const centroids = await backfillNeighborhoodCentroids();
    logger.info({ msg: 'Market statistics refreshed', ...derived, centroids });
  } catch (error) {
    logger.warn({ msg: 'Market statistics refresh failed', error });
  }

  const app = createApp();

  const server = app.listen(config.PORT, () => {
    logger.info({
      msg: 'Server started',
      port: config.PORT,
      env: config.NODE_ENV,
      api: `http://localhost:${config.PORT}${config.API_PREFIX}`,
    });
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ msg: 'Graceful shutdown initiated', signal });
    server.close(async () => {
      await disconnectKafka();
      await closeRabbit();
      await closeRedis();
      await disconnectDb();
      logger.info('Graceful shutdown complete');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.fatal({ msg: 'Uncaught exception', err });
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ msg: 'Unhandled rejection', reason });
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.fatal({ msg: 'Bootstrap failed', err });
  process.exit(1);
});
