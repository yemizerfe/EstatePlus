/**
 * One-off correction for rows imported before the Real.et mapping was tightened:
 *  - a listing with bedrooms was being typed OFFICE when its title said
 *    "building",
 *  - addresses repeated "Addis Ababa".
 *
 * Both are recomputed from the stored row and its source URL, so the fix is
 * reproducible rather than hand-edited.
 *
 * Usage: npx tsx scripts/repair-real-et-rows.ts [--dry-run]
 */
import 'dotenv/config';

import { prisma } from '../src/infrastructure/database/prisma';
import { classifyRealEtPropertyType } from '../src/modules/external-sources/adapters/real-et.adapter';

const DRY_RUN = process.argv.includes('--dry-run');

function dedupeAddress(address: string | null): string | null {
  if (!address) return null;
  const parts: string[] = [];
  for (const part of address.split(',').map((p) => p.trim())) {
    if (!part) continue;
    if (!parts.some((existing) => existing.toLowerCase() === part.toLowerCase())) parts.push(part);
  }
  return parts.join(', ') || null;
}

async function main() {
  const rows = await prisma.property.findMany({
    where: { description: { contains: 'Source URL: https://real.et/properties/' } },
    select: { id: true, title: true, address: true, propertyType: true, bedrooms: true, description: true },
  });

  let typeFixed = 0;
  let addressFixed = 0;

  for (const row of rows) {
    const sourceUrl = row.description?.match(/Source URL:\s*(\S+)/)?.[1] ?? '';
    const nextType = classifyRealEtPropertyType(row.title, sourceUrl, row.bedrooms);
    const nextAddress = dedupeAddress(row.address);

    const typeChanged = nextType !== row.propertyType;
    const addressChanged = nextAddress !== row.address;
    if (!typeChanged && !addressChanged) continue;

    if (typeChanged) {
      typeFixed += 1;
      console.log(`${row.title}: ${row.propertyType} → ${nextType}`);
    }
    if (addressChanged) {
      addressFixed += 1;
      console.log(`  address: ${row.address} → ${nextAddress}`);
    }

    if (DRY_RUN) continue;

    await prisma.property.update({
      where: { id: row.id },
      data: {
        ...(typeChanged ? { propertyType: nextType } : {}),
        ...(addressChanged ? { address: nextAddress } : {}),
      },
    });
  }

  console.log(
    `\nscanned=${rows.length} typesFixed=${typeFixed} addressesFixed=${addressFixed}${DRY_RUN ? ' (dry run)' : ''}`,
  );
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('REAL.ET REPAIR FAILED:', error);
  await prisma.$disconnect();
  process.exit(1);
});
