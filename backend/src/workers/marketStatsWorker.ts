import { EachMessagePayload } from 'kafkajs';
import dayjs from 'dayjs';

import { createConsumer, subscribeAndConsume } from '../infrastructure/kafka/client';
import { cacheDelPattern } from '../infrastructure/redis/client';
import { KAFKA_TOPICS } from '../shared/constants';
import { calculateAndStoreMarketStats } from '../modules/market/market.service';
import { logger } from '../shared/utils/logger';
import { prisma } from '../infrastructure/database/prisma';

void KAFKA_TOPICS;
void prisma;
export async function startMarketStatsConsumer(): Promise<void> {
  const consumer = await createConsumer('market-stats-group');
  if (!consumer) return;

  await subscribeAndConsume(
    consumer,
    [KAFKA_TOPICS.PROPERTY_EVENTS, KAFKA_TOPICS.MARKET_EVENTS],
    async (payload: EachMessagePayload) => {
      if (!payload.message.value) return;

      const event = JSON.parse(payload.message.value.toString()) as {
        eventType: string;
        payload: { neighborhoodId?: string };
      };

      const recalcEvents = ['PROPERTY_CREATED', 'PRICE_CHANGED', 'MARKET_DATA_IMPORTED'];
      if (!recalcEvents.includes(event.eventType)) return;

      const period = dayjs().format('YYYY-MM');
      const neighborhoodId = event.payload?.neighborhoodId;

      // Recalculate stats for affected neighborhood and city-wide
      await calculateAndStoreMarketStats(period, neighborhoodId);
      await calculateAndStoreMarketStats(period);

      // Invalidate caches
      await cacheDelPattern('market:*');
      await cacheDelPattern('neighborhood:*');

      logger.info({ msg: 'market.stats.recalculated', eventType: event.eventType, period });
    },
  );

  logger.info('Market stats Kafka consumer started');
}
