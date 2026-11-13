import 'dotenv/config';

import { prisma } from '../src/infrastructure/database/prisma';

async function main() {
  const listings = await prisma.listing.findMany({
    select: { listedAt: true, updatedAt: true, status: true, listingType: true },
    orderBy: { listedAt: 'asc' },
  });
  const byMonth: Record<string, number> = {};
  for (const listing of listings) {
    const key = `${listing.listedAt.getUTCFullYear()}-${String(listing.listedAt.getUTCMonth() + 1).padStart(2, '0')}`;
    byMonth[key] = (byMonth[key] ?? 0) + 1;
  }
  console.log(byMonth);
  console.log('first', listings[0]?.listedAt, 'last', listings[listings.length - 1]?.listedAt);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
