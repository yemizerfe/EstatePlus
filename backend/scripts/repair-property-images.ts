/**
 * Guarantees an apartment photograph on every apartment listing.
 *
 * Imported galleries sometimes lead with a marketing graphic, a chat
 * screenshot or an AI advert instead of a photograph of the unit. This script:
 *
 *  1. Drops non-photo entries (screenshots / ad creatives).
 *  2. Keeps the listing's own photograph as the primary image when it has one,
 *     so each card shows the unit that is actually for sale.
 *  3. Only when a gallery holds no usable photograph, fills it from the pool of
 *     photographs captured for that bedroom count (1BR from 1BR units, 2BR from
 *     2BR units, …).
 *
 * Every URL used already exists in this database: nothing is generated or
 * downloaded. Run with `npx tsx scripts/repair-property-images.ts`.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Gallery entries that are not photographs of the property. */
const NON_PHOTO_PATTERN = /screenshot|chatgpt|flyer|brochure|poster|logo|watermark|_ad\b/i;

const APARTMENT_TYPES = ['APARTMENT', 'CONDOMINIUM'];

function bedroomBucket(bedrooms: number): number {
  if (bedrooms <= 1) return 1;
  if (bedrooms >= 4) return 4;
  return bedrooms;
}

async function main() {
  const photographed = await prisma.property.findMany({
    where: {
      description: { contains: 'BinaSmart' },
      images: { some: {} },
    },
    select: { bedrooms: true, images: { select: { imageUrl: true }, orderBy: { sortOrder: 'asc' } } },
  });

  // Photographs of real units, grouped by bedroom count, used only as a
  // fallback for a listing whose gallery holds no usable photo.
  const pool = new Map<number, string[]>();
  for (const property of photographed) {
    const bucket = bedroomBucket(property.bedrooms);
    const list = pool.get(bucket) ?? [];
    for (const image of property.images) {
      if (!NON_PHOTO_PATTERN.test(image.imageUrl) && !list.includes(image.imageUrl)) {
        list.push(image.imageUrl);
      }
    }
    pool.set(bucket, list);
  }

  const buckets = [...pool.keys()].sort((a, b) => a - b);
  if (buckets.length === 0) {
    console.error('No photographed BinaSmart apartments found; nothing to use as a photo pool.');
    process.exitCode = 1;
    return;
  }

  const candidates = await prisma.property.findMany({
    where: { propertyType: { in: APARTMENT_TYPES } },
    select: {
      id: true,
      title: true,
      bedrooms: true,
      images: { select: { imageUrl: true, isPrimary: true, sortOrder: true } },
    },
  });

  let updated = 0;
  let dropped = 0;
  let filled = 0;
  const cursor = new Map<number, number>();

  for (const property of candidates) {
    const kept = property.images
      .map((image) => image.imageUrl)
      .filter((url) => !NON_PHOTO_PATTERN.test(url));
    dropped += property.images.length - kept.length;

    const ownPrimary = property.images.find((image) => image.isPrimary)?.imageUrl;
    let gallery: string[];

    if (kept.length > 0) {
      // The listing photographs itself; keep its own shot in front.
      const ordered = ownPrimary && kept.includes(ownPrimary)
        ? [ownPrimary, ...kept.filter((url) => url !== ownPrimary)]
        : kept;
      gallery = ordered.slice(0, 4);
    } else {
      const bucket = bedroomBucket(property.bedrooms);
      const bucketWithPhotos = pool.has(bucket)
        ? bucket
        : buckets.reduce((best, candidate) =>
            Math.abs(candidate - bucket) < Math.abs(best - bucket) ? candidate : best,
          );
      const sources = pool.get(bucketWithPhotos)!;
      const index = cursor.get(bucketWithPhotos) ?? 0;
      gallery = [sources[index % sources.length]!];
      cursor.set(bucketWithPhotos, index + 1);
      filled += 1;
    }

    const unchanged =
      property.images.length === gallery.length &&
      gallery.every((url, position) => property.images[position]?.imageUrl === url) &&
      property.images[0]?.isPrimary === true &&
      property.images.slice(1).every((image) => image.isPrimary === false);

    if (unchanged) continue;

    await prisma.$transaction([
      prisma.propertyImage.deleteMany({ where: { propertyId: property.id } }),
      prisma.propertyImage.createMany({
        data: gallery.map((imageUrl, position) => ({
          propertyId: property.id,
          imageUrl,
          altText: property.title,
          isPrimary: position === 0,
          sortOrder: position,
        })),
      }),
    ]);
    updated += 1;
  }

  console.log(
    `Galleries repaired: ${updated} properties updated, ${dropped} non-photo image(s) removed, ` +
      `${filled} gallery(ies) filled from the bedroom-matched pool ` +
      `(${buckets.map((bucket) => `${bucket}BR:${pool.get(bucket)!.length}`).join(', ')}).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
