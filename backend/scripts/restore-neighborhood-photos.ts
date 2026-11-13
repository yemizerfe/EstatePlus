/**
 * Restore a specific Wikimedia Commons file as an area's stored photo.
 *
 * Used to put back a photo that was replaced by a weaker candidate: the file is
 * looked up by name, so the URL, author and licence stored alongside it are the
 * authoritative values from Commons rather than a copy-pasted URL.
 *
 * Usage: npx tsx scripts/restore-neighborhood-photos.ts <slug>="<File name>" ...
 */
import 'dotenv/config';
import axios from 'axios';

import { prisma } from '../src/infrastructure/database/prisma';
import { normalizeCommonsImageUrl } from '../src/shared/utils/commons-image';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'EstatePlus/1.0 (neighborhood photo restore; data-integration)';

function stripHtml(value: string | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/<[^>]*>/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return text.length > 0 ? text.slice(0, 200) : null;
}

async function main() {
  const pairs = process.argv
    .slice(2)
    .map((arg) => {
      const index = arg.indexOf('=');
      return { slug: arg.slice(0, index), title: arg.slice(index + 1) };
    })
    .filter((pair) => pair.slug && pair.title);

  for (const pair of pairs) {
    const area = await prisma.neighborhood.findUnique({ where: { slug: pair.slug } });
    if (!area) {
      console.log(`missing area ${pair.slug}`);
      continue;
    }
    const response = await axios.get(API, {
      timeout: 25_000,
      headers: { Accept: 'application/json', 'User-Agent': UA },
      params: {
        action: 'query',
        format: 'json',
        titles: `File:${pair.title}`,
        prop: 'imageinfo',
        iiprop: 'url|extmetadata',
        iiurlwidth: 1280,
      },
    });
    const page: any = Object.values(response.data?.query?.pages ?? {})[0] ?? {};
    const info = page.imageinfo?.[0];
    const url = info?.thumburl ?? info?.url;
    if (!url) {
      console.log(`no file ${pair.title}`);
      continue;
    }
    const meta = info.extmetadata ?? {};
    const metadata = (area.metadata as Record<string, unknown> | null) ?? {};
    await prisma.neighborhood.update({
      where: { id: area.id },
      data: {
        metadata: {
          ...metadata,
          image: {
            url: normalizeCommonsImageUrl(url) ?? url,
            pageUrl:
              info.descriptionurl ??
              `https://commons.wikimedia.org/wiki/${encodeURIComponent(`File:${pair.title}`)}`,
            title: pair.title,
            credit: stripHtml(meta['Artist']?.value),
            license: stripHtml(meta['LicenseShortName']?.value),
            source: 'wikimedia_commons',
            fetchedAt: new Date().toISOString(),
          },
        } as object,
      },
    });
    console.log(`restored ${pair.slug} -> ${pair.title}`);
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
