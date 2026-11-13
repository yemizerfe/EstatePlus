/**
 * Publish the World Bank Ethiopia series into `economic_indicators`, the table
 * the economics and scenario pages read, and drop the fabricated seed rows that
 * previously stood in for this data.
 *
 * Only indicators with a matching local enum are mapped; everything else stays
 * in `macro_indicators`. Annual World Bank observations are dated 31 December
 * of the reference year, which is what the value describes.
 *
 * Usage: npx tsx scripts/import-worldbank-economic-indicators.ts [--keep-placeholders]
 */
import 'dotenv/config';

import { prisma } from '../src/infrastructure/database/prisma';

const MAPPING: Array<{
  code: string;
  indicatorType:
    | 'INFLATION_RATE'
    | 'GDP_GROWTH'
    | 'EXCHANGE_RATE'
    | 'INTEREST_RATE'
    | 'CPI'
    | 'UNEMPLOYMENT_RATE';
  unit: string;
}> = [
  { code: 'FP.CPI.TOTL.ZG', indicatorType: 'INFLATION_RATE', unit: '%' },
  { code: 'NY.GDP.MKTP.KD.ZG', indicatorType: 'GDP_GROWTH', unit: '%' },
];

const SOURCE = 'World Bank Open Data';

async function main() {
  let saved = 0;

  for (const mapping of MAPPING) {
    const rows = await prisma.macroIndicator.findMany({
      where: { indicatorCode: mapping.code },
      select: { year: true, value: true, indicatorName: true },
      orderBy: { year: 'asc' },
    });

    for (const row of rows) {
      const recordedAt = new Date(Date.UTC(row.year, 11, 31));
      await prisma.economicIndicator.upsert({
        where: {
          indicatorType_recordedAt: { indicatorType: mapping.indicatorType, recordedAt },
        },
        update: {
          value: Number(row.value),
          unit: mapping.unit,
          source: SOURCE,
          sourceUrl: `https://api.worldbank.org/v2/country/ETH/indicator/${mapping.code}?format=json`,
          notes: `${row.indicatorName} (World Bank annual observation for ${row.year})`,
        },
        create: {
          indicatorType: mapping.indicatorType,
          value: Number(row.value),
          unit: mapping.unit,
          recordedAt,
          source: SOURCE,
          sourceUrl: `https://api.worldbank.org/v2/country/ETH/indicator/${mapping.code}?format=json`,
          notes: `${row.indicatorName} (World Bank annual observation for ${row.year})`,
        },
      });
      saved += 1;
    }
    console.log(`${mapping.code} → ${mapping.indicatorType}: ${rows.length} annual observations`);
  }

  if (!process.argv.includes('--keep-placeholders')) {
    const removed = await prisma.economicIndicator.deleteMany({ where: { source: 'SEED_PLACEHOLDER' } });
    console.log(`Removed ${removed.count} fabricated SEED_PLACEHOLDER indicator rows.`);
  }

  const [total, bySource] = await Promise.all([
    prisma.economicIndicator.count(),
    prisma.economicIndicator.groupBy({ by: ['source'], _count: { _all: true } }),
  ]);
  console.log(`\nsaved=${saved} total economic_indicators=${total}`);
  for (const row of bySource) console.log(`  ${row.source ?? '(no source)'}: ${row._count._all}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('ECONOMIC INDICATOR IMPORT FAILED:', error);
  await prisma.$disconnect();
  process.exit(1);
});
