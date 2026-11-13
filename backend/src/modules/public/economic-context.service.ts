import { prisma } from '../../infrastructure/database/prisma';

/**
 * Economic context for the public market pages.
 *
 * Every series here comes from a stored row, and every series carries the
 * provenance that row actually has:
 *
 *  - `verified_source`  stored with a publisher name and (usually) a source URL
 *                       and observation date; safe to show as a sourced fact.
 *  - `recorded_internal` stored internally without a publisher / URL. Shown,
 *                       but never described as an official statistic.
 *  - `unverified_seed`  development placeholder rows (`SEED_PLACEHOLDER`).
 *                       Never shown as market data; counted separately so the
 *                       gap is visible instead of silently filled.
 *
 * Nothing is interpolated, forecast or derived between observation dates.
 */

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

export interface MacroPoint {
  year: number;
  value: number;
}

export interface MacroSeries {
  code: string;
  label: string;
  unit: string | null;
  points: MacroPoint[];
  latest: MacroPoint | null;
  source: string;
  sourceUrl: string | null;
  quality: SeriesQuality;
}

export interface EconomicCoverage {
  indicatorRows: number;
  placeholderRowsExcluded: number;
  verifiedIndicatorRows: number;
  exchangeRateRows: number;
  macroRows: number;
  latestObservationDate: string | null;
}

export interface EconomicContext {
  generatedAt: string;
  months: number;
  indicators: IndicatorSeries[];
  exchangeRates: ExchangeRateQuote[];
  macro: MacroSeries[];
  coverage: EconomicCoverage;
  limitations: string[];
}

const INDICATOR_LABELS: Record<string, string> = {
  INFLATION_RATE: 'Inflation rate',
  INTEREST_RATE: 'Policy interest rate',
  EXCHANGE_RATE: 'Exchange rate',
  CONSTRUCTION_COST_INDEX: 'Construction cost index',
  GDP_GROWTH: 'GDP growth',
  UNEMPLOYMENT_RATE: 'Unemployment rate',
  CONSUMER_PRICE_INDEX: 'Consumer price index',
  MONEY_SUPPLY: 'Money supply',
  BANK_LENDING_RATE: 'Bank lending rate',
  GOVERNMENT_DEBT: 'Government debt',
  MORTGAGE_RATE: 'Mortgage rate',
  REAL_ESTATE_PRICE_INDEX: 'Real estate price index',
  RENTAL_YIELD_INDEX: 'Rental yield index',
  HOUSING_AFFORDABILITY: 'Housing affordability',
  CREDIT_GROWTH: 'Credit growth',
  FOREIGN_INVESTMENT: 'Foreign investment',
  TAX_REVENUE: 'Tax revenue',
  IMPORT_PRICE_INDEX: 'Import price index',
  EXPORT_PRICE_INDEX: 'Export price index',
  OTHER: 'Other indicator',
};

const MACRO_LABELS: Record<string, { label: string; unit: string | null }> = {
  'SP.POP.TOTL': { label: 'Population, total', unit: 'people' },
  'SP.URB.TOTL.IN.ZS': { label: 'Urban population', unit: '% of total population' },
  'NY.GDP.MKTP.CD': { label: 'GDP (current US$)', unit: 'USD' },
  'NY.GDP.MKTP.KD.ZG': { label: 'GDP growth', unit: '% annual' },
  'FP.CPI.TOTL.ZG': { label: 'Inflation, consumer prices', unit: '% annual' },
};

/** How many macro series are returned to a page (kept small on purpose). */
const MACRO_SERIES_LIMIT = 5;

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isPlaceholder(source: string | null, unit: string | null): boolean {
  const haystack = `${source ?? ''} ${unit ?? ''}`.toLowerCase();
  return haystack.includes('seed') || haystack.includes('placeholder');
}

