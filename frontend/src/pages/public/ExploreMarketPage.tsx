import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Building2,
  CalendarDays,
  Clock,
  Info,
  Loader2,
  MapPin,
  PieChart as PieIcon,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import Footer from '../../components/Footer';
import { InfoHint } from '../../components/ui/kit-core';
import { METRIC_HINTS } from '../../lib/metricHints';
import NeighborhoodMap, { type NeighborhoodMarkerData } from '../../components/NeighborhoodMap';
import {
  fetchBinaStats,
  fetchEconomicContext,
  fetchMarketSummary,
  fetchMarketTrends,
  fetchPublicNeighborhoods,
  formatAmount,
  formatCompact,
  formatDate,
  formatPct,
  propertyTypeLabel,
  type EconomicContext,
  type IndicatorSeries,
  type MarketTrends,
  type Metric,
  type PublicNeighborhood,
} from '../../api/publicData';
import { askQuestion, fetchAiStatus, isAiNotConfigured } from '../../api/ai';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Public market explorer.
 *
 * The layout follows the original page (period selector, overview cards, price
 * and rental trend charts, market map, composition, insights, period
 * comparison, featured areas). Every value is now computed by the backend from
 * stored records — sale and rent stay separate, and a bucket that cannot meet
 * the minimum sample renders its real sample count instead of a number.
 */

type Period = 6 | 12 | 24;

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: 6, label: 'Last 6 months' },
  { id: 12, label: 'Last 12 months' },
  { id: 24, label: 'Last 2 years' },
];

const CHART_TOOLTIP = {
  backgroundColor: '#0f172a',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  color: '#fff',
  fontSize: 13,
};

const DONUT_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16'];

function SectionHeading({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <h2 className="text-3xl font-black text-white">{title}</h2>
          {subtitle ? <p className="text-gray-400 mt-1">{subtitle}</p> : null}
        </div>
      </div>
      {right}
    </div>
  );
}

function EmptyPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
        <div>
          <p className="font-bold text-white mb-1">{title}</p>
          <div className="text-sm text-gray-400 leading-relaxed space-y-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

interface OverviewCardProps {
  label: string;
  value: string;
  sub: string;
  change?: string | null;
  changeNote?: string;
  trend?: 'up' | 'down' | 'flat';
  icon: React.ReactNode;
  gradient: string;
  /** Plain-language explanation of the figure, shown behind an ⓘ. */
  hint?: string;
}

function OverviewCard({
  label,
  value,
  sub,
  change,
  changeNote,
  trend = 'flat',
  icon,
  gradient,
  hint,
}: OverviewCardProps) {
  const badgeClass =
    trend === 'up'
      ? 'bg-green-500/20 text-green-400'
      : trend === 'down'
        ? 'bg-red-500/20 text-red-400'
        : 'bg-white/10 text-gray-300';
  return (
    <div className="group relative p-6 rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 hover:border-blue-500/50 transition-all duration-500 hover:scale-[1.02]">
      <div className={`absolute inset-0 bg-gradient-to-r ${gradient} opacity-0 group-hover:opacity-10 rounded-3xl blur-xl transition-opacity duration-500`} />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-2xl bg-gradient-to-br ${gradient}`}>{icon}</div>
          {change ? (
            <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${badgeClass}`}>
              {trend === 'up' ? (
                <TrendingUp className="w-4 h-4" />
              ) : trend === 'down' ? (
                <TrendingDown className="w-4 h-4" />
              ) : null}
              {change}
            </span>
          ) : null}
        </div>
        <div className="text-3xl font-black text-white mb-1">{value}</div>
        <div className="flex items-center text-gray-400 font-medium text-sm">
          {label}
          {hint && <InfoHint text={hint} label={label} />}
        </div>
        <div className="text-gray-500 text-xs mt-2">{changeNote ?? sub}</div>
      </div>
    </div>
  );
}

/** Keeps indicator/FX precision (132.5 must not become "133"). */
function formatDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function metricValue(metric: Metric | undefined, compact = false): string {
  if (!metric || metric.value === null) return '—';
  return compact ? formatCompact(metric.value) : formatAmount(metric.value);
}

function metricNote(metric: Metric | undefined, fallback = ''): string {
  if (!metric) return fallback;
  if (metric.value === null) return '';
  const basis = metric.scope === 'city' ? `citywide median of ${metric.sampleSize}` : `median of ${metric.sampleSize} listings`;
  const weight = metric.confidence && metric.confidence !== 'high' ? ` · ${metric.confidence} confidence` : '';
  return `${basis}${weight}`;
}

function trendDirection(value: number | null): 'up' | 'down' | 'flat' {
  if (value === null || value === 0) return 'flat';
  return value > 0 ? 'up' : 'down';
}

