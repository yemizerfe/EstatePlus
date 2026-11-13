/**
 * Smoke test for the external data sources integration.
 * Runs each adapter against the REAL endpoints and the REAL database,
 * printing an honest pass/fail per source.
 *
 * Usage: npx tsx scripts/smoke-external-sources.ts
 */
import 'dotenv/config';

import { prisma } from '../src/infrastructure/database/prisma';
import { externalSourcesService } from '../src/modules/external-sources/external-sources.service';
import { cbeExchangeAdapter } from '../src/modules/external-sources/adapters/cbe-exchange.adapter';
import { openDataPortalAdapter } from '../src/modules/external-sources/adapters/open-data-portal.adapter';
import { nbeAdapter } from '../src/modules/external-sources/adapters/nbe.adapter';
import { essCpiAdapter } from '../src/modules/external-sources/adapters/ess-cpi.adapter';

function line(label: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(28)} ${detail}`);
}

async function main() {
  // 1. CBE exchange rates (may time out outside Ethiopia — reported honestly)
  try {
    const rates = await cbeExchangeAdapter.fetchDailyRates();
    line('CBE exchange rates', rates.length > 0, `${rates.length} currency rows`);
    if (rates.length > 0) {
      const summary = await externalSourcesService.syncCbeExchangeRates();
      line('  -> DB persist', summary.saved > 0, `saved=${summary.saved} errors=${summary.errors.length}`);
    }
  } catch (err) {
    line('CBE exchange rates', false, `unreachable from this network: ${err instanceof Error ? err.message.slice(0, 100) : err}`);
  }

  // 2. NBE page probe (honest: page reachable, values may not be parseable)
  const nbe = await nbeAdapter.fetchReferencePage();
  line('NBE reference page', nbe.reachable, nbe.note.slice(0, 120));

  // 2b. NBE CSV import path (the reliable NBE ingestion)
  const nbeCsv = 'date,currency,buying,selling\n2026-10-24,USD,132.5,133.9\n2026-10-24,EUR,144.1,145.8\n';
  const nbeImport = await externalSourcesService.importNbeCsv(nbeCsv);
  line('  -> NBE CSV import', nbeImport.saved === 2, `saved=${nbeImport.saved}`);

  // 3. ESS CPI page probe + CSV import
  const ess = await essCpiAdapter.fetchLatestReports();
  line('ESS CPI page', ess.reachable, `${ess.reports.length} report links; ${ess.note.slice(0, 80)}`);
  const essCsv = 'date,indicator,value\n2026-09-01,inflation,26.8\n2026-09-01,cpi,215.4\n';
  const essImport = await externalSourcesService.importEssCpiCsv(essCsv);
  line('  -> ESS CSV import', essImport.saved === 2, `saved=${essImport.saved} errors=${essImport.errors.length}`);

  // 4. World Bank (verified live)
  const wb = await externalSourcesService.syncWorldBank('2015:2024');
  line('World Bank indicators', wb.saved > 0, `saved=${wb.saved}/${wb.fetched}`);

  // 5. OSM Overpass (public instances capacity-limited; retry ok)
  try {
    const anyNeighborhood = await prisma.neighborhood.findFirst({
      where: { centerLat: { not: null }, centerLng: { not: null } },
    });
    if (anyNeighborhood) {
      const osm = await externalSourcesService.syncOsmAmenities({ neighborhoodId: anyNeighborhood.id });
      line('OSM Overpass amenities', osm.saved > 0 || osm.fetched > 0, `fetched=${osm.fetched} saved=${osm.saved} (nb=${anyNeighborhood.name})`);
    } else {
      // Fallback: raw bbox query near Addis Ababa center (no persistence without a neighborhood)
      const features = await (await import('../src/modules/external-sources/adapters/osm-overpass.adapter')).osmOverpassAdapter.queryAmenities({
        bbox: [8.98, 38.75, 9.02, 38.79],
        groups: ['hospitals'],
        limitPerGroup: 5,
      });
      line('OSM Overpass amenities', features.length > 0, `${features.length} features (raw query, no neighborhood to anchor)`);
    }
  } catch (err) {
    line('OSM Overpass amenities', false, `all instances failed (capacity-limited): ${err instanceof Error ? err.message.slice(0, 90) : err}`);
  }

  // 6. Admin boundaries ADM1 (verified live)
  const boundaries = await externalSourcesService.syncAdminBoundaries('ADM1');
  line('Admin boundaries ADM1', boundaries.saved > 0, `saved=${boundaries.saved}/${boundaries.fetched}`);

  // 7. Open data (HDX search; data.gov.et unreachable)
  const open = await externalSourcesService.searchOpenData('population', 3);
  line('Open data search (HDX)', open.datasets.length > 0, `${open.datasets.length} datasets; ${open.portalNote.slice(0, 70)}`);

  // DB row counts
  const [rates, macros, boundariesCount, amenities] = await Promise.all([
    prisma.exchangeRate.count(),
    prisma.macroIndicator.count(),
    prisma.geographicBoundary.count(),
    prisma.neighborhoodAmenity.count(),
  ]);
  console.log(`\nDB rows: exchange_rates=${rates} macro_indicators=${macros} geographic_boundaries=${boundariesCount} neighborhood_amenities=${amenities}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('SMOKE FAILED:', err);
  await prisma.$disconnect();
  process.exit(1);
});