function pctChange(previous: number | null, current: number | null): number | null {
  if (previous === null || current === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

export async function getEconomicContext(monthsInput = 36): Promise<EconomicContext> {
  const months = Math.min(Math.max(Math.floor(monthsInput), 1), 120);
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const [indicatorRows, exchangeRows, macroRows] = await Promise.all([
    prisma.economicIndicator.findMany({ orderBy: { recordedAt: 'asc' } }),
    prisma.exchangeRate.findMany({ orderBy: [{ rateDate: 'desc' }, { currency: 'asc' }] }),
    prisma.macroIndicator.findMany({ orderBy: [{ year: 'asc' }] }),
  ]);

  const grouped = new Map<string, IndicatorSeries>();
  let placeholderRowsExcluded = 0;
  let verifiedIndicatorRows = 0;
  let latestObservation: Date | null = null;

  for (const row of indicatorRows) {
    const value = toNumber(row.value);
    if (value === null) continue;

    if (isPlaceholder(row.source, row.unit)) {
      placeholderRowsExcluded += 1;
      continue;
    }
    if (row.recordedAt < since) continue;

    const quality: SeriesQuality = row.sourceUrl ? 'verified_source' : 'recorded_internal';
    if (quality === 'verified_source') verifiedIndicatorRows += 1;

    const key = row.indicatorType;
    let series = grouped.get(key);
    if (!series) {
      series = {
        type: key,
        label: INDICATOR_LABELS[key] ?? key,
        unit: row.unit,
        points: [],
        latest: null,
        previous: null,
        changePct: null,
        source: row.source,
        sourceUrl: row.sourceUrl,
        quality,
      };
      grouped.set(key, series);
    }

    series.points.push({ date: row.recordedAt.toISOString(), value });
    if (!latestObservation || row.recordedAt > latestObservation) latestObservation = row.recordedAt;
  }

  const indicators = [...grouped.values()].map((series) => {
    const latest = series.points[series.points.length - 1] ?? null;
    const previous = series.points[series.points.length - 2] ?? null;
    return {
      ...series,
      latest,
      previous,
      changePct: pctChange(previous?.value ?? null, latest?.value ?? null),
    };
  });

  // Latest quote per currency — exchange rates are daily snapshots, not series.
  const latestByCurrency = new Map<string, ExchangeRateQuote>();
  const seenRateRows = new Set<string>();
  for (const row of exchangeRows) {
    seenRateRows.add(row.id);
    const key = `${row.baseCurrency}/${row.currency}/${row.source}`;
    if (latestByCurrency.has(key)) continue;
    latestByCurrency.set(key, {
      currency: row.currency,
      baseCurrency: row.baseCurrency,
      rateDate: row.rateDate.toISOString(),
      cashBuying: toNumber(row.cashBuying),
      cashSelling: toNumber(row.cashSelling),
      transactionalBuying: toNumber(row.transactionalBuying),
      transactionalSelling: toNumber(row.transactionalSelling),
      source: row.source,
      sourceUrl: row.sourceUrl,
    });
  }

  const macroGrouped = new Map<string, MacroSeries>();
  for (const row of macroRows) {
    const value = toNumber(row.value);
    if (value === null) continue;
    let series = macroGrouped.get(row.indicatorCode);
    if (!series) {
      const meta = MACRO_LABELS[row.indicatorCode];
      series = {
        code: row.indicatorCode,
        label: row.indicatorName || meta?.label || row.indicatorCode,
        unit: row.unit ?? meta?.unit ?? null,
        points: [],
        latest: null,
        source: row.source,
        sourceUrl: row.sourceUrl,
        quality: row.sourceUrl ? 'verified_source' : 'recorded_internal',
      };
      macroGrouped.set(row.indicatorCode, series);
    }
    series.points.push({ year: row.year, value });
  }

  const macro = [...macroGrouped.values()]
    .filter((series) => series.points.length >= 2)
    .slice(0, MACRO_SERIES_LIMIT)
    .map((series) => ({
      ...series,
      latest: series.points[series.points.length - 1] ?? null,
    }));

  const limitations: string[] = [];
  if (placeholderRowsExcluded > 0) {
    limitations.push(
      `${placeholderRowsExcluded} seeded placeholder indicator row(s) are stored in the database and were excluded — they carry no publisher or source URL, so they are not shown as market data.`,
    );
  }
  if (verifiedIndicatorRows === 0) {
    limitations.push(
      'No economic indicator row currently carries a source URL, so indicator values are labelled as internally recorded rather than sourced facts.',
    );
  }
  if (exchangeRows.length > 0) {
    limitations.push(
      'Exchange rates are published snapshots from the source named on each row; rates for dates without a stored row are not back-filled.',
    );
  }
  limitations.push(
    'Macro series are annual country-level observations from the publisher named on each series; they are not Addis Ababa-specific and are not interpolated between years.',
  );

  return {
    generatedAt: new Date().toISOString(),
    months,
    indicators,
    exchangeRates: [...latestByCurrency.values()],
    macro,
    coverage: {
      indicatorRows: indicatorRows.length,
      placeholderRowsExcluded,
      verifiedIndicatorRows,
      exchangeRateRows: seenRateRows.size,
      macroRows: macroRows.length,
      latestObservationDate: latestObservation ? latestObservation.toISOString() : null,
    },
    limitations,
  };
}