/* â”€â”€ Price / rent charts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function TrendChartCard({
  accent,
  series,
  points,
  emptyReason,
  interpretation,
  loading,
  error,
}: {
  accent: string;
  series: 'price' | 'rent';
  points: MarketTrends['points'];
  emptyReason: string;
  interpretation: React.ReactNode;
  loading: boolean;
  error: boolean;
}) {
  const chartData = points.map((point) => ({
    month: point.label,
    value: series === 'price' ? point.medianPrice : point.medianRent,
    listings: point.listingCount,
    sample: series === 'price' ? point.priceSampleSize : point.rentSampleSize,
  }));
  const plottable = chartData.filter((point) => point.value !== null).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 p-6 lg:p-8">
        {loading ? (
          <div className="h-[320px] flex items-center justify-center text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-3" /> Loading stored listings…
          </div>
        ) : error ? (
          <div className="h-[320px] flex items-center justify-center text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-3" /> Reconnecting to the market feed…
          </div>
        ) : plottable >= 1 ? (
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#64748b" style={{ fontSize: 12 }} />
                <YAxis
                  stroke="#64748b"
                  style={{ fontSize: 12 }}
                  width={64}
                  tickFormatter={(value: number) =>
                    series === 'price'
                      ? `${(value / 1_000_000).toFixed(1)}M`
                      : `${Math.round(value / 1_000)}K`
                  }
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP}
                  labelStyle={{ color: '#fff', fontWeight: 600 }}
                  formatter={(value: number, _name, entry) => {
                    const point = entry?.payload as { sample?: number; listings?: number } | undefined;
                    return [
                      `${formatAmount(value)} recorded units (median of ${point?.sample ?? 0})`,
                      series === 'price' ? 'Median asking price' : 'Median monthly rent',
                    ];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={`Median ${series === 'price' ? 'asking price' : 'monthly rent'} (recorded units)`}
                  stroke={accent}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[320px] flex items-center justify-center px-6 text-center text-sm text-gray-400">
            {emptyReason}
          </div>
        )}
      </div>
      <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 p-6 lg:p-8">
        <div className="flex items-center gap-2 text-blue-300 mb-4">
          <Sparkles className="w-5 h-5" />
          <span className="font-bold">What this means</span>
        </div>
        <div className="text-gray-300 text-sm leading-relaxed space-y-3">{interpretation}</div>
      </div>
    </div>
  );
}

/* â”€â”€ Economic context â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function EconomicCard({ series, label, icon }: { series?: IndicatorSeries; label: string; icon: React.ReactNode }) {
  // An indicator the publishers have not released is not shown at all.
  if (!series || !series.latest) return null;
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs uppercase tracking-wider text-gray-400">{label}</p>
        <span className="p-2 rounded-xl bg-white/5">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-white">
        {formatDecimal(series.latest.value)}{' '}
        <span className="text-sm font-medium text-gray-400">{series.unit}</span>
      </p>
      <p className="text-[11px] text-gray-500 mt-2">
        {series.source ?? 'Publisher not recorded'} · {formatDate(series.latest.date)}
        {series.changePct !== null ? ` · ${formatPct(series.changePct)} vs previous` : ''}
      </p>
      {series.sourceUrl ? (
        <a
          href={series.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 mt-1"
        >
          Source <ArrowUpRight className="w-3 h-3" />
        </a>
      ) : null}
    </div>
  );
}

function macroChartData(economic: EconomicContext | undefined) {
  if (!economic) return [];
  const gdp = economic.macro.find((series) => series.code === 'NY.GDP.MKTP.KD.ZG');
  const cpi = economic.macro.find((series) => series.code === 'FP.CPI.TOTL.ZG');
  const years = new Set<number>();
  gdp?.points.forEach((point) => years.add(point.year));
  cpi?.points.forEach((point) => years.add(point.year));
  const gdpByYear = new Map(gdp?.points.map((point) => [point.year, point.value]) ?? []);
  const cpiByYear = new Map(cpi?.points.map((point) => [point.year, point.value]) ?? []);
  return [...years]
    .sort((a, b) => a - b)
    .map((year) => ({
      year: String(year),
      gdp: gdpByYear.get(year) ?? null,
      cpi: cpiByYear.get(year) ?? null,
    }));
}

/* â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const ExploreMarketPage: React.FC = () => {
  const [period, setPeriod] = useState<Period>(12);
  const [aiQuestion, setAiQuestion] = useState(
    'How much listing data is available, what do the medians show, and what can you not tell me?',
  );
  const { isAuthenticated } = useAuth();

  const summaryQuery = useQuery({
    queryKey: ['public-market-summary', period],
    queryFn: () => fetchMarketSummary(period),
    retry: 1,
  });

  const binaStatsQuery = useQuery({
    queryKey: ['bina-stats'],
    queryFn: fetchBinaStats,
    enabled: true,
    retry: 1,
  });
  const trendsQuery = useQuery({
    queryKey: ['public-market-trends', period],
    queryFn: () => fetchMarketTrends(period),
    retry: 1,
  });

  const neighborhoodsQuery = useQuery({
    queryKey: ['public-neighborhoods'],
    queryFn: fetchPublicNeighborhoods,
    retry: 1,
  });

  const economicQuery = useQuery({
    queryKey: ['public-economic-context', 36],
    queryFn: () => fetchEconomicContext(36),
    retry: 1,
  });

  const aiStatusQuery = useQuery({
    queryKey: ['ai-status'],
    queryFn: fetchAiStatus,
    enabled: isAuthenticated,
    retry: false,
  });

  const aiMutation = useMutation({
    mutationFn: () => askQuestion(aiQuestion, { months: period }),
  });

  const summary = summaryQuery.data;
  const trends = trendsQuery.data;
  const economic = economicQuery.data;
  const neighborhoods = useMemo(() => neighborhoodsQuery.data ?? [], [neighborhoodsQuery.data]);

  const comparison = trends?.comparison;
  // A chart with no plottable month is removed entirely rather than shown
  // with an explanation of its own emptiness.
  const pricePlottable = (trends?.points ?? []).filter((point) => point.medianPrice !== null).length;
  const rentPlottable = (trends?.points ?? []).filter((point) => point.medianRent !== null).length;

  const neighborhoodsWithCoords = useMemo<NeighborhoodMarkerData[]>(
    () =>
      neighborhoods
        .filter((neighborhood) => neighborhood.centerLat !== null && neighborhood.centerLng !== null)
        .map((neighborhood) =>
          toMarker(neighborhood),
        ),
    [neighborhoods],
  );

  const featured = useMemo(() => {
    return [...neighborhoods]
      .sort((a, b) => {
        const activityA = a.activeListings.sale + a.activeListings.rent;
        const activityB = b.activeListings.sale + b.activeListings.rent;
        if (activityB !== activityA) return activityB - activityA;
        return (b.sale.medianAskingPrice.value ?? 0) - (a.sale.medianAskingPrice.value ?? 0);
      })
      .slice(0, 4);
  }, [neighborhoods]);

  const typeMix = useMemo(() => {
    const types = summary?.propertyTypes ?? [];
    const total = types.reduce((sum, entry) => sum + entry.count, 0);
    return types.map((entry, index) => ({
      name: propertyTypeLabel(entry.propertyType),
      value: entry.count,
      share: total > 0 ? Math.round((entry.count / total) * 1000) / 10 : null,
      color: DONUT_COLORS[index % DONUT_COLORS.length]!,
    }));
  }, [summary]);

  const typeTotal = typeMix.reduce((sum, entry) => sum + entry.value, 0);
  const topType = typeMix[0];

  const macroData = useMemo(() => macroChartData(economic), [economic]);
  const macroPlottable = macroData.filter((row) => row.gdp !== null || row.cpi !== null).length;

  const inflation = economic?.indicators.find((series) => series.type === 'INFLATION_RATE');
  const policyRate = economic?.indicators.find((series) => series.type === 'INTEREST_RATE');
  const cpi = economic?.indicators.find((series) => series.type === 'CONSUMER_PRICE_INDEX');
  const usdRate = economic?.exchangeRates.find((quote) => quote.currency === 'USD');

  const priceInterpretation =
    comparison && comparison.status === 'available' && comparison.priceChangePct !== null ? (
      <>
        <p>
          Median asking price moved from{' '}
          <strong className="text-white">{formatAmount(comparison.previousPrice)}</strong> recorded units in{' '}
          {comparison.previousLabel} to{' '}
          <strong className="text-white">{formatAmount(comparison.currentPrice)}</strong> recorded units in{' '}
          {comparison.currentLabel} — a change of {formatPct(comparison.priceChangePct)}.
        </p>
        <p className="text-gray-400">{comparison.note}</p>
      </>
    ) : (
      <>
        <p>
          Sale prices are compared between the two most recent months in the selected window that
          each hold a priced sale listing.
        </p>
      </>
    );

  const rentInterpretation =
    comparison && comparison.status === 'available' && comparison.rentChangePct !== null ? (
      <>
        <p>
          Median monthly rent moved from{' '}
          <strong className="text-white">{formatAmount(comparison.previousRent)}</strong> recorded units to{' '}
          <strong className="text-white">{formatAmount(comparison.currentRent)}</strong> recorded units (
          {formatPct(comparison.rentChangePct)}).
        </p>
        <p className="text-gray-400">
          Rental figures are computed only from listings that state a rent; they are never derived
          from sale prices.
        </p>
      </>
    ) : (
      <>
        <p>
          Rentals are charted from every month that holds a listing with a stated rent.
        </p>
      </>
    );

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,24,39,1),rgba(0,0,0,1))] pointer-events-none" />
      <div className="fixed inset-0 opacity-20 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>
      <div className="fixed top-20 left-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-xl border border-blue-500/30 text-blue-300 px-6 py-2 rounded-full text-sm font-semibold mb-6">
            <Sparkles className="w-4 h-4" />
            Database-backed market intelligence
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-6">
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Addis Ababa
            </span>{' '}
            <span className="text-white">Real Estate Market</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            A citywide view of prices, rents, supply and composition — every figure calculated from
            listings stored in the EstatePlus database, with its sample size attached.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-sm text-gray-400">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              {summary ? `Listings last updated ${formatDate(summary.dataAsOf)}` : 'Loading last update…'}
            </span>
            {summary ? (
              <span className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-emerald-400" />
                Minimum sample: {summary.minimumSampleSize} records per metric
              </span>
            ) : null}
          </div>
        </div>

        {/* Period selector */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-14">
          {PERIODS.map((option) => (
            <button
              key={option.id}
              onClick={() => setPeriod(option.id)}
              className={`px-5 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
                period === option.id
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30 scale-105'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {summaryQuery.isError && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center mb-12">
            <Loader2 className="w-8 h-8 text-blue-400 mx-auto mb-3 animate-spin" />
            <h3 className="text-xl font-bold mb-2">Syncing the market feed</h3>
            <p className="text-gray-400 mb-5">The connection dropped while loading the latest numbers.</p>
            <button
              type="button"
              onClick={() => summaryQuery.refetch()}
              className="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Retry now
            </button>
          </div>
        )}

        {/* Market overview */}
        <section className="mb-16">
          <SectionHeading
            icon={<Building2 className="w-6 h-6 text-blue-400" />}
            title={
              <>
                <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  Market
                </span>{' '}
                Overview
              </>
            }
            subtitle={`Headline numbers for the last ${period} months`}
          />
          {summaryQuery.isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-3" /> Calculating from the database…
            </div>
          ) : summary ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <OverviewCard
                label="Median Asking Price"
                value={metricValue(summary.sale.medianAskingPrice, true)}
                sub={metricNote(summary.sale.medianAskingPrice)}
                change={comparison?.status === 'available' ? formatPct(comparison.priceChangePct) : null}
                trend={trendDirection(comparison?.priceChangePct ?? null)}
                changeNote={
                  comparison?.status === 'available'
                    ? `vs ${comparison.previousLabel}`
                    : `${period}-month window`
                }
                hint={METRIC_HINTS.medianAskingPrice}
                icon={<TrendingUp className="w-6 h-6 text-white" />}
                gradient="from-blue-500 to-cyan-500"
              />
              <OverviewCard
                label="Median Price / m²"
                value={metricValue(summary.sale.medianPricePerSqm, true)}
                sub={metricNote(summary.sale.medianPricePerSqm)}
                trend={trendDirection(comparison?.priceChangePct ?? null)}
                change={comparison?.status === 'available' ? formatPct(comparison.priceChangePct) : null}
                changeNote="Sale prices only, divided by recorded size"
                hint={METRIC_HINTS.pricePerSqm}
                icon={<Building2 className="w-6 h-6 text-white" />}
                gradient="from-green-500 to-emerald-500"
              />
              <OverviewCard
                label="Median Monthly Rent"
                value={metricValue(summary.rent.medianMonthlyRent, true)}
                sub={metricNote(summary.rent.medianMonthlyRent)}
                change={comparison?.status === 'available' ? formatPct(comparison.rentChangePct) : null}
                trend={trendDirection(comparison?.rentChangePct ?? null)}
                changeNote={
                  comparison?.status === 'available'
                    ? `vs ${comparison.previousLabel}`
                    : `${period}-month window`
                }
                hint={METRIC_HINTS.medianMonthlyRent}
                icon={<Wallet className="w-6 h-6 text-white" />}
                gradient="from-orange-500 to-red-500"
              />
              <OverviewCard
                label="Active Listings"
                value={String(summary.activeListings.total)}
                sub={`${summary.activeListings.sale} sale · ${summary.activeListings.rent} rent${
                  summary.activeListings.dualPurpose
                    ? ` · ${summary.activeListings.dualPurpose} dual-purpose`
                    : ''
                }`}
                change={
                  comparison && comparison.status === 'available'
                    ? formatPct(
                        comparison.previousListingCount === 0
                          ? null
                          : Math.round(
                              ((comparison.currentListingCount - comparison.previousListingCount) /
                                comparison.previousListingCount) *
                                10000,
                            ) / 100,
                      )
                    : null
                }
                trend="flat"
                hint={METRIC_HINTS.activeListings}
                changeNote={`${summary.neighborhoodsCovered} neighborhoods covered`}
                icon={<TrendingUp className="w-6 h-6 text-white" />}
                gradient="from-indigo-500 to-purple-500"
              />
              <OverviewCard
                label="Data Window"
                value={`${period} mo`}
                sub={trends ? `${trends.points.filter((p) => p.listingCount > 0).length} months with listings` : 'Loading…'}
                changeNote={
                  trends
                    ? trends.status === 'available'
                      ? `${trends.points.filter((p) => p.medianPrice !== null || p.medianRent !== null).length} months plottable`
                      : 'Too few months meet the minimum sample'
                    : 'Loading…'
                }
                hint="The length of the window every figure on this page is calculated from. Only months that contain eligible listings are plotted, so an empty month is not treated as a zero price."
                icon={<CalendarDays className="w-6 h-6 text-white" />}
                gradient="from-cyan-500 to-blue-600"
              />
            </div>
          ) : null}
        </section>

        {/* Price trend */}
        {pricePlottable > 0 ? (
        <section className="mb-16">
          <SectionHeading
            icon={<TrendingUp className="w-6 h-6 text-blue-400" />}
            title={
              <>
                <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  Price
                </span>{' '}
                Trend
              </>
            }
            subtitle="Monthly median asking price of active sale listings"
          />
          <TrendChartCard
            accent="#3b82f6"
            series="price"
            points={trends?.points ?? []}
            loading={trendsQuery.isLoading}
            error={trendsQuery.isError}
            emptyReason={
              trends?.note ??
              'The trend endpoint returned no months. A line drawn through missing months would be an interpolation, so none is drawn.'
            }
            interpretation={priceInterpretation}
          />
        </section>
        ) : null}

        {/* Rental trend */}
        {rentPlottable > 0 ? (
        <section className="mb-16">
          <SectionHeading
            icon={<Wallet className="w-6 h-6 text-teal-400" />}
            title={
              <>
                <span className="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
                  Rental
                </span>{' '}
                Trend
              </>
            }
            subtitle="Monthly median rent of listings with a recorded rent"
          />
          <TrendChartCard
            accent="#14b8a6"
            series="rent"
            points={trends?.points ?? []}
            loading={trendsQuery.isLoading}
            error={trendsQuery.isError}
            emptyReason={
              trends?.note ??
              'No rental series is available for this window, so the chart is left empty.'
            }
            interpretation={rentInterpretation}
          />
        </section>
        ) : null}

        {/* Economic context */}
        <section className="mb-16">
          <SectionHeading
            icon={<PieIcon className="w-6 h-6 text-amber-400" />}
            title={
              <>
                <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  Economic
                </span>{' '}
                Context
              </>
            }
            subtitle="Stored indicators, exchange rates and country-level macro series"
            right={
              economic ? (
                <span className="text-xs text-gray-500">
                  {economic.coverage.verifiedIndicatorRows} sourced indicator(s) ·{' '}
                  {economic.coverage.macroRows} macro row(s)
                  {economic.coverage.placeholderRowsExcluded > 0
                    ? ` · ${economic.coverage.placeholderRowsExcluded} placeholder row(s) excluded`
                    : ''}
                </span>
              ) : null
            }
          />

          {economicQuery.isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-3" /> Loading stored indicators…
            </div>
          ) : economicQuery.isError ? (
            <EmptyPanel title="Economic data could not be loaded">
              <p>The API did not respond. No indicator values are displayed.</p>
            </EmptyPanel>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <EconomicCard series={inflation} label="Inflation rate" icon={<TrendingUp className="w-4 h-4 text-amber-400" />} />
                <EconomicCard series={policyRate} label="Policy interest rate" icon={<Wallet className="w-4 h-4 text-blue-400" />} />
                <EconomicCard series={cpi} label="Consumer price index" icon={<PieIcon className="w-4 h-4 text-purple-400" />} />
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">
                    USD cash buying
                  </p>
                  {usdRate ? (
                    <>
                      <p className="text-2xl font-bold text-white">
                        {formatDecimal(usdRate.cashBuying)}{' '}
                        <span className="text-sm font-medium text-gray-400">
                          {usdRate.baseCurrency}
                        </span>
                      </p>
                      <p className="text-[11px] text-gray-500 mt-2">
                        {usdRate.source} · {formatDate(usdRate.rateDate)}
                      </p>
                      {usdRate.sourceUrl ? (
                        <a
                          href={usdRate.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 mt-1"
                        >
                          Source <ArrowUpRight className="w-3 h-3" />
                        </a>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>

              <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 p-6 lg:p-8">
                {macroPlottable >= 2 ? (
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={macroData} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="year" stroke="#64748b" style={{ fontSize: 12 }} />
                        <YAxis
                          stroke="#64748b"
                          style={{ fontSize: 12 }}
                          width={52}
                          tickFormatter={(value: number) => `${value}%`}
                        />
                        <Tooltip contentStyle={CHART_TOOLTIP} labelStyle={{ color: '#fff', fontWeight: 600 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line
                          type="monotone"
                          dataKey="gdp"
                          name="GDP growth (% annual)"
                          stroke="#22c55e"
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                          connectNulls={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="cpi"
                          name="Inflation, consumer prices (% annual)"
                          stroke="#f59e0b"
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                          connectNulls={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyPanel title="No multi-year macro series to chart">
                    <p>
                      The database holds {economic?.coverage.macroRows ?? 0} macro row(s); at least
                      two observed years of GDP growth or CPI inflation are needed to plot a line.
                    </p>
                  </EmptyPanel>
                )}
                <div className="mt-6 space-y-1">
                  <p className="text-xs text-gray-500">
                    Source: {economic?.macro[0]?.source ?? 'publisher named on each stored row'} —
                    country-level annual data, not Addis Ababa-specific, not interpolated.
                  </p>
                  {economic?.limitations.map((limitation) => (
                    <p key={limitation} className="text-xs text-gray-500">
                      {limitation}
                    </p>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        {/* Market map — omitted entirely when no area has a recorded coordinate. */}
        {neighborhoodsWithCoords.length > 0 && (
          <section className="mb-16">
            <SectionHeading
              icon={<MapPin className="w-6 h-6 text-blue-400" />}
              title={
                <>
                  <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    Addis Ababa
                  </span>{' '}
                  Market Map
                </>
              }
            />
            <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 p-4 lg:p-6">
              <NeighborhoodMap neighborhoods={neighborhoodsWithCoords} height="480px" />
            </div>
            <p className="text-gray-400 text-sm mt-4 text-center">
              Click any pin to open that neighborhood's stored market indicators.
            </p>
          </section>
        )}

        {/* Composition */}
        <section className="mb-16">
          <SectionHeading
            icon={<PieIcon className="w-6 h-6 text-purple-400" />}
            title={
              <>
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Market
                </span>{' '}
                Composition
              </>
            }
            subtitle="Active listings by property type"
          />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 p-6 lg:p-8">
              {summaryQuery.isLoading ? (
                <div className="h-[320px] flex items-center justify-center text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin mr-3" /> Loading composition…
                </div>
              ) : typeTotal > 0 ? (
                <div style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={typeMix}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {typeMix.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={CHART_TOOLTIP}
                        itemStyle={{ color: '#fff' }}
                        formatter={(value: number, name: string) => [`${value} listing(s)`, name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[320px] flex items-center justify-center text-sm text-gray-400">
                  Loading the property-type mix…
                </div>
              )}
            </div>
            <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 p-6 lg:p-8">
              <div className="flex items-center gap-2 text-purple-300 mb-4">
                <Sparkles className="w-5 h-5" />
                <span className="font-bold">Plain-language takeaway</span>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed mb-6">
                {typeTotal === 0 || !topType
                  ? 'The property-type mix is calculated from the active listings on file.'
                  : `${topType.name} account for ${topType.share ?? 0}% of the ${typeTotal} active listing(s) in the database${
                      typeMix.length > 1
                        ? `, followed by ${typeMix[1]!.name} at ${typeMix[1]!.share ?? 0}%`
                        : ''
                    }. These are record counts, not a market-wide share.`}
              </p>
              <div className="space-y-3">
                {typeMix.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-gray-300">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                      {entry.name}
                    </span>
                    <span className="font-bold text-white">
                      {entry.value} · {entry.share ?? 0}%
                    </span>
                  </div>
                ))}
                {typeMix.length === 0 && (
                  <p className="text-sm text-gray-500">No property types recorded.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Insights */}
        <section className="mb-16">
          <SectionHeading
            icon={<Sparkles className="w-6 h-6 text-amber-400" />}
            title={
              <>
                <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  Market
                </span>{' '}
                Insights
              </>
            }
            subtitle="Read directly from the stored records — no projections"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {comparison?.status === 'available' && comparison.priceChangePct !== null ? (
              <InsightCard
                icon={<TrendingUp className="w-6 h-6 text-emerald-400" />}
                bg="bg-emerald-500/10"
                title={
                  comparison.priceChangePct >= 0
                    ? 'Prices rose over the selected window'
                    : 'Prices fell over the selected window'
                }
                text={`Median asking price changed ${formatPct(comparison.priceChangePct)} from ${comparison.previousLabel} to ${comparison.currentLabel}, based on ${comparison.previousListingCount} vs ${comparison.currentListingCount} stored listings.`}
              />
            ) : null}
            {comparison?.status === 'available' && comparison.rentChangePct !== null ? (
              <InsightCard
                icon={<Wallet className="w-6 h-6 text-blue-400" />}
                bg="bg-blue-500/10"
                title="Rents moved over the selected window"
                text={`Median monthly rent changed ${formatPct(comparison.rentChangePct)} (${formatAmount(comparison.previousRent)} → ${formatAmount(comparison.currentRent)} recorded units), from listings that state a rent.`}
              />
            ) : null}
            <InsightCard
              icon={<Building2 className="w-6 h-6 text-purple-400" />}
              bg="bg-purple-500/10"
              title={topType ? `${topType.name} dominate stored supply` : 'Supply composition unknown'}
              text={
                topType
                  ? `${topType.value} of ${typeTotal} active listings are ${topType.name.toLowerCase()} (${topType.share ?? 0}%). Composition is a count of records, not a city-wide census.`
                  : 'No active listings are stored yet, so composition cannot be described.'
              }
            />
            <InsightCard
              icon={<MapPin className="w-6 h-6 text-amber-400" />}
              bg="bg-amber-500/10"
              title={
                neighborhoodsWithCoords.length === 0
                  ? 'Map coverage is incomplete'
                  : `${neighborhoodsWithCoords.length} neighborhoods can be mapped`
              }
              text={`${summary?.neighborhoodsCovered ?? 0} of ${neighborhoods.length} neighborhoods hold at least one active listing. ${
                neighborhoodsWithCoords.length === 0
                  ? 'No center coordinates are recorded, so no pin is placed at a guessed location.'
                  : `${neighborhoodsWithCoords.length} have a recorded center coordinate.`
              }`}
            />
          </div>
        </section>

        {/* Comparison — only when two comparable periods actually exist. */}
        {comparison && comparison.status === 'available' ? (
        <section className="mb-16">
          <SectionHeading
            icon={<TrendingUp className="w-6 h-6 text-emerald-400" />}
            title={
              <>
                <span className="bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
                  Market
                </span>{' '}
                Comparison
              </>
            }
            subtitle={comparison ? `${comparison.previousLabel} vs ${comparison.currentLabel}` : 'Current period vs previous period'}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ComparisonCard
              label="Median Asking Price"
              current={comparison?.currentPrice ?? null}
              previous={comparison?.previousPrice ?? null}
              changePct={comparison?.priceChangePct ?? null}
              available={comparison?.status === 'available'}
              sampleNote={`${comparison?.currentListingCount ?? 0} listings in the current half`}
            />
            <ComparisonCard
              label="Median Monthly Rent"
              current={comparison?.currentRent ?? null}
              previous={comparison?.previousRent ?? null}
              changePct={comparison?.rentChangePct ?? null}
              available={comparison?.status === 'available'}
              sampleNote={`${comparison?.previousListingCount ?? 0} listings in the previous half`}
            />
            <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-5">
                <span className="text-gray-400 font-medium">Active Listings</span>
                <span className="px-3 py-1 rounded-full text-sm font-bold bg-white/10 text-gray-300">
                  {comparison?.currentListingCount ?? 0} in window
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-sm">Current half</span>
                  <span className="text-white font-bold">{comparison?.currentListingCount ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-sm">Previous half</span>
                  <span className="text-gray-400 font-semibold">{comparison?.previousListingCount ?? 0}</span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <span className="text-gray-500 text-sm">Total in window</span>
                  <span className="text-gray-300 font-semibold">{summary?.activeListings.total ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
          {comparison && (
            <p className="text-xs text-gray-500 mt-4">{comparison.note}</p>
          )}
        </section>
        ) : null}

        {/* BinaSmart medians — rendered only when stored records exist. */}
        {binaStatsQuery.data && binaStatsQuery.data.recordCount > 0 ? (
        <section className="mb-16">
          <SectionHeading
            icon={<MapPin className="w-6 h-6 text-blue-400" />}
            title={"BinaSmart Integrated Listings"}
            subtitle={
              binaStatsQuery.data.currencyStatus === 'currency_unstated'
                ? 'Captured BinaSmart records: amounts are shown exactly as the source published them.'
                : 'Stored BinaSmart asking prices whose source pages stated ETB.'
            }
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(() => {
              const stats = binaStatsQuery.data!;
              const tiles = [
                { label: 'Median Asking Price', metric: stats.medianAskingPrice, sample: 'sale record' },
                { label: 'Median Monthly Rent', metric: stats.medianMonthlyRent, sample: 'rent record' },
                { label: 'Median Price per Sqm', metric: stats.medianPricePerSqm, sample: 'record' },
              ].filter((tile) => tile.metric.value !== null);

              return tiles.map((tile) => (
                <div key={tile.label} className="rounded-3xl bg-white/5 border border-white/10 p-6">
                  <div className="flex items-center text-gray-400 text-xs uppercase tracking-wider mb-2">
                    {tile.label}
                    <InfoHint
                      text={
                        tile.label === 'Median Monthly Rent'
                          ? METRIC_HINTS.medianMonthlyRent
                          : tile.label === 'Median Price per Sqm'
                            ? METRIC_HINTS.pricePerSqm
                            : METRIC_HINTS.medianAskingPrice
                      }
                      label={tile.label}
                    />
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {formatCompact(tile.metric.value)} {tile.metric.unit}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Median of {tile.metric.sampleSize} {tile.sample}
                    {tile.metric.sampleSize === 1 ? '' : 's'}
                  </div>
                </div>
              ));
            })()}
            <div className="text-gray-500 text-xs mt-2 lg:col-span-3">
              {binaStatsQuery.data.note}
            </div>
          </div>
        </section>
        ) : null}

        {/* Featured areas */}
        <section className="mb-16">
          <SectionHeading
            icon={<MapPin className="w-6 h-6 text-blue-400" />}
            title={
              <>
                <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  Featured
                </span>{' '}
                Areas
              </>
            }
            subtitle="Neighborhoods with the most stored listings"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featured.map((neighborhood) => (
              <FeaturedAreaCard key={neighborhood.id} neighborhood={neighborhood} />
            ))}
            {featured.length === 0 && (
              <div className="lg:col-span-4">
                <EmptyPanel title="No neighborhoods recorded">
                  <p>Neighborhood records will appear here as they are stored.</p>
                </EmptyPanel>
              </div>
            )}
          </div>
        </section>

        {/* AI analysis */}
        <section className="mb-16">
          <SectionHeading
            icon={<Bot className="w-6 h-6 text-cyan-400" />}
            title={
              <>
                <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  EstatePlus
                </span>{' '}
                AI Analysis
              </>
            }
            subtitle="Retrieval-grounded answers — the model receives the records, never the whole database"
          />
          <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 p-6 lg:p-8">
            {!isAuthenticated ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                <div>
                  <p className="font-semibold text-white mb-1">Sign in to use AI analysis</p>
                  <p className="text-sm text-gray-400">
                    AI endpoints require an authenticated session and are rate limited. The charts
                    above never depend on the AI service.
                  </p>
                </div>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 font-semibold text-white whitespace-nowrap"
                >
                  Sign in <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : aiStatusQuery.isLoading ? (
              <div className="flex items-center text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-3" /> Checking AI configuration…
              </div>
            ) : aiStatusQuery.isError ? (
              <p className="text-sm text-red-300">Could not read AI configuration from the API.</p>
            ) : aiStatusQuery.data && !aiStatusQuery.data.configured ? (
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-white mb-1">AI analysis is not configured</p>
                  <p className="text-sm text-gray-400">{aiStatusQuery.data.message}</p>
                  <ul className="mt-2 text-xs text-amber-300/90 space-y-1">
                    {aiStatusQuery.data.missingEnvironmentVariables.map((name) => (
                      <li key={name}>Missing: {name}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-500 mt-2">
                    Retrieval works without a provider; only the model-written explanation is
                    unavailable. No answer is fabricated in its place.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">
                  {aiStatusQuery.data?.message} The question is sent with the selected period; the
                  backend retrieves only the matching records and returns source links and
                  limitations with the answer.
                </p>
                <textarea
                  value={aiQuestion}
                  onChange={(event) => setAiQuestion(event.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-cyan-400 focus:outline-none"
                  placeholder="Ask about the market data shown on this page…"
                />
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-gray-500">{aiQuestion.length}/500</span>
                  <button
                    onClick={() => aiMutation.mutate()}
                    disabled={aiMutation.isPending || aiQuestion.trim().length < 5}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {aiMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Analyse
                  </button>
                </div>

                {aiMutation.isError && (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
                    {isAiNotConfigured(aiMutation.error) ? (
                      <div className="space-y-1">
                        <p>{aiMutation.error.response.data.message}</p>
                        <p className="text-xs">
                          Missing:{' '}
                          {aiMutation.error.response.data.missingEnvironmentVariables.join(', ')}
                        </p>
                      </div>
                    ) : (
                      <p>
                        The AI service is unavailable right now. The market data above is unaffected.
                      </p>
                    )}
                  </div>
                )}

                {aiMutation.data && (
                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
                    <p className="whitespace-pre-line text-sm leading-7 text-gray-200">
                      {aiMutation.data.answer}
                    </p>
                    <div className="mt-4 pt-4 border-t border-white/10 text-xs text-gray-500 space-y-1">
                      <p>
                        Retrieved {aiMutation.data.grounding.counts.facts} fact(s),{' '}
                        {aiMutation.data.grounding.counts.calculations} calculated metric(s),{' '}
                        {aiMutation.data.grounding.counts.listings} listing(s) ·{' '}
                        {aiMutation.data.grounding.scope.neighborhood?.name ?? 'city-wide'} · last{' '}
                        {aiMutation.data.grounding.scope.months} months
                      </p>
                      {aiMutation.data.grounding.citations.map((citation) => (
                        <p key={citation.id}>
                          Source{' '}
                          {citation.url ? (
                            <a
                              href={citation.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-400 hover:text-blue-300"
                            >
                              {citation.label}
                            </a>
                          ) : (
                            citation.label
                          )}
                          {citation.asOf ? ` (${citation.asOf})` : ''}
                        </p>
                      ))}
                      {aiMutation.data.grounding.limitations.slice(0, 3).map((limitation) => (
                        <p key={limitation}>{limitation}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* CTA */}
        <div className="text-center">
          <div className="relative p-12 rounded-3xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-cyan-500/20 backdrop-blur-xl border border-white/20 overflow-hidden">
            <div className="relative z-10">
              <MapPin className="w-16 h-16 text-blue-400 mx-auto mb-6" />
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
                Explore Neighborhoods
              </h2>
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                Open any area to see the listings, prices and rents recorded for it, with a photo of
                the place itself.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  to="/neighborhoods"
                  className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 rounded-2xl font-bold text-white text-lg hover:scale-105 transition-all duration-300 shadow-xl hover:shadow-blue-500/50"
                >
                  View All Neighborhoods <ArrowRight className="w-6 h-6" />
                </Link>
                <Link
                  to="/properties"
                  className="inline-flex items-center gap-3 px-8 py-5 bg-white/10 border border-white/20 rounded-2xl font-bold text-white text-lg hover:bg-white/15 transition-all duration-300"
                >
                  Browse listings <ArrowUpRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Coverage table */}
        <section className="mt-16">
          <SectionHeading
            icon={<MapPin className="w-6 h-6 text-blue-400" />}
            title="Neighborhood coverage"
            subtitle={`${neighborhoodsWithCoords.length} of ${neighborhoods.length} neighborhoods have a recorded map coordinate`}
          />
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-gray-400">
                  <tr>
                    <th className="text-left font-medium px-6 py-3">Neighborhood</th>
                    <th className="text-right font-medium px-6 py-3">For sale</th>
                    <th className="text-right font-medium px-6 py-3">For rent</th>
                    <th className="text-right font-medium px-6 py-3">Median asking</th>
                    <th className="text-right font-medium px-6 py-3">Median rent</th>
                    <th className="text-right font-medium px-6 py-3">Mapped</th>
                  </tr>
                </thead>
                <tbody>
                  {neighborhoods.map((neighborhood) => (
                    <tr key={neighborhood.id} className="border-t border-white/5">
                      <td className="px-6 py-3">
                        <Link
                          to={`/neighborhoods/${neighborhood.slug}`}
                          className="text-white hover:text-blue-400"
                        >
                          {neighborhood.name}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-right text-gray-300">
                        {neighborhood.activeListings.sale}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-300">
                        {neighborhood.activeListings.rent}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-300">
                        {metricValue(neighborhood.sale.medianAskingPrice)}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-300">
                        {metricValue(neighborhood.rent.medianMonthlyRent)}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-500">
                        {neighborhood.centerLat !== null ? 'Yes' : 'No'}
                      </td>
                    </tr>
                  ))}
                  {neighborhoods.length === 0 && (
                    <tr className="border-t border-white/5">
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        No neighborhoods recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {summary && (
            <p className="text-xs text-gray-500 mt-4">
              {summary.basis} {summary.currencyNote}
            </p>
          )}
        </section>
      </div>

      <Footer />
    </div>
  );
};

/* â”€â”€ Small helpers / components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function toMarker(neighborhood: PublicNeighborhood): NeighborhoodMarkerData {
  return {
    id: neighborhood.id,
    name: neighborhood.name,
    slug: neighborhood.slug,
    position: [Number(neighborhood.centerLat), Number(neighborhood.centerLng)],
    avgPrice:
      neighborhood.sale.medianAskingPrice.status === 'available'
        ? neighborhood.sale.medianAskingPrice.value
        : null,
    avgPricePerSqm:
      neighborhood.sale.medianPricePerSqm.status === 'available'
        ? neighborhood.sale.medianPricePerSqm.value
        : null,
    avgRent:
      neighborhood.rent.medianMonthlyRent.status === 'available'
        ? neighborhood.rent.medianMonthlyRent.value
        : null,
    properties: neighborhood.activeListings.sale + neighborhood.activeListings.rent,
    growth: null,
  };
}

function InsightCard({
  icon,
  bg,
  title,
  text,
}: {
  icon: React.ReactNode;
  bg: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 p-6">
      <div className={`inline-flex p-3 rounded-2xl ${bg} mb-4`}>{icon}</div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function ComparisonCard({
  label,
  current,
  previous,
  changePct,
  available,
  sampleNote,
}: {
  label: string;
  current: number | null;
  previous: number | null;
  changePct: number | null;
  available: boolean | undefined;
  sampleNote: string;
}) {
  // Nothing comparable inside the window means the card is not useful.
  if (!available || current === null) return null;
  const trend = trendDirection(changePct);
  const badgeClass =
    trend === 'up'
      ? 'bg-green-500/20 text-green-400'
      : trend === 'down'
        ? 'bg-red-500/20 text-red-400'
        : 'bg-white/10 text-gray-300';
  return (
    <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 p-6">
      <div className="flex items-center justify-between mb-5">
        <span className="text-gray-400 font-medium">{label}</span>
        <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${badgeClass}`}>
          {trend === 'up' ? (
            <TrendingUp className="w-4 h-4" />
          ) : trend === 'down' ? (
            <TrendingDown className="w-4 h-4" />
          ) : null}
          {changePct !== null ? formatPct(changePct) : '—'}
        </span>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 text-sm">Current</span>
          <span className="text-white font-bold">
            {formatAmount(current)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 text-sm">Previous</span>
          <span className="text-gray-400 font-semibold">
            {formatAmount(previous)}
          </span>
        </div>
      </div>
      <p className="text-[11px] text-gray-500 mt-4">{sampleNote}</p>
    </div>
  );
}

function FeaturedAreaCard({ neighborhood }: { neighborhood: PublicNeighborhood }) {
  const priceMetric = neighborhood.sale.medianAskingPrice;
  const price = priceMetric.status === 'available' ? priceMetric.value : null;
  const activity = neighborhood.activeListings.sale + neighborhood.activeListings.rent;

  return (
    <Link
      to={`/neighborhoods/${neighborhood.slug}`}
      className="group relative p-6 rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 hover:border-blue-500/50 transition-all duration-500 hover:scale-[1.02]"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xl font-bold text-white group-hover:text-blue-300 transition-colors">
          {neighborhood.name}
        </h3>
        <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500">
          <MapPin className="w-5 h-5 text-white" />
        </div>
      </div>
      <p className="text-gray-400 text-sm leading-relaxed mb-5">
        {activity} active listing{activity === 1 ? '' : 's'} stored ({neighborhood.activeListings.sale}{' '}
        sale, {neighborhood.activeListings.rent} rent) in {neighborhood.city}.
      </p>
      {price !== null && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-white font-bold">{formatCompact(price)}</span>
          <span className="text-gray-500">median of {priceMetric.sampleSize}</span>
        </div>
      )}
      <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
        <span className="text-gray-400 font-medium">Explore Area</span>
        <ArrowRight className="w-5 h-5 text-blue-400 group-hover:translate-x-2 transition-transform duration-300" />
      </div>
    </Link>
  );
}

export default ExploreMarketPage;
