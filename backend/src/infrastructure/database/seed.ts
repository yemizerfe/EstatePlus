import argon2 from 'argon2';

import { prisma } from './prisma';
import { logger } from '../../shared/utils/logger';

const NEIGHBORHOODS = [
  { name: 'Bole', slug: 'bole', description: 'Upscale business and residential district' },
  { name: 'Kirkos', slug: 'kirkos', description: 'Central commercial district' },
  { name: 'Arada', slug: 'arada', description: 'Historic central neighborhood' },
  { name: 'Yeka', slug: 'yeka', description: 'Growing residential area in the east' },
  { name: 'Nifas Silk-Lafto', slug: 'nifas-silk-lafto', description: 'Southern residential district' },
  { name: 'Akaky Kaliti', slug: 'akaky-kaliti', description: 'Industrial and residential southern area' },
  { name: 'Kolfe Keranio', slug: 'kolfe-keranio', description: 'Western mixed-use district' },
  { name: 'Gulele', slug: 'gulele', description: 'Northern residential area' },
  { name: 'Lideta', slug: 'lideta', description: 'Central western district' },
  { name: 'Lemi Kura', slug: 'lemi-kura', description: 'Newer development area' },
];

async function seed(): Promise<void> {
  logger.info('Starting database seed...');

  // Seed neighborhoods
  for (const n of NEIGHBORHOODS) {
    await prisma.neighborhood.upsert({
      where: { slug: n.slug },
      update: {},
      create: { name: n.name, slug: n.slug, city: 'Addis Ababa', description: n.description },
    });
  }
  logger.info('Neighborhoods seeded');

  // Create admin user
  const adminHash = await argon2.hash('Admin@123456');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@realestate.et' },
    update: {},
    create: {
      email: 'admin@realestate.et',
      passwordHash: adminHash,
      firstName: 'System',
      lastName: 'Admin',
      role: 'ADMIN',
      isActive: true,
    },
  });
  logger.info({ msg: 'Admin user seeded', id: admin.id });

  // Create analyst user
  const analystHash = await argon2.hash('Analyst@123456');
  const analyst = await prisma.user.upsert({
    where: { email: 'analyst@realestate.et' },
    update: {},
    create: {
      email: 'analyst@realestate.et',
      passwordHash: analystHash,
      firstName: 'Market',
      lastName: 'Analyst',
      role: 'ANALYST',
      isActive: true,
    },
  });
  logger.info({ msg: 'Analyst user seeded', id: analyst.id });

  // Seed economic indicators
  // NOTE: these are structural placeholders for development only. Real values
  // must come from an official published source (NBE / ESS) with provenance;
  // they are recorded here with source 'SEED_PLACEHOLDER' so they can be
  // identified and replaced once source integrations land.
  const indicators = [
    { indicatorType: 'INFLATION_RATE' as const, value: 28.5, unit: '%', source: 'SEED_PLACEHOLDER', recordedAt: new Date('2024-01-01') },
    { indicatorType: 'INFLATION_RATE' as const, value: 25.2, unit: '%', source: 'SEED_PLACEHOLDER', recordedAt: new Date('2024-04-01') },
    { indicatorType: 'INFLATION_RATE' as const, value: 22.1, unit: '%', source: 'SEED_PLACEHOLDER', recordedAt: new Date('2024-07-01') },
    { indicatorType: 'INTEREST_RATE' as const, value: 8.5, unit: '%', source: 'SEED_PLACEHOLDER', recordedAt: new Date('2024-01-01') },
    { indicatorType: 'INTEREST_RATE' as const, value: 9.0, unit: '%', source: 'SEED_PLACEHOLDER', recordedAt: new Date('2024-07-01') },
    { indicatorType: 'EXCHANGE_RATE' as const, value: 56.2, unit: 'ETB/USD', source: 'SEED_PLACEHOLDER', recordedAt: new Date('2024-01-01') },
    { indicatorType: 'EXCHANGE_RATE' as const, value: 58.8, unit: 'ETB/USD', source: 'SEED_PLACEHOLDER', recordedAt: new Date('2024-07-01') },
    // Construction cost index intentionally omitted: an index requires a documented
    // basket, base period and weights. Raw ETB/sqm observations are not an index.
  ];

  for (const ind of indicators) {
    await prisma.economicIndicator.upsert({
      where: { indicatorType_recordedAt: { indicatorType: ind.indicatorType, recordedAt: ind.recordedAt } },
      update: {},
      create: ind,
    });
  }
  logger.info('Economic indicators seeded');

  logger.info('Seed complete');
}

seed()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    logger.error({ msg: 'Seed failed', err });
    process.exit(1);
  });
