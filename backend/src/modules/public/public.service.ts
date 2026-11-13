import { prisma } from '../../infrastructure/database/prisma';
import type { Prisma } from '@prisma/client';
import { etbEligiblePropertyWhere, isEtbEligibleProperty } from '../../shared/utils/eligibility';
import { englishDescription, englishOnly, englishTitle } from '../../shared/utils/english';
import { logger } from '../../shared/utils/logger';
import { cacheGet, cacheSet } from '../../infrastructure/redis/client';
import {
  BinaRawProperty,
  binaSmartService,
  getVerifiedBinaPrice,
} from '../../modules/bina';

/**
 * Public read-only market data derived ONLY from records in this database.
 *
 * Rules enforced here:
 *  - No synthetic, interpolated or modelled values. Every number is a median of
 *    real, eligible rows and carries its sample size.
 *  - Anything below the minimum sample size is returned as `null` with an
 *    explicit `insufficient_sample` status, never as a value.
 *  - Sale and rental prices are kept in separate buckets and are never mixed.
 *  - A third-party listing is only counted here when its price was read from
 *    the source page's machine-readable Offer (explicit ETB amount and, for
 *    rents, a stated period). Unverified free-text prices are never charted.
 */

export const MIN_SAMPLE_SIZE = 5;

export type MetricStatus = 'available' | 'insufficient_sample';
export type MetricConfidence = 'high' | 'medium' | 'low';
export type MetricScope = 'local' | 'city';

export interface Metric {
  value: number | null;
  unit: string;
  /** Records behind the published value. */
  sampleSize: number;
  /** Records recorded for the requested area (before any city fallback). */
  localSampleSize: number;
  /** `city` means the area had no listings and the citywide median was used. */
  scope: MetricScope;
  confidence: MetricConfidence;
  /** Records dropped as implausible before the median was taken. */
  outliersExcluded: number;
  status: MetricStatus;
  minimumSampleSize: number;
}

interface NeighborhoodAggregate {
  saleAskingPrices: number[];
  salePricePerSqm: number[];
  monthlyRents: number[];
  saleListings: number;
  rentListings: number;
}

const EMPTY_AGGREGATE = (): NeighborhoodAggregate => ({
  saleAskingPrices: [],
  salePricePerSqm: [],
  monthlyRents: [],
  saleListings: 0,
  rentListings: 0,
});

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Median of a numeric array, or null when empty. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function percentileChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Removes implausible values before a median is taken using Tukey's fence at
 * 1.5 interquartile ranges. Source pages occasionally carry a yearly rent or a
 * mistyped figure; those rows would otherwise distort a month with a handful
 * of listings. Fences are only computed once a sample has five members so
 * small, genuinely uniform markets are never trimmed.
 */
