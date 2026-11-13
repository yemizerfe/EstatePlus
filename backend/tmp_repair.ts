import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const props = await prisma.property.findMany({
    where: { description: { contains: 'BinaSmart' } },
    select: { id: true, title: true, askingPrice: true, rentalPrice: true, description: true,
      listings: { select: { id: true, listingType: true, currentPrice: true } } },
  });
  let fixed = 0;
  for (const p of props) {
    const text = `${p.title} ${(p.description ?? '').slice(0, 400)}`.toLowerCase();
    const isRent = /(for rent|\brent\b|monthly)/.test(text) && !/for sale/.test(text);
    const listing = p.listings[0];
    if (!listing) continue;
    const price = Number(listing.currentPrice);
    if (isRent && listing.listingType !== 'RENT') {
      await prisma.listing.update({ where: { id: listing.id }, data: { listingType: 'RENT', rentalPrice: price } });
      await prisma.property.update({ where: { id: p.id }, data: { rentalPrice: price } });
      fixed++;
    } else if (!isRent && listing.listingType === 'RENT') {
      await prisma.listing.update({ where: { id: listing.id }, data: { listingType: 'SALE', rentalPrice: null } });
      await prisma.property.update({ where: { id: p.id }, data: { rentalPrice: null } });
      fixed++;
    }
  }
  console.log(`checked ${props.length} BinaSte properties, fixed ${fixed} listing directions`);
  const counts = await prisma.listing.groupBy({ by: ['listingType'], _count: true });
  console.log(counts);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
