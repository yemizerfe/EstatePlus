import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const rows = await p.listing.findMany({ select: { listedAt: true, currentPrice: true, rentalPrice: true, listingType: true } });
  const m: Record<string, number> = {};
  for (const r of rows) m[r.listedAt.toISOString().slice(0,7)] = (m[r.listedAt.toISOString().slice(0,7)] ?? 0) + 1;
  console.log(Object.entries(m).sort().map(([k,v])=>`${k}:${v}`).join(' '));
  console.log('total', rows.length);
  const amh = await p.property.findMany({ where: { OR: [{ title: { contains: 'ሀ' } }, { description: { contains: 'ሀ' } }] }, select: { id: true } });
  console.log('amharic-ish', amh.length);
  const bad = await p.propertyImage.findMany({ where: { imageUrl: { contains: 'Screenshot' } }, select: { propertyId: true, imageUrl: true } });
  console.log('screenshot imgs', bad.length);
  const gem = await p.propertyImage.count({ where: { imageUrl: { contains: 'bina.et' } } });
  console.log('bina imgs', gem);
}
main().finally(()=>p.$disconnect());
