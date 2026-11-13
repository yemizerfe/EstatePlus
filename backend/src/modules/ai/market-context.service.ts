import { prisma } from '../../infrastructure/database/prisma';

import { getEconomicContext, type EconomicContext } from '../public/economic-context.service';
import {
  getMarketSummary,
  getMarketTrends,
  getPublicProperty,
  listPublicListings,
  listPublicNeighborhoods,
  type MarketSummary,
  type MarketTrends,
  type PublicListingCard,
  type PublicNeighborhood,
  type PublicPropertyDetail,
} from '../public/public.service';

/**
 * Retrieval layer for the EstatePlus AI.
 *
 * The model never receives the whole database. This module:
 *  1. infers the scope of the question (neighborhood, property, date range,
 *     listing direction, property type, budget),
 *  2. loads only the records that scope needs, with hard caps,
 *  3. separates what it found into:
 *       - facts        rows copied from the database, with provenance
 *       - calculations medians/ratios this codebase computed from those rows
 *       - estimates    nothing is generated here; the array exists so the
 *                      prompt has an explicit, empty-by-construction bucket
 *       - unavailable  questions the data cannot answer
 *  4. renders a compact, bounded prompt block.
 *
 * It performs no AI call itself, so it can be tested and reused without an
 * OpenAI key.
 */

export type FactKind =
  | 'market_summary'
  | 'market_trend'
  | 'listing'
  | 'property'
  | 'neighborhood'
  | 'economic_indicator'
  | 'exchange_rate'
  | 'macro_indicator'
  | 'market_statistic';

export type FactQuality = 'verified_source' | 'recorded_internal' | 'calculated' | 'unverified';

export interface GroundedFact {
  id: string;
  kind: FactKind;
  quality: FactQuality;
  /** Human-readable statement, already carrying its numbers and units. */
  statement: string;
  /** Source publisher when the stored row records one. */
  source?: string | null;
  /** Source link when the stored row records one. */
  sourceUrl?: string | null;
  /** Observation / record timestamp this statement is based on. */
  asOf?: string | null;
}

export interface Citation {
  id: string;
  label: string;
  url: string | null;
  asOf: string | null;
  publisher: string | null;
}

export interface GroundingScope {
  question: string;
  neighborhood: { name: string; slug: string } | null;
  propertyId: string | null;
  months: number;
  listingType: 'sale' | 'rent' | null;
  propertyType: string | null;
  maxPrice: number | null;
}

export interface GroundingBundle {
  generatedAt: string;
  scope: GroundingScope;
  facts: GroundedFact[];
  calculations: GroundedFact[];
  estimates: GroundedFact[];
  unavailable: string[];
  citations: Citation[];
  limitations: string[];
  counts: {
    listings: number;
    neighborhoods: number;
    indicatorSeries: number;
    macroSeries: number;
    exchangeRates: number;
    facts: number;
    calculations: number;
  };
  /** Structured payload retained for the prompt renderer (not sent to the UI). */
  data: {
    summary: MarketSummary;
    trends: MarketTrends;
    neighborhoods: PublicNeighborhood[];
    listings: PublicListingCard[];
    property: PublicPropertyDetail | null;
    economic: EconomicContext;
  };
}

export interface BuildMarketContextInput {
  question: string;
  neighborhoodSlug?: string;
  propertyId?: string;
  months?: number;
  listingType?: 'sale' | 'rent';
  propertyType?: string;
  maxPrice?: number;
}

/** Hard caps so a wide question cannot pull an unbounded context. */
const MAX_FACTS = 40;
const MAX_LISTINGS = 8;
const MAX_NEIGHBORHOODS = 6;
const MAX_INDICATOR_SERIES = 6;
const MAX_MACRO_SERIES = 3;
const MAX_TREND_POINTS = 12;

