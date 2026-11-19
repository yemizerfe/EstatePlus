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
  console.log('STEP 1: Starting database connection');

  // Verify database connection
  await prisma.$connect();

  console.log('STEP 2: Database connection successful');
  logger.info('Database connected');

  console.log('STEP 3: Starting reference data bootstrap');

  // Populate an empty deployment before serving requests. This is also run
  // outside Docker, where the image entrypoint is not used.
  const referenceData = await bootstrapReferenceData();

  console.log('STEP 4: Reference data bootstrap successful');
  logger.info({
    msg: 'Reference data bootstrap completed',
    ...referenceData,
  });

  console.log('STEP 5: Starting Redis connection');

  // Connect Redis
  await getRedis();

  console.log('STEP 6: Redis connection successful');

  // Initialize job queue service
  // Without RabbitMQ, this will use the in-process fallback
  // if the service supports it.
  console.log('STEP 7: Starting job queue initialization');

  try {
    await jobQueueService.initialize();

    console.log('STEP 8: Job queue initialization successful');
    logger.info('Job queue service initialized');
  } catch (error) {
    console.log('STEP 8: Job queue initialization failed, continuing');

    logger.warn({
      msg: 'Job queue service initialization failed',
      error,
    });
  }

  // Refresh market statistics from listings in the database
  // Non-fatal: the application can still serve live listing data
  // if the statistics refresh fails.
  console.log('STEP 9: Starting market statistics refresh');

  try {
    const derived = await deriveMarketStatistics({ months: 24 });
    const centroids = await backfillNeighborhoodCentroids();

    console.log('STEP 10: Market statistics refresh successful');

    logger.info({
      msg: 'Market statistics refreshed',
      ...derived,
      centroids,
    });
  } catch (error) {
    console.log('STEP 10: Market statistics refresh failed, continuing');

    logger.warn({
      msg: 'Market statistics refresh failed',
      error,
    });
  }

  console.log('STEP 11: Creating Express application');

  const app = createApp();

  console.log('STEP 12: Starting HTTP server');

  const server = app.listen(config.PORT, '0.0.0.0', () => {
    console.log(`STEP 13: Server started on port ${config.PORT}`);

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
  console.error('BOOTSTRAP FAILED:', err);

  logger.fatal({
    msg: 'Bootstrap failed',
    err,
  });

  process.exit(1);
});
