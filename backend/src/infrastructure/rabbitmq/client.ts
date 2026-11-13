import amqp, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';

import { config } from '../../config';
import { RABBITMQ_QUEUES } from '../../shared/constants';
import { logger } from '../../shared/utils/logger';

// amqplib >= 0.10.9 types the broker connection as `ChannelModel`.
let connection: ChannelModel | null = null;
let channel: Channel | null = null;

const QUEUES = Object.values(RABBITMQ_QUEUES);

export async function getRabbitChannel(): Promise<Channel | null> {
  if (channel) return channel;

  try {
    const conn = await amqp.connect(config.RABBITMQ_URL);
    connection = conn;
    const ch = await conn.createChannel();
    channel = ch;

    // Durable queues survive broker restart
    for (const q of QUEUES) {
      await ch.assertQueue(q, { durable: true });
    }

    conn.on('error', (err: Error) => {
      logger.error({ msg: 'RabbitMQ connection error', err: err.message });
      channel = null;
      connection = null;
    });

    conn.on('close', () => {
      logger.warn('RabbitMQ connection closed');
      channel = null;
      connection = null;
    });

    logger.info('RabbitMQ connected');
    return ch;
  } catch (err) {
    logger.warn({ msg: 'RabbitMQ unavailable — background jobs disabled', err });
    channel = null;
    connection = null;
    return null;
  }
}

export async function publishJob<T>(queue: string, payload: T): Promise<boolean> {
  try {
    const ch = await getRabbitChannel();
    if (!ch) return false;
    const content = Buffer.from(JSON.stringify(payload));
    return ch.sendToQueue(queue, content, { persistent: true });
  } catch (err) {
    logger.error({ msg: 'Failed to publish job', queue, err });
    return false;
  }
}

export async function consumeQueue(
  queue: string,
  handler: (msg: ConsumeMessage, channel: Channel) => Promise<void>,
): Promise<void> {
  const ch = await getRabbitChannel();
  if (!ch) {
    logger.error({ msg: 'Cannot consume — RabbitMQ unavailable', queue });
    return;
  }

  // prefetch 1 — process one message at a time
  await ch.prefetch(1);

  await ch.consume(queue, async (msg) => {
    if (!msg) return;
    try {
      await handler(msg, ch);
      ch.ack(msg);
    } catch (err) {
      logger.error({ msg: 'Job handler failed', queue, err });
      // Requeue once, then dead-letter
      ch.nack(msg, false, !msg.fields.redelivered);
    }
  });

  logger.info({ msg: 'Consumer registered', queue });
}

export async function closeRabbit(): Promise<void> {
  try {
    await channel?.close();
    await connection?.close();
    logger.info('RabbitMQ disconnected');
  } catch {
    // ignore
  }
}

export async function checkRabbitHealth(): Promise<boolean> {
  try {
    const ch = await getRabbitChannel();
    return ch !== null;
  } catch {
    return false;
  }
}
