/** Quick inventory of what real data exists for charts/tables. */
import 'dotenv/config';
import { prisma } from '../src/infrastructure/database/prisma';

async function main() {
  const props = await prisma.property.count();
  const listings = await prisma.listing.count();
  const listingStatuses = await prisma.listing.groupBy({ by: ['status'], _count: true }).catch(() => []);
  const hoods = await prisma.neighborhood.count();
  const stats = await prisma.marketStatistic.count();
  const econ = await prisma.economicIndicator.count();
  const fx = await prisma.$queryRaw<{ c: number }[]>`SELECT count(*)::int as c FROM exchange_rates`;
  const macro = await prisma.macroIndicator.count().catch(() => -1);
  const bnd = await prisma.geographicBoundary.count().catch(() => -1);
  const amen = await prisma.neighborhoodAmenity.count().catch(() => -1);

  const byMonth = await prisma.listing.findMany({
    select: { listedAt: true, currentPrice: true, rentalPrice: true, listingType: true, status: true },
    orderBy: { listedAt: 'asc' },
    take: 5,
  });
  const newest = await prisma.listing.findMany({
    select: { listedAt: true, currentPrice: true },
    orderBy: { listedAt: 'desc' },
    take: 3,
  });

  // monthly bucket count over last 12 months (for trend chart feasibility)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const recent = await prisma.listing.count({ where: { listedAt: { gte: twelveMonthsAgo } } });

  const econTypes = await prisma.economicIndicator.groupBy({
    by: ['indicatorType'],
    _count: true,
  }).catch(() => []);

  console.log(JSON.stringify({
    props, listings, listingStatuses, hoods, stats, econ,
    fx: fx[0]?.c, macro, bnd, amen, recentListings12mo: recent,
    oldestSample: byMonth[0], newestSample: newest[0],
    econTypes,
  }, null, 2));
}

main().finally(() => prisma.$disconnect());