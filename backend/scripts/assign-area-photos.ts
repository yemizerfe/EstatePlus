/**
 * Assigns each Addis Ababa area the photograph that actually shows it.
 *
 * The previous geosearch pass accepted any photograph taken within 8 km of an
 * area, which put bowls of food, aircraft and laboratory benches on sub-city
 * cards. This script instead resolves a curated Commons file per area (a
 * landmark of the area, or the landmark of the sub-city the area belongs to),
 * verifies the file exists and that its thumbnail loads, and records the
 * author, licence and page URL so the interface can attribute it.
 *
 * Nothing is invented: a title that Commons does not hold, or whose thumbnail
 * does not answer, is skipped and reported.
 *
 * Usage: npx tsx scripts/assign-area-photos.ts [--dry-run] [area-slug ...]
 */
import 'dotenv/config';
import axios from 'axios';

import { prisma } from '../src/infrastructure/database/prisma';

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'EstatePlus/1.0 (neighborhood imagery; data-integration)';

const dryRun = process.argv.includes('--dry-run');
const slugArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));

/** A photograph that shows the area itself. */
const AREA_PHOTOS: Record<string, string> = {
  merkato: 'Addis Mercato, Adís Abeba, Etiopía, 2024-01-19, DD 27.jpg',
  summit: 'Summit Kidane Mehret Church 20250727 130730.jpg',
  jemo: 'Jemo, September 2022.jpg',
  megenagna: 'Addis Ababa Railway Megenagna Area.jpg',
  atlas: 'Skylight 20250731 155723.jpg',
  piassa: 'Addis Ababa - Piassa.jpg',
  shiromeda: 'Addis Ababa from Entoto Mountains.jpg',
  cmc: 'Addis Ababa sky view.jpg',
  ayeka: 'Bellevue 20250731 160329.jpg',
};

/**
 * Photographs of each sub-city, used for areas whose own landmark Commons does
 * not name. Ordered best first; areas sharing a sub-city take the next unused
 * one so two cards never show the same picture.
 */
const SUBCITY_PHOTOS: Record<string, string[]> = {
  'Addis Ketema': [
    'Addis Mercato, Adís Abeba, Etiopía, 2024-01-19, DD 26.jpg',
    'Addis Mercato, Adís Abeba, Etiopía, 2024-01-19, DD 28.jpg',
    'Addis Ababa street scene (2).jpg',
  ],
  'Akaky Kaliti': [
    'Addis Ababa from the air.jpg',
    'Addis Ababa cityscape.jpg',
    'Addis Ababa September 2022.jpg',
  ],
  Arada: [
    'Arada post office, Addis Ababa.jpg',
    'Addis Ababa street scene near the Lion of Judah monument.jpg',
    'Avenida Churchill, Adís Abeba - 01.jpg',
  ],
  Bole: [
    'Bole Road, Addis Ababa (1).jpg',
    'Bole Medhanealem Churcn.jpg',
    'Bole Road (25052032380).jpg',
    'Bole Road, Addis Ababa (2).jpg',
    'Skylight 20250731 155723.jpg',
  ],
  Gulele: [
    'Entoto Park Addis Ababa.jpg',
    'Addis Abeba-Entoto Palace (4).jpg',
    'Addis Ababa from Entoto Mountains.jpg',
  ],
  Kirkos: [
    'Meskel Square, December 2014.jpg',
    'Addis Ababa City Hall at night.jpg',
    'Addis Ababa Mexico Area.jpg',
    'ET Addis asv2018-01 img01 Meskel Square.jpg',
  ],
  'Kolfe Keranio': [
    'Addis Ababa LRT by Ben Welle 05.jpg',
    'Light Rail Traffic Circle.jpg',
    'Addis Ababa light rail street view.jpg',
  ],
  'Lemi Kura': [
    'Addis Ababa September 2022.jpg',
    'Addis Ababa from the air.jpg',
    'Addis Ababa sky view.jpg',
    'Addis Ababa at the night time.jpg',
    'Addis Ababa, Ethiopia (48735979893).jpg',
  ],
  Lideta: [
    'ET Addis asv2018-01 img04 Balcha Hospital.jpg',
    'African Union Building.jpg',
    'Addis Ababa street scene (3).jpg',
  ],
  'Nifas Silk-Lafto': [
    'Ring road around Addis, built by China - Flickr - Dave Proffer.jpg',
    'The Suburbs Of Addis (210920819).jpeg',
    'Addis Ababa light rail street view.jpg',
    'Addis Ababa street scene (4).jpg',
    'Addis Ababa Mexico Area.jpg',
    'Balewold ^ Abraham Church - panoramio.jpg',
    'Addis Ababa street scene (2).jpg',
    'Addis Ababa.jpg',
  ],
  Yeka: [
    'Local government building, Yeka Subcity, Addis Ababa.jpg',
    'View of addis.jpg',
    'Yeka 2.jpg',
    'Yeka\'s picture.jpg',
    'Addis Ababa street scene (3).jpg',
    'Addis Ababa street scene near the Lion of Judah monument.jpg',
  ],
};