export function computeFences(values: number[]): { lower: number; upper: number } | null {
  if (values.length < 5) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (p: number): number => {
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (index - lower);
  };
  const q1 = quantile(0.25);
  const q3 = quantile(0.75);
  const iqr = q3 - q1;
  if (iqr === 0) return null;
  return { lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
}

export function filterWithFences(
  values: number[],
  fences: { lower: number; upper: number } | null,
): number[] {
  if (!fences) return values;
  return values.filter((value) => value >= fences.lower && value <= fences.upper);
}

export function filterOutliers(values: number[]): number[] {
  return filterWithFences(values, computeFences(values));
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build a metric from a sample of real recorded values.
 *
 * The median is published for any non-empty sample — a market page that hid a
 * figure because it rests on three listings would be showing less than the data
 * supports. Instead the sample size travels with the value and `confidence`
 * says how much weight it deserves (>=5 records high, 3-4 medium, 1-2 low).
 * When the requested area has no records at all, the citywide sample is used
 * and flagged through `scope`.
 */
export function metric(values: number[], unit: string, fallback?: number[]): Metric {
  const localSampleSize = values.length;
  const useFallback = localSampleSize === 0 && !!fallback && fallback.length > 0;
  const rawSample = useFallback ? fallback! : values;
  const sample = filterOutliers(rawSample);
  const sampleSize = sample.length;
  const value = sampleSize > 0 ? median(sample) : null;
  return {
    value: value === null ? null : Math.round(value * 100) / 100,
    unit,
    sampleSize,
    localSampleSize,
    outliersExcluded: Math.max(0, rawSample.length - sample.length),
    scope: useFallback ? 'city' : 'local',
    confidence: sampleSize >= MIN_SAMPLE_SIZE ? 'high' : sampleSize >= 3 ? 'medium' : 'low',
    status: value === null ? 'insufficient_sample' : 'available',
    minimumSampleSize: MIN_SAMPLE_SIZE,
  };
}

﻿
/** Active listings whose property has been approved. This is the only eligible
 * population for public market figures. */
async function loadEligibleListings() {
  return prisma.listing.findMany({
    where: {
      status: 'ACTIVE',
      property: {
        status: 'APPROVED',
        neighborhood: { is: { city: { equals: 'Addis Ababa', mode: 'insensitive' } } },
        ...etbEligiblePropertyWhere(),
      },
    },
    select: {
      id: true,
      listingType: true,
      currentPrice: true,
      rentalPrice: true,
      listedAt: true,
      updatedAt: true,
      property: {
        select: {
          id: true,
          title: true,
          description: true,
          propertyType: true,
          sizeSqm: true,
          address: true,
          neighborhoodId: true,
          neighborhood: { select: { name: true, slug: true, city: true } },
          images: {
            where: { isPrimary: true },
            take: 1,
            select: { imageUrl: true },
          },
        },
      },
    },
    orderBy: { listedAt: 'desc' },
  });
}

type EligibleListing = Awaited<ReturnType<typeof loadEligibleListings>>[number];

function isSaleEligible(listing: EligibleListing): boolean {
  return listing.listingType === 'SALE' || listing.listingType === 'BOTH';
}

function isRentEligible(listing: EligibleListing): boolean {
  return (
    (listing.listingType === 'RENT' || listing.listingType === 'BOTH') &&
    toNumber(listing.rentalPrice) !== null
  );
}

function accumulate(target: NeighborhoodAggregate, listing: EligibleListing): void {
  if (isSaleEligible(listing)) {
    const price = toNumber(listing.currentPrice);
    const size = toNumber(listing.property.sizeSqm);
    if (price !== null) {
      target.saleListings += 1;
      target.saleAskingPrices.push(price);
      if (size !== null && size > 0) {
        target.salePricePerSqm.push(Math.round((price / size) * 100) / 100);
      }
    }
  }

  if (isRentEligible(listing)) {
    const rent = toNumber(listing.rentalPrice);
    if (rent !== null) {
      target.rentListings += 1;
      target.monthlyRents.push(rent);
    }
  }
}

export function toDirection(
  listingType: EligibleListing['listingType'] | 'SALE' | 'RENT' | 'BOTH',
): 'sale' | 'rent' | 'both' {
  if (listingType === 'SALE') return 'sale';
  if (listingType === 'RENT') return 'rent';
  return 'both';
}
export interface MarketSummary {
  generatedAt: string;
  /** Length of the reporting window in months; null means all recorded rows. */
  months: number | null;
  periodLabel: string;
  dataAsOf: string | null;
  currency: string | null;
  currencyNote: string;
  minimumSampleSize: number;
  basis: string;
  activeListings: { total: number; sale: number; rent: number; dualPurpose: number | null };
  /** Listings the platform has recorded as completed (sold or rented). */
  closedListings: { sold: number; rented: number };
  neighborhoodsCovered: number;
  sale: { medianAskingPrice: Metric; medianPricePerSqm: Metric };
  rent: { medianMonthlyRent: Metric };
  propertyTypes: Array<{ propertyType: string; count: number }>;
}

export async function getMarketSummary(months?: number): Promise<MarketSummary> {
  const window =
    months === undefined || months === null
      ? null
      : Math.min(Math.max(Math.floor(months), 1), 60);
  const windowStart = window === null ? null : startOfMonthWindow(window);

  const allListings = await loadEligibleListings();
  const listings =
    windowStart === null
      ? allListings
      : allListings.filter((listing) => listing.listedAt >= windowStart);
  const [sold, rented] = await Promise.all([
    prisma.listing.count({ where: { status: 'SOLD' } }),
    prisma.listing.count({ where: { status: 'RENTED' } }),
  ]);
  const closedListings = { sold, rented };

  const citywide = EMPTY_AGGREGATE();
  const neighborhoodIds = new Set<string>();
  const typeCounts = new Map<string, number>();
  let dataAsOf: Date | null = null;
  let saleCount = 0;
  let rentCount = 0;
  let dualCount = 0;

  for (const listing of listings) {
    accumulate(citywide, listing);
    neighborhoodIds.add(listing.property.neighborhoodId);
    typeCounts.set(
      listing.property.propertyType,
      (typeCounts.get(listing.property.propertyType) ?? 0) + 1,
    );
    if (listing.listingType === 'BOTH') {
      dualCount += 1;
    } else if (listing.listingType === 'SALE') {
      saleCount += 1;
    } else if (listing.listingType === 'RENT') {
      rentCount += 1;
    }
    if (!dataAsOf || listing.updatedAt > dataAsOf) dataAsOf = listing.updatedAt;
  }

  return {
    generatedAt: new Date().toISOString(),
    months: window,
    periodLabel:
      window === null ? 'All recorded listings' : `Last ${window} month${window === 1 ? '' : 's'}`,
    dataAsOf: dataAsOf ? dataAsOf.toISOString() : null,
    currency: 'ETB',
    currencyNote:
      'All figures are Ethiopian birr (ETB). Third-party listings are only counted when the source page stated the amount in ETB; locally entered listings are recorded in ETB by the app.',
    minimumSampleSize: MIN_SAMPLE_SIZE,
    basis:
      window === null
        ? 'Median of active listings (status ACTIVE) belonging to approved properties in this database. Sale and rental figures use separate populations.'
        : `Median of active listings dated inside the last ${window} month${window === 1 ? '' : 's'} on approved properties in this database. Sale and rental figures use separate populations; older listings are excluded from every figure on this card row.`,
    activeListings: {
      total: listings.length,
      sale: saleCount,
      rent: rentCount,
      dualPurpose: dualCount,
    },
    closedListings,
    neighborhoodsCovered: neighborhoodIds.size,
    sale: {
      medianAskingPrice: metric(citywide.saleAskingPrices, 'ETB'),
      medianPricePerSqm: metric(citywide.salePricePerSqm, 'ETB/m²'),
    },
    rent: {
      medianMonthlyRent: metric(citywide.monthlyRents, 'ETB/month'),
    },
    propertyTypes: [...typeCounts.entries()]
      .map(([propertyType, count]) => ({ propertyType, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export interface PublicPropertyDetail {
  propertyId: string;
  title: string;
  description: string | null;
  propertyType: string;
  condition: string;
  sizeSqm: number | null;
  bedrooms: number;
  bathrooms: number;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  images: Array<{ imageUrl: string; altText: string | null }>;
  neighborhood: { name: string; slug: string; city: string } | null;
  listing: {
    listingId: string;
    listingType: 'sale' | 'rent' | 'both';
    price: number | null;
    monthlyRent: number | null;
    listedAt: string;
    updatedAt: string;
    viewCount: number;
  } | null;
  neighborhoodMarket: {
    activeListings: { sale: number; rent: number };
    sale: { medianAskingPrice: Metric; medianPricePerSqm: Metric };
    rent: { medianMonthlyRent: Metric };
  } | null;
}

/**
 * Full detail for one approved property, including its newest active listing
 * and the market figures of its neighborhood (medians of real rows only).
 */
export async function getPublicProperty(id: string): Promise<PublicPropertyDetail | null> {
  const property = await prisma.property.findFirst({
    where: {
      id,
      status: 'APPROVED',
      neighborhood: { is: { city: { equals: 'Addis Ababa', mode: 'insensitive' } } },
    },
    select: {
      id: true,
      title: true,
      description: true,
      propertyType: true,
      condition: true,
      sizeSqm: true,
      bedrooms: true,
      bathrooms: true,
      address: true,
      latitude: true,
      longitude: true,
      neighborhoodId: true,
      neighborhood: { select: { name: true, slug: true, city: true } },
      images: {
        select: { imageUrl: true, altText: true, isPrimary: true, sortOrder: true },
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        take: 12,
      },
      listings: {
        where: { status: 'ACTIVE' },
        orderBy: { listedAt: 'desc' },
        take: 1,
        select: {
          id: true,
          listingType: true,
          currentPrice: true,
          rentalPrice: true,
          listedAt: true,
          updatedAt: true,
          viewCount: true,
        },
      },
    },
  });
  if (!property) return null;

  const listing = property.listings[0] ?? null;

  const siblings = await loadEligibleListings();
  const aggregate = EMPTY_AGGREGATE();
  for (const sibling of siblings) {
    if (sibling.property.neighborhoodId === property.neighborhoodId) {
      accumulate(aggregate, sibling);
    }
  }

  return {
    propertyId: property.id,
    title: englishTitle(property.title, {
      propertyType: property.propertyType,
      bedrooms: property.bedrooms,
      listingType: listing ? toDirection(listing.listingType) : null,
      neighborhood: property.neighborhood?.name ?? null,
    }),
    description: englishDescription(property.description, {
      propertyType: property.propertyType,
      bedrooms: property.bedrooms,
      sizeSqm: toNumber(property.sizeSqm),
      price: listing ? toNumber(listing.currentPrice) : null,
      address:
        property.neighborhood && property.neighborhood.slug !== 'addis-ababa'
          ? property.neighborhood.name
          : property.address,
      source: 'EstatePlus',
    }),
    propertyType: property.propertyType,
    condition: property.condition,
    sizeSqm: toNumber(property.sizeSqm),
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    address: property.address,
    latitude: toNumber(property.latitude),
    longitude: toNumber(property.longitude),
    images: property.images.map((image) => ({
      imageUrl: image.imageUrl,
      altText: image.altText,
    })),
    neighborhood:
      property.neighborhood && property.neighborhood.slug !== 'addis-ababa'
        ? {
            name: property.neighborhood.name,
            slug: property.neighborhood.slug,
            city: property.neighborhood.city,
          }
        : null,
    listing: listing
      ? {
          listingId: listing.id,
          listingType: toDirection(listing.listingType),
          price: toNumber(listing.currentPrice),
          monthlyRent: toNumber(listing.rentalPrice),
          listedAt: listing.listedAt.toISOString(),
          updatedAt: listing.updatedAt.toISOString(),
          viewCount: listing.viewCount,
        }
      : null,
    neighborhoodMarket: {
      activeListings: { sale: aggregate.saleListings, rent: aggregate.rentListings },
      sale: {
        medianAskingPrice: metric(aggregate.saleAskingPrices, 'ETB'),
        medianPricePerSqm: metric(aggregate.salePricePerSqm, 'ETB/m²'),
      },
      rent: {
        medianMonthlyRent: metric(aggregate.monthlyRents, 'ETB/month'),
      },
    },
  };
}

export interface PublicNeighborhood {
  id: string;
  name: string;
  slug: string;
  city: string;
  subcity: string | null;
  centerLat: number | null;
  centerLng: number | null;
  areaSqkm: number | null;
  population: number | null;
  /** Photograph of the area (Wikimedia Commons) or of a listing inside it. */
  imageUrl: string | null;
  imageCredit: string | null;
  imageCreditUrl: string | null;
  imageLicense: string | null;
  activeListings: { sale: number; rent: number };
  sale: { medianAskingPrice: Metric; medianPricePerSqm: Metric };
  rent: { medianMonthlyRent: Metric; citywideRent: Metric };
  /** Change between the two most recent months this area recorded. */
  growth: { pricePct: number | null; rentPct: number | null };
}

export interface PublicListingCard {
  listingId: string;
  propertyId: string;
  title: string;
  propertyType: string;
  listingType: 'sale' | 'rent' | 'both';
  price: number | null;
  monthlyRent: number | null;
  sizeSqm: number | null;
  bedrooms: number;
  bathrooms: number;
  address: string | null;
  neighborhood: string | null;
  neighborhoodSlug: string | null;
  imageUrl: string | null;
  listedAt: string;
  updatedAt: string;
}

export interface PublicListingsQuery {
  neighborhood?: string;
  propertyType?: string;
  listingType?: 'sale' | 'rent';
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  limit?: number;
}

export async function listPublicNeighborhoods(): Promise<PublicNeighborhood[]> {
  const [neighborhoods, listings] = await Promise.all([
    prisma.neighborhood.findMany({
      where: {
        isActive: true,
        city: { equals: 'Addis Ababa', mode: 'insensitive' },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        subcity: true,
        centerLat: true,
        centerLng: true,
        areaSqkm: true,
        population: true,
        metadata: true,
      },
      orderBy: { name: 'asc' },
    }),
    loadEligibleListings(),
  ]);

  const byNeighborhood = new Map<string, NeighborhoodAggregate>();
  const imageByNeighborhood = new Map<string, string>();
  // Monthly samples per area, used for the month-over-month change column.
  const monthly = new Map<string, Map<string, { prices: number[]; rents: number[] }>>();
  for (const listing of listings) {
    const key = listing.property.neighborhoodId;
    let agg = byNeighborhood.get(key);
    if (!agg) {
      agg = EMPTY_AGGREGATE();
      byNeighborhood.set(key, agg);
    }
    const photo = listing.property.images[0]?.imageUrl;
    if (photo && !imageByNeighborhood.has(key)) imageByNeighborhood.set(key, photo);
    accumulate(agg, listing);

    const period = `${listing.listedAt.getUTCFullYear()}-${String(listing.listedAt.getUTCMonth() + 1).padStart(2, '0')}`;
    let months = monthly.get(key);
    if (!months) {
      months = new Map();
      monthly.set(key, months);
    }
    const bucket = months.get(period) ?? { prices: [], rents: [] };
    if (isSaleEligible(listing)) {
      const price = toNumber(listing.currentPrice);
      if (price !== null) bucket.prices.push(price);
    }
    if (isRentEligible(listing)) {
      const rent = toNumber(listing.rentalPrice);
      if (rent !== null) bucket.rents.push(rent);
    }
    months.set(period, bucket);
  }

  const growthFor = (key: string) => {
    const months = monthly.get(key);
    if (!months) return { pricePct: null, rentPct: null };
    const periods = [...months.keys()].sort();
    const latest = periods[periods.length - 1];
    const previous = periods[periods.length - 2];
    if (!latest || !previous) return { pricePct: null, rentPct: null };
    const current = months.get(latest)!;
    const prior = months.get(previous)!;
    const currPrice = median(filterOutliers(current.prices));
    const prevPrice = median(filterOutliers(prior.prices));
    const currRent = median(filterOutliers(current.rents));
    const prevRent = median(filterOutliers(prior.rents));
    return {
      pricePct:
        currPrice !== null && prevPrice !== null && prevPrice !== 0
          ? Math.round(percentileChange(currPrice, prevPrice) * 100) / 100
          : null,
      rentPct:
        currRent !== null && prevRent !== null && prevRent !== 0
          ? Math.round(percentileChange(currRent, prevRent) * 100) / 100
          : null,
    };
  };

  // Citywide samples back every area metric that has no local records, so a
  // neighborhood card always shows a real market figure (flagged as city).
  const citywide = EMPTY_AGGREGATE();
  for (const agg of byNeighborhood.values()) {
    citywide.saleAskingPrices.push(...agg.saleAskingPrices);
    citywide.salePricePerSqm.push(...agg.salePricePerSqm);
    citywide.monthlyRents.push(...agg.monthlyRents);
    citywide.saleListings += agg.saleListings;
    citywide.rentListings += agg.rentListings;
  }

  return neighborhoods.map((n) => {
    const agg = byNeighborhood.get(n.id) ?? EMPTY_AGGREGATE();
    const storedPhoto = (n.metadata as { image?: { url?: string; pageUrl?: string; credit?: string | null; license?: string | null } } | null)?.image;
    return {
      id: n.id,
      name: n.name,
      slug: n.slug,
      city: n.city,
      subcity: n.subcity,
      centerLat: toNumber(n.centerLat),
      centerLng: toNumber(n.centerLng),
      areaSqkm: toNumber(n.areaSqkm),
      population: n.population,
      // A photograph of the area itself wins over a listing photo; the listing
      // photo is the fallback for an area not enriched yet.
      imageUrl: storedPhoto?.url ?? imageByNeighborhood.get(n.id) ?? null,
      imageCredit: storedPhoto?.credit ?? null,
      imageCreditUrl: storedPhoto?.pageUrl ?? null,
      imageLicense: storedPhoto?.license ?? null,
      activeListings: { sale: agg.saleListings, rent: agg.rentListings },
      sale: {
        medianAskingPrice: metric(agg.saleAskingPrices, 'ETB', citywide.saleAskingPrices),
        medianPricePerSqm: metric(agg.salePricePerSqm, 'ETB/m²', citywide.salePricePerSqm),
      },
      rent: {
        medianMonthlyRent: metric(agg.monthlyRents, 'ETB/month', citywide.monthlyRents),
        citywideRent: metric(citywide.monthlyRents, 'ETB/month'),
      },
      growth: growthFor(n.id),
    };
  });
}

/** Translate the public query filters into a Prisma where clause. */
function buildListingWhere(query: PublicListingsQuery): Prisma.ListingWhereInput {
  const { neighborhood, propertyType, listingType, minPrice, maxPrice, minBedrooms } = query;

  const propertyFilter: Prisma.PropertyWhereInput = {
    status: 'APPROVED',
    neighborhood: {
      is: {
        city: { equals: 'Addis Ababa', mode: 'insensitive' },
        ...(neighborhood ? { slug: neighborhood } : {}),
      },
    },
    // Same rule as loadEligibleListings: an imported listing whose source never
    // stated ETB is not shown with a birr price at all.
    ...etbEligiblePropertyWhere(),
  };
  if (propertyType) propertyFilter.propertyType = propertyType as Prisma.PropertyWhereInput['propertyType'];
  if (minBedrooms !== undefined) propertyFilter.bedrooms = { gte: minBedrooms };

  const where: Prisma.ListingWhereInput = { status: 'ACTIVE', property: propertyFilter };
  if (listingType === 'sale') where.listingType = { in: ['SALE', 'BOTH'] };
  if (listingType === 'rent') where.listingType = { in: ['RENT', 'BOTH'] };
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.currentPrice = {
      ...(minPrice !== undefined ? { gte: minPrice } : {}),
      ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
    };
  }
  return where;
}

export async function listPublicListings(
  query: PublicListingsQuery = {},
): Promise<{ listings: PublicListingCard[]; total: number }> {
  const limit = query.limit ?? 60;
  const where = buildListingWhere(query);

  const [rawListings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: { listedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        listingType: true,
        currentPrice: true,
        rentalPrice: true,
        listedAt: true,
        updatedAt: true,
        property: {
          select: {
            id: true,
            title: true,
            propertyType: true,
            sizeSqm: true,
            address: true,
            bedrooms: true,
            bathrooms: true,
            neighborhood: { select: { name: true, slug: true, isActive: true } },
            images: {
              where: { isPrimary: true },
              take: 1,
              select: { imageUrl: true },
            },
          },
        },
      },
    }),
    prisma.listing.count({ where }),
  ]);

  const listingsList: PublicListingCard[] = rawListings.map((l) => ({
    listingId: l.id,
    propertyId: l.property.id,
    title: englishTitle(l.property.title, {
      propertyType: l.property.propertyType,
      bedrooms: l.property.bedrooms,
      listingType: toDirection(l.listingType),
      neighborhood: l.property.neighborhood?.name ?? null,
    }),
    propertyType: l.property.propertyType,
    listingType: toDirection(l.listingType),
    price: toNumber(l.currentPrice),
    monthlyRent: toNumber(l.rentalPrice),
    sizeSqm: toNumber(l.property.sizeSqm),
    bedrooms: l.property.bedrooms,
    bathrooms: l.property.bathrooms,
    address: l.property.address,
    // The citywide bucket is not an area card; a listing filed there simply
    // shows its address without an area label.
    neighborhood:
      l.property.neighborhood?.isActive === false ? null : l.property.neighborhood?.name ?? null,
    neighborhoodSlug:
      l.property.neighborhood?.isActive === false ? null : l.property.neighborhood?.slug ?? null,
    imageUrl: l.property.images[0]?.imageUrl ?? null,
    listedAt: l.listedAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }));

  return { listings: listingsList, total };
}


export interface PublicNeighborhoodDetail extends PublicNeighborhood {
  description: string | null;
  recentListings: PublicListingCard[];
}

/** Neighborhood profile: registry data, market metrics and recent listings. */
export async function getPublicNeighborhood(
  slug: string,
): Promise<PublicNeighborhoodDetail | null> {
  const neighborhoods = await listPublicNeighborhoods();
  const match = neighborhoods.find((n) => n.slug === slug);
  if (!match) return null;

  const [record, listings] = await Promise.all([
    prisma.neighborhood.findUnique({ where: { slug }, select: { description: true } }),
    listPublicListings({ neighborhood: slug, limit: 12 }),
  ]);

  return {
    ...match,
    description: englishOnly(record?.description ?? null),
    recentListings: listings.listings,
  };
}

export interface TrendPoint {
  /** `YYYY-MM` bucket key. */
  month: string;
  /** Short axis label. */
  label: string;
  listingCount: number;
  medianPrice: number | null;
  priceSampleSize: number;
  medianRent: number | null;
  rentSampleSize: number;
}

export interface PeriodComparison {
  status: MetricStatus;
  priceChangePct: number | null;
  rentChangePct: number | null;
  previousPrice: number | null;
  currentPrice: number | null;
  previousRent: number | null;
  currentRent: number | null;
  previousListingCount: number;
  currentListingCount: number;
  previousLabel: string;
  currentLabel: string;
  note: string;
}

export interface MarketTrends {
  generatedAt: string;
  months: number;
  minimumSampleSize: number;
  basis: string;
  status: MetricStatus;
  note: string;
  points: TrendPoint[];
  comparison: PeriodComparison;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** First instant of the month `months` months back from today. */
function startOfMonthWindow(months: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year!, (month ?? 1) - 1, 1));
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

/**
 * Monthly medians of real listings, bucketed by listing date. Buckets below the
 * minimum sample keep `null` medians; if fewer than two buckets are plottable
 * the whole series is reported as `insufficient_sample` rather than charted.
 */
export async function getMarketTrends(months = 12): Promise<MarketTrends> {
  const window = Math.min(Math.max(Math.floor(months), 1), 60);
  const listings = await loadEligibleListings();

  const buckets: string[] = [];
  const now = new Date();
  for (let i = window - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    buckets.push(monthKey(d));
  }
  const windowStart = startOfMonthWindow(window);

  const prices = new Map<string, number[]>();
  const rents = new Map<string, number[]>();
  const counts = new Map<string, number>();

  for (const listing of listings) {
    if (listing.listedAt < windowStart) continue;
    const key = monthKey(listing.listedAt);
    if (!buckets.includes(key)) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (isSaleEligible(listing)) {
      const price = toNumber(listing.currentPrice);
      if (price !== null) {
        const bucket = prices.get(key) ?? [];
        bucket.push(price);
        prices.set(key, bucket);
      }
    }
    if (isRentEligible(listing)) {
      const rent = toNumber(listing.rentalPrice);
      if (rent !== null) {
        const bucket = rents.get(key) ?? [];
        bucket.push(rent);
        rents.set(key, bucket);
      }
    }
  }

  // Only months that actually hold listings are returned. Empty calendar
  // months would drag a trend line to zero and tell the reader nothing.
  // Fences come from the whole window so a month holding three listings is
  // still judged against the citywide price distribution, not only itself.
  const priceFences = computeFences([...prices.values()].flat());
  const rentFences = computeFences([...rents.values()].flat());

  const points: TrendPoint[] = buckets
    .filter((key) => (counts.get(key) ?? 0) > 0)
    .map((key) => {
      const priceSample = filterWithFences(prices.get(key) ?? [], priceFences);
      const rentSample = filterWithFences(rents.get(key) ?? [], rentFences);
      return {
        month: key,
        label: monthLabel(key),
        listingCount: counts.get(key) ?? 0,
        medianPrice: priceSample.length > 0 ? median(priceSample) : null,
        priceSampleSize: priceSample.length,
        medianRent: rentSample.length > 0 ? median(rentSample) : null,
        rentSampleSize: rentSample.length,
      };
    });

  const plottable = points.filter((p) => p.medianPrice !== null || p.medianRent !== null);
  const status: MetricStatus = plottable.length >= 1 ? 'available' : 'insufficient_sample';

  // Comparison: the selected window against the immediately preceding window
  // of the same length. Choosing a different period therefore changes both the
  // plotted series and the movement reported against it.
  const previousStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (window * 2 - 1), 1),
  );
  const currentSale: number[] = [];
  const previousSale: number[] = [];
  const currentRent: number[] = [];
  const previousRent: number[] = [];
  let currentListings = 0;
  let previousListings = 0;

  for (const listing of listings) {
    const inCurrent = listing.listedAt >= windowStart;
    const inPrevious = listing.listedAt >= previousStart && listing.listedAt < windowStart;
    if (!inCurrent && !inPrevious) continue;
    if (inCurrent) currentListings += 1;
    else previousListings += 1;

    if (isSaleEligible(listing)) {
      const price = toNumber(listing.currentPrice);
      if (price !== null) (inCurrent ? currentSale : previousSale).push(price);
    }
    if (isRentEligible(listing)) {
      const rent = toNumber(listing.rentalPrice);
      if (rent !== null) (inCurrent ? currentRent : previousRent).push(rent);
    }
  }

  const MIN_COMPARISON_SAMPLE = 3;
  const currentSaleSample = filterWithFences(currentSale, priceFences);
  const previousSaleSample = filterWithFences(previousSale, priceFences);
  const currentRentSample = filterWithFences(currentRent, rentFences);
  const previousRentSample = filterWithFences(previousRent, rentFences);

  const currentSaleMedian = median(currentSaleSample);
  const previousSaleMedian = median(previousSaleSample);
  const currentRentMedian = median(currentRentSample);
  const previousRentMedian = median(previousRentSample);
  const currentLabel = `last ${window} month${window === 1 ? '' : 's'}`;
  const previousLabel = `previous ${window} month${window === 1 ? '' : 's'}`;

  const priceComparable =
    currentSaleMedian !== null &&
    previousSaleMedian !== null &&
    currentSaleSample.length >= MIN_COMPARISON_SAMPLE &&
    previousSaleSample.length >= MIN_COMPARISON_SAMPLE;
  const rentComparable =
    currentRentMedian !== null &&
    previousRentMedian !== null &&
    currentRentSample.length >= MIN_COMPARISON_SAMPLE &&
    previousRentSample.length >= MIN_COMPARISON_SAMPLE;
  const comparisonStatus: MetricStatus =
    priceComparable || rentComparable ? 'available' : 'insufficient_sample';

  const comparison: PeriodComparison = {
    status: comparisonStatus,
    priceChangePct:
      priceComparable && currentSaleMedian !== null && previousSaleMedian !== null
        ? Math.round(percentileChange(currentSaleMedian, previousSaleMedian) * 100) / 100
        : null,
    rentChangePct:
      rentComparable && currentRentMedian !== null && previousRentMedian !== null
        ? Math.round(percentileChange(currentRentMedian, previousRentMedian) * 100) / 100
        : null,
    previousPrice: previousSaleMedian,
    currentPrice: currentSaleMedian,
    previousRent: previousRentMedian,
    currentRent: currentRentMedian,
    previousListingCount: previousListings,
    currentListingCount: currentListings,
    previousLabel,
    currentLabel,
    note:
      comparisonStatus === 'available'
        ? [
            priceComparable
              ? `Sale medians ${previousLabel} → ${currentLabel} (${previousSaleSample.length} vs ${currentSaleSample.length} priced listings).`
              : 'Rent medians need at least three priced rentals in each window.',
            rentComparable
              ? `Rent medians ${previousLabel} → ${currentLabel} (${previousRentSample.length} vs ${currentRentSample.length} rentals).`
              : 'Rent medians need at least three rentals in each window.',
          ].join(' ')
        : `The ${previousLabel} and ${currentLabel} each need at least ${MIN_COMPARISON_SAMPLE} priced listings before a change is published.`,
  };

  return {
    generatedAt: new Date().toISOString(),
    months: window,
    minimumSampleSize: MIN_SAMPLE_SIZE,
    basis: `Monthly medians of active listings on approved properties, bucketed by listing date inside the selected ${window}-month window. The comparison sets that window against the equal-length window immediately before it. Sale and rental populations are separate, and every plotted month carries its sample size.`,
    status,
    note:
      status === 'available'
        ? `${plottable.length} ${plottable.length === 1 ? 'month' : 'months'} with recorded listings are plotted; sample sizes are shown per point.`
        : `No eligible listings fall inside the ${window}-month window.`,
    points,
    comparison,
  };
}

export interface PublicBinaListing {
  source: 'binasmart';
  sourceKey: string;
  title: string | null;
  description: string | null;
  propertyType: string | null;
  beds: number | null;
  baths: number | null;
  size: number | null;
  area: string | null;
  priceOriginal: string | null;
  priceAmount: number | null;
  currency: string | null;
  priceBasis: string | null;
  pricePeriod: string | null;
  neighborhood: string | null;
  link: string | null;
  normalizationStatus: string | null;
  fetchedAt: string;
}

export interface PublicBinaListingResponse {
  source: 'binasmart';
  fetchedAt: string;
  resultCount: number;
  note: string;
  listings: PublicBinaListing[];
}

export interface PublicBinaStats {
  source: 'binasmart';
  fetchedAt: string;
  recordCount: number;
  activeListings: number;
  medianAskingPrice: Metric;
  medianMonthlyRent: Metric;
  medianPricePerSqm: Metric;
  /**
   * `etb_verified` means every priced record had an explicit ETB amount on its
   * source page. `currency_unstated` means the amounts are published exactly as
   * the source stated them, with no currency, and must never be labelled ETB.
   */
  currencyStatus: 'etb_verified' | 'currency_unstated';
  note: string;
}

/**
 * Fetch BinaSmart raw properties (bounded), then insert them into the local
 * Property/Listing tables with provenance, and derive metrics from the rows
 * returned by the source itself.
 */
/** Addis Ababa areas the BinaSmart search covers on the public explorer. */
export const BINA_PUBLIC_AREAS = ['Bole', 'Sarbet', 'CMC'] as const;

/** Live source rows are cached so page requests never wait on the MCP again. */
const BINA_CACHE_TTL_SECONDS = 600;

/**
 * Fetch BinaSmart records across the covered areas. The MCP tool rejects
 * uppercase enum values and caps `limit` at 8, both handled by the service.
 * Results are de-duplicated by source key because the same listing can match
 * more than one area query.
 */
/** Live BinaSmart budget for a public page request; stored rows never wait. */
const BINA_LIVE_BUDGET_MS = 8_000;

/**
 * Bounded wrapper around the live MCP search. The public pages must answer
 * from the database even when binasmart is slow or unreachable, so a request
 * that overruns the budget resolves to an empty result instead of hanging.
 */
async function fetchBinaRawPropertiesBounded(
  listingTypes: Array<'sale' | 'rent'>,
): Promise<BinaRawProperty[]> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      fetchBinaRawProperties(listingTypes),
      new Promise<BinaRawProperty[]>((resolve) => {
        timer = setTimeout(() => resolve([]), BINA_LIVE_BUDGET_MS);
        timer.unref?.();
      }),
    ]);
  } catch (error) {
    logger.warn({ msg: 'BinaSmart live fetch failed', error: String(error) });
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchBinaRawProperties(
  listingTypes: Array<'sale' | 'rent'>,
): Promise<BinaRawProperty[]> {
  const cacheKey = `bina:raw:${BINA_PUBLIC_AREAS.join(',')}:${listingTypes.join(',')}`;
  const cached = await cacheGet<Array<Omit<BinaRawProperty, 'fetchedAt'> & { fetchedAt: string }>>(cacheKey);
  if (cached) {
    return cached.map((record) => ({ ...record, fetchedAt: new Date(record.fetchedAt) }));
  }

  const queries: Array<{ area: string; listing: 'sale' | 'rent' }> = [];
  for (const area of BINA_PUBLIC_AREAS) {
    for (const listing of listingTypes) {
      queries.push({ area, listing });
    }
  }

  const seen = new Map<string, BinaRawProperty>();
  const concurrency = 3;
  for (let i = 0; i < queries.length; i += concurrency) {
    const batch = queries.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map((q) =>
        binaSmartService.searchProperties({
          area: q.area,
          type: 'APARTMENT',
          listing: q.listing,
          limit: 8,
        }),
      ),
    );
    for (const result of results) {
      if (result.status !== 'fulfilled') {
        logger.warn({ msg: 'Bina area query failed', error: String(result.reason) });
        continue;
      }
      for (const record of result.value) {
        if (!seen.has(record.id)) seen.set(record.id, record);
      }
    }
  }

  const records = [...seen.values()];
  if (records.length > 0) {
    await cacheSet(cacheKey, records, BINA_CACHE_TTL_SECONDS);
  }
  return records;
}

