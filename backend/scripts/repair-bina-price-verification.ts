/**
 * Repairs BinaSmart properties that were marked as ETB-verified even though
 * their provenance block says the price string was ambiguous and carried no
 * currency. Those rows must not feed birr market metrics or public listings.
 *
 * Idempotent: rows already carrying the unverified label are left untouched.
 *
 * Run with: npx tsx scripts/repair-bina-price-verification.ts
 */
import { prisma } from '../src/infrastructure/database/prisma';
import { BINA_PRICE_VERIFICATION_MARKER } from '../src/modules/bina';

const UNVERIFIED_LABEL = 'Price verification: unverified price string from search tool';

/** True when the row's own provenance shows an explicit ETB Offer price. */
function hasEtbEvidence(description: string): boolean {
  const normalization = /Price normalization:\s*(\w+)/.exec(description)?.[1];
  const normalizedPrice = /Price normalized:\s*([^|]*)/.exec(description)?.[1] ?? '';
  return normalization === 'normalized' && /\bETB\b/.test(normalizedPrice);
}

async function main(): Promise<void> {
  const rows = await prisma.property.findMany({
    where: { description: { contains: 'Source: BinaSmart' } },
    select: { id: true, title: true, description: true },
  });

  let repaired = 0;
  for (const row of rows) {
    const description = row.description ?? '';
    if (!description.includes(BINA_PRICE_VERIFICATION_MARKER)) continue;
    if (hasEtbEvidence(description)) continue;

    const next = description.replace(
      BINA_PRICE_VERIFICATION_MARKER,
      `${UNVERIFIED_LABEL} (no ETB amount in the listing page's Offer)`,
    );
    await prisma.property.update({ where: { id: row.id }, data: { description: next } });
    repaired += 1;
    console.log(`repaired ${row.id} — ${row.title?.slice(0, 60) ?? '(untitled)'}`);
  }

  console.log(`\nscanned ${rows.length} BinaSmart rows, repaired ${repaired}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