/** Areas whose own photograph Commons does not hold, in priority order. */
const AREA_PRIORITY = [
  'ayat',
  'bole',
  'bole-arabsa',
  'bole-bulbula',
  'gerji',
  'kilinto',
  'kirkos',
  'kazanchis',
  'sarbet',
  'old-airport',
  'saris',
  'beshale',
  'lebu',
  'tafo',
  'meri',
  'yeka',
  'gulele',
  'arada',
  'lideta',
  'kolfe-keranio',
  'nifas-silk-lafto',
  'akaky-kaliti',
  'lemi-kura',
  'addis-ketema',
  'cmc',
];

interface ResolvedFile {
  title: string;
  imageUrl: string;
  pageUrl: string;
  credit: string | null;
  license: string | null;
  width: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function stripHtml(value: string | undefined): string | null {
  if (!value) return null;
  const text = value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return text.length > 0 ? text.slice(0, 200) : null;
}

/** Resolve Commons file titles to a 1200px thumbnail plus attribution. */
async function resolveTitles(titles: string[]): Promise<Map<string, ResolvedFile>> {
  const resolved = new Map<string, ResolvedFile>();
  for (let index = 0; index < titles.length; index += 40) {
    const batch = titles.slice(index, index + 40);
    try {
      const response = await axios.get(COMMONS_API, {
        timeout: 30_000,
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        params: {
          action: 'query',
          format: 'json',
          titles: batch.map((title) => `File:${title}`).join('|'),
          prop: 'imageinfo',
          iiprop: 'url|extmetadata|size',
          iiurlwidth: 1200,
        },
      });
      const pages = (
        response.data as {
          query?: {
            pages?: Record<
              string,
              {
                title?: string;
                imageinfo?: Array<{
                  thumburl?: string;
                  url?: string;
                  descriptionurl?: string;
                  width?: number;
                  extmetadata?: Record<string, { value?: string }>;
                }>;
              }
            >;
          };
        }
      ).query?.pages;
      for (const page of Object.values(pages ?? {})) {
        const info = page.imageinfo?.[0];
        const url = info?.thumburl ?? info?.url;
        if (!url || !page.title) continue;
        const meta = info?.extmetadata ?? {};
        resolved.set(page.title.replace(/^File:/, ''), {
          title: page.title.replace(/^File:/, ''),
          imageUrl: url,
          pageUrl: info?.descriptionurl ?? '',
          credit: stripHtml(meta['Artist']?.value),
          license: stripHtml(meta['LicenseShortName']?.value),
          width: info?.width ?? 0,
        });
      }
    } catch (error) {
      console.warn(`Commons lookup failed: ${error instanceof Error ? error.message : error}`);
    }
    await sleep(400);
  }
  return resolved;
}

/** True when the thumbnail really answers with an image. */
async function reachable(url: string): Promise<boolean> {
  try {
    const response = await axios.get(url, {
      timeout: 25_000,
      responseType: 'stream',
      headers: { 'User-Agent': USER_AGENT },
      validateStatus: () => true,
    });
    const type = String(response.headers['content-type'] ?? '');
    response.data?.destroy?.();
    return response.status === 200 && type.startsWith('image/');
  } catch {
    return false;
  }
}

async function main() {
  const areas = await prisma.neighborhood.findMany({
    where: {
      isActive: true,
      city: { equals: 'Addis Ababa', mode: 'insensitive' },
      ...(slugArgs.length > 0 ? { slug: { in: slugArgs } } : {}),
    },
    select: { id: true, name: true, slug: true, subcity: true },
    orderBy: { name: 'asc' },
  });

  const wanted = new Set<string>();
  Object.values(AREA_PHOTOS).forEach((title) => wanted.add(title));
  Object.values(SUBCITY_PHOTOS).flat().forEach((title) => wanted.add(title));
  const resolved = await resolveTitles([...wanted]);
  console.log(`Commons resolved ${resolved.size}/${wanted.size} titles`);

  // Files that answer with real image bytes only.
  const usable = new Map<string, ResolvedFile>();
  for (const file of resolved.values()) {
    if (!/\.(jpe?g)$/i.test(file.title)) continue;
    if (await reachable(file.imageUrl)) {
      usable.set(file.title, file);
      continue;
    }
    console.warn(`unreachable thumbnail: ${file.title}`);
  }
  console.log(`Usable photos: ${usable.size}`);

  const used = new Set<string>();
  const assignments: Array<{ id: string; name: string; slug: string; file: ResolvedFile }> = [];

  const takeAreaPhoto = (area: { id: string; name: string; slug: string }) => {
    const title = AREA_PHOTOS[area.slug];
    if (!title) return false;
    const file = usable.get(title);
    if (!file || used.has(file.title)) return false;
    used.add(file.title);
    assignments.push({ ...area, file });
    return true;
  };

  const ordered = [...areas].sort((a, b) => {
    const ia = AREA_PRIORITY.indexOf(a.slug);
    const ib = AREA_PRIORITY.indexOf(b.slug);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  const pending: typeof areas = [];
  for (const area of ordered) {
    if (!takeAreaPhoto(area)) pending.push(area);
  }

  for (const area of pending) {
    const pool = SUBCITY_PHOTOS[area.subcity] ?? [];
    const file = pool.map((title) => usable.get(title)).find((entry) => entry && !used.has(entry.title));
    if (!file) {
      console.warn(`no photo left for ${area.name} (${area.subcity})`);
      continue;
    }
    used.add(file.title);
    assignments.push({ ...area, file });
  }

  for (const assignment of assignments) {
    const isOwnArea = assignment.file.title === AREA_PHOTOS[assignment.slug];
    console.log(
      `${isOwnArea ? 'area   ' : 'subcity'} ${assignment.name.padEnd(18)} -> ${assignment.file.title}`,
    );
    if (dryRun) continue;
    const area = await prisma.neighborhood.findUnique({ where: { id: assignment.id } });
    const metadata = (area?.metadata as Record<string, unknown> | null) ?? {};
    await prisma.neighborhood.update({
      where: { id: assignment.id },
      data: {
        metadata: {
          ...metadata,
          image: {
            url: assignment.file.imageUrl,
            pageUrl: assignment.file.pageUrl,
            title: assignment.file.title,
            credit: assignment.file.credit,
            license: assignment.file.license,
            source: 'wikimedia_commons',
            relevance: isOwnArea ? 'area' : 'subcity',
            fetchedAt: new Date().toISOString(),
          },
        } as object,
      },
    });
  }

  console.log(`\n${dryRun ? 'would assign' : 'assigned'} ${assignments.length}/${areas.length} areas`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
