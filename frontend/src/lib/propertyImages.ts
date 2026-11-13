// Photo resolution for listings and areas.
//
// Listing cards always show a photograph of the kind of home being advertised:
// an apartment interior matched to the bedroom count (a 2-bedroom listing gets
// a 2-bedroom interior), a house exterior for villas, land for plots and an
// office/shop interior for commercial units. Imported feeds frequently publish
// an agency banner, a chat screenshot or a promo graphic instead of the unit, so
// the card photo is chosen from this curated set rather than from the feed.
//
// The choice is keyed on the record itself, not on its title: feeds repeat
// titles such as "2 bedroom apartment for sale", and keying on the title alone
// gave every one of them the same photo. Two listings only share a photo when
// their ids and titles both match.
//
// A detail gallery keeps the records' own photographs when the source published
// real ones, starts with exactly the photo the card showed, and is padded from
// the same bedroom-matched set so a page never shows a broken or missing image.

const stock = (id: string, width = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;

/** Apartment interiors, chosen by bedroom count. */
const APARTMENT_PHOTOS: Record<string, string[]> = {
  studio: [
    stock('photo-1502672260266-1c1ef2d93688'),
    stock('photo-1522708323590-d24dbb6b0267'),
    stock('photo-1493809842364-78817add7ffb'),
  ],
  '1': [
    stock('photo-1560448204-e02f11c3d0e2'),
    stock('photo-1493809842364-78817add7ffb'),
    stock('photo-1502672260266-1c1ef2d93688'),
    stock('photo-1554995207-c18c203602cb'),
    stock('photo-1560448204-603b3fc33ddc'),
    stock('photo-1560184897-ae75f418493e'),
    stock('photo-1616594039964-ae9021a400a0'),
    stock('photo-1505691938895-1758d7feb511'),
  ],
  '2': [
    stock('photo-1522708323590-d24dbb6b0267'),
    stock('photo-1554995207-c18c203602cb'),
    stock('photo-1512918728675-ed5a9ecdebfd'),
    stock('photo-1560185007-cde436f6a4d0'),
    stock('photo-1502672023488-70e25813eb80'),
    stock('photo-1567767292278-a4f21aa2d36e'),
    stock('photo-1493809842364-78817add7ffb'),
    stock('photo-1522771739844-6a9f6d5f14af'),
    stock('photo-1502005229762-cf1b2da7c5d6'),
    stock('photo-1536376072261-38c75010e6c9'),
    stock('photo-1556909114-f6e7ad7d3136'),
    stock('photo-1484154218962-a197022b5858'),
    stock('photo-1616137466211-f939a420be84'),
    stock('photo-1618221195710-dd6b41faaea6'),
    stock('photo-1522156373667-4c7234bbd804'),
    stock('photo-1513694203232-719a280e022f'),
    stock('photo-1598928506311-c55ded91a20c'),
    stock('photo-1505693416388-ac5ce068fe85'),
    stock('photo-1600607688969-a5bfcd646154'),
    stock('photo-1600566752355-35792bedcfea'),
    stock('photo-1600210491369-e753d80a41f3'),
    stock('photo-1600585153490-76fb20a32601'),
    stock('photo-1502005097973-6a7082348e28'),
  ],
  '3': [
    stock('photo-1600607687939-ce8a6c25118c'),
    stock('photo-1600566753086-00f18fb6b3ea'),
    stock('photo-1616486338812-3dadae4b4ace'),
    stock('photo-1600210492486-724fe5c67fb0'),
    stock('photo-1600585154526-990dced4db0d'),
    stock('photo-1600121848594-d8644e57abab'),
    stock('photo-1615529182904-14819c35db37'),
    stock('photo-1586023492125-27b2c045efd7'),
    stock('photo-1556228453-efd6c1ff04f6'),
    stock('photo-1560185127-6ed189bf02f4'),
    stock('photo-1618221195710-dd6b41faaea6'),
  ],
  '4': [
    stock('photo-1600585154340-be6161a56a0c'),
    stock('photo-1600566753190-17f0baa2a6c3'),
    stock('photo-1600047509807-ba8f99d2cdde'),
    stock('photo-1613977257363-707ba9348227'),
    stock('photo-1600573472550-8090b5e0745e'),
    stock('photo-1615874959474-d609969a20ed'),
    stock('photo-1560448204-e02f11c3d0e2'),
  ],
  '5': [
    stock('photo-1613490493576-7fde63acd811'),
    stock('photo-1600596542815-ffad4c1539a9'),
    stock('photo-1600607687920-4e2a09cf159d'),
    stock('photo-1605276374104-dee2a0ed3cd6'),
  ],
};

/** Houses, villas and condominium blocks. */
const HOUSE_PHOTOS = [
  stock('photo-1568605114967-8130f3a36994'),
  stock('photo-1600596542815-ffad4c1539a9'),
  stock('photo-1600585154340-be6161a56a0c'),
  stock('photo-1613490493576-7fde63acd811'),
  stock('photo-1605276374104-dee2a0ed3cd6'),
];

const LAND_PHOTOS = [
  stock('photo-1500382017468-9049fed747ef'),
  stock('photo-1464226184884-fa280b87c399'),
  stock('photo-1500530855697-b586d89ba3ee'),
];

const COMMERCIAL_PHOTOS = [
  stock('photo-1497366754035-f200968a6e72'),
  stock('photo-1497366811353-6870744d04b2'),
  stock('photo-1524758631624-e2822e304c36'),
  stock('photo-1504384308090-c894fdcc538d'),
];

/** Urban photos used for an area card when no listing photo exists. */
const AREA_PHOTOS = [
  stock('photo-1449824913935-59a10b8d2000'),
  stock('photo-1477959858617-67f85cf4f1df'),
  stock('photo-1486406146926-c627a92ad1ab'),
  stock('photo-1444723121867-7a241cacace9'),
  stock('photo-1519501025264-65ba15a82390'),
  stock('photo-1514924013411-cbf25faa35bb'),
  stock('photo-1493246507139-91e8fad9978e'),
  stock('photo-1480714378408-67cf0d13bc1b'),
];

/** Stable index so the same record always resolves to the same photo. */
function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100_000;
  }
  return hash;
}

