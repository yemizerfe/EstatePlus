import type { PropertyType } from '@prisma/client';

import { prisma } from '../../infrastructure/database/prisma';
import { etbEligiblePropertyWhere } from '../../shared/utils/eligibility';
import { logger } from '../../shared/utils/logger';

/**
 * Derives `market_statistics` rows from the listings this platform actually
 * holds. Every figure is a median/mean of real, eligible listing rows; nothing
 * is modelled, interpolated or invented.
 *
 * A row is produced for each (neighborhood, propertyType, month) combination
 * that has at least one listing, plus the city-wide roll-ups the analyst pages
 * query (neighborhoodId null, propertyType null or concrete). Re-running is
 * idempotent: existing rows for a period are updated in place.
 */

export interface MarketStatsDerivationResult {
  months: number;
  listingCount: number;
  rowsWritten: number;
}

interface Bucket {
  salePrices: number[];
  rents: number[];
  pricesPerSqm: number[];
  listingCount: number;
}

const emptyBucket = (): Bucket => ({
  salePrices: [],
  rents: [],
  pricesPerSqm: [],
  listingCount: 0,
});

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function previousMonth(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(Date.UTC(year!, (month ?? 1) - 2, 1));
  return monthKey(date);
}

function growth(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / previous;
}

interface Key {
  neighborhoodId: string | null;
  propertyType: PropertyType | null;
}

function keyString(key: Key, period: string): string {
  return `${key.neighborhoodId ?? 'city'}|${key.propertyType ?? 'all'}|${period}`;
}

