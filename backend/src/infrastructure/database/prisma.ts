import { PrismaClient } from '@prisma/client';

import { logger } from '../../shared/utils/logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });
}

// In development re-use the same client across hot reloads
export const prisma: PrismaClient =
  global.__prisma ?? createPrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
  global.__prisma = prisma;
}

// Wire Prisma logs into Pino
(prisma.$on as Function)('query', (e: { query: string; duration: number }) => {
  logger.debug({ msg: 'prisma:query', query: e.query, duration: `${e.duration}ms` });
});

(prisma.$on as Function)('error', (e: { message: string }) => {
  logger.error({ msg: 'prisma:error', error: e.message });
});

(prisma.$on as Function)('warn', (e: { message: string }) => {
  logger.warn({ msg: 'prisma:warn', warning: e.message });
});

export async function checkDbHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Prisma disconnected');
}
