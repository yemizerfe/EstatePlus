import { createApp } from './app';
import { config } from './config';
import { prisma, disconnectDb } from './infrastructure/database/prisma';
import { getRedis, closeRedis } from './infrastructure/redis/client';
import { jobQueueService } from './services/job-queue.service';
import {
  backfillNeighborhoodCentroids,
  deriveMarketStatistics,
} from './modules/market/market-stats-derivation.service';
import { logger } from './shared/utils/logger';
import { bootstrapReferenceData } from './bootstrap/reference-data';

async function bootstrap(): Promise<void> {
  // Verify database connection
  await prisma.$connect();
  logger.info('Database connected');

  // Populate an empty deployment before serving requests. This is also run
  // outside Docker, where the image entrypoint is not used.
  const referenceData = await bootstrapReferenceData();
  logger.info({ msg: 'Reference data bootstrap completed', ...referenceData });

  // Connect Redis (non-fatal if unavailable)
  await getRedis();

  // Initialize job queue service
  // Without RabbitMQ, this will use the in-process fallback
  // if the service supports it.
  try {
    await jobQueueService.initialize();
    logger.info('Job queue service initialized');
  } catch (error) {
    logger.warn({
      msg: 'Job queue service initialization failed',
      error,
    });
  }

  // Refresh market statistics from listings in the database
  // Non-fatal: the application can still serve live listing data
  // if the statistics refresh fails.
  try {
    const derived = await deriveMarketStatistics({ months: 24 });
    const centroids = await backfillNeighborhoodCentroids();

    logger.info({
      msg: 'Market statistics refreshed',
      ...derived,
      centroids,
    });
  } catch (error) {
    logger.warn({
      msg: 'Market statistics refresh failed',
      error,
    });
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
    logger.info({
      msg: 'Graceful shutdown initiated',
      signal,
    });

    server.close(async () => {
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
    logger.fatal({
      msg: 'Uncaught exception',
      err,
    });

    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({
      msg: 'Unhandled rejection',
      reason,
    });

    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.fatal({
    msg: 'Bootstrap failed',
    err,
  });

  process.exit(1);
});
