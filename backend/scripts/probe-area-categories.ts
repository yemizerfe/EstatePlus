/**
 * Exploration helper: probes Wikimedia Commons categories for each area.
 *
 * Usage: npx tsx scripts/probe-area-categories.ts
 */
import 'dotenv/config';
import axios from 'axios';

import { prisma } from '../src/infrastructure/database/prisma';

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'EstatePlus/1.0 (neighborhood imagery; data-integration)';

async function members(category: string): Promise<string[]> {
  try {
    const response = await axios.get(COMMONS_API, {
      timeout: 25_000,
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      params: {
        action: 'query',
        format: 'json',
        list: 'categorymembers',
        cmtitle: `Category:${category}`,
        cmtype: 'file|subcat',
        cmlimit: 25,
      },
    });
    const list = (response.data as { query?: { categorymembers?: Array<{ title: string }> } })
      .query?.categorymembers;
    return (list ?? []).map((entry) => entry.title);
  } catch {
    return [];
  }
}

async function main() {
  const areas = await prisma.neighborhood.findMany({
    where: { isActive: true },
    select: { name: true, subcity: true },
    orderBy: { name: 'asc' },
  });

  for (const area of areas) {
    const attempts = [
      `${area.name}, Addis Ababa`,
      `${area.name} (Addis Ababa)`,
      area.name,
      `${area.subcity}, Addis Ababa`,
    ];
    console.log(`\n=== ${area.name} / ${area.subcity}`);
    for (const attempt of attempts) {
      const found = await members(attempt);
      const files = found.filter((title) => title.startsWith('File:'));
      if (files.length === 0) continue;
      console.log(`  [${attempt}] ${files.length} file(s)`);
      files.slice(0, 6).forEach((title) => console.log(`     ${title}`));
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
