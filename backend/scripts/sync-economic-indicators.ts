/**
 * Refresh the external economic series the market pages read:
 *   - World Bank Ethiopia indicators (population, GDP, inflation, urban share),
 *   - Commercial Bank of Ethiopia daily exchange rates.
 *
 * Both are public, keyless endpoints. A failure is reported as a failure; no
 * value is substituted from another publisher.
 *
 * Usage: npx tsx scripts/sync-economic-indicators.ts [--skip-world-bank] [--skip-cbe]
 */
import 'dotenv/config';

import { prisma } from '../src/infrastructure/database/prisma';
import { externalSourcesService } from '../src/modules/external-sources/external-sources.service';

async function main() {
  if (!process.argv.includes('--skip-world-bank')) {
    try {
      const summary = await externalSourcesService.syncWorldBank('2000:2026');
      console.log(
        `World Bank: fetched=${summary.fetched} saved=${summary.saved} errors=${summary.errors.length}`,
      );
      for (const error of summary.errors.slice(0, 3)) console.log(`  error: ${error}`);
    } catch (error) {
      console.log(`World Bank failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  if (!process.argv.includes('--skip-cbe')) {
    try {
      const summary = await externalSourcesService.syncCbeExchangeRates();
      console.log(`CBE exchange rates: fetched=${summary.fetched} saved=${summary.saved} errors=${summary.errors.length}`);
      for (const error of summary.errors.slice(0, 3)) console.log(`  error: ${error}`);
    } catch (error) {
      console.log(`CBE failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  const [macro, rates, economic] = await Promise.all([
    prisma.macroIndicator.count(),
    prisma.exchangeRate.count(),
    prisma.economicIndicator.count(),
  ]);
  console.log(`\nDB rows: macro_indicators=${macro} exchange_rates=${rates} economic_indicators=${economic}`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('ECONOMIC SYNC FAILED:', error);
  await prisma.$disconnect();
  process.exit(1);
});
