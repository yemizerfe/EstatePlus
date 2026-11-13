import { createClient, RedisClientType } from 'redis';

import { config } from '../../config';
import { logger } from '../../shared/utils/logger';

let client: RedisClientType | null = null;
let isConnected = false;

export async function getRedis(): Promise<RedisClientType | null> {
  if (client && isConnected) return client;

  try {
    client = createClient({ url: config.REDIS_URL }) as RedisClientType;

    client.on('error', (err: Error) => {
      logger.error({ msg: 'Redis error', err: err.message });
      isConnected = false;
    });

    client.on('connect', () => {
      logger.info('Redis connected');
      isConnected = true;
    });

    client.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
    });

    // Redis is non-fatal: don't block startup if it is unavailable. Give the
    // connection a bounded window so the HTTP server still starts.
    await Promise.race([
      client.connect(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Redis connection timed out')), 5000);
      }),
    ]);
    isConnected = true;
    return client;
  } catch (err) {
    logger.warn({ msg: 'Redis unavailable — caching disabled', err });
    return null;
  }
}

export async function closeRedis(): Promise<void> {
  if (client && isConnected) {
    await client.disconnect();
    isConnected = false;
    logger.info('Redis disconnected');
  }
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const c = await getRedis();
    if (!c) return false;
    await c.ping();
    return true;
  } catch {
    return false;
  }
}

// ─── Cache helpers ───────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const c = await getRedis();
    if (!c) return null;
    const val = await c.get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  try {
    const c = await getRedis();
    if (!c) return;
    await c.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // Redis write failure is non-fatal
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    const c = await getRedis();
    if (!c) return;
    await c.del(key);
  } catch {
    // non-fatal
  }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    const c = await getRedis();
    if (!c) return;
    const keys = await c.keys(pattern);
    if (keys.length > 0) {
      await c.del(keys);
    }
  } catch {
    // non-fatal
  }
}

// ─── Distributed lock ────────────────────────────────────────

export async function acquireLock(key: string, ttlSeconds = 30): Promise<boolean> {
  try {
    const c = await getRedis();
    if (!c) return true; // If Redis is down, allow through
    const result = await c.set(`lock:${key}`, '1', { NX: true, EX: ttlSeconds });
    return result === 'OK';
  } catch {
    return true;
  }
}

export async function releaseLock(key: string): Promise<void> {
  await cacheDel(`lock:${key}`);
}