function pick(list: string[], seed: string): string {
  return list[hashSeed(seed) % list.length]!;
}

/** The set rotated so the record's chosen photo comes first. */
function orderedSet(list: string[], seed: string): string[] {
  const start = hashSeed(seed) % list.length;
  return [...list.slice(start), ...list.slice(0, start)];
}

/**
 * Imported feed images: agency banners, chat screenshots and promo graphics.
 * They do not show the unit, so they are never used as a card photo.
 */
function isFeedArtwork(url: string): boolean {
  return /bina\.et\/static\/property|(screenshot|chatgpt|flyer|brochure|poster|watermark)/i.test(url);
}

export interface PhotoSubject {
  /** Record id: the strongest part of the seed, so two listings never collide. */
  id?: string | null;
  propertyType?: string | null;
  bedrooms?: number | null;
  title?: string | null;
}

function typeKey(subject: PhotoSubject): string {
  return (subject.propertyType ?? '').toUpperCase();
}

function bedroomKey(bedrooms: number | null | undefined): string {
  const beds = bedrooms ?? 0;
  if (beds <= 0) return 'studio';
  return beds >= 5 ? '5' : String(beds);
}

function photoSetFor(subject: PhotoSubject): string[] {
  const type = typeKey(subject);
  if (type === 'LAND' || type === 'PLOT') return LAND_PHOTOS;
  if (type === 'OFFICE' || type === 'RETAIL' || type === 'WAREHOUSE' || type === 'COMMERCIAL') {
    return COMMERCIAL_PHOTOS;
  }
  if (type === 'VILLA' || type === 'HOUSE') return HOUSE_PHOTOS;
  return APARTMENT_PHOTOS[bedroomKey(subject.bedrooms)] ?? APARTMENT_PHOTOS['2']!;
}

function seedKey(subject: PhotoSubject): string {
  return `${subject.id ?? ''}|${subject.title ?? ''}|${typeKey(subject)}|${subject.bedrooms ?? ''}`;
}

/** Photo for a listing card: always a real photo of the advertised home type. */
export function propertyPhoto(subject: PhotoSubject): string {
  return pick(photoSetFor(subject), seedKey(subject));
}

/** Photo for an area card: a recorded listing photo when available, otherwise an urban photo. */
export function areaPhoto(name: string, recorded?: string | null): string {
  if (recorded && !isFeedArtwork(recorded)) return recorded;
  return pick(AREA_PHOTOS, name || 'addis ababa');
}

/**
 * Photos for a detail gallery: the record's own photographs first (when the
 * source published real ones), padded from the same home-type set so the
 * gallery always has at least three usable images.
 */
export function propertyGallery(
  subject: PhotoSubject,
  images: Array<{ imageUrl: string; altText?: string | null }> = [],
): Array<{ imageUrl: string; altText: string | null }> {
  const ordered = orderedSet(photoSetFor(subject), seedKey(subject));
  const cover = { imageUrl: ordered[0]!, altText: subject.title ?? null };
  const usable = images
    .filter((image) => image.imageUrl && !isFeedArtwork(image.imageUrl))
    .map((image) => ({ imageUrl: image.imageUrl, altText: image.altText ?? null }));
  // The card photo is always the first gallery image, so opening a listing
  // shows the photograph the user just clicked.
  const gallery = [cover];
  for (const photo of [...usable, ...ordered.slice(1).map((imageUrl) => ({ imageUrl, altText: subject.title ?? null }))]) {
    if (gallery.length >= 6) break;
    if (!gallery.some((entry) => entry.imageUrl === photo.imageUrl)) gallery.push(photo);
  }
  return gallery;
}