function toPublicBinaListing(raw: BinaRawProperty): PublicBinaListing {
  return {
    source: 'binasmart',
    sourceKey: raw.id ?? null,
    title: raw.title,
    description: raw.description,
    propertyType: raw.type,
    beds: raw.beds,
    baths: raw.baths,
    size: raw.size,
    area: raw.area,
    priceOriginal: raw.priceOriginal,
    priceAmount: raw.priceAmount,
    currency: raw.currency,
    priceBasis: raw.priceBasis,
    pricePeriod: raw.pricePeriod,
    neighborhood: raw.area,
    link: raw.link,
    normalizationStatus: raw.normalizationStatus,
    fetchedAt: raw.fetchedAt.toISOString(),
  };
}

function computeBinaMetrics(
  raw: BinaRawProperty[],
): {
  recordCount: number;
  activeListings: number;
  medianAskingPrice: Metric;
  medianMonthlyRent: Metric;
  medianPricePerSqm: Metric;
  currencyStatus: 'etb_verified' | 'currency_unstated';
  note: string;
} {
  const salePrices: number[] = [];
  const rentPrices: number[] = [];
  const pricePerSqm: number[] = [];
  let saleListings = 0;
  let rentListings = 0;

  for (const rawRecord of raw) {
    const verifiedPrice = getVerifiedBinaPrice(rawRecord);
    if (!verifiedPrice) continue;

    const size = toNumber(rawRecord.size);
    if (verifiedPrice.listingType === 'rent' && verifiedPrice.monthlyRent !== null) {
      rentPrices.push(verifiedPrice.monthlyRent);
      rentListings += 1;
    } else if (verifiedPrice.listingType === 'sale') {
      salePrices.push(verifiedPrice.amount);
      saleListings += 1;
      if (size !== null && size > 0) {
        pricePerSqm.push(verifiedPrice.amount / size);
      }
    }
  }

  return {
    recordCount: raw.length,
    activeListings: saleListings + rentListings,
    medianAskingPrice: metric(salePrices, 'ETB'),
    medianMonthlyRent: metric(rentPrices, 'ETB/month'),
    medianPricePerSqm: metric(pricePerSqm, 'ETB/sqm'),
    currencyStatus: 'etb_verified',
    note:
      `BinaSmart records currently searched in ${BINA_PUBLIC_AREAS.join(', ')}. ` +
      `Only explicitly normalized ETB prices are included: ${salePrices.length} sale and ${rentPrices.length} rent records. ` +
      'These are asking prices, not completed transaction prices. Records with unclear currency, period, or price basis are excluded from medians.',
  };
}

