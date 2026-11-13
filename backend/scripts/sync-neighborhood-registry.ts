/**
 * Neighborhood registry for Addis Ababa.
 *
 * The public area pages must list real sub-cities and neighborhoods, never the
 * city itself. This script:
 *
 *  1. creates any missing sub-city / neighborhood record,
 *  2. geocodes it through OpenStreetMap Nominatim (1 request/second),
 *  3. fetches a Wikimedia Commons photo of the place,
 *  4. files every listing under the area its address names, and
 *  5. retires the city-level "Addis Ababa" bucket so it is never shown as an area.
 *
 * Usage: npx tsx scripts/sync-neighborhood-registry.ts [--skip-photos]
 */
import 'dotenv/config';
import axios from 'axios';

import { prisma } from '../src/infrastructure/database/prisma';
import { wikimediaCommonsAdapter } from '../src/modules/external-sources/adapters/wikimedia-commons.adapter';

const USER_AGENT = 'EstatePlus/1.0 (neighborhood registry; data-integration)';
const skipPhotos = process.argv.includes('--skip-photos');

interface AreaSeed {
  name: string;
  slug: string;
  subcity: string;
  /** Address spellings that map onto this area, longest first at match time. */
  aliases: string[];
}

const SUB_CITIES: AreaSeed[] = [
  { name: 'Addis Ketema', slug: 'addis-ketema', subcity: 'Addis Ketema', aliases: [] },
  { name: 'Akaky Kaliti', slug: 'akaky-kaliti', subcity: 'Akaky Kaliti', aliases: ['akaki'] },
  { name: 'Arada', slug: 'arada', subcity: 'Arada', aliases: [] },
  { name: 'Bole', slug: 'bole', subcity: 'Bole', aliases: [] },
  { name: 'Gulele', slug: 'gulele', subcity: 'Gulele', aliases: ['gullele'] },
  { name: 'Kirkos', slug: 'kirkos', subcity: 'Kirkos', aliases: [] },
  { name: 'Kolfe Keranio', slug: 'kolfe-keranio', subcity: 'Kolfe Keranio', aliases: ['kolfe'] },
  { name: 'Lemi Kura', slug: 'lemi-kura', subcity: 'Lemi Kura', aliases: ['lemikura'] },
  { name: 'Lideta', slug: 'lideta', subcity: 'Lideta', aliases: [] },
  { name: 'Nifas Silk-Lafto', slug: 'nifas-silk-lafto', subcity: 'Nifas Silk-Lafto', aliases: ['nifas silk', 'lafto'] },
  { name: 'Yeka', slug: 'yeka', subcity: 'Yeka', aliases: [] },
];

const NEIGHBORHOODS: AreaSeed[] = [
  { name: 'Shiromeda', slug: 'shiromeda', subcity: 'Gulele', aliases: ['shiromeda', 'shromeda', 'ሽሮ መዳ'] },
  { name: 'Meri', slug: 'meri', subcity: 'Yeka', aliases: ['meri'] },
  { name: 'Summit', slug: 'summit', subcity: 'Bole', aliases: ['summit', 'sumit'] },
  { name: 'Tafo', slug: 'tafo', subcity: 'Yeka', aliases: ['tafo'] },
  { name: 'Kilinto', slug: 'kilinto', subcity: 'Akaky Kaliti', aliases: ['kilinto', 'kilint'] },
  { name: 'Atlas', slug: 'atlas', subcity: 'Bole', aliases: ['atlas'] },
  { name: 'CMC', slug: 'cmc', subcity: 'Yeka', aliases: ['cmc', 'yetebaberut'] },
  { name: 'Kazanchis', slug: 'kazanchis', subcity: 'Kirkos', aliases: ['kazanchis', 'kazanch'] },
  { name: 'Sarbet', slug: 'sarbet', subcity: 'Nifas Silk-Lafto', aliases: ['sarbet'] },
  { name: 'Gerji', slug: 'gerji', subcity: 'Bole', aliases: ['gerji'] },
  { name: 'Megenagna', slug: 'megenagna', subcity: 'Bole', aliases: ['megenagna', 'megenanga'] },
  { name: 'Ayat', slug: 'ayat', subcity: 'Yeka', aliases: ['ayat'] },
  { name: 'Lebu', slug: 'lebu', subcity: 'Nifas Silk-Lafto', aliases: ['lebu'] },
  { name: 'Jemo', slug: 'jemo', subcity: 'Nifas Silk-Lafto', aliases: ['jemo'] },
  { name: 'Old Airport', slug: 'old-airport', subcity: 'Nifas Silk-Lafto', aliases: ['old airport'] },
  { name: 'Bole Bulbula', slug: 'bole-bulbula', subcity: 'Bole', aliases: ['bulbula'] },
  { name: 'Bole Arabsa', slug: 'bole-arabsa', subcity: 'Bole', aliases: ['arabsa'] },
  { name: 'Piassa', slug: 'piassa', subcity: 'Arada', aliases: ['piassa', 'piazza'] },
  { name: 'Merkato', slug: 'merkato', subcity: 'Addis Ketema', aliases: ['merkato', 'mercatto'] },
  { name: 'Saris', slug: 'saris', subcity: 'Nifas Silk-Lafto', aliases: ['saris'] },
  { name: 'Beshale', slug: 'beshale', subcity: 'Nifas Silk-Lafto', aliases: ['beshale'] },
];

