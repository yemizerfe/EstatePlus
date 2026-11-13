// Real.et adapter — reads the public Addis Ababa listing pages.
//
// Each listing page publishes a schema.org `RealEstateListing` block with an
// `Offer` (amount + currency), `floorSize`, bedrooms/bathrooms, a
// `PostalAddress` naming the area, images and `datePosted`. That is the only
// data used here: no guessed currency, no inferred size, no fabricated dates.
//
// Scope: Addis Ababa only. Records outside the city are dropped by the caller.

export const REAL_ET_BASE = 'https://real.et';
export const REAL_ET_SOURCE_NAME = 'Real.et';
export const REAL_ET_SOURCE_TYPE = 'REAL_ET';
export const REAL_ET_USER_AGENT =
  'EstatePlus/1.0 (Addis Ababa market intelligence; reads public listing pages)';

/** Public category pages that list Addis Ababa inventory (robots.txt allows /). */
export const REAL_ET_CATEGORY_PATHS = [
  '/addis-ababa/property-for-sale',
  '/addis-ababa/property-for-rent',
  '/addis-ababa/houses-for-sale',
  '/addis-ababa/houses-for-rent',
  '/addis-ababa/apartments-for-sale',
  '/addis-ababa/apartments-for-rent',
  '/addis-ababa/condominiums-for-sale',
  '/addis-ababa/land-for-sale',
  '/addis-ababa/buildings-for-sale',
  // Area views expose listings that the type views do not paginate to.
  '/addis-ababa',
  '/explore',
  '/addis-ababa/bole',
  '/addis-ababa/ayat',
  '/addis-ababa/cmc',
  '/addis-ababa/summit',
  '/addis-ababa/bole-bulbula',
  '/addis-ababa/bole-arabsa',
  '/addis-ababa/sarbet',
  '/addis-ababa/kazanchis',
  '/addis-ababa/old-airport',
  '/addis-ababa/gerji',
  '/addis-ababa/lebu',
  '/addis-ababa/megenagna',
  '/addis-ababa/jemo',
  '/addis-ababa/saris',
] as const;

export interface RealEtListing {
  sourceUrl: string;
  title: string | null;
  description: string | null;
  listingType: 'sale' | 'rent' | null;
  priceAmount: number | null;
  currency: string | null;
  propertyTypeLabel: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqm: number | null;
  neighborhood: string | null;
  address: string | null;
  images: string[];
  datePosted: Date | null;
  seller: string | null;
}

