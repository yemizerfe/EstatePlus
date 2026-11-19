/**
 * Dev-only exporter: snapshots the public reference data that a production
 * deployment needs from an empty database (listings, neighbourhoods, market
 * statistics, indicators, rates, amenities, boundaries).
 *
 * Run from backend/:  npx tsx scripts/export-reference-data.ts
 * Output:             prisma/seed-data/reference-data.json
 *
 * Deliberately excluded: users, refresh tokens, notifications, inquiries,
 * viewings, saved properties/searches, audit logs — personal or session data
 * that must never ship inside a deployed image.
 */
import fs from 'node:fs';
import path from 'node:path';

import { prisma } from '../src/infrastructure/database/prisma';

const OUTPUT = path.join(__dirname, '..', 'prisma', 'seed-data', 'reference-data.json');

async function main(): Promise<void> {
  const [
    neighborhoods,
    neighborhoodStatistics,
    properties,
    propertyImages,
    listings,
    marketStatistics,
    economicIndicators,
    macroIndicators,
    exchangeRates,
    neighborhoodAmenities,
    geographicBoundaries,
    dataSources,
  ] = await Promise.all([
    prisma.neighborhood.findMany(),
    prisma.neighborhoodStatistic.findMany(),
    prisma.property.findMany(),
    prisma.propertyImage.findMany(),
    prisma.listing.findMany(),
    prisma.marketStatistic.findMany(),
    prisma.economicIndicator.findMany(),
    prisma.macroIndicator.findMany(),
    prisma.exchangeRate.findMany(),
    prisma.neighborhoodAmenity.findMany(),
    prisma.geographicBoundary.findMany(),
    prisma.dataSource.findMany(),
  ]);

  const snapshot = {
    exportedAt: new Date().toISOString(),
    neighborhoods,
    neighborhoodStatistics,
    properties,
    propertyImages,
    listings,
    marketStatistics,
    economicIndicators,
    macroIndicators,
    exchangeRates,
    neighborhoodAmenities,
    geographicBoundaries,
    dataSources,
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(snapshot));

  const counts = Object.fromEntries(
    Object.entries(snapshot)
      .filter(([, value]) => Array.isArray(value))
      .map(([key, value]) => [key, (value as unknown[]).length]),
  );
  const bytes = fs.statSync(OUTPUT).size;
  console.log('Wrote', OUTPUT, `${(bytes / 1024).toFixed(0)} kB`);
  console.table(counts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
