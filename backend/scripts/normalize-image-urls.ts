/**
 * Rewrites stored Wikimedia URLs onto the host that actually serves images.
 *
 * Commons `imageinfo` hands back thumbnails on `thumb.wikimedia.org` with
 * tracking parameters. Browsers get no pixels from that host, so every stored
 * photo URL is moved to `upload.wikimedia.org` and the parameters are dropped.
 *
 * Usage: npx tsx scripts/normalize-image-urls.ts
 */
import 'dotenv/config';

import { prisma } from '../src/infrastructure/database/prisma';
import { normalizeCommonsImageUrl } from '../src/shared/utils/commons-image';

async function main() {
  let neighborhoods = 0;
  let propertyImages = 0;

  const areas = await prisma.neighborhood.findMany({
    select: { id: true, name: true, metadata: true },
  });
  for (const area of areas) {
    const metadata = (area.metadata as Record<string, unknown> | null) ?? {};
    const image = metadata['image'] as { url?: string } | undefined;
    const clean = normalizeCommonsImageUrl(image?.url);
    if (!image?.url || !clean || clean === image.url) continue;
    await prisma.neighborhood.update({
      where: { id: area.id },
      data: { metadata: { ...metadata, image: { ...image, url: clean } } as object },
    });
    neighborhoods += 1;
  }

  const images = await prisma.propertyImage.findMany({
    where: { imageUrl: { contains: 'wikimedia.org' } },
    select: { id: true, imageUrl: true },
  });
  for (const image of images) {
    const clean = normalizeCommonsImageUrl(image.imageUrl);
    if (!clean || clean === image.imageUrl) continue;
    await prisma.propertyImage.update({ where: { id: image.id }, data: { imageUrl: clean } });
    propertyImages += 1;
  }

  console.log(`normalised ${neighborhoods} area photo(s) and ${propertyImages} property image(s)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
