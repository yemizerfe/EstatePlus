/**
 * Re-pick the Commons photograph stored for one or more neighborhoods.
 *
 * The first enrichment pass took the highest-resolution file geotagged near an
 * area. That surfaced photographs of building sites, road works and generic
 * skyline shots, which read as "construction" on a neighborhood card. This
 * script ranks candidates by what the file actually depicts — landmark words
 * (church, hotel, mall, square, market, street, station, park, stadium,
 * university, hospital, museum) first — and refuses construction imagery
 * outright. Images already used by another area are skipped so cards differ.
 *
 * Usage: npx tsx scripts/refresh-neighborhood-photos.ts [--all] [slug ...]
 */
import 'dotenv/config';
import axios from 'axios';

import { prisma } from '../src/infrastructure/database/prisma';
import { normalizeCommonsImageUrl } from '../src/shared/utils/commons-image';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'EstatePlus/1.0 (neighborhood photo refresh; data-integration)';

/** Never published: building sites, road works, demolition, scaffolding. */
const CONSTRUCTION =
  /(construction|constructing|under construction|scaffold|crane|excavat|foundation|unfinished|half[- ]built|building site|demolition|road works|earthworks|cement|rebar|scaffolding|greenfield|bare land|empty plot|quarry)/i;

/** Diagrams, maps, seals and non-photographic files. */
const NON_PHOTO =
  /(\.svg|\.png|\.gif|\.webm|\.ogv|\.ogg|\.tif|\.tiff|\.pdf|map|logo|icon|coat[_ ]of[_ ]arms|seal|diagram|plan_of)/i;

/** People, events and objects that do not describe a place. */
const NOT_A_PLACE =
  /(portrait|meets with|secretary|minister|president|conference|coffee|injera|food|dish|bird|people|woman|women|\bman\b|child|festival|ceremony|wedding|illustration|poster|screenshot|chart|banner|selfie|group photo|laboratory|aircraft|airplane|airlines|\bjet\b|satellite|nasa)/i;

/** Named, finished places — the strongest signal that a photo shows an area. */
const LANDMARK =
  /(church|cathedral|mosque|hotel|mall|square|market|street|road|avenue|boulevard|station|park|stadium|university|college|hospital|museum|theatre|theater|library|tower|plaza|centre|center|building|headquarters|bank|bridge)/i;

interface Candidate {
  url: string;
  pageUrl: string;
  title: string;
  credit: string | null;
  license: string | null;
  width: number;
  score: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function commons(params: Record<string, string | number>): Promise<any> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await axios.get(API, {
        timeout: 25_000,
        headers: { Accept: 'application/json', 'User-Agent': UA },
        params: { action: 'query', format: 'json', ...params },
      });
      return response.data;
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status !== 429) throw error;
      await sleep(2500 * (attempt + 1));
    }
  }
  return null;
}

function stripHtml(value: string | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/<[^>]*>/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return text.length > 0 ? text.slice(0, 200) : null;
}

function toCandidate(page: any): Candidate | null {
  const info = page?.imageinfo?.[0];
  const url = info?.thumburl ?? info?.url;
  if (!url) return null;
  const title = String(page.title ?? '').replace(/^File:/, '');
  if (NON_PHOTO.test(title) || NOT_A_PLACE.test(title) || CONSTRUCTION.test(title)) return null;
  const width = Number(info?.thumbwidth ?? 0);
  const height = Number(info?.thumbheight ?? 0);
  if (width > 0 && width < 640) return null;
  if (width > 0 && height > 0 && width / height < 1.15) return null;
  const meta = info?.extmetadata ?? {};
  const description = String(meta['ImageDescription']?.value ?? '');
  if (CONSTRUCTION.test(description)) return null;
  const landmark = LANDMARK.test(title) || LANDMARK.test(description) ? 2 : 0;
  return {
    url: normalizeCommonsImageUrl(url) ?? url,
    pageUrl:
      info?.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
    title,
    credit: stripHtml(meta['Artist']?.value),
    license: stripHtml(meta['LicenseShortName']?.value),
    width,
    score: landmark * 1_000_000 + width,
  };
}

async function candidatesFor(area: { name: string; subcity: string | null; slug: string }) {
  const terms = [
    `${area.name} Addis Ababa`,
    `${area.subcity ?? area.name} Addis Ababa`,
    `${area.name} Ethiopia`,
  ];
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const term of terms) {
    const data = await commons({
      generator: 'search',
      gsrsearch: term,
      gsrnamespace: 6,
      gsrlimit: 25,
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: 1200,
    });
    for (const page of Object.values(data?.query?.pages ?? {}) as any[]) {
      const candidate = toCandidate(page);
      if (!candidate || seen.has(candidate.url)) continue;
      // A photo of another area with a different name is not this area.
      seen.add(candidate.url);
      out.push(candidate);
    }
    await sleep(1200);
  }
  return out.sort((a, b) => b.score - a.score);
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const slugs = args.filter((arg) => !arg.startsWith('-'));

  const areas = await prisma.neighborhood.findMany({
    where: {
      isActive: true,
      ...(all ? {} : slugs.length > 0 ? { slug: { in: slugs } } : {}),
    },
    select: { id: true, name: true, slug: true, subcity: true, metadata: true },
    orderBy: { name: 'asc' },
  });

  const used = new Set<string>();
  const existing = await prisma.neighborhood.findMany({
    where: { isActive: true },
    select: { metadata: true },
  });
  for (const row of existing) {
    const url = (row.metadata as { image?: { url?: string } } | null)?.image?.url;
    if (url) used.add(url);
  }

  for (const area of areas) {
    const metadata = (area.metadata as Record<string, unknown> | null) ?? {};
    const current = (metadata['image'] as { url?: string } | undefined)?.url;
    if (current) used.delete(current);

    const candidates = await candidatesFor(area);
    const pick = candidates.find((candidate) => !used.has(candidate.url));
    if (!pick) {
      console.log(`no new photo  ${area.name} (${area.slug})`);
      if (current) used.add(current);
      continue;
    }

    used.add(pick.url);
    await prisma.neighborhood.update({
      where: { id: area.id },
      data: {
        metadata: {
          ...metadata,
          image: {
            url: pick.url,
            pageUrl: pick.pageUrl,
            title: pick.title,
            credit: pick.credit,
            license: pick.license,
            source: 'wikimedia_commons',
            fetchedAt: new Date().toISOString(),
          },
        } as object,
      },
    });
    console.log(`photo  ${area.name} -> ${pick.title}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
