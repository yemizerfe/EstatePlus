import { prisma } from './src/infrastructure/database/prisma';
import { wikimediaCommonsAdapter } from './src/modules/external-sources/adapters/wikimedia-commons.adapter';

(async () => {
  const area = await prisma.neighborhood.findUnique({ where: { slug: 'addis-ketema' } });
  if (!area) { console.log('missing'); process.exit(0); }
  const all = await prisma.neighborhood.findMany({ where: { isActive: true }, select: { metadata: true } });
  const used = new Set(
    all.map((a: any) => a.metadata?.image?.url).filter(Boolean) as string[],
  );
  const candidates = await wikimediaCommonsAdapter.fetchNeighborhoodPhotoCandidates({
    name: 'Addis Ketema',
    lat: area.centerLat === null ? null : Number(area.centerLat),
    lng: area.centerLng === null ? null : Number(area.centerLng),
  });
  const photo = candidates.find((c) => !used.has(c.imageUrl));
  console.log('candidates', candidates.length, 'picked', photo?.title);
  if (photo) {
    const metadata = (area.metadata as Record<string, unknown> | null) ?? {};
    await prisma.neighborhood.update({
      where: { id: area.id },
      data: { metadata: { ...metadata, image: { url: photo.imageUrl, pageUrl: photo.pageUrl, title: photo.title, credit: photo.credit, license: photo.license, source: 'wikimedia_commons', fetchedAt: new Date().toISOString() } } as object },
    });
  }
  await prisma.$disconnect();
})();
