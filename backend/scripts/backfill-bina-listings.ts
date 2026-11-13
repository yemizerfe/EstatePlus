/**
 * Backfill BinaSmart-imported properties from their own listing pages.
 *
 * The search tool returns prices as free text ("3,500 / month", "on request"),
 * so earlier imports stored rows that the public services could not count. Each
 * listing page publishes a schema.org RealEstateListing block with
 * `offers.price` + `offers.priceCurrency`; this script reads it, refreshes the
 * property/listing attributes and marks the row as price-verified.
 *
 * Usage: npx tsx scripts/backfill-bina-listings.ts [--dry-run]
 */
import 'dotenv/config';

import { prisma } from '../src/infrastructure/database/prisma';
import { BINA_PRICE_VERIFICATION_MARKER, getVerifiedDetailPrice } from '../src/modules/bina';
import { BinaRawProperty } from '../src/modules/bina';
import { fetchBinaListingDetail } from '../src/modules/bina/bina-listing-detail';

const DRY_RUN = process.argv.includes('--dry-run');

const PROPERTY_TYPE_MAP: Record<string, 'APARTMENT' | 'VILLA' | 'CONDOMINIUM' | 'OFFICE' | 'RETAIL' | 'WAREHOUSE' | 'LAND'> = {
  apartment: 'APARTMENT',
  condominium: 'CONDOMINIUM',
  'house / villa': 'VILLA',
  house: 'VILLA',
  villa: 'VILLA',
  land: 'LAND',
  commercial: 'RETAIL',
  building: 'OFFICE',
};

function mapType(label: string | null): 'APARTMENT' | 'VILLA' | 'CONDOMINIUM' | 'OFFICE' | 'RETAIL' | 'WAREHOUSE' | 'LAND' | null {
  if (!label) return null;
  return PROPERTY_TYPE_MAP[label.trim().toLowerCase()] ?? null;
}

/** Shape expected by getVerifiedDetailPrice; only the fields it reads matter. */
function rawStub(sourceUrl: string): BinaRawProperty {
  return {
    id: `bina:${sourceUrl}`,
    title: null,
    description: null,
    type: null,
    beds: null,
    baths: null,
    size: null,
    area: null,
    company: null,
    phone: null,
    whatsapp: null,
    telegram: null,
    link: sourceUrl,
    checkedOnCompanySite: null,
    note: null,
    sourceUrl,
    listingType: null,
    priceOriginal: null,
    priceAmount: null,
    currency: null,
    priceUnit: null,
    pricePeriod: null,
    priceBasis: null,
    normalizationStatus: 'unparsed',
    normalizationNotes: null,
    fetchedAt: new Date(),
  };
}

async function main() {
  const properties = await prisma.property.findMany({
    where: { description: { contains: 'Source: BinaSmart' } },
    select: { id: true, title: true, description: true, propertyType: true, status: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${properties.length} BinaSmart-imported properties.`);

  let updated = 0;
  let noDetail = 0;
  let noVerifiedPrice = 0;
  let imagesAdded = 0;

  for (const property of properties) {
    const sourceUrl = property.description?.match(/Source URL:\s*(\S+)/)?.[1] ?? null;
    if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
      noDetail += 1;
      console.log(`SKIP  ${property.title} — no source URL recorded`);
      continue;
    }

    let detail;
    try {
      detail = await fetchBinaListingDetail(sourceUrl);
    } catch (error) {
      noDetail += 1;
      console.log(`SKIP  ${property.title} — page unreadable (${error instanceof Error ? error.message : error})`);
      continue;
    }

    if (!detail) {
      noDetail += 1;
      console.log(`SKIP  ${property.title} — no RealEstateListing JSON-LD`);
      continue;
    }

    const price = getVerifiedDetailPrice(detail, rawStub(sourceUrl));
    if (!price) {
      noVerifiedPrice += 1;
      console.log(
        `SKIP  ${property.title} — listing page states ${detail.priceAmount ?? 'no amount'} ${detail.currency ?? '(no currency)'} ${detail.listingType ?? ''}`,
      );
      continue;
    }

    const askingPrice = price.monthlyRent ?? price.amount;
    const isRent = price.listingType === 'rent';
    const postedAt =
      detail.datePosted && !Number.isNaN(detail.datePosted.getTime()) ? detail.datePosted : null;
    const marker = property.description?.includes(BINA_PRICE_VERIFICATION_MARKER)
      ? property.description
      : `${property.description ?? ''}\n${BINA_PRICE_VERIFICATION_MARKER}`;

    if (DRY_RUN) {
      console.log(
        `DRY   ${property.title} — ${price.listingType} ${askingPrice} ETB${isRent ? '/month' : ''}, ${detail.sizeSqm ?? '?'} m², posted ${postedAt?.toISOString().slice(0, 10) ?? 'unknown'}`,
      );
      continue;
    }

    await prisma.property.update({
      where: { id: property.id },
      data: {
        ...(detail.title ? { title: detail.title } : {}),
        description: marker,
        ...(mapType(detail.propertyTypeLabel) ? { propertyType: mapType(detail.propertyTypeLabel)! } : {}),
        ...(detail.sizeSqm && detail.sizeSqm > 0 ? { sizeSqm: detail.sizeSqm } : {}),
        ...(detail.bedrooms !== null ? { bedrooms: detail.bedrooms } : {}),
        ...(detail.bathrooms !== null ? { bathrooms: detail.bathrooms } : {}),
        ...(detail.address ? { address: detail.address } : {}),
        ...(postedAt ? { listingDate: postedAt } : {}),
        ...(isRent ? { rentalPrice: askingPrice } : { askingPrice }),
      },
    });

    const listing = await prisma.listing.findFirst({
      where: { propertyId: property.id },
      orderBy: { listedAt: 'desc' },
      select: { id: true, currentPrice: true },
    });

    if (listing) {
      await prisma.listing.update({
        where: { id: listing.id },
        data: {
          currentPrice: askingPrice,
          originalPrice: listing.currentPrice,
          rentalPrice: isRent ? askingPrice : null,
          ...(postedAt ? { listedAt: postedAt } : {}),
          status: 'ACTIVE',
        },
      });
    }

    if (detail.images.length > 0) {
      const existing = await prisma.propertyImage.count({ where: { propertyId: property.id } });
      if (existing === 0) {
        const created = await prisma.propertyImage.createMany({
          data: detail.images.map((imageUrl, index) => ({
            propertyId: property.id,
            imageUrl,
            altText: (detail!.title ?? property.title).slice(0, 250),
            isPrimary: index === 0,
            sortOrder: index,
          })),
          skipDuplicates: true,
        });
        imagesAdded += created.count;
      }
    }

    updated += 1;
    console.log(
      `OK    ${property.title} — ${price.listingType} ${askingPrice} ETB${isRent ? '/month' : ''}${detail.sizeSqm ? `, ${detail.sizeSqm} m²` : ''}`,
    );
  }

  console.log(
    `\nupdated=${updated} noDetail=${noDetail} noVerifiedPrice=${noVerifiedPrice} imagesAdded=${imagesAdded}${DRY_RUN ? ' (dry run)' : ''}`,
  );
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('BACKFILL FAILED:', error);
  await prisma.$disconnect();
  process.exit(1);
});
