import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const [props, listings, users] = await Promise.all([
    prisma.property.count(),
    prisma.listing.count(),
    prisma.user.findMany({ select: { id: true, email: true, role: true } }),
  ]);
  console.log({ properties: props, listings, users });
  const recent = await prisma.property.findMany({ orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, title: true, askingPrice: true, ownerId: true, createdAt: true } });
  console.log(recent);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