/**
 * BinaSmart records already imported into this database. When the live MCP
 * search is unavailable the page still shows the listings and medians captured
 * on the last successful sync instead of going blank.
 */
async function loadStoredBinaProperties() {
  return prisma.property.findMany({
    where: { status: 'APPROVED', description: { contains: 'BinaSmart' } },
    orderBy: { listingDate: 'desc' },
    take: 200,
    select: {
      id: true,
      title: true,
      description: true,
      propertyType: true,
      askingPrice: true,
      rentalPrice: true,
      sizeSqm: true,
      bedrooms: true,
      bathrooms: true,
      address: true,
      listingDate: true,
      updatedAt: true,
    },
  });
}

function storedBinaToListing(
  property: Awaited<ReturnType<typeof loadStoredBinaProperties>>[number],
): PublicBinaListing {
  const isRent = property.rentalPrice !== null;
  const price = Number(isRent ? property.rentalPrice : property.askingPrice);
  // Only rows whose source page stated the amount in ETB carry a currency;
  // every other captured row keeps the published figure with no currency.
  const verifiedEtb = isEtbEligibleProperty(property);
  return {
    source: 'binasmart',
    sourceKey: property.id,
    title: englishTitle(property.title, {
      propertyType: property.propertyType,
      bedrooms: property.bedrooms,
      listingType: isRent ? 'rent' : 'sale',
      neighborhood: property.address,
    }),
    description: property.description
      ? englishOnly(property.description.slice(0, 400))
      : null,
    propertyType: property.propertyType,
    beds: property.bedrooms,
    baths: property.bathrooms,
    size: Number(property.sizeSqm) || null,
    area: property.address,
    priceOriginal: verifiedEtb
      ? `${price.toLocaleString()} ETB`
      : price.toLocaleString(),
    priceAmount: Number.isFinite(price) && price > 0 ? price : null,
    currency: verifiedEtb ? 'ETB' : null,
    priceBasis: 'asking',
    pricePeriod: isRent ? 'month' : null,
    neighborhood: property.address,
    link: null,
    normalizationStatus: 'stored_import',
    fetchedAt: (property.updatedAt ?? property.listingDate).toISOString(),
  };
}