const ALL_AREAS = [...NEIGHBORHOODS, ...SUB_CITIES];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function geocode(name: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await axios.get<Array<{ lat: string; lon: string }>>(
      'https://nominatim.openstreetmap.org/search',
      {
        timeout: 20_000,
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        params: { q: `${name}, Addis Ababa, Ethiopia`, format: 'jsonv2', limit: 1 },
      },
    );
    const hit = response.data?.[0];
    if (!hit) return null;
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

async function ensureArea(seed: AreaSeed) {
  const existing = await prisma.neighborhood.findUnique({ where: { slug: seed.slug } });
  if (existing) {
    if (existing.name !== seed.name || existing.subcity !== seed.subcity || !existing.isActive) {
      return prisma.neighborhood.update({
        where: { id: existing.id },
        data: { name: seed.name, subcity: seed.subcity, isActive: true },
      });
    }
    return existing;
  }
  // The name column is unique; a renamed record can already hold it.
  const byName = await prisma.neighborhood.findUnique({ where: { name: seed.name } });
  if (byName) {
    return prisma.neighborhood.update({
      where: { id: byName.id },
      data: { slug: seed.slug, subcity: seed.subcity, isActive: true },
    });
  }
  return prisma.neighborhood.create({
    data: {
      name: seed.name,
      slug: seed.slug,
      subcity: seed.subcity,
      city: 'Addis Ababa',
      isActive: true,
    },
  });
}

function matchArea(text: string): AreaSeed | null {
  const haystack = ` ${text.toLowerCase()} `;
  let best: { seed: AreaSeed; length: number } | null = null;
  for (const seed of ALL_AREAS) {
    const terms = [seed.name.toLowerCase(), ...seed.aliases.map((a) => a.toLowerCase())];
    for (const term of terms) {
      if (term.length < 3) continue;
      if (!haystack.includes(term)) continue;
      if (!best || term.length > best.length) best = { seed, length: term.length };
    }
  }
  return best?.seed ?? null;
}

async function main() {
  const city = await prisma.neighborhood.findUnique({ where: { slug: 'addis-ababa' } });

  // 1 + 2. Registry rows and coordinates.
  const ids = new Map<string, string>();
  for (const seed of [...SUB_CITIES, ...NEIGHBORHOODS]) {
    const area = await ensureArea(seed);
    ids.set(seed.slug, area.id);
    if (area.centerLat === null || area.centerLng === null) {
      const point = await geocode(seed.name);
      await sleep(1100);
      if (point) {
        await prisma.neighborhood.update({
          where: { id: area.id },
          data: { centerLat: point.lat, centerLng: point.lng },
        });
        console.log(`coords  ${seed.name} -> ${point.lat}, ${point.lng}`);
      }
    }
  }
  console.log(`registry rows ready: ${ids.size}`);

  // 3. Photos for the neighborhoods, each area getting a distinct image.
  if (!skipPhotos) {
    const photoUse = new Map<string, number>();
    const allAreas = await prisma.neighborhood.findMany({
      where: { isActive: true },
      select: { metadata: true },
    });
    for (const area of allAreas) {
      const url = (area.metadata as { image?: { url?: string } } | null)?.image?.url;
      if (url) photoUse.set(url, (photoUse.get(url) ?? 0) + 1);
    }
    const usedPhotos = new Set(photoUse.keys());

    for (const seed of NEIGHBORHOODS) {
      const area = await prisma.neighborhood.findUnique({ where: { slug: seed.slug } });
      if (!area) continue;
      const metadata = (area.metadata as Record<string, unknown> | null) ?? {};
      const currentUrl = (metadata['image'] as { url?: string } | undefined)?.url;
      // An area keeps its photo only while no other area shows the same image.
      if (currentUrl && (photoUse.get(currentUrl) ?? 0) <= 1) continue;
      const candidates = await wikimediaCommonsAdapter.fetchNeighborhoodPhotoCandidates({
        name: seed.name,
        lat: area.centerLat === null ? null : Number(area.centerLat),
        lng: area.centerLng === null ? null : Number(area.centerLng),
      });
      const photo = candidates.find((candidate) => !usedPhotos.has(candidate.imageUrl)) ?? null;
      await sleep(600);
      if (!photo) {
        console.log(`no photo ${seed.name}`);
        continue;
      }
      if (currentUrl) {
        const remaining = (photoUse.get(currentUrl) ?? 1) - 1;
        if (remaining <= 0) {
          photoUse.delete(currentUrl);
          usedPhotos.delete(currentUrl);
        } else {
          photoUse.set(currentUrl, remaining);
        }
      }
      photoUse.set(photo.imageUrl, 1);
      usedPhotos.add(photo.imageUrl);
      await prisma.neighborhood.update({
        where: { id: area.id },
        data: {
          metadata: {
            ...metadata,
            image: {
              url: photo.imageUrl,
              pageUrl: photo.pageUrl,
              title: photo.title,
              credit: photo.credit,
              license: photo.license,
              source: 'wikimedia_commons',
              fetchedAt: new Date().toISOString(),
            },
          } as object,
        },
      });
      console.log(`photo   ${seed.name} -> ${photo.title}`);
    }
  }

  // 4. File each listing under the area its address (or title) names.
  const properties = await prisma.property.findMany({
    select: { id: true, title: true, address: true, neighborhoodId: true },
  });
  let filed = 0;
  for (const property of properties) {
    const area = matchArea(`${property.address ?? ''} ${property.title ?? ''}`);
    if (!area) continue;
    const targetId = ids.get(area.slug);
    if (!targetId || property.neighborhoodId === targetId) continue;
    await prisma.property.update({ where: { id: property.id }, data: { neighborhoodId: targetId } });
    filed += 1;
  }
  console.log(`listings filed by address: ${filed}`);

  // Anything still sitting in the city bucket is geocoded by its own point when
  // possible, otherwise it stays there out of the public area pages.
  if (city) {
    const stragglers = await prisma.property.findMany({
      where: { neighborhoodId: city.id },
      select: { id: true, address: true, title: true },
    });
    for (const property of stragglers) {
      const area = matchArea(`${property.address ?? ''} ${property.title ?? ''}`);
      if (!area) continue;
      const targetId = ids.get(area.slug);
      if (!targetId) continue;
      await prisma.property.update({ where: { id: property.id }, data: { neighborhoodId: targetId } });
      filed += 1;
    }
    await prisma.neighborhood.update({
      where: { id: city.id },
      data: { isActive: false, name: 'Addis Ababa (citywide)' },
    });
    console.log('city bucket retired (isActive=false)');
  }

  // 5. Report the areas that now hold listings.
  const active = await prisma.neighborhood.findMany({
    where: { isActive: true, city: { equals: 'Addis Ababa', mode: 'insensitive' } },
    select: { name: true, _count: { select: { properties: true } } },
    orderBy: { name: 'asc' },
  });
  console.log(
    `areas: ${active.length} | with listings: ${active.filter((a) => a._count.properties > 0).length}`,
  );
  for (const area of active) {
    if (area._count.properties > 0) console.log(`  ${area.name}: ${area._count.properties}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
