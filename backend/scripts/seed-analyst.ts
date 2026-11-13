import argon2 from 'argon2';
import { prisma } from '../src/infrastructure/database/prisma';
import { logger } from '../src/shared/utils/logger';

async function createAnalyst(): Promise<void> {
  logger.info('Creating analyst user...');

  const passwordHash = await argon2.hash('@Ferideme1');
  
  const analyst = await prisma.user.upsert({
    where: { email: 'yyt@gmail.com' },
    update: {},
    create: {
      email: 'yyt@gmail.com',
      passwordHash: passwordHash,
      firstName: 'Analyst',
      lastName: 'User',
      role: 'analyst',
      isActive: true,
    },
  });
  
  logger.info({ msg: 'Analyst user created/updated', id: analyst.id, email: analyst.email, role: analyst.role });

  await prisma.$disconnect();
}

createAnalyst()
  .then(() => logger.info('Done'))
  .catch((err) => {
    logger.error({ msg: 'Failed', err });
    process.exit(1);
  });