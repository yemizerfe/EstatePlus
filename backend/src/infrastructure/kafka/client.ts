import { Kafka, Producer, Consumer, EachMessagePayload, logLevel } from 'kafkajs';

import { config } from '../../config';
import { KAFKA_TOPICS } from '../../shared/constants';
import { DomainEvent } from '../../shared/types';
import { logger } from '../../shared/utils/logger';

const kafka = new Kafka({
  clientId: config.KAFKA_CLIENT_ID,
  brokers: config.KAFKA_BROKERS.split(','),
  logLevel: logLevel.WARN,
  retry: { initialRetryTime: 300, retries: 5 },
});

let producer: Producer | null = null;

export async function getKafkaProducer(): Promise<Producer | null> {
  if (producer) return producer;
  try {
    producer = kafka.producer({ allowAutoTopicCreation: true });
    await producer.connect();
    logger.info('Kafka producer connected');
    return producer;
  } catch (err) {
    logger.warn({ msg: 'Kafka producer unavailable — events disabled', err });
    return null;
  }
}

export async function publishEvent<T>(event: DomainEvent<T>, topic: string): Promise<void> {
  try {
    const p = await getKafkaProducer();
    if (!p) return;
    await p.send({
      topic,
      messages: [
        {
          key: event.aggregateId,
          value: JSON.stringify(event),
          headers: {
            eventType: event.eventType,
            correlationId: event.correlationId ?? '',
          },
        },
      ],
    });
    logger.debug({ msg: 'Kafka event published', topic, eventType: event.eventType });
  } catch (err) {
    logger.error({ msg: 'Failed to publish Kafka event', topic, err });
    // Non-fatal — system continues without event
  }
}

export async function createConsumer(groupId: string): Promise<Consumer | null> {
  try {
    const consumer = kafka.consumer({ groupId, sessionTimeout: 30000 });
    await consumer.connect();
    logger.info({ msg: 'Kafka consumer connected', groupId });
    return consumer;
  } catch (err) {
    logger.warn({ msg: 'Kafka consumer unavailable', groupId, err });
    return null;
  }
}

export async function subscribeAndConsume(
  consumer: Consumer,
  topics: string[],
  handler: (payload: EachMessagePayload) => Promise<void>,
): Promise<void> {
  for (const topic of topics) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }

  await consumer.run({
    eachMessage: async (payload) => {
      try {
        await handler(payload);
      } catch (err) {
        logger.error({ msg: 'Kafka message handler failed', topic: payload.topic, err });
        // Commit offset anyway to avoid infinite retry on bad messages
      }
    },
  });
}

export async function ensureTopics(): Promise<void> {
  try {
    const admin = kafka.admin();
    await admin.connect();
    const existing = await admin.listTopics();
    const toCreate = Object.values(KAFKA_TOPICS).filter((t) => !existing.includes(t));
    if (toCreate.length > 0) {
      await admin.createTopics({
        topics: toCreate.map((topic) => ({ topic, numPartitions: 3, replicationFactor: 1 })),
      });
      logger.info({ msg: 'Kafka topics created', topics: toCreate });
    }
    await admin.disconnect();
  } catch (err) {
    logger.warn({ msg: 'Could not ensure Kafka topics', err });
  }
}

export async function disconnectKafka(): Promise<void> {
  try {
    await producer?.disconnect();
    logger.info('Kafka producer disconnected');
  } catch {
    // ignore
  }
}