const PROPERTY_TYPE_WORDS: Record<string, string> = {
  apartment: 'APARTMENT',
  apartments: 'APARTMENT',
  flat: 'APARTMENT',
  condo: 'CONDOMINIUM',
  condominium: 'CONDOMINIUM',
  villa: 'VILLA',
  villas: 'VILLA',
  office: 'OFFICE',
  offices: 'OFFICE',
  retail: 'RETAIL',
  shop: 'RETAIL',
  warehouse: 'WAREHOUSE',
  land: 'LAND',
  plot: 'LAND',
};

function clampMonths(value: number): number {
  return Math.min(Math.max(Math.floor(value), 3), 24);
}

function inferMonths(question: string): number | null {
  const q = question.toLowerCase();
  const explicit = q.match(/(?:last|past|previous)\s+(\d{1,2})\s*(month|months|year|years)/);
  if (explicit) {
    const amount = Number(explicit[1]);
    const isYear = explicit[2]!.startsWith('year');
    if (Number.isFinite(amount) && amount > 0) return clampMonths(isYear ? amount * 12 : amount);
  }
  if (q.includes('last year') || q.includes('past year') || q.includes('12 month')) return 12;
  if (q.includes('last quarter') || q.includes('past quarter') || q.includes('3 month')) return 3;
  if (q.includes('last two years') || q.includes('past two years') || q.includes('2 year')) return 24;
  if (q.includes('this year') || q.includes('year to date') || q.includes('ytd')) return 12;
  return null;
}

function inferListingType(question: string): 'sale' | 'rent' | null {
  const q = question.toLowerCase();
  if (/\brent(al|ing|s)?\b|\blease\b|\btenant\b|\byield\b/.test(q)) return 'rent';
  if (/\bbuy(ing)?\b|\bsale\b|\bsell(ing)?\b|\bpurchase\b|\basking price\b/.test(q)) return 'sale';
  return null;
}

function inferPropertyType(question: string): string | null {
  const words = question.toLowerCase().match(/[a-z]+/g) ?? [];
  for (const word of words) {
    const type = PROPERTY_TYPE_WORDS[word];
    if (type) return type;
  }
  return null;
}

function inferMaxPrice(question: string): number | null {
  const match = question
    .toLowerCase()
    .match(/(?:under|below|less than|budget of|up to)\s*(?:etb\s*)?([\d,.]+)\s*(million|m|k|thousand)?/);
  if (!match) return null;
  const raw = Number(match[1]!.replace(/,/g, ''));
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const unit = match[2];
  if (unit === 'million' || unit === 'm') return raw * 1_000_000;
  if (unit === 'k' || unit === 'thousand') return raw * 1_000;
  return raw;
}

function matchNeighborhood(
  question: string,
  neighborhoods: PublicNeighborhood[],
): PublicNeighborhood | null {
  const q = question.toLowerCase();
  let best: PublicNeighborhood | null = null;
  let bestLength = 0;
  for (const neighborhood of neighborhoods) {
    const name = neighborhood.name.toLowerCase();
    const slug = neighborhood.slug.toLowerCase();
    const tokens = [...name.split(/[\s-]+/), ...slug.split('-')].filter((t) => t.length >= 4);
    const matched =
      q.includes(name) ||
      q.includes(slug.replace(/-/g, ' ')) ||
      tokens.some((token) => new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(q));
    if (matched && name.length > bestLength) {
      best = neighborhood;
      bestLength = name.length;
    }
  }
  return best;
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'not available';
  return Math.round(value).toLocaleString('en-US');
}

