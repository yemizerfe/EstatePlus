import { prisma } from '../src/infrastructure/database/prisma';

async function main() {
  const counts: Record<string, number> = {};
  counts.properties = await prisma.property.count();
  counts.listings = await prisma.listing.count();
  counts.neighborhoods = await prisma.neighborhood.count();
  counts.neighborhoodsWithCoords = await prisma.neighborhood.count({ where: { NOT: { centerLat: null } } });
  counts.boundaries = await prisma.geographicBoundary.count();
  counts.economicIndicators = await prisma.economicIndicator.count();
  counts.macroIndicators = await prisma.macroIndicator.count();
  counts.exchangeRates = await prisma.exchangeRate.count();
  counts.amenities = await prisma.neighborhoodAmenity.count();
  counts.marketStatistics = await prisma.marketStatistic.count();
  counts.users = await prisma.user.count();
  console.log('COUNTS', counts);

  const levels = await prisma.geographicBoundary.groupBy({ by: ['adminLevel'], _count: true });
  console.log('BOUNDARY LEVELS', levels);

  const nbs = await prisma.neighborhood.findMany({ select: { name: true, centerLat: true, centerLng: true, subCity: true } });
  console.log('NEIGHBORHOODS', JSON.stringify(nbs, null, 1));

  const props = await prisma.property.findMany({ select: { title: true, propertyType: true, neighborhoodId: true, createdAt: true } });
  console.log('PROPERTIES', JSON.stringify(props, null, 1));

  const ls = await prisma.listing.findMany({ select: { listingType: true, price: true, currency: true, listedAt: true, pricePerSqm: true, status: true } });
  console.log('LISTINGS', JSON.stringify(ls, null, 1));

  const ei = await prisma.economicIndicator.groupBy({ by: ['indicatorType', 'source'], _count: true });
  console.log('ECON', ei);

  const ms = await prisma.marketStatistic.groupBy({ by: ['period', 'propertyType'], _count: true });
  console.log('MARKET STATS', ms);
}
main().finally(() => prisma.$disconnect());
