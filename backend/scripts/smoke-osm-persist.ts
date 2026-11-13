/**
 * Proves OSM amenity persistence end-to-end: creates a throwaway neighborhood,
 * syncs OSM Overpass amenities anchored to it, verifies DB rows, then removes
 * the throwaway data so the dev DB stays clean.
 *
 * Usage: npx tsx scripts/smoke-osm-persist.ts
 */
import 'dotenv/config';

import { prisma } from '../src/infrastructure/database/prisma';
import { externalSourcesService } from '../src/modules/external-sources/external-sources.service';

async function main() {
  const stamp = Date.now();
  const hood = await prisma.neighborhood.create({
    data: {
      name: `Bole temp OSM smoke ${stamp}`,
      slug: `bole-temp-osm-smoke-${stamp}`,
      city: 'Addis Ababa',
      // Bole area, Addis Ababa — dense with amenities
      centerLat: 8.9806,
      centerLng: 38.7578,
    },
  });
  console.log(`temp neighborhood created: ${hood.id}`);

  try {
    const summary = await externalSourcesService.syncOsmAmenities({ neighborhoodId: hood.id });
    console.log(
      `OSM sync: fetched=${summary.fetched} saved=${summary.saved} errors=${summary.errors.length}`,
    );
    const rows = await prisma.neighborhoodAmenity.count({ where: { neighborhoodId: hood.id } });
    console.log(`DB rows for temp neighborhood: ${rows}`);
    console.log(rows > 0 && summary.saved > 0 ? 'PASS  OSM amenity persistence' : 'FAIL  OSM amenity persistence');
    if (summary.errors.length) console.log('errors:', summary.errors.slice(0, 3));
  } finally {
    await prisma.neighborhoodAmenity.deleteMany({ where: { neighborhoodId: hood.id } });
    await prisma.neighborhood.delete({ where: { id: hood.id } });
    console.log('temp neighborhood + amenities removed');
  }
}

main()
  .catch((err) => {
    console.error('FAIL', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());