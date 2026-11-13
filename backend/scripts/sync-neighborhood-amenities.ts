/**
 * Give every Addis Ababa sub-city a real map centre, then import its nearby
 * amenities from OpenStreetMap (Overpass).
 *
 * - Centres come from Nominatim (OpenStreetMap's geocoder), one request per
 *   sub-city with the required 1 request/second pace and an identifying
 *   User-Agent. The returned place is stored with its display name so the
 *   attribution is auditable.
 * - Amenities come from public Overpass instances; nothing is invented and
 *   every imported amenity keeps its OSM id and tags.
 *
 * Usage: npx tsx scripts/sync-neighborhood-amenities.ts [--radius 3000] [--only Bole] [--skip-geocode]
 */
import 'dotenv/config';

import { prisma } from '../src/infrastructure/database/prisma';
import { externalSourcesService } from '../src/modules/external-sources/external-sources.service';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'EstatePlus/1.0 (Addis Ababa market intelligence; amenities import)';

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index > -1 ? process.argv[index + 1] : undefined;
}

const RADIUS = Number(argValue('--radius') ?? 2500);
const ONLY = argValue('--only');
const SKIP_GEOCODE = process.argv.includes('--skip-geocode');

interface GeocodeResult {
  lat: number;
  lon: number;
  displayName: string;
  boundingBox: [number, number, number, number] | null;
}

async function geocode(query: string): Promise<GeocodeResult | null> {
  const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=jsonv2&limit=1&addressdetails=1`;
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`Nominatim responded ${response.status}`);
  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
    boundingbox?: [string, string, string, string];
  }>;
  const first = results[0];
  if (!first) return null;
  const boundingBox = first.boundingbox
    ? (first.boundingbox.map(Number) as [number, number, number, number])
    : null;
  return {
    lat: Number(first.lat),
    lon: Number(first.lon),
    displayName: first.display_name,
    boundingBox,
  };
}

async function main() {
  const neighborhoods = await prisma.neighborhood.findMany({
    where: {
      city: { equals: 'Addis Ababa', mode: 'insensitive' },
      ...(ONLY ? { name: { equals: ONLY, mode: 'insensitive' } } : { name: { not: 'Addis Ababa' } }),
    },
    select: { id: true, name: true, centerLat: true, centerLng: true },
    orderBy: { name: 'asc' },
  });

  if (neighborhoods.length === 0) throw new Error('No Addis Ababa sub-city rows found.');

  let geocoded = 0;
  let amenityTotal = 0;

  for (const neighborhood of neighborhoods) {
    console.log(`\n=== ${neighborhood.name}`);

    if (!SKIP_GEOCODE) {
      try {
        const place = await geocode(`${neighborhood.name}, Addis Ababa, Ethiopia`);
        if (!place) {
          console.log('  geocode: no result; skipping amenities (no centre to anchor them)');
          continue;
        }
        await prisma.neighborhood.update({
          where: { id: neighborhood.id },
          data: {
            centerLat: place.lat,
            centerLng: place.lon,
            metadata: {
              geocodedFrom: 'Nominatim (OpenStreetMap)',
              geocodedAt: new Date().toISOString(),
              nominatimDisplayName: place.displayName,
              nominatimBoundingBox: place.boundingBox,
            },
          },
        });
        geocoded += 1;
        console.log(`  centre ${place.lat.toFixed(5)}, ${place.lon.toFixed(5)} — ${place.displayName}`);
      } catch (error) {
        console.log(`  geocode failed: ${error instanceof Error ? error.message : error}`);
        continue;
      }
      // Nominatim usage policy: at most one request per second.
      await new Promise((resolve) => setTimeout(resolve, 1_200));
    }

    const refreshed = await prisma.neighborhood.findUnique({
      where: { id: neighborhood.id },
      select: { centerLat: true, centerLng: true },
    });
    if (!refreshed?.centerLat || !refreshed?.centerLng) {
      console.log('  no centre stored; skipping amenities');
      continue;
    }

    try {
      const summary = await externalSourcesService.syncOsmAmenities({
        neighborhoodId: neighborhood.id,
        radiusMeters: RADIUS,
      });
      amenityTotal += summary.saved;
      console.log(`  amenities fetched=${summary.fetched} saved=${summary.saved}`);
      if (summary.errors.length > 0) console.log(`  errors: ${summary.errors.slice(0, 3).join('; ')}`);

      // Record the amenity count as a neighbourhood statistic, sourced to OSM.
      const period = new Date().toISOString().slice(0, 7);
      const count = await prisma.neighborhoodAmenity.count({
        where: { neighborhoodId: neighborhood.id },
      });
      await prisma.neighborhoodStatistic.upsert({
        where: {
          neighborhoodId_period_statisticType: {
            neighborhoodId: neighborhood.id,
            statisticType: 'AMENITY_COUNT',
            period,
          },
        },
        update: { value: count, source: 'OpenStreetMap via Overpass', unit: 'amenities' },
        create: {
          neighborhoodId: neighborhood.id,
          statisticType: 'AMENITY_COUNT',
          period,
          value: count,
          unit: 'amenities',
          source: 'OpenStreetMap via Overpass',
        },
      });
      console.log(`  stored amenity total for ${period}: ${count}`);
    } catch (error) {
      console.log(`  amenity sync failed: ${error instanceof Error ? error.message : error}`);
    }

    // Be a good citizen of the shared Overpass instances.
    await new Promise((resolve) => setTimeout(resolve, 4_000));
  }

  const [amenities, coords] = await Promise.all([
    prisma.neighborhoodAmenity.count(),
    prisma.neighborhood.count({ where: { centerLat: { not: null } } }),
  ]);
  console.log(`\ngeocoded=${geocoded} amenitiesSaved=${amenityTotal}`);
  console.log(`DB rows: neighborhood_amenities=${amenities}, neighborhoodsWithCentre=${coords}`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('AMENITY SYNC FAILED:', error);
  await prisma.$disconnect();
  process.exit(1);
});
