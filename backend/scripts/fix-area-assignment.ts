/**
 * Re-files every property under the most specific area its own listing text names.
 *
 * Imported feeds often publish only a broad location ("Addis Ababa", or a
 * sub-city such as "Bole") even when the title names the neighborhood
 * ("2 bedroom apartment for sale in Bole Arabsa"). This script reads each
 * property's title and address, matches the longest real area name this
 * database holds, and moves the record there. Nothing is guessed: a property
 * whose text names no area keeps the area it already has.
 *
 * Usage: npx tsx scripts/fix-area-assignment.ts [--dry-run]
 */
import 'dotenv/config';

import { prisma } from '../src/infrastructure/database/prisma';

const dryRun = process.argv.includes('--dry-run');

/** Spelling variants published by feeds, mapped to the area they mean. */
const ALIASES: Record<string, string> = {
  piazza: 'Piassa',
  'bole medhanialem': 'Bole',
  'bole medhanealem': 'Bole',
  'bole michael': 'Bole',
  'bole mikael': 'Bole',
  'old airport': 'Old Airport',
  'nifas silk': 'Nifas Silk-Lafto',
  lafto: 'Nifas Silk-Lafto',
  'kolfee keranio': 'Kolfe Keranio',
  'kolfe keranio': 'Kolfe Keranio',
  'akaki kaliti': 'Akaky Kaliti',
  'akaki kality': 'Akaky Kaliti',
  'addis ketema': 'Addis Ketema',
  'lemi kura': 'Lemi Kura',
  'bole arabsa': 'Bole Arabsa',
  'arabsa': 'Bole Arabsa',
  'bole bulbula': 'Bole Bulbula',
  'bulbula': 'Bole Bulbula',
  gerji: 'Gerji',
  megenagna: 'Megenagna',
  summit: 'Summit',
  sumit: 'Summit',
  atlas: 'Atlas',
  cmc: 'CMC',
  ayat: 'Ayat',
  sarbet: 'Sarbet',
  saris: 'Saris',
  jemo: 'Jemo',
  lebu: 'Lebu',
  kazanchis: 'Kazanchis',
  beshale: 'Beshale',
  shiromeda: 'Shiromeda',
  merkato: 'Merkato',
  mercato: 'Merkato',
  gulele: 'Gulele',
  lideta: 'Lideta',
  kirkos: 'Kirkos',
  arada: 'Arada',
  'addis ababa': 'Addis Ababa',
};

interface AreaRow {
  id: string;
  name: string;
  city: string;
  subcity?: string | null;
  isActive?: boolean;
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Finds the most specific area named in the text. Longer names win, so
 * "Bole Arabsa" is never mistaken for "Bole".
 */
function matchArea(text: string, areas: AreaRow[]): string | null {
  const haystack = normalise(text);
  if (!haystack) return null;

  let best: { name: string; length: number; index: number } | null = null;
  for (const area of areas) {
    const needles = [normalise(area.name), ...Object.keys(ALIASES).filter((alias) => ALIASES[alias] === area.name)];
    for (const needle of needles) {
      if (!needle) continue;
      const pattern = new RegExp(`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
      const match = pattern.exec(haystack);
      if (!match) continue;
      const index = match.index;
      // Longer names win; on a tie the later (more local) name wins, so
      // "Bole Ayat" resolves to Ayat rather than to the sub-city Bole.
      const better =
        !best || needle.length > best.length || (needle.length === best.length && index > best.index);
      if (better) best = { name: area.name, length: needle.length, index };
    }
  }
  return best?.name ?? null;
}

async function main() {
  const areas = await prisma.neighborhood.findMany({
    where: { city: { equals: 'Addis Ababa', mode: 'insensitive' } },
    select: { id: true, name: true, city: true, subcity: true, isActive: true },
  });
  const byName = new Map(areas.map((area) => [area.name, area]));

  /**
   * 0 = the city bucket, 1 = a sub-city row, 2 = a neighborhood inside a
   * sub-city. A re-file may only move a record upwards through these levels.
   */
  const specificity = (area: AreaRow & { subcity?: string | null; isActive?: boolean }): number => {
    if (area.name.includes('citywide') || area.isActive === false) return 0;
    if (area.subcity && area.subcity !== area.name) return 2;
    return 1;
  };

  const properties = await prisma.property.findMany({
    select: {
      id: true,
      title: true,
      address: true,
      description: true,
      neighborhood: { select: { name: true } },
    },
  });

  let moved = 0;
  const summary: Record<string, number> = {};

  for (const property of properties) {
    // The description is scanned too: imported records sometimes carry the
    // location only there ("G+3 House around Sumit").
    const target = matchArea(
      `${property.title} ${property.address ?? ''} ${(property.description ?? '').slice(0, 400)}`,
      areas,
    );
    if (!target) continue;
    const current = property.neighborhood?.name ?? null;
    if (current === target) continue;
    const currentArea = current ? byName.get(current) : undefined;
    const targetArea = byName.get(target);
    if (!targetArea) continue;
    // Only refine: never move a record into a coarser bucket than it already
    // has (a description that mentions "Yeka" must not pull a CMC listing out
    // of CMC, and a neighborhood listing never falls back to its sub-city).
    const currentLevel = currentArea ? specificity(currentArea) : 0;
    if (specificity(targetArea) <= currentLevel && current !== null) continue;

    summary[`${current ?? 'none'} → ${target}`] = (summary[`${current ?? 'none'} → ${target}`] ?? 0) + 1;
    moved += 1;
    if (dryRun) continue;
    await prisma.property.update({
      where: { id: property.id },
      data: { neighborhoodId: byName.get(target)!.id },
    });
  }

  for (const [change, count] of Object.entries(summary)) console.log(`${change}: ${count}`);
  console.log(`${dryRun ? 'would move' : 'moved'} ${moved}/${properties.length} properties`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
