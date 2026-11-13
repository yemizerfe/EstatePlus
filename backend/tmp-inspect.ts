import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const imgs = await p.propertyImage.groupBy({ by: ['imageUrl'], _count: { _all: true } });
  console.log('images total distinct', imgs.length);
  console.log(imgs.slice(0, 25).map(i => `${i._count._all}x ${i.imageUrl}`).join('\n'));
  const props = await p.property.findMany({ select: { id: true, title: true, description: true, propertyType: true, bedrooms: true, images: { select: { imageUrl: true, isPrimary: true } } }, take: 15 });
  console.log(JSON.stringify(props, null, 2).slice(0, 6000));
  const hoods = await p.neighborhood.findMany({ select: { name: true, slug: true, _count: { select: { properties: true } } }, orderBy: { name: 'asc' } });
  console.log(JSON.stringify(hoods, null, 2));
  const binaCount = await p.property.count({ where: { description: { contains: 'BinaSmart' } } });
  console.log('bina props', binaCount);
  const listed = await p.listing.findMany({ select: { listedAt: true }, orderBy: { listedAt: 'asc' } });
  console.log('listing months', [...new Set(listed.map(l => l.listedAt.toISOString().slice(0,7)))].join(','));
}
main().finally(() => p.$disconnect());
