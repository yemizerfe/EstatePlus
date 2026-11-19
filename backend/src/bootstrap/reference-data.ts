import fs from 'node:fs';
import path from 'node:path';

import { Prisma } from '@prisma/client';
import argon2 from 'argon2';

import { prisma } from '../infrastructure/database/prisma';

/**
 * Production data bootstrap.
 *
 * The application reads every figure it shows from Postgres. A newly deployed
 * database therefore starts completely empty: no neighbourhoods, listings,
 * market statistics, indicators or exchange rates, which is what "no info"
 * after a deploy looks like. This module loads the reference dataset that ships
 * with the server (prisma/seed-data/reference-data.json) into a database whose
 * content tables are still empty.
 *
 * It only ever fills an empty database:
 *  - if neighbourhoods already exist, nothing is touched;
 *  - it never deletes or overwrites rows;
 *  - personal data (users, refresh tokens, notifications, inquiries, viewings)
 *    is not part of the snapshot.
 *
 * Set REFERENCE_DATA_BOOTSTRAP=off to skip it entirely on a host that manages
 * its own data.
 */

const SYSTEM_USER_EMAIL = 'data@estateplus.local';
const SNAPSHOT_RELATIVE_PATH = path.join('prisma', 'seed-data', 'reference-data.json');

interface Snapshot {
  exportedAt?: string;
  neighborhoods?: unknown;
  neighborhoodStatistics?: unknown;
  properties?: unknown;
  propertyImages?: unknown;
  listings?: unknown;
  marketStatistics?: unknown;
  economicIndicators?: unknown;
  macroIndicators?: unknown;
  exchangeRates?: unknown;
  neighborhoodAmenities?: unknown;
  geographicBoundaries?: unknown;
  dataSources?: unknown;
}

function resolveSnapshotPath(): string | null {
  const configured = process.env['REFERENCE_DATA_FILE'];
  const candidates = [
    configured,
    path.join(process.cwd(), SNAPSHOT_RELATIVE_PATH),
    path.join(__dirname, '..', '..', SNAPSHOT_RELATIVE_PATH),
    path.join(__dirname, '..', '..', '..', SNAPSHOT_RELATIVE_PATH),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function rows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Snapshot rows carry the user ids of the machine they were exported from.
 * Re-point every user reference at the dedicated system account so the foreign
 * keys stay valid on a fresh deployment.
 */
function relinkUserReferences<T extends object>(input: T[], userId: string): T[] {
  return input.map((row) => {
    const next = { ...row } as unknown as Record<string, unknown>;
    if ('ownerId' in next) next['ownerId'] = userId;
    if ('createdBy' in next) next['createdBy'] = userId;
    if ('approvedBy' in next) next['approvedBy'] = null;
    return next as T;
  });
}

async function ensureSystemUser(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: SYSTEM_USER_EMAIL },
    update: {},
    create: {
      email: SYSTEM_USER_EMAIL,
      firstName: 'EstatePlus',
      lastName: 'Data',
      role: 'ANALYST',
      // No password hash: this account owns imported records and cannot sign in.
      passwordHash: null,
      isActive: true,
    },
    select: { id: true },
  });
  return user.id;
}

