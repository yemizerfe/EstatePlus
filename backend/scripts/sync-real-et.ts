/**
 * Import Real.et's Addis Ababa listings into this database.
 *
 * Every field comes from the listing page's schema.org `RealEstateListing`
 * block: ETB amount, floor size, bedrooms, bathrooms, area, images and posting
 * date. Records without an explicit ETB amount are skipped rather than counted.
 *
 * Usage: npx tsx scripts/sync-real-et.ts [--dry-run] [--limit N]
 */
import 'dotenv/config';

import { prisma } from '../src/infrastructure/database/prisma';
import {
  REAL_ET_BASE,
  REAL_ET_SOURCE_NAME,
  REAL_ET_SOURCE_TYPE,
  buildRealEtAddress,
  classifyRealEtPropertyType,
  fetchRealEtListing,
  listRealEtListingUrls,
} from '../src/modules/external-sources/adapters/real-et.adapter';

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_ARG = process.argv.indexOf('--limit');
const LIMIT = LIMIT_ARG > -1 ? Number(process.argv[LIMIT_ARG + 1]) : Number.POSITIVE_INFINITY;

export const REAL_ET_PRICE_VERIFICATION_MARKER =
  'Price verification: ETB amount read from the Real.et listing page (schema.org Offer)';

/** Local place names → the sub-city rows this database already holds. */
const AREA_TO_NEIGHBORHOOD: Record<string, string> = {
  bole: 'Bole',
  'bole atlas': 'Bole',
  atlas: 'Bole',
  'bole medhanialem': 'Bole',
  'bole bulbula': 'Bole',
  'bole arabsa': 'Bole',
  cmc: 'Yeka',
  ayat: 'Yeka',
  summit: 'Bole',
  gerji: 'Bole',
  megenagna: 'Bole',
  shiromeda: 'Yeka',
  yeka: 'Yeka',
  sarbet: 'Nifas Silk-Lafto',
  lafto: 'Nifas Silk-Lafto',
  lebu: 'Nifas Silk-Lafto',
  jemo: 'Nifas Silk-Lafto',
  'old airport': 'Nifas Silk-Lafto',
  kazanchis: 'Kirkos',
  kirkos: 'Kirkos',
  piassa: 'Arada',
  piazza: 'Arada',
  merkato: 'Arada',
  arada: 'Arada',
  kolfe: 'Kolfe Keranio',
  gulele: 'Gulele',
  lideta: 'Lideta',
  saris: 'Akaky Kaliti',
  'akaky kaliti': 'Akaky Kaliti',
  figa: 'Akaky Kaliti',
  // Amharic place names as published on the listing pages.
  'ቦሌ': 'Bole',
  'አያት': 'Yeka',
  'ሰሚት': 'Bole',
  'ሳርቤት': 'Nifas Silk-Lafto',
  'ሳሪስ': 'Akaky Kaliti',
  'ካዛንችስ': 'Kirkos',
  'ፒያሳ': 'Arada',
  'ጉለሌ': 'Gulele',
  'ኮልፌ': 'Kolfe Keranio',
  'ልደታ': 'Lideta',
  'ጃሞ': 'Nifas Silk-Lafto',
};

function resolveAreaName(...candidates: Array<string | null>): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    for (const part of candidate.split(/[,|]/)) {
      const key = part.trim().toLowerCase();
      if (!key) continue;
      if (AREA_TO_NEIGHBORHOOD[key]) return AREA_TO_NEIGHBORHOOD[key]!;
      for (const [needle, neighborhood] of Object.entries(AREA_TO_NEIGHBORHOOD)) {
        if (key.includes(needle)) return neighborhood;
      }
    }
  }
  return null;
}