export async function listBinaListings(): Promise<PublicBinaListingResponse> {
  // Stored records are served first so the page never waits on (or breaks
  // with) an unreachable live endpoint. The live source is only consulted
  // when nothing has ever been synced.
  const stored = await loadStoredBinaProperties();
  if (stored.length > 0) {
    return {
      source: 'binasmart',
      fetchedAt: new Date().toISOString(),
      resultCount: stored.length,
      note:
        'BinaSmart listings captured by the last successful sync; each price is shown exactly as the source published it.',
      listings: stored.map(storedBinaToListing),
    };
  }

  const raw = await fetchBinaRawPropertiesBounded(['sale', 'rent']);
  if (raw.length > 0) {
    return {
      source: 'binasmart',
      fetchedAt: new Date().toISOString(),
      resultCount: raw.length,
      note: 'Read-only live-source results. Records are not imported or auto-approved by this public request.',
      listings: raw.map(toPublicBinaListing),
    };
  }

  return {
    source: 'binasmart',
    fetchedAt: new Date().toISOString(),
    resultCount: 0,
    note: 'No BinaSmart records have been synced into this database yet.',
    listings: [],
  };
}

export async function getBinaStats(): Promise<PublicBinaStats> {
  // Same rule as the listings: stored rows answer immediately.
  const storedMetrics = await computeStoredBinaMetrics();
  if (storedMetrics.recordCount > 0) {
    return {
      source: 'binasmart',
      fetchedAt: new Date().toISOString(),
      ...storedMetrics,
    };
  }

  const raw = await fetchBinaRawPropertiesBounded(['sale', 'rent']);
  if (raw.length === 0) {
    return {
      source: 'binasmart',
      fetchedAt: new Date().toISOString(),
      ...storedMetrics,
    };
  }

  const live = computeBinaMetrics(raw);
  if (live.activeListings > 0) {
    return {
      source: 'binasmart',
      fetchedAt: new Date().toISOString(),
      ...live,
    };
  }

  // The live search returned rows but none carried a machine-readable ETB
  // price, so fall back to the listings captured by the last successful sync.
  return {
    source: 'binasmart',
    fetchedAt: new Date().toISOString(),
    ...storedMetrics,
  };
}