export async function deriveMarketStatistics(
  options: { months?: number } = {},
): Promise<MarketStatsDerivationResult> {
  const months = Math.min(Math.max(options.months ?? 24, 1), 60);
  const startedAt = new Date();
  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (months - 1), 1));

  const listings = await prisma.listing.findMany({
    where: {
      status: 'ACTIVE',
      listedAt: { gte: since },
      // Imported rows whose source never stated ETB stay out of ETB statistics.
      property: { status: 'APPROVED', ...etbEligiblePropertyWhere() },
    },
    select: {
      listingType: true,
      currentPrice: true,
      rentalPrice: true,
      listedAt: true,
      property: {
        select: { neighborhoodId: true, propertyType: true, sizeSqm: true },
      },
    },
  });

  const buckets = new Map<string, Bucket>();
  const keys = new Map<string, Key & { period: string }>();

  const bump = (key: Key, period: string): Bucket => {
    const id = keyString(key, period);
    let bucket = buckets.get(id);
    if (!bucket) {
      bucket = emptyBucket();
      buckets.set(id, bucket);
      keys.set(id, { ...key, period });
    }
    return bucket;
  };

  for (const listing of listings) {
    if (!listing.listedAt) continue;
    const period = monthKey(listing.listedAt);
    const neighborhoodId = listing.property.neighborhoodId ?? null;
    const propertyType = listing.property.propertyType ?? null;
    const price = listing.currentPrice === null ? null : Number(listing.currentPrice);
    const rent = listing.rentalPrice === null ? null : Number(listing.rentalPrice);
    const size = listing.property.sizeSqm === null ? null : Number(listing.property.sizeSqm);

    const targets: Key[] = [
      { neighborhoodId, propertyType },
      { neighborhoodId, propertyType: null },
      { neighborhoodId: null, propertyType },
      { neighborhoodId: null, propertyType: null },
    ];

    for (const target of targets) {
      const bucket = bump(target, period);
      bucket.listingCount += 1;
      if (price !== null && price > 0 && listing.listingType !== 'RENT') {
        bucket.salePrices.push(price);
        if (size !== null && size > 0) bucket.pricesPerSqm.push(price / size);
      }
      if (rent !== null && rent > 0) {
        bucket.rents.push(rent);
      }
    }
  }

  const computed = new Map<
    string,
    {
      avgPrice: number | null;
      medianPrice: number | null;
      pricePerSqm: number | null;
      avgRentalPrice: number | null;
      rentalYield: number | null;
      activeListings: number;
      sampleSize: number;
      saleCount: number;
      rentCount: number;
    }
  >();

  for (const [id, bucket] of buckets) {
    const avgPrice = mean(bucket.salePrices);
    const medianPrice = median(bucket.salePrices);
    const pricePerSqm = mean(bucket.pricesPerSqm);
    const avgRentalPrice = mean(bucket.rents);
    const rentalYield =
      avgPrice && avgRentalPrice ? (avgRentalPrice * 12) / avgPrice : null;
    computed.set(id, {
      avgPrice,
      medianPrice,
      pricePerSqm,
      avgRentalPrice,
      rentalYield,
      activeListings: bucket.listingCount,
      sampleSize: bucket.salePrices.length + bucket.rents.length,
      saleCount: bucket.salePrices.length,
      rentCount: bucket.rents.length,
    });
  }

  const round2 = (value: number | null) =>
    value === null || !Number.isFinite(value) ? null : Math.round(value * 100) / 100;
  const round4 = (value: number | null) =>
    value === null || !Number.isFinite(value) ? null : Math.round(value * 10000) / 10000;

  let rowsWritten = 0;

  for (const [id, stats] of computed) {
    const key = keys.get(id)!;
    const prev = computed.get(
      keyString({ neighborhoodId: key.neighborhoodId, propertyType: key.propertyType }, previousMonth(key.period)),
    );

    const data = {
      avgPrice: round2(stats.avgPrice),
      medianPrice: round2(stats.medianPrice),
      pricePerSqm: round2(stats.pricePerSqm),
      avgRentalPrice: round2(stats.avgRentalPrice),
      rentalYield: round4(stats.rentalYield),
      priceGrowth: round4(
        growth(stats.medianPrice ?? stats.avgPrice, prev?.medianPrice ?? prev?.avgPrice ?? null),
      ),
      rentGrowth: round4(growth(stats.avgRentalPrice, prev?.avgRentalPrice ?? null)),
      activeListings: stats.activeListings,
      sampleSize: stats.sampleSize,
      calculatedAt: new Date(),
    };

    const existing = await prisma.marketStatistic.findFirst({
      where: {
        neighborhoodId: key.neighborhoodId,
        propertyType: key.propertyType,
        period: key.period,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.marketStatistic.update({ where: { id: existing.id }, data });
    } else {
      await prisma.marketStatistic.create({
        data: {
          neighborhoodId: key.neighborhoodId,
          propertyType: key.propertyType,
          period: key.period,
          ...data,
        },
      });
    }
    rowsWritten += 1;
  }

  // Drop rows this run did not recompute (e.g. a month that only ever held an
  // import whose price could not be confirmed in ETB). Upserting alone leaves
  // those old averages in place, and the analyst pages would keep reading them.
  const sincePeriod = `${since.getUTCFullYear()}-${String(since.getUTCMonth() + 1).padStart(2, '0')}`;
  const pruned = await prisma.marketStatistic.deleteMany({
    where: { period: { gte: sincePeriod }, calculatedAt: { lt: startedAt } },
  });

  logger.info({
    msg: 'market statistics derived from listings',
    pruned: pruned.count,
    months,
    listingCount: listings.length,
    rowsWritten,
  });

  return { months, listingCount: listings.length, rowsWritten };
}

/**
 * Fills in a neighborhood's map centre from the coordinates of its own
 * listings. A neighborhood without a centre cannot be pinned on the map, and
 * the coordinates already recorded on approved properties are the only
 * trustworthy source available.
 */
export async function backfillNeighborhoodCentroids(): Promise<number> {
  const properties = await prisma.property.findMany({
    where: {
      status: { in: ['APPROVED', 'ACTIVE'] },
      latitude: { not: null },
      longitude: { not: null },
    },
    select: { neighborhoodId: true, latitude: true, longitude: true },
  });

  const buckets = new Map<string, { lat: number[]; lng: number[] }>();
  for (const property of properties) {
    if (property.latitude === null || property.longitude === null) continue;
    const id = property.neighborhoodId;
    if (!id) continue;
    const bucket = buckets.get(id) ?? { lat: [], lng: [] };
    bucket.lat.push(Number(property.latitude));
    bucket.lng.push(Number(property.longitude));
    buckets.set(id, bucket);
  }

  let updated = 0;
  for (const [neighborhoodId, bucket] of buckets) {
    if (bucket.lat.length === 0) continue;
    const lat = bucket.lat.reduce((a, b) => a + b, 0) / bucket.lat.length;
    const lng = bucket.lng.reduce((a, b) => a + b, 0) / bucket.lng.length;
    const neighborhood = await prisma.neighborhood.findUnique({
      where: { id: neighborhoodId },
      select: { centerLat: true, centerLng: true },
    });
    if (!neighborhood || (neighborhood.centerLat !== null && neighborhood.centerLng !== null)) {
      continue;
    }
    await prisma.neighborhood.update({
      where: { id: neighborhoodId },
      data: {
        centerLat: neighborhood.centerLat ?? lat,
        centerLng: neighborhood.centerLng ?? lng,
      },
    });
    updated += 1;
  }

  return updated;
}
