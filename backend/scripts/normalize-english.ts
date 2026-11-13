/**
 * One-off repair: the app is presented in English only, so records imported
 * from feeds that publish Amharic place names or descriptions are rewritten
 * here. Titles and addresses keep their facts with the place name translated;
 * an Amharic description is replaced with an English summary built from the
 * record's own structured fields (never invented copy).
 *
 * Usage: npx ts-node scripts/normalize-english.ts [--dry]
 */
import { prisma } from '../src/infrastructure/database/prisma';
import { hasAmharic, isAmharicProse, toEnglishText } from '../src/shared/utils/english';

const dryRun = process.argv.includes('--dry');

const TYPE_LABEL: Record<string, string> = {
  APARTMENT: 'apartment',
  VILLA: 'villa',
  CONDOMINIUM: 'condominium',
  HOUSE: 'house',
  OFFICE: 'office',
  RETAIL: 'retail space',
  WAREHOUSE: 'warehouse',
  LAND: 'land plot',
};

function englishDescription(property: {
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  sizeSqm: unknown;
  address: string | null;
  neighborhood: { name: string } | null;
  askingPrice: unknown;
  rentalPrice: unknown;
}): string {
  const type = TYPE_LABEL[property.propertyType] ?? property.propertyType.toLowerCase();
  const bedrooms = property.bedrooms > 0 ? `${property.bedrooms} bedroom ` : '';
  const size = property.sizeSqm ? `${Number(property.sizeSqm).toLocaleString()} m²` : null;
  const bathrooms = property.bathrooms > 0 ? `${property.bathrooms} bathroom` : null;
  const place = property.neighborhood?.name ?? property.address;
  const price = property.rentalPrice
    ? `ETB ${Number(property.rentalPrice).toLocaleString()} per month`
    : property.askingPrice
      ? `ETB ${Number(property.askingPrice).toLocaleString()}`
      : null;

  const facts = [bedrooms + type, size, bathrooms].filter(Boolean).join(', ');
  return [
    `${facts.charAt(0).toUpperCase()}${facts.slice(1)}${place ? ` in ${place}` : ''}.`,
    price ? `Offered at ${price}.` : null,
    'Contact the listing owner through EstatePlus for a viewing.',
  ]
    .filter(Boolean)
    .join(' ');
}

async function main() {
  const properties = await prisma.property.findMany({
    select: {
      id: true,
      title: true,
      address: true,
      description: true,
      propertyType: true,
      bedrooms: true,
      bathrooms: true,
      sizeSqm: true,
      askingPrice: true,
      rentalPrice: true,
      neighborhood: { select: { name: true } },
    },
  });

  let updated = 0;
  for (const property of properties) {
    const patch: Record<string, string | null> = {};

    for (const field of ['title', 'address'] as const) {
      const value = property[field];
      if (!value || !hasAmharic(value)) continue;
      const cleaned = toEnglishText(value);
      if (cleaned && cleaned !== value) patch[field] = cleaned;
    }

    if (property.description && isAmharicProse(property.description)) {
      patch.description = englishDescription(property);
    } else if (property.description && hasAmharic(property.description)) {
      const cleaned = toEnglishText(property.description);
      if (cleaned) patch.description = cleaned;
    }

    if (Object.keys(patch).length === 0) continue;
    updated += 1;
    console.log(`${dryRun ? '[dry] ' : ''}${property.id} ${JSON.stringify(patch).slice(0, 200)}`);
    if (!dryRun) {
      await prisma.property.update({ where: { id: property.id }, data: patch });
    }
  }

  const neighborhoods = await prisma.neighborhood.findMany({
    select: { id: true, name: true, description: true },
  });
  for (const neighborhood of neighborhoods) {
    const patch: Record<string, string> = {};
    if (hasAmharic(neighborhood.name)) {
      const cleaned = toEnglishText(neighborhood.name);
      if (cleaned) patch.name = cleaned;
    }
    if (hasAmharic(neighborhood.description)) {
      const cleaned = toEnglishText(neighborhood.description);
      patch.description = cleaned ?? '';
    }
    if (Object.keys(patch).length === 0) continue;
    updated += 1;
    console.log(`${dryRun ? '[dry] ' : ''}neighborhood ${neighborhood.id} ${JSON.stringify(patch)}`);
    if (!dryRun) {
      await prisma.neighborhood.update({ where: { id: neighborhood.id }, data: patch });
    }
  }

  const reports = await prisma.report.findMany({
    select: { id: true, title: true, description: true, analysis: true, conclusions: true },
  });
  for (const report of reports) {
    const patch: Record<string, string | null> = {};
    if (hasAmharic(report.title)) patch.title = toEnglishText(report.title);
    if (hasAmharic(report.description)) patch.description = toEnglishText(report.description) ?? '';
    if (hasAmharic(report.analysis)) patch.analysis = toEnglishText(report.analysis) ?? '';
    if (hasAmharic(report.conclusions)) patch.conclusions = toEnglishText(report.conclusions) ?? '';
    if (Object.keys(patch).length === 0) continue;
    updated += 1;
    console.log(`${dryRun ? '[dry] ' : ''}report ${report.id} ${JSON.stringify(patch).slice(0, 160)}`);
    if (!dryRun) {
      await prisma.report.update({ where: { id: report.id }, data: patch });
    }
  }

  console.log(`\n${dryRun ? 'Would update' : 'Updated'} ${updated} record(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