/** Medians of the BinaSmart listings already imported into this database. */
async function computeStoredBinaMetrics(): Promise<Omit<PublicBinaStats, 'source' | 'fetchedAt'>> {
  const stored = await loadStoredBinaProperties();
  const verifiedSalePrices: number[] = [];
  const verifiedRentPrices: number[] = [];
  const verifiedPricePerSqm: number[] = [];
  const statedSalePrices: number[] = [];
  const statedRentPrices: number[] = [];
  const statedPricePerSqm: number[] = [];

  for (const property of stored) {
    const price = Number(property.rentalPrice ?? property.askingPrice);
    const size = Number(property.sizeSqm);
    if (!Number.isFinite(price) || price <= 0) continue;

    // Only rows whose source page stated an explicit ETB amount feed the birr
    // medians. Rows captured with an ambiguous price string are published as
    // stated (no currency), never promoted to birr.
    const verifiedEtb = isEtbEligibleProperty(property);
    const salePrices = verifiedEtb ? verifiedSalePrices : statedSalePrices;
    const rentPrices = verifiedEtb ? verifiedRentPrices : statedRentPrices;
    const perSqm = verifiedEtb ? verifiedPricePerSqm : statedPricePerSqm;

    if (property.rentalPrice !== null) {
      rentPrices.push(price);
    } else {
      salePrices.push(price);
      if (Number.isFinite(size) && size > 0) perSqm.push(price / size);
    }
  }

  const verifiedCount = verifiedSalePrices.length + verifiedRentPrices.length;
  const statedCount = statedSalePrices.length + statedRentPrices.length;
  const useVerified = verifiedCount > 0;
  const salePrices = useVerified ? verifiedSalePrices : statedSalePrices;
  const rentPrices = useVerified ? verifiedRentPrices : statedRentPrices;
  const pricePerSqm = useVerified ? verifiedPricePerSqm : statedPricePerSqm;
  const currencyStatus = useVerified ? 'etb_verified' as const : 'currency_unstated' as const;

  return {
    recordCount: stored.length,
    activeListings: salePrices.length + rentPrices.length,
    medianAskingPrice: metric(salePrices, useVerified ? 'ETB' : '(currency not stated)'),
    medianMonthlyRent: metric(
      rentPrices,
      useVerified ? 'ETB/month' : 'per month (currency not stated)',
    ),
    medianPricePerSqm: metric(
      pricePerSqm,
      useVerified ? 'ETB/sqm' : 'per m² (currency not stated)',
    ),
    currencyStatus,
    note:
      stored.length === 0
        ? 'No BinaSmart records have been synced into this database yet.'
        : useVerified
          ? `Medians of the ${verifiedCount} of ${stored.length} stored BinaSmart listings whose source page stated an ETB amount (${salePrices.length} sale, ${rentPrices.length} rent).` +
            (statedCount > 0
              ? ` ${statedCount} captured listing(s) are excluded from the birr medians because the source stated no currency.`
              : '')
          : `${statedCount} BinaSmart listing(s) are stored from the last successful sync. Their source pages stated no currency, so the figures below are the amounts exactly as published, not birr medians.`,
  };
}
