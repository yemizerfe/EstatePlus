/**
 * Exploration helper: prints Commons search hits for each registered area so a
 * human can pick the photo that actually shows the place.
 *
 * Usage: npx tsx scripts/explore-area-photos.ts [area-slug ...]
 */
import 'dotenv/config';
import axios from 'axios';

import { prisma } from '../src/infrastructure/database/prisma';

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'EstatePlus/1.0 (neighborhood imagery; data-integration)';

const slugArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));

async function search(term: string): Promise<Array<{ title: string; url: string }>> {
  try {
    const response = await axios.get(COMMONS_API, {
      timeout: 20_000,
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      params: {
        action: 'query',
        format: 'json',
        generator: 'search',
        gsrsearch: term,
        gsrnamespace: 6,
        gsrlimit: 12,
        prop: 'imageinfo',
        iiprop: 'url',
        iiurlwidth: 1200,
      },
    });
    const pages = Object.values(
      (response.data as { query?: { pages?: Record<string, unknown> } }).query?.pages ?? {},
    ) as Array<{ title: string; imageinfo?: Array<{ thumburl?: string; url?: string }> }>;
    return pages
      .map((page) => ({ title: page.title, url: page.imageinfo?.[0]?.thumburl ?? '' }))
      .filter((entry) => /\.(jpe?g)$/i.test(entry.title) && entry.url);
  } catch (error) {
    console.log(`  ! search failed: ${error instanceof Error ? error.message : error}`);
    return [];
  }
}

async function main() {
  const areas = await prisma.neighborhood.findMany({
    where: {
      isActive: true,
      ...(slugArgs.length > 0 ? { slug: { in: slugArgs } } : {}),
    },
    select: { name: true, slug: true, subcity: true },
    orderBy: { name: 'asc' },
  });

  for (const area of areas) {
    console.log(`\n=== ${area.name} (${area.subcity}) [${area.slug}]`);
    for (const term of [`${area.name} Addis Ababa`, `${area.subcity} Addis Ababa`]) {
      const hits = await search(term);
      console.log(` -- ${term}`);
      hits.slice(0, 8).forEach((hit) => console.log(`    ${hit.title}`));
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