async function main() {
  console.log('Enumerating Real.et Addis Ababa listing pages…');
  const urls = await listRealEtListingUrls();
  console.log(`Found ${urls.length} listing URLs.`);

  const neighborhoods = await prisma.neighborhood.findMany({
    select: { id: true, name: true, city: true },
  });
  const neighborhoodId = (name: string | null): string => {
    const match = neighborhoods.find(
      (neighborhood) => neighborhood.city.toLowerCase() === 'addis ababa' && neighborhood.name === name,
    );
    return match?.id ?? neighborhoods.find((n) => n.name === 'Addis Ababa')!.id;
  };

  const owner = await prisma.user.findFirst({
    where: { role: { in: ['ADMIN', 'ANALYST'] }, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!owner) throw new Error('No ADMIN/ANALYST user exists; run the seed or create-admin first.');

  const source = await prisma.dataSource.upsert({
    where: { name: REAL_ET_SOURCE_NAME },
    update: { description: `Real.et Addis Ababa listings adapter (${REAL_ET_BASE})` },
    create: {
      name: REAL_ET_SOURCE_NAME,
      sourceType: REAL_ET_SOURCE_TYPE,
      description: `Real.et Addis Ababa listings adapter (${REAL_ET_BASE})`,
    },
    select: { id: true },
  }).catch(async () => {
    // `name` is not unique in every deployment; fall back to a lookup.
    const existing = await prisma.dataSource.findFirst({ where: { name: REAL_ET_SOURCE_NAME } });
    if (existing) return { id: existing.id };
    return prisma.dataSource.create({
      data: {
        name: REAL_ET_SOURCE_NAME,
        sourceType: REAL_ET_SOURCE_TYPE,
        description: `Real.et Addis Ababa listings adapter (${REAL_ET_BASE})`,
      },
      select: { id: true },
    });
  });

  const job = DRY_RUN
    ? null
    : await prisma.dataImportJob.create({
        data: {
          sourceId: source.id,
          jobType: 'REAL_ET_LISTING_IMPORT',
          status: 'processing',
          startedAt: new Date(),
          createdBy: null,
        },
        select: { id: true },
      });

  let imported = 0;
  let skippedNoPrice = 0;
  let skippedDuplicate = 0;
  let failed = 0;
  let imagesAdded = 0;
  const touched: string[] = [];

  for (const url of urls.slice(0, LIMIT)) {
    let listing;
    try {
      listing = await fetchRealEtListing(url);
    } catch (error) {
      failed += 1;
      console.log(`FAIL  ${url} — ${error instanceof Error ? error.message : error}`);
      continue;
    }

    if (!listing) {
      failed += 1;
      console.log(`FAIL  ${url} — no RealEstateListing JSON-LD`);
      continue;
    }

    if (
      !listing.priceAmount ||
      listing.currency?.toUpperCase() !== 'ETB' ||
      !listing.listingType
    ) {
      skippedNoPrice += 1;
      console.log(
        `SKIP  ${listing.title ?? url} — ${listing.priceAmount ?? 'no amount'} ${listing.currency ?? '(no currency)'} ${listing.listingType ?? ''}`,
      );
      continue;
    }

    const duplicate = await prisma.property.findFirst({
      where: { description: { contains: url } },
      select: { id: true },
    });
    if (duplicate) {
      skippedDuplicate += 1;
      continue;
    }

    const isRent = listing.listingType === 'rent';
    const price = listing.priceAmount;
    const postedAt =
      listing.datePosted && !Number.isNaN(listing.datePosted.getTime()) ? listing.datePosted : new Date();
    const propertyType = classifyRealEtPropertyType(listing.title, url, listing.bedrooms);
    const areaName = resolveAreaName(listing.neighborhood, listing.address, listing.title);
    const description = [
      listing.description,
      '',
      `Source: ${REAL_ET_SOURCE_NAME} (${REAL_ET_BASE})`,
      `Source URL: ${url}`,
      REAL_ET_PRICE_VERIFICATION_MARKER,
      `Listed price as published: ETB ${price.toLocaleString('en-US')}${isRent ? ' per month' : ''}`,
      `Seller: ${listing.seller ?? 'not stated'}`,
      `Fetched at: ${new Date().toISOString()}`,
    ]
      .filter((line) => line !== null && line !== undefined)
      .join('\n');

    if (DRY_RUN) {
      console.log(
        `DRY   ${listing.title ?? url} — ${listing.listingType} ${price} ETB${isRent ? '/month' : ''} ${listing.sizeSqm ?? '?'} m² in ${areaName ?? 'unmapped area'}`,
      );
      imported += 1;
      continue;
    }

    try {
      const property = await prisma.property.create({
        data: {
          title: listing.title ?? 'Real.et listing',
          description,
          propertyType,
          condition: 'GOOD',
          neighborhoodId: neighborhoodId(areaName),
          address: buildRealEtAddress(listing),
          sizeSqm: listing.sizeSqm ?? 0,
          bedrooms: listing.bedrooms ?? 0,
          bathrooms: listing.bathrooms ?? 0,
          askingPrice: price,
          rentalPrice: isRent ? price : null,
          listingDate: postedAt,
          status: 'APPROVED',
          ownerId: owner.id,
          approvedBy: owner.id,
          approvedAt: new Date(),
        },
        select: { id: true },
      });

      await prisma.listing.create({
        data: {
          propertyId: property.id,
          listingType: isRent ? 'RENT' : 'SALE',
          currentPrice: price,
          originalPrice: price,
          rentalPrice: isRent ? price : null,
          status: 'ACTIVE',
          listedAt: postedAt,
        },
      });

      if (listing.images.length > 0) {
        const created = await prisma.propertyImage.createMany({
          data: listing.images.map((imageUrl, index) => ({
            propertyId: property.id,
            imageUrl,
            altText: (listing!.title ?? 'Real.et listing').slice(0, 250),
            isPrimary: index === 0,
            sortOrder: index,
          })),
          skipDuplicates: true,
        });
        imagesAdded += created.count;
      }

      imported += 1;
      touched.push(`${listing.title ?? url} (${areaName ?? 'Addis Ababa'}, ${listing.listingType}, ETB ${price})`);
    } catch (error) {
      failed += 1;
      console.log(`FAIL  ${url} — ${error instanceof Error ? error.message : error}`);
    }
  }

  if (job) {
    await prisma.dataImportJob.update({
      where: { id: job.id },
      data: {
        status: failed > 0 && imported === 0 ? 'failed' : 'completed',
        recordsReceived: urls.length,
        recordsValid: imported,
        recordsRejected: skippedNoPrice + skippedDuplicate + failed,
        errorLog:
          failed > 0
            ? { failed, note: 'Listing pages that could not be read are reported, not inferred' }
            : undefined,
        completedAt: new Date(),
      },
    });
  }

  console.log('\nImported listings:');
  for (const line of touched) console.log(`  • ${line}`);
  console.log(
    `\nimported=${imported} skippedNoPrice=${skippedNoPrice} skippedDuplicate=${skippedDuplicate} failed=${failed} images=${imagesAdded}${DRY_RUN ? ' (dry run)' : ''}`,
  );
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('REAL.ET SYNC FAILED:', error);
  await prisma.$disconnect();
  process.exit(1);
});
