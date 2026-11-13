import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const all = await prisma.neighborhood.findMany({ select: { id: true, name: true, slug: true } });
  const byName = new Map(all.map((n) => [n.name.toLowerCase(), n]));
  for (const n of all) {
    if (!n.name.includes(',')) continue;
    const baseName = n.name.split(',')[0]!.trim();
    const target = byName.get(baseName.toLowerCase());
    if (!target) continue;
    const moved = await prisma.property.updateMany({
      where: { neighborhoodId: n.id },
      data: { neighborhoodId: target.id },
    });
    const left = await prisma.property.count({ where: { neighborhoodId: n.id } });
    if (left === 0) {
      await prisma.neighborhood.delete({ where: { id: n.id } });
      console.log(`merged "${n.name}" -> "${target.name}" (moved ${moved.count} properties), deleted duplicate`);
    } else {
      console.log(`kept "${n.name}": ${left} properties still reference it`);
    }
  }
  console.log('neighborhoods now:', (await prisma.neighborhood.findMany({ select: { name: true } })).map((n) => n.name).join(', '));
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