async function fetchText(url: string, attempts = 3): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': REAL_ET_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en',
        },
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 1_500 * attempt));
    }
  }
  throw new Error(
    `Could not read ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

interface JsonLdNode {
  '@type'?: string | string[];
  [key: string]: unknown;
}

function jsonLdNodes(html: string): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]!.trim()) as JsonLdNode | JsonLdNode[];
      if (Array.isArray(parsed)) nodes.push(...parsed);
      else nodes.push(parsed);
    } catch {
      // Skip malformed blocks; others may still describe the listing.
    }
  }
  return nodes;
}

function hasType(node: JsonLdNode, type: string): boolean {
  const t = node['@type'];
  return Array.isArray(t) ? t.includes(type) : t === type;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function listingTypeOf(node: JsonLdNode): 'sale' | 'rent' | null {
  const businessFunction =
    typeof node.businessFunction === 'string' ? node.businessFunction.toLowerCase() : '';
  if (businessFunction.includes('lease') || businessFunction.includes('rent')) return 'rent';
  if (businessFunction.includes('sell') || businessFunction.includes('sale')) return 'sale';
  return null;
}

/** Collect every listing URL advertised on real.et's Addis Ababa category pages. */
export async function listRealEtListingUrls(): Promise<string[]> {
  const urls = new Set<string>();

  for (const path of REAL_ET_CATEGORY_PATHS) {
    let html: string;
    try {
      html = await fetchText(REAL_ET_BASE + path);
    } catch {
      continue; // A category page that cannot be read is simply not enumerated.
    }
    for (const node of jsonLdNodes(html)) {
      if (!hasType(node, 'ItemList')) continue;
      const items = Array.isArray(node.itemListElement) ? node.itemListElement : [];
      for (const item of items) {
        const url = asString((item as Record<string, unknown>).url);
        if (url && /^https:\/\/real\.et\/properties\//.test(url)) urls.add(url);
      }
    }
  }

  return [...urls];
}

/** Parse one real.et property page. Returns null when the page has no listing JSON-LD. */
export function parseRealEtListingPage(url: string, html: string): RealEtListing | null {
  const listing = jsonLdNodes(html).find((node) => hasType(node, 'RealEstateListing'));
  if (!listing) return null;

  const offers = (listing.offers ?? {}) as Record<string, unknown>;
  const entity = (listing.mainEntity ?? {}) as Record<string, unknown>;
  const floorSize = (entity.floorSize ?? {}) as Record<string, unknown>;
  const address = (entity.address ?? {}) as Record<string, unknown>;
  const rawImages = Array.isArray(listing.image)
    ? listing.image
    : typeof listing.image === 'string'
      ? [listing.image]
      : [];
  const datePosted = asString(listing.datePosted);

  return {
    sourceUrl: url,
    title: asString(listing.name),
    description: asString(listing.description)?.slice(0, 4000) ?? null,
    listingType: listingTypeOf(offers),
    priceAmount: asNumber(offers.price),
    currency: asString(offers.priceCurrency),
    propertyTypeLabel: asString(entity['@type']),
    bedrooms: asNumber(entity.numberOfBedrooms),
    bathrooms: asNumber(entity.numberOfBathroomsTotal ?? entity.numberOfBathrooms),
    sizeSqm: asNumber(floorSize.value),
    neighborhood: asString(address.addressLocality),
    address: asString(address.streetAddress),
    images: rawImages
      .filter((image): image is string => typeof image === 'string')
      .map((image) => image.trim())
      .filter((image) => /^https?:\/\//i.test(image))
      .slice(0, 10),
    datePosted: datePosted ? new Date(datePosted) : null,
    seller: asString((offers.seller as Record<string, unknown> | undefined)?.name),
  };
}

export async function fetchRealEtListing(url: string): Promise<RealEtListing | null> {
  const html = await fetchText(url);
  return parseRealEtListingPage(url, html);
}

/**
 * Map a Real.et listing onto this app's property types. A listing with bedrooms
 * is a home even when its title says "building"; "Building" alone is treated as
 * commercial space only when no bedroom count is published.
 */
export function classifyRealEtPropertyType(
  title: string | null,
  url: string,
  bedrooms: number | null,
): 'APARTMENT' | 'VILLA' | 'CONDOMINIUM' | 'OFFICE' | 'WAREHOUSE' | 'RETAIL' | 'LAND' {
  const text = `${title ?? ''} ${url}`.toLowerCase();
  if (text.includes('condominium')) return 'CONDOMINIUM';
  if (text.includes('house') || text.includes('villa')) return 'VILLA';
  if (text.includes('land') || text.includes('plot')) return 'LAND';
  if (text.includes('commercial') || text.includes('shop')) return 'RETAIL';
  if (text.includes('bedroom') || (bedrooms ?? 0) > 0) return 'APARTMENT';
  if (text.includes('building')) return 'OFFICE';
  return 'APARTMENT';
}

/** Build a display address without repeating the same part twice. */
export function buildRealEtAddress(listing: RealEtListing): string | null {
  const parts = [listing.address, listing.neighborhood, 'Addis Ababa'].filter(
    (part): part is string => typeof part === 'string' && part.trim().length > 0,
  );
  const unique: string[] = [];
  for (const part of parts) {
    const normalized = part.trim();
    if (!unique.some((existing) => existing.toLowerCase() === normalized.toLowerCase())) {
      unique.push(normalized);
    }
  }
  const joined = unique.join(', ');
  return joined.length > 0 ? joined.slice(0, 250) : null;
}
