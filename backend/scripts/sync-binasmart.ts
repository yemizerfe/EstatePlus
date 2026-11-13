/**
 * Bounded, resumable BinaSmart import over the official MCP server.
 *
 * BinaSmart's terms allow building on the MCP but forbid copying the index
 * wholesale, and the no-key quota is 20 requests/hour per address (shared with
 * /api/knowledge/search). So this script:
 *   - runs a handful of area/type/listing queries per invocation (default 8),
 *   - persists which queries already ran in a state file, so the next run
 *     continues instead of repeating them,
 *   - stops immediately on HTTP 429 and reports the retry window,
 *   - keeps only records whose price the listing page states in ETB.
 *
 * Usage: npx tsx scripts/sync-binasmart.ts [--max-queries N] [--reset]
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

import { prisma } from '../src/infrastructure/database/prisma';
import { binaSmartService } from '../src/modules/bina';

const STATE_FILE = path.join(__dirname, '..', '.bina-sync-state.json');

const AREAS = [
  'Bole',
  'Sarbet',
  'CMC',
  'Ayat',
  'Gerji',
  'Summit',
  'Megenagna',
  'Piassa',
  'Kazanchis',
  'Lebu',
  'Jemo',
  'Lafto',
  'Old Airport',
  'Shiromeda',
  'Beshale',
  'Gulele',
  'Kolfe',
  'Saris',
  'Merkato',
  'Yeka',
  'Bole Bulbula',
  'Bole Arabsa',
  'Atlas',
];

const TYPES = ['Apartment', 'Condominium', 'House / Villa', 'Commercial'];
const LISTINGS: Array<'sale' | 'rent'> = ['sale', 'rent'];

interface SyncState {
  /** Key → ISO timestamp of the last successful run. */
  done: Record<string, string>;
}

function loadState(): SyncState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as SyncState;
  } catch {
    return { done: {} };
  }
}

function saveState(state: SyncState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function argValue(flag: string, fallback: number): number {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  const parsed = Number(process.argv[index + 1]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Queries not yet attempted, most informative first (sale before rent). */
function nextQueries(state: SyncState, limit: number): Array<{ area: string; type: string; listing: 'sale' | 'rent' }> {
  const queue: Array<{ area: string; type: string; listing: 'sale' | 'rent' }> = [];
  for (const area of AREAS) {
    for (const type of TYPES) {
      for (const listing of LISTINGS) {
        const key = `${area}|${type}|${listing}`;
        if (!state.done[key]) queue.push({ area, type, listing });
      }
    }
  }
  return queue.slice(0, limit);
}

async function main() {
  const maxQueries = argValue('--max-queries', 8);
  if (process.argv.includes('--reset')) {
    fs.rmSync(STATE_FILE, { force: true });
    console.log('Sync state reset; all queries will be retried.');
  }

  const state = loadState();
  const areaArg = process.argv.indexOf('--areas') >= 0 ? process.argv[process.argv.indexOf('--areas') + 1] : null;
  const queries = areaArg
    ? nextQueries(state, Number.MAX_SAFE_INTEGER)
        .filter((query) => areaArg.split(',').includes(query.area))
        .slice(0, maxQueries)
    : nextQueries(state, maxQueries);
  if (queries.length === 0) {
    console.log('All configured queries have been attempted. Use --reset to run them again.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Running ${queries.length} BinaSmart queries (quota: 20 requests/hour).`);

  let rawTotal = 0;
  let ingested = 0;
  let skipped = 0;
  let quotaStopped = false;

  for (const query of queries) {
    const key = `${query.area}|${query.type}|${query.listing}`;
    try {
      const records = await binaSmartService.searchProperties({
        area: query.area,
        type: query.type,
        listing: query.listing,
        limit: 8,
      });
      rawTotal += records.length;

      if (records.length > 0) {
        const sourceId = await binaSmartService.upsertSourceRegistration();
        const result = await binaSmartService.ingestSearchResult(
          sourceId,
          `area=${query.area}, type=${query.type}, listing=${query.listing}`,
          records,
        );
        ingested += result.ingested;
        skipped += result.skipped;
        console.log(
          `  ${key}: ${records.length} returned, ${result.ingested} imported, ${result.skipped} skipped (no verified ETB price or already stored)`,
        );
      } else {
        console.log(`  ${key}: no listing matched`);
      }

      state.done[key] = new Date().toISOString();
      saveState(state);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/rate_limited|429|retry_after/i.test(message)) {
        const retry = message.match(/retry_after_seconds\\?"?:?\s*(\d+)/i)?.[1];
        console.log(
          `  ${key}: quota exhausted${retry ? ` — retry in ~${Math.ceil(Number(retry) / 60)} min` : ''}. Stopping without retrying.`,
        );
        quotaStopped = true;
        break;
      }
      console.log(`  ${key}: failed — ${message.slice(0, 160)}`);
    }
  }

  console.log(
    `\nqueriesRun=${queries.length} rawRecords=${rawTotal} imported=${ingested} skipped=${skipped} quotaStopped=${quotaStopped}`,
  );
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('BINASMART SYNC FAILED:', error);
  await prisma.$disconnect();
  process.exit(1);
});