async function ensureAdminFromEnv(): Promise<void> {
  const email = process.env['ADMIN_EMAIL']?.trim().toLowerCase();
  const password = process.env['ADMIN_PASSWORD'];
  if (!email || !password) return;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return;

  await prisma.user.create({
    data: {
      email,
      passwordHash: await argon2.hash(password),
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log(`[bootstrap] created admin account ${email}`);
}

export interface BootstrapSummary {
  skipped: boolean;
  counts: Record<string, number>;
}

export async function bootstrapReferenceData(): Promise<BootstrapSummary> {
  // An admin login is useful even when the dataset is already loaded.
  await ensureAdminFromEnv();

  if (process.env['REFERENCE_DATA_BOOTSTRAP'] === 'off') {
    console.log('[bootstrap] REFERENCE_DATA_BOOTSTRAP=off — skipping reference data');
    return { skipped: true, counts: {} };
  }

  const existingNeighborhoods = await prisma.neighborhood.count();
  if (existingNeighborhoods > 0) {
    console.log(
      `[bootstrap] database already has ${existingNeighborhoods} neighbourhoods — reference data untouched`,
    );
    return { skipped: true, counts: {} };
  }

  const snapshotPath = resolveSnapshotPath();
  if (!snapshotPath) {
    throw new Error(
      `Reference data snapshot not found (looked for ${SNAPSHOT_RELATIVE_PATH}). ` +
        'Set REFERENCE_DATA_FILE or ship the file next to the prisma schema.',
    );
  }

  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as Snapshot;
  console.log(`[bootstrap] loading reference data from ${snapshotPath}`);
  const systemUserId = await ensureSystemUser();

  const counts: Record<string, number> = {};

  const steps: Array<[string, () => Promise<{ count: number }>]> = [
    [
      'neighborhoods',
      () =>
        prisma.neighborhood.createMany({
          data: rows<Prisma.NeighborhoodCreateManyInput>(snapshot.neighborhoods),
          skipDuplicates: true,
        }),
    ],
    [
      'neighborhoodStatistics',
      () =>
        prisma.neighborhoodStatistic.createMany({
          data: rows<Prisma.NeighborhoodStatisticCreateManyInput>(snapshot.neighborhoodStatistics),
          skipDuplicates: true,
        }),
    ],
    [
      'properties',
      () =>
        prisma.property.createMany({
          data: relinkUserReferences(rows<Prisma.PropertyCreateManyInput>(snapshot.properties), systemUserId),
          skipDuplicates: true,
        }),
    ],
    [
      'propertyImages',
      () =>
        prisma.propertyImage.createMany({
          data: rows<Prisma.PropertyImageCreateManyInput>(snapshot.propertyImages),
          skipDuplicates: true,
        }),
    ],
    [
      'listings',
      () =>
        prisma.listing.createMany({
          data: rows<Prisma.ListingCreateManyInput>(snapshot.listings),
          skipDuplicates: true,
        }),
    ],
    [
      'marketStatistics',
      () =>
        prisma.marketStatistic.createMany({
          data: rows<Prisma.MarketStatisticCreateManyInput>(snapshot.marketStatistics),
          skipDuplicates: true,
        }),
    ],
    [
      'economicIndicators',
      () =>
        prisma.economicIndicator.createMany({
          data: relinkUserReferences(
            rows<Prisma.EconomicIndicatorCreateManyInput>(snapshot.economicIndicators),
            systemUserId,
          ),
          skipDuplicates: true,
        }),
    ],
    [
      'macroIndicators',
      () =>
        prisma.macroIndicator.createMany({
          data: rows<Prisma.MacroIndicatorCreateManyInput>(snapshot.macroIndicators),
          skipDuplicates: true,
        }),
    ],
    [
      'exchangeRates',
      () =>
        prisma.exchangeRate.createMany({
          data: rows<Prisma.ExchangeRateCreateManyInput>(snapshot.exchangeRates),
          skipDuplicates: true,
        }),
    ],
    [
      'neighborhoodAmenities',
      () =>
        prisma.neighborhoodAmenity.createMany({
          data: rows<Prisma.NeighborhoodAmenityCreateManyInput>(snapshot.neighborhoodAmenities),
          skipDuplicates: true,
        }),
    ],
    [
      'geographicBoundaries',
      () =>
        prisma.geographicBoundary.createMany({
          data: relinkUserReferences(
            rows<Prisma.GeographicBoundaryCreateManyInput>(snapshot.geographicBoundaries),
            systemUserId,
          ),
          skipDuplicates: true,
        }),
    ],
    [
      'dataSources',
      () =>
        prisma.dataSource.createMany({
          data: relinkUserReferences(
            rows<Prisma.DataSourceCreateManyInput>(snapshot.dataSources),
            systemUserId,
          ),
          skipDuplicates: true,
        }),
    ],
  ];

  for (const [name, insert] of steps) {
    const result = await insert();
    counts[name] = result.count;
    console.log(`[bootstrap] ${name}: ${result.count} rows`);
  }

  console.log('[bootstrap] reference data loaded');
  return { skipped: false, counts };
}