function formatMonth(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export async function buildMarketContext(
  input: BuildMarketContextInput,
): Promise<GroundingBundle> {
  const question = input.question.trim();
  const months = clampMonths(input.months ?? inferMonths(question) ?? 12);

  // Neighborhoods are needed to resolve a name mentioned in the question.
  const allNeighborhoods = await listPublicNeighborhoods();
  const mentioned = input.neighborhoodSlug
    ? allNeighborhoods.find((n) => n.slug === input.neighborhoodSlug) ?? null
    : matchNeighborhood(question, allNeighborhoods);

  const listingType = input.listingType ?? inferListingType(question);
  const propertyType = input.propertyType ?? inferPropertyType(question);
  const maxPrice = input.maxPrice ?? inferMaxPrice(question);

  const [summary, trends, economic] = await Promise.all([
    getMarketSummary(),
    getMarketTrends(months),
    getEconomicContext(Math.max(months, 12)),
  ]);

  const [listingsResult, property] = await Promise.all([
    listPublicListings({
      neighborhood: mentioned?.slug,
      listingType: listingType ?? undefined,
      propertyType: propertyType ?? undefined,
      maxPrice: maxPrice ?? undefined,
      minBedrooms: undefined,
      limit: MAX_LISTINGS,
    }),
    input.propertyId ? getPublicProperty(input.propertyId) : Promise.resolve(null),
  ]);

  // Stored (imported) statistics for the scoped neighborhood, if any exist.
  const storedStats = mentioned
    ? await prisma.marketStatistic.findMany({
        where: { neighborhood: { slug: mentioned.slug } },
        orderBy: { period: 'desc' },
        take: 4,
        select: {
          period: true,
          avgPrice: true,
          medianPrice: true,
          pricePerSqm: true,
          avgRentalPrice: true,
          rentalYield: true,
          priceGrowth: true,
          sampleSize: true,
          calculatedAt: true,
        },
      })
    : [];

  const scope: GroundingScope = {
    question,
    neighborhood: mentioned ? { name: mentioned.name, slug: mentioned.slug } : null,
    propertyId: input.propertyId ?? null,
    months,
    listingType,
    propertyType,
    maxPrice,
  };

  const facts: GroundedFact[] = [];
  const calculations: GroundedFact[] = [];
  const unavailable: string[] = [];
  const citations: Citation[] = [];
  const citationIds = new Set<string>();

  const addCitation = (citation: Citation): void => {
    if (!citation.url || citationIds.has(citation.id)) return;
    citationIds.add(citation.id);
    citations.push(citation);
  };

  const scopeLabel = mentioned ? mentioned.name : 'Addis Ababa (city-wide)';

  // ── Market summary ────────────────────────────────────────────────────
  facts.push({
    id: 'summary.active',
    kind: 'market_summary',
    quality: 'recorded_internal',
    statement: `${summary.activeListings.total} active listing(s) on approved properties are stored (${summary.activeListings.sale} sale, ${summary.activeListings.rent} rent${summary.activeListings.dualPurpose ? `, ${summary.activeListings.dualPurpose} dual-purpose` : ''}), covering ${summary.neighborhoodsCovered} neighborhood(s).`,
    asOf: summary.dataAsOf,
  });

  const summaryMetrics: Array<[string, { value: number | null; sampleSize: number; unit: string }]> = [
    ['median asking price', summary.sale.medianAskingPrice],
    ['median sale price per m²', summary.sale.medianPricePerSqm],
    ['median monthly rent', summary.rent.medianMonthlyRent],
  ];
  for (const [label, metric] of summaryMetrics) {
    if (metric.value !== null) {
      calculations.push({
        id: `summary.${label.replace(/\s+/g, '_')}`,
        kind: 'market_summary',
        quality: 'calculated',
        statement: `City-wide ${label}: ${formatNumber(metric.value)} ${metric.unit} — median of ${metric.sampleSize} eligible listing record(s).`,
        asOf: summary.dataAsOf,
      });
    } else {
      unavailable.push(
        `City-wide ${label} cannot be stated: only ${metric.sampleSize} eligible record(s), below the minimum sample of ${summary.minimumSampleSize}.`,
      );
    }
  }

  if (summary.currency === null) {
    unavailable.push(
      'Listing prices carry no currency field in this database, so no currency is asserted for listing figures.',
    );
  }

  // ── Monthly trend ─────────────────────────────────────────────────────
  if (trends.status === 'available') {
    const plottable = trends.points.filter((p) => p.medianPrice !== null || p.medianRent !== null);
    for (const point of plottable.slice(-MAX_TREND_POINTS)) {
      facts.push({
        id: `trend.${point.month}`,
        kind: 'market_trend',
        quality: 'recorded_internal',
        statement: `${point.month}: ${point.listingCount} listing(s) recorded; median sale price ${formatNumber(point.medianPrice)} (sample ${point.priceSampleSize}); median monthly rent ${formatNumber(point.medianRent)} (sample ${point.rentSampleSize}).`,
        asOf: point.month,
      });
    }
  } else {
    unavailable.push(
      `A monthly price/rent trend cannot be stated over ${months} months: ${trends.note}`,
    );
  }

  if (trends.comparison.status === 'available') {
    calculations.push({
      id: 'trend.comparison',
      kind: 'market_trend',
      quality: 'calculated',
      statement: `Comparing ${trends.comparison.previousLabel} with ${trends.comparison.currentLabel}: median sale price ${formatNumber(trends.comparison.previousPrice)} → ${formatNumber(trends.comparison.currentPrice)} (${trends.comparison.priceChangePct ?? 'n/a'}%), median monthly rent ${formatNumber(trends.comparison.previousRent)} → ${formatNumber(trends.comparison.currentRent)} (${trends.comparison.rentChangePct ?? 'n/a'}%).`,
    });
  } else {
    unavailable.push(trends.comparison.note);
  }

  // ── Selected property ─────────────────────────────────────────────────
  if (input.propertyId && !property) {
    unavailable.push(
      `Property ${input.propertyId} was requested but has no published (approved) record in the database.`,
    );
  }
  if (property) {
    facts.push({
      id: `property.${property.propertyId}`,
      kind: 'property',
      quality: 'recorded_internal',
      statement: `${property.title} — ${property.propertyType.toLowerCase()}, ${property.condition.toLowerCase()}, ${formatNumber(property.sizeSqm)} m², ${property.bedrooms} bedroom(s), ${property.bathrooms} bathroom(s) in ${property.neighborhood?.name ?? 'an unrecorded neighborhood'}${property.address ? `, ${property.address}` : ''}.`,
      asOf: property.listing?.updatedAt ?? null,
    });
    if (property.listing) {
      facts.push({
        id: `property.${property.propertyId}.listing`,
        kind: 'listing',
        quality: 'recorded_internal',
        statement: `Active ${property.listing.listingType} listing: asking price ${formatNumber(property.listing.price)}, monthly rent ${formatNumber(property.listing.monthlyRent)}, listed ${property.listing.listedAt.slice(0, 10)}.`,
        asOf: property.listing.updatedAt,
      });
      if (property.listing.price !== null && property.sizeSqm !== null && property.sizeSqm > 0) {
        calculations.push({
          id: `property.${property.propertyId}.per_sqm`,
          kind: 'property',
          quality: 'calculated',
          statement: `Asking price per m² for this property: ${formatNumber(property.listing.price / property.sizeSqm)} (price ÷ recorded size).`,
        });
      }
      if (
        property.listing.price !== null &&
        property.listing.monthlyRent !== null &&
        property.listing.price > 0
      ) {
        const gross = Math.round((property.listing.monthlyRent * 12 * 10000) / property.listing.price) / 100;
        calculations.push({
          id: `property.${property.propertyId}.gross_yield`,
          kind: 'property',
          quality: 'calculated',
          statement: `Gross rental yield implied by the recorded asking price and rent: ${gross}% per year (annual rent ÷ asking price; excludes costs, vacancy and taxes).`,
        });
      }
    }
    if (property.neighborhoodMarket) {
      const market = property.neighborhoodMarket;
      facts.push({
        id: `property.${property.propertyId}.area`,
        kind: 'neighborhood',
        quality: 'recorded_internal',
        statement: `Neighborhood market for ${property.neighborhood?.name ?? 'this area'}: ${market.activeListings.sale} sale and ${market.activeListings.rent} rent listing(s); median asking price ${market.sale.medianAskingPrice.status === 'available' ? formatNumber(market.sale.medianAskingPrice.value) : 'not available'}; median monthly rent ${market.rent.medianMonthlyRent.status === 'available' ? formatNumber(market.rent.medianMonthlyRent.value) : 'not available'}.`,
      });
    }
  }

  // ── Neighborhoods ─────────────────────────────────────────────────────
  const neighborhoodPool = mentioned
    ? [mentioned]
    : [...allNeighborhoods]
        .sort(
          (a, b) =>
            b.activeListings.sale + b.activeListings.rent - (a.activeListings.sale + a.activeListings.rent),
        )
        .slice(0, MAX_NEIGHBORHOODS);

  for (const neighborhood of neighborhoodPool) {
    const medianPrice =
      neighborhood.sale.medianAskingPrice.status === 'available'
        ? formatNumber(neighborhood.sale.medianAskingPrice.value)
        : `not available (${neighborhood.sale.medianAskingPrice.sampleSize} sale records)`;
    const medianRent =
      neighborhood.rent.medianMonthlyRent.status === 'available'
        ? formatNumber(neighborhood.rent.medianMonthlyRent.value)
        : `not available (${neighborhood.rent.medianMonthlyRent.sampleSize} rent records)`;
    facts.push({
      id: `neighborhood.${neighborhood.slug}`,
      kind: 'neighborhood',
      quality: 'recorded_internal',
      statement: `${neighborhood.name}: ${neighborhood.activeListings.sale} sale and ${neighborhood.activeListings.rent} rent active listing(s); median asking price ${medianPrice}; median monthly rent ${medianRent}; coordinates ${neighborhood.centerLat !== null && neighborhood.centerLng !== null ? `${neighborhood.centerLat}, ${neighborhood.centerLng}` : 'not recorded'}.`,
    });
  }

  for (const statistic of storedStats) {
    facts.push({
      id: `statistic.${statistic.period}.${statistic.sampleSize ?? 0}`,
      kind: 'market_statistic',
      quality: 'recorded_internal',
      statement: `Stored market statistic for ${scopeLabel}, period ${statistic.period}: average price ${formatNumber(statistic.avgPrice === null ? null : Number(statistic.avgPrice))}, median price ${formatNumber(statistic.medianPrice === null ? null : Number(statistic.medianPrice))}, average rent ${formatNumber(statistic.avgRentalPrice === null ? null : Number(statistic.avgRentalPrice))}, price growth ${statistic.priceGrowth === null ? 'not recorded' : `${Number(statistic.priceGrowth)}%`}, sample size ${statistic.sampleSize ?? 'not recorded'}.`,
      asOf: statistic.calculatedAt.toISOString(),
    });
  }

  // ── Comparables ───────────────────────────────────────────────────────
  for (const listing of listingsResult.listings.slice(0, MAX_LISTINGS)) {
    facts.push({
      id: `listing.${listing.listingId}`,
      kind: 'listing',
      quality: 'recorded_internal',
      statement: `${listing.title} — ${listing.propertyType.toLowerCase()} in ${listing.neighborhood ?? 'an unrecorded neighborhood'}: ${listing.listingType} at ${formatNumber(listing.price)}${listing.monthlyRent !== null ? `, rent ${formatNumber(listing.monthlyRent)}/month` : ''}, ${formatNumber(listing.sizeSqm)} m², ${listing.bedrooms} bed / ${listing.bathrooms} bath. Listed ${listing.listedAt.slice(0, 10)}, last updated ${listing.updatedAt.slice(0, 10)}.`,
      asOf: listing.updatedAt,
    });
  }

  // ── Economic indicators (publisher, URL and date preserved) ───────────
  for (const series of economic.indicators.slice(0, MAX_INDICATOR_SERIES)) {
    if (!series.latest) continue;
    facts.push({
      id: `indicator.${series.type}`,
      kind: 'economic_indicator',
      quality: series.quality === 'verified_source' ? 'verified_source' : 'recorded_internal',
      statement: `${series.label}: ${series.latest.value} ${series.unit} observed ${series.latest.date.slice(0, 10)}${series.changePct !== null ? `, change from previous observation ${series.changePct}%` : ''}.`,
      source: series.source,
      sourceUrl: series.sourceUrl,
      asOf: series.latest.date,
    });
    if (series.sourceUrl) {
      addCitation({
        id: `indicator.${series.type}`,
        label: `${series.label} (${series.source ?? 'source unrecorded'})`,
        url: series.sourceUrl,
        asOf: series.latest.date.slice(0, 10),
        publisher: series.source,
      });
    }
  }

  for (const quote of economic.exchangeRates.slice(0, 4)) {
    facts.push({
      id: `fx.${quote.currency}.${quote.rateDate.slice(0, 10)}`,
      kind: 'exchange_rate',
      quality: quote.sourceUrl ? 'verified_source' : 'recorded_internal',
      statement: `${quote.baseCurrency}/${quote.currency}: cash buying ${formatNumber(quote.cashBuying)}, cash selling ${formatNumber(quote.cashSelling)}, transactional buying ${formatNumber(quote.transactionalBuying)}, transactional selling ${formatNumber(quote.transactionalSelling)} on ${quote.rateDate.slice(0, 10)}.`,
      source: quote.source,
      sourceUrl: quote.sourceUrl,
      asOf: quote.rateDate,
    });
    if (quote.sourceUrl) {
      addCitation({
        id: `fx.${quote.currency}`,
        label: `${quote.source} ${quote.baseCurrency}/${quote.currency} rate`,
        url: quote.sourceUrl,
        asOf: quote.rateDate.slice(0, 10),
        publisher: quote.source,
      });
    }
  }

  for (const series of economic.macro.slice(0, MAX_MACRO_SERIES)) {
    if (!series.latest) continue;
    facts.push({
      id: `macro.${series.code}`,
      kind: 'macro_indicator',
      quality: series.quality === 'verified_source' ? 'verified_source' : 'recorded_internal',
      statement: `${series.label} (Ethiopia, country-level, not city-level): ${series.latest.value} ${series.unit ?? ''} in ${series.latest.year}.`,
      source: series.source,
      sourceUrl: series.sourceUrl,
      asOf: String(series.latest.year),
    });
    if (series.sourceUrl) {
      addCitation({
        id: `macro.${series.code}`,
        label: `${series.label} — ${series.source}`,
        url: series.sourceUrl,
        asOf: String(series.latest.year),
        publisher: series.source,
      });
    }
  }

  // ── Limitations ───────────────────────────────────────────────────────
  const limitations = [
    ...economic.limitations,
    `Sale and rental figures come from separate populations and are never combined; buckets below ${summary.minimumSampleSize} records are reported as unavailable rather than estimated.`,
    'Property and listing records carry no external source URL in this schema; they are cited as records in the EstatePlus database with their listed/updated timestamps.',
    `${listingsResult.total} listing(s) matched the scope; only the ${Math.min(listingsResult.total, MAX_LISTINGS)} most recent were retrieved as comparables.`,
  ];
  if (economic.coverage.placeholderRowsExcluded > 0) {
    limitations.push(
      `${economic.coverage.placeholderRowsExcluded} seeded placeholder economic indicator(s) were excluded from the context. If the question depends on them, the data is simply not available.`,
    );
  }
  if (mentioned && mentioned.centerLat === null) {
    limitations.push(
      `No map centroid is recorded for ${mentioned.name}, so map-distance questions cannot be answered from this database.`,
    );
  }

  if (facts.length === 0 && calculations.length === 0) {
    unavailable.push('No stored records matched this question at all.');
  }

  return {
    generatedAt: new Date().toISOString(),
    scope,
    facts: facts.slice(0, MAX_FACTS),
    calculations,
    estimates: [],
    unavailable: [...new Set(unavailable)],
    citations,
    limitations: [...new Set(limitations)],
    counts: {
      listings: listingsResult.listings.length,
      neighborhoods: neighborhoodPool.length,
      indicatorSeries: economic.indicators.length,
      macroSeries: economic.macro.length,
      exchangeRates: economic.exchangeRates.length,
      facts: facts.length,
      calculations: calculations.length,
    },
    data: {
      summary,
      trends,
      neighborhoods: neighborhoodPool,
      listings: listingsResult.listings,
      property,
      economic,
    },
  };
}

/**
 * Compact, bounded rendering of the bundle for the model prompt.
 * Facts keep their `[S#]` citation marker so the answer can point back.
 */
export function renderContextForPrompt(bundle: GroundingBundle): string {
  const citationIndex = new Map<string, string>();
  bundle.citations.forEach((citation, index) => {
    citationIndex.set(citation.id, `S${index + 1}`);
  });

  const markerFor = (fact: GroundedFact): string => {
    const key = fact.kind === 'economic_indicator'
      ? fact.id
      : fact.kind === 'exchange_rate'
        ? `fx.${fact.id.split('.')[1]}`
        : fact.kind === 'macro_indicator'
          ? fact.id
          : '';
    const marker = key ? citationIndex.get(key) : undefined;
    return marker ? ` [${marker}]` : '';
  };

  const lines: string[] = [];
  const { scope } = bundle;

  lines.push('### RETRIEVAL SCOPE');
  lines.push(
    `Question: ${scope.question}\nNeighborhood: ${scope.neighborhood?.name ?? 'city-wide'}\nProperty: ${scope.propertyId ?? 'none selected'}\nWindow: last ${scope.months} months\nDirection: ${scope.listingType ?? 'sale and rent'}\nProperty type: ${scope.propertyType ?? 'any'}\nBudget ceiling: ${scope.maxPrice ?? 'not specified'}`,
  );
  lines.push(`Retrieved: ${bundle.counts.facts} fact(s), ${bundle.counts.calculations} calculated metric(s), ${bundle.counts.listings} comparable listing(s), ${bundle.counts.neighborhoods} neighborhood(s).`);

  lines.push('\n### VERIFIED FACTS (rows in the EstatePlus database; quote these as facts)');
  for (const fact of bundle.facts) {
    const provenance = [
      fact.source ? `source: ${fact.source}` : null,
      fact.asOf ? `as of ${fact.asOf.length > 10 ? formatMonth(fact.asOf) : fact.asOf}` : null,
    ].filter(Boolean).join('; ');
    lines.push(`- [${fact.quality}] ${fact.statement}${provenance ? ` (${provenance})` : ''}${markerFor(fact)}`);
  }

  lines.push('\n### CALCULATED METRICS (computed by EstatePlus from those facts)');
  if (bundle.calculations.length === 0) {
    lines.push('- none available');
  } else {
    for (const calculation of bundle.calculations) {
      lines.push(`- ${calculation.statement}`);
    }
  }

  lines.push('\n### ESTIMATES');
  lines.push('- none were generated. You have no model-generated estimates in this context.');

  lines.push('\n### DATA THAT IS NOT AVAILABLE');
  if (bundle.unavailable.length === 0) {
    lines.push('- nothing flagged');
  } else {
    for (const item of bundle.unavailable) lines.push(`- ${item}`);
  }

  if (bundle.citations.length > 0) {
    lines.push('\n### SOURCE LINKS');
    bundle.citations.forEach((citation, index) => {
      lines.push(`- [S${index + 1}] ${citation.label} — ${citation.url} (as of ${citation.asOf ?? 'date not recorded'})`);
    });
  }

  lines.push('\n### LIMITATIONS');
  for (const limitation of bundle.limitations) lines.push(`- ${limitation}`);

  return lines.join('\n');
}

/** Small, safe summary returned alongside an answer for the UI. */
export function summarizeGrounding(bundle: GroundingBundle) {
  return {
    scope: bundle.scope,
    counts: bundle.counts,
    citations: bundle.citations,
    limitations: bundle.limitations,
    unavailable: bundle.unavailable,
    generatedAt: bundle.generatedAt,
  };
}
