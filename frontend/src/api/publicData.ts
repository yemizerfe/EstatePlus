import { apiClient } from './client';
import { areaPhoto, propertyGallery, propertyPhoto } from '../lib/propertyImages';

/**
 * Typed access to the unauthenticated `/public` endpoints.
 *
 * Every statistic is a median of real recorded listings and carries its
 * `sampleSize`. The value is published for any non-empty sample; `confidence`
 * (high >= 5 records, medium 3-4, low 1-2) says how much weight it deserves,
 * and `scope: 'city'` marks an area figure backed by the citywide sample
 * because that area had no listings of its own.
 */

export type MetricStatus = 'available' | 'insufficient_sample';
export type MetricConfidence = 'high' | 'medium' | 'low';
export type MetricScope = 'local' | 'city';

export interface Metric {
  value: number | null;
  unit: string;
  sampleSize: number;
  localSampleSize?: number;
  scope?: MetricScope;
  confidence?: MetricConfidence;
  status: MetricStatus;
  minimumSampleSize: number;
}

export interface MarketSummary {
  generatedAt: string;
  /** Reporting window in months; null means every recorded listing. */
  months?: number | null;
  periodLabel?: string;
  dataAsOf: string | null;
  currency: string | null;
  currencyNote: string;
  minimumSampleSize: number;
  basis: string;
  activeListings: {
    total: number;
    sale: number;
    rent: number;
    dualPurpose: number | null;
  };
  closedListings?: { sold: number; rented: number };
  neighborhoodsCovered: number;
  sale: {
    medianAskingPrice: Metric;
    medianPricePerSqm: Metric;
  };
  rent: {
    medianMonthlyRent: Metric;
  };
  propertyTypes: Array<{ propertyType: string; count: number }>;
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
  /** Primary photo of a listing recorded in this area, when one exists. */
  imageUrl?: string | null;
  activeListings: { sale: number; rent: number };
  sale: {
    medianAskingPrice: Metric;
    medianPricePerSqm: Metric;
  };
  rent: {
    medianMonthlyRent: Metric;
    /** Citywide rent sample, used when this area has no rentals of its own. */
    citywideRent?: Metric;
  };
  /** Change between the two most recent months this area recorded. */
  growth?: { pricePct: number | null; rentPct: number | null };
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

export async function fetchPublicProperty(id: string): Promise<PublicPropertyDetail> {
  const { data } = await apiClient.get<{ data: PublicPropertyDetail }>(
    `/public/properties/${encodeURIComponent(id)}`,
  );
  const detail = data.data;
  return {
    ...detail,
    images: propertyGallery(
      {
        id: detail.propertyId,
        propertyType: detail.propertyType,
        bedrooms: detail.bedrooms,
        title: detail.title,
      },
      detail.images ?? [],
    ),
  };
}

export interface PublicNeighborhoodDetail extends PublicNeighborhood {
  description: string | null;
  /** Attribution for the stored area photograph. */
  imageCredit?: string | null;
  imageCreditUrl?: string | null;
  imageLicense?: string | null;
  recentListings: PublicListingCard[];
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

export async function fetchMarketSummary(months?: number): Promise<MarketSummary> {
  const { data } = await apiClient.get<{ data: MarketSummary }>('/public/market-summary', {
    params: months ? { months } : undefined,
  });
  return data.data;
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

/**
 * Monthly median series. Months below the backend minimum sample return
 * `null` medians; when fewer than two months are plottable the whole payload
 * comes back with `status: 'insufficient_sample'` — render that, do not chart.
 */
export async function fetchMarketTrends(months = 12): Promise<MarketTrends> {
  const { data } = await apiClient.get<{ data: MarketTrends }>('/public/market-trends', {
    params: { months },
  });
  return data.data;
}

// ─── Economic context (indicators, FX, macro series) ────────────────────────

export type SeriesQuality = 'verified_source' | 'recorded_internal' | 'unverified_seed';

export interface IndicatorPoint {
  date: string;
  value: number;
}

export interface IndicatorSeries {
  type: string;
  label: string;
  unit: string;
  points: IndicatorPoint[];
  latest: IndicatorPoint | null;
  previous: IndicatorPoint | null;
  changePct: number | null;
  source: string | null;
  sourceUrl: string | null;
  quality: SeriesQuality;
}

export interface ExchangeRateQuote {
  currency: string;
  baseCurrency: string;
  rateDate: string;
  cashBuying: number | null;
  cashSelling: number | null;
  transactionalBuying: number | null;
  transactionalSelling: number | null;
  source: string;
  sourceUrl: string | null;
}

export interface MacroSeries {
  code: string;
  label: string;
  unit: string | null;
  points: Array<{ year: number; value: number }>;
  latest: { year: number; value: number } | null;
  source: string;
  sourceUrl: string | null;
  quality: SeriesQuality;
}

export interface EconomicContext {
  generatedAt: string;
  months: number;
  indicators: IndicatorSeries[];
  exchangeRates: ExchangeRateQuote[];
  macro: MacroSeries[];
  coverage: {
    indicatorRows: number;
    placeholderRowsExcluded: number;
    verifiedIndicatorRows: number;
    exchangeRateRows: number;
    macroRows: number;
    latestObservationDate: string | null;
  };
  limitations: string[];
}

/**
 * Stored economic indicators, FX snapshots and World Bank macro series, each
 * with its publisher, source link and observation date. Unsourced seed rows are
 * excluded by the backend, not hidden in the client.
 */
export async function fetchEconomicContext(months = 36): Promise<EconomicContext> {
  const { data } = await apiClient.get<{ data: EconomicContext }>('/public/economic-context', {
    params: { months },
  });
  return data.data;
}

export async function fetchPublicNeighborhoods(): Promise<PublicNeighborhood[]> {
  const { data } = await apiClient.get<{ data: PublicNeighborhood[] }>('/public/neighborhoods');
  return (data.data ?? []).map((neighborhood) => ({
    ...neighborhood,
    imageUrl: areaPhoto(neighborhood.name, neighborhood.imageUrl),
  }));
}

export async function fetchPublicNeighborhood(slug: string): Promise<PublicNeighborhoodDetail> {
  const { data } = await apiClient.get<{ data: PublicNeighborhoodDetail }>(
    `/public/neighborhoods/${encodeURIComponent(slug)}`,
  );
  const detail = data.data;
  return {
    ...detail,
    imageUrl: areaPhoto(detail.name, detail.imageUrl),
    recentListings: (detail.recentListings ?? []).map((listing) => ({
      ...listing,
      imageUrl: propertyPhoto({ ...listing, id: listing.propertyId }),
    })),
  };
}

export async function fetchPublicListings(
  query: PublicListingsQuery = {},
): Promise<{ listings: PublicListingCard[]; total: number }> {
  const { data } = await apiClient.get<{ data: { listings: PublicListingCard[]; total: number } }>(
    '/public/listings',
    { params: query },
  );
  const payload = data.data;
  return {
    ...payload,
    listings: (payload.listings ?? []).map((listing) => ({
      ...listing,
      imageUrl: propertyPhoto({ ...listing, id: listing.propertyId }),
    })),
  };
}

// ─── Presentation helpers ───────────────────────────────────────────────────

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  APARTMENT: 'Apartment',
  VILLA: 'Villa',
  CONDOMINIUM: 'Condominium',
  OFFICE: 'Office',
  RETAIL: 'Retail',
  WAREHOUSE: 'Warehouse',
  LAND: 'Land',
};

export function propertyTypeLabel(type: string): string {
  return PROPERTY_TYPE_LABELS[type] ?? type;
}

export function formatAmount(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function formatDate(iso: string | null): string {
  if (!iso) return 'never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toLocaleString();
}

/** Provenance line shown under a metric (sample size, confidence, scope). */
export function metricNote(metric: Metric): string {
  if (metric.value === null) return 'No listings recorded yet';
  const basis =
    metric.scope === 'city'
      ? `citywide median of ${metric.sampleSize} listings`
      : `median of ${metric.sampleSize} listing${metric.sampleSize === 1 ? '' : 's'}`;
  const weight =
    metric.confidence === 'high'
      ? ''
      : metric.confidence === 'medium'
        ? ' · moderate sample'
        : ' · small sample';
  return `${basis}${weight}`;
}

/** Compact display for large ETB figures (8500000 → "8.5M"). */
export function formatCompact(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  // Below 10K the compact form would round away meaningful digits (2,500 → 3K).
  if (Math.abs(value) >= 10_000) return `${Math.round(value / 1_000)}K`;
  return value.toLocaleString();
}

/** Signed percentage for trend badges (8.4 → "+8.4%", -2.1 → "-2.1%"). */
export function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value}%`;
}

/** BinaSmart integrated listings and stats (computed from the source). */
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

export interface PublicBinaStats {
  source: 'binasmart';
  fetchedAt: string;
  recordCount: number;
  activeListings: number;
  medianAskingPrice: Metric;
  medianMonthlyRent: Metric;
  medianPricePerSqm: Metric;
  /** `currency_unstated` means the source published amounts without a currency. */
  currencyStatus: 'etb_verified' | 'currency_unstated';
  note: string;
}

export interface SourceStatusRow {
  id: string;
  name: string;
  category: string;
  status: string;
  accessMethod: string;
  capabilities: Record<string, unknown>;
  lastSuccessfulSync?: string;
  notes: string;
}

export async function fetchBinaListings(): Promise<{
  source: 'binasmart';
  fetchedAt: string;
  resultCount: number;
  note: string;
  listings: PublicBinaListing[];
}> {
  const { data } = await apiClient.get<{
    data: {
      source: 'binasmart';
      fetchedAt: string;
      resultCount: number;
      note: string;
      listings: PublicBinaListing[];
    };
  }>('/public/bina/listings');
  return { ...data.data, listings: data.data.listings ?? [] };
}

export async function fetchBinaStats(): Promise<PublicBinaStats> {
  const { data } = await apiClient.get<{ data: PublicBinaStats }>('/public/bina/stats');
  return data.data!;
}

export async function fetchIntegrationsStatus(): Promise<SourceStatusRow[]> {
  const { data } = await apiClient.get<{ data: SourceStatusRow[] }>(
    '/public/integrations/status',
  );
  return data.data!;
}

