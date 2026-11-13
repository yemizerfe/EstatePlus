/**
 * Enrich the neighborhood registry from two key-free public sources:
 *
 *  - OpenStreetMap Nominatim gives a coordinate for areas imported without one.
 *  - Wikimedia Commons gives a real photograph taken in or near that area,
 *    stored with its author and licence so the interface can attribute it.
 *
 * Both results are written into the record (centerLat/centerLng and
 * `metadata.image`), so the API serves them afterwards without any external
 * call at request time.
 *
 * Usage: npx tsx scripts/enrich-neighborhoods.ts [--force] [--limit N]
 */
import 'dotenv/config';
import axios from 'axios';

import { prisma } from '../src/infrastructure/database/prisma';
import { wikimediaCommonsAdapter } from '../src/modules/external-sources/adapters/wikimedia-commons.adapter';

const USER_AGENT = 'EstatePlus/1.0 (neighborhood registry; data-integration)';
const force = process.argv.includes('--force');
const limitArg = process.argv.indexOf('--limit');
const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : undefined;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function geocode(name: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await axios.get<
      Array<{ lat: string; lon: string; display_name?: string }>
    >('https://nominatim.openstreetmap.org/search', {
      timeout: 20_000,
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      params: { q: `${name}, Addis Ababa, Ethiopia`, format: 'jsonv2', limit: 1 },
    });
    const hit = Array.isArray(response.data) ? response.data[0] : undefined;
    if (!hit) return null;
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

async function main() {
  const neighborhoods = await prisma.neighborhood.findMany({
    where: { isActive: true },
    select: { id: true, name: true, centerLat: true, centerLng: true, metadata: true },
    orderBy: { name: 'asc' },
    ...(limit ? { take: limit } : {}),
  });

  let geocoded = 0;
  let photographed = 0;

  for (const neighborhood of neighborhoods) {
    const metadata = (neighborhood.metadata as Record<string, unknown> | null) ?? {};
    const existingImage = (metadata['image'] as { url?: string } | undefined)?.url;
    let lat = neighborhood.centerLat === null ? null : Number(neighborhood.centerLat);
    let lng = neighborhood.centerLng === null ? null : Number(neighborhood.centerLng);

    if (lat === null || lng === null) {
      const point = await geocode(neighborhood.name);
      await sleep(1200);
      if (point) {
        lat = point.lat;
        lng = point.lng;
        await prisma.neighborhood.update({
          where: { id: neighborhood.id },
          data: { centerLat: point.lat, centerLng: point.lng },
        });
        geocoded += 1;
        console.log(`coords  ${neighborhood.name} -> ${point.lat}, ${point.lng}`);
      }
    }

    if (existingImage && !force) continue;

    const photo = await wikimediaCommonsAdapter.fetchNeighborhoodPhoto({
      name: neighborhood.name,
      lat: lat !== null && Number.isFinite(lat) ? lat : null,
      lng: lng !== null && Number.isFinite(lng) ? lng : null,
    });
    await sleep(400);
    if (!photo) {
      console.log(`no photo ${neighborhood.name}`);
      continue;
    }

    await prisma.neighborhood.update({
      where: { id: neighborhood.id },
      data: {
        metadata: {
          ...metadata,
          image: {
            url: photo.imageUrl,
            pageUrl: photo.pageUrl,
            title: photo.title,
            credit: photo.credit,
            license: photo.license,
            source: 'wikimedia_commons',
            fetchedAt: new Date().toISOString(),
          },
        } as object,
      },
    });
    photographed += 1;
    console.log(`photo   ${neighborhood.name} -> ${photo.title}`);
  }

  console.log(`\nareas=${neighborhoods.length} geocoded=${geocoded} photographed=${photographed}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
