import 'dotenv/config';

import { prisma } from '../src/infrastructure/database/prisma';

async function main() {
  const properties = await prisma.property.findMany({
    select: {
      title: true,
      bedrooms: true,
      propertyType: true,
      status: true,
      neighborhood: { select: { name: true } },
      images: { select: { imageUrl: true, isPrimary: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } },
    },
    take: 15,
  });
  for (const p of properties) {
    console.log(
      `${p.status} ${p.bedrooms}bd ${p.propertyType} ${p.neighborhood?.name ?? '-'} | ${p.title.slice(0, 45)} | ${p.images[0]?.imageUrl?.slice(0, 100) ?? 'NO IMAGE'}`,
    );
  }

  const hosts: Record<string, number> = {};
  const images = await prisma.propertyImage.findMany({ select: { imageUrl: true } });
  for (const image of images) {
    try {
      const host = new URL(image.imageUrl).host;
      hosts[host] = (hosts[host] ?? 0) + 1;
    } catch {
      hosts['INVALID'] = (hosts['INVALID'] ?? 0) + 1;
    }
  }
  console.log('--- image hosts ---');
  console.log(hosts);

  console.log('--- listings per neighborhood ---');
  const areas = await prisma.neighborhood.findMany({
    select: {
      name: true,
      slug: true,
      subcity: true,
      _count: { select: { properties: true } },
    },
    orderBy: { name: 'asc' },
  });
  for (const area of areas) console.log(`${area.subcity ?? '-'} | ${area.name} | ${area._count.properties}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
