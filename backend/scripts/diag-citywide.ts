import 'dotenv/config';

import { prisma } from '../src/infrastructure/database/prisma';

async function main() {
  const citywide = await prisma.neighborhood.findFirst({ where: { name: { contains: 'citywide' } } });
  if (!citywide) {
    console.log('no citywide area');
    return;
  }
  console.log('citywide', citywide.id, citywide.slug, citywide.isActive);
  const properties = await prisma.property.findMany({
    where: { neighborhoodId: citywide.id },
    select: { title: true, address: true, description: true },
  });
  for (const property of properties) {
    console.log('\nTITLE:', property.title);
    console.log('ADDR :', property.address);
    console.log('DESC :', (property.description ?? '').replace(/\n/g, ' ').slice(0, 260));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
