// Reads a single BinaSmart listing page (the public page linked from the MCP
// search results) and extracts the schema.org RealEstateListing block it
// publishes. The search tool reports prices as written by the listing company
// ("on request", "3,500 / month"), which is not enough to store a verified
// amount; the listing page states the currency explicitly in
// `offers.priceCurrency`, so it is the only place a price is trusted from.

import { logger } from '../../shared/utils/logger';

export const BINA_LISTING_USER_AGENT =
  'EstatePlus/1.0 (Addis Ababa market intelligence; +https://bina.et/property)';

export interface BinaListingDetail {
  url: string;
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

interface JsonLdNode {
  '@type'?: string | string[];
  [key: string]: unknown;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function hasType(node: JsonLdNode, type: string): boolean {
  const t = node['@type'];
  return Array.isArray(t) ? t.includes(type) : t === type;
}

function collectJsonLd(html: string): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]!.trim()) as JsonLdNode | JsonLdNode[];
      if (Array.isArray(parsed)) nodes.push(...parsed);
      else nodes.push(parsed);
    } catch {
      // A malformed block is skipped; other blocks may still carry the listing.
    }
  }
  return nodes;
}

function listingTypeFromBusinessFunction(value: unknown): 'sale' | 'rent' | null {
  const text = asString(value)?.toLowerCase() ?? '';
  if (!text) return null;
  if (text.includes('leaseout') || text.includes('lease')) return 'rent';
  if (text.includes('sell') || text.includes('sale')) return 'sale';
  return null;
}

export function parseBinaListingPage(url: string, html: string): BinaListingDetail | null {
  const nodes = collectJsonLd(html);
  const listing = nodes.find((node) => hasType(node, 'RealEstateListing'));
  if (!listing) return null;

  const offers = (listing.offers ?? {}) as Record<string, unknown>;
  const about = (listing.about ?? {}) as Record<string, unknown>;
  const floorSize = (about.floorSize ?? {}) as Record<string, unknown>;
  const address = (about.address ?? {}) as Record<string, unknown>;

  const rawImages = Array.isArray(listing.image)
    ? listing.image
    : typeof listing.image === 'string'
      ? [listing.image]
      : [];

  const datePostedRaw = asString(listing.datePosted);

  return {
    url,
    title: asString(listing.name),
    description: asString(listing.description)?.slice(0, 4000) ?? null,
    listingType: listingTypeFromBusinessFunction(offers.businessFunction),
    priceAmount: asNumber(offers.price),
    currency: asString(offers.priceCurrency),
    propertyTypeLabel: asString(about['@type']) ?? asString(listing.about),
    bedrooms: asNumber(about.numberOfRooms ?? about.numberOfBedrooms),
    bathrooms: asNumber(about.numberOfBathroomsTotal),
    sizeSqm: asNumber(floorSize.value),
    neighborhood: asString(address.addressLocality) ?? null,
    address: asString(address.streetAddress),
    images: rawImages
      .filter((img): img is string => typeof img === 'string')
      .map((img) => img.trim())
      .filter((img) => /^https?:\/\//i.test(img))
      .slice(0, 10),
    datePosted: datePostedRaw ? new Date(datePostedRaw) : null,
    seller: asString((offers.seller as Record<string, unknown> | undefined)?.name),
  };
}

/** Fetch and parse one BinaSmart listing page. Returns null when the page has
 * no usable JSON-LD block; network failures throw so the caller can decide. */
export async function fetchBinaListingDetail(url: string): Promise<BinaListingDetail | null> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': BINA_LISTING_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en',
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`BinaSmart listing page responded ${response.status}`);
  }

  const html = await response.text();
  const detail = parseBinaListingPage(url, html);
  if (!detail) {
    logger.warn({ msg: 'BinaSmart listing page had no RealEstateListing JSON-LD', url });
  }
  return detail;
}
