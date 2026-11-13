import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Home, DollarSign, Percent, BarChart3, MapPin, Calendar } from 'lucide-react';
import { InfoHint, PageHero, StatCard } from '../../components/ui/kit-core';
import { METRIC_HINTS } from '../../lib/metricHints';
import { marketReadings } from '../../lib/marketMeaning';
import { MeaningPanel } from '../../components/ui/MeaningPanel';
import { TableSkeleton } from '../../components/ui/kit-blocks';

import {
  fetchMarketSummary,
  fetchMarketTrends,
  fetchPublicNeighborhoods,
  propertyTypeLabel,
} from '../../api/publicData';

const formatRecordedAmount = (value: number | null | undefined) =>
  value == null ? '—' : Math.round(value).toLocaleString();

const getMarketDashboard = async (months: number) => {
  const [summary, trends] = await Promise.all([fetchMarketSummary(), fetchMarketTrends(months)]);
  const medianAsking = summary.sale.medianAskingPrice.value;
  const medianRent = summary.rent.medianMonthlyRent.value;

  return {
    medianAsking,
    medianPerSqm: summary.sale.medianPricePerSqm.value,
    medianRent,
    activeListings: summary.activeListings.total,
    priceGrowth: trends.comparison.priceChangePct,
    rentalGrowth: trends.comparison.rentChangePct,
    neighborhoodsCovered: summary.neighborhoodsCovered,
    note: `${summary.basis} ${summary.currencyNote}`,
  };
};

const getPriceTrends = async (months: number) => {
  let trends = await fetchMarketTrends(months);
  // A quiet window should still show the market history we hold rather than an
  // empty chart, so widen to every recorded month before giving up.
  if (!trends.points.some((point) => point.medianPrice != null || point.medianRent != null)) {
    trends = await fetchMarketTrends(60);
  }
  const points = trends.points.filter(
    (point) => point.medianPrice != null || point.medianRent != null,
  );
  return {
    data: points.map((point) => ({
      month: point.label,
      price: Number(point.medianPrice),
      rent: point.medianRent,
    })),
    status: trends.status,
    note: trends.note,
  };
};

const getNeighborhoodPerformance = async () => {
  const neighborhoods = await fetchPublicNeighborhoods();
  const data = neighborhoods
    .map((n) => {
      const price = n.sale.medianAskingPrice.value;
      const rent = n.rent.medianMonthlyRent.value;
      // Only a pairing of this area's own sale and rental listings is a yield
      // someone could act on. When either side falls back to the citywide
      // sample, quoting a percentage would invent a local return.
      const localPrice = n.sale.medianAskingPrice.scope !== 'city';
      const localRent = n.rent.medianMonthlyRent.scope !== 'city';
      const grossYield =
        price && rent && localPrice && localRent ? ((rent * 12) / price) * 100 : null;
      return {
        name: n.name,
        slug: n.slug,
        avgPrice: price,
        avgPriceIsCitywide: !localPrice,
        yield: grossYield,
        yieldNote: grossYield
          ? null
          : !localPrice && !localRent
            ? 'No listings here yet — price and yield would be citywide figures'
            : !localRent
              ? 'No rentals recorded here, so a local yield cannot be calculated'
              : 'No sale listings recorded here, so a local yield cannot be calculated',
        listings: n.activeListings.sale + n.activeListings.rent,
      };
    })
    .sort((a, b) => (b.avgPrice ?? 0) - (a.avgPrice ?? 0));

  return { data };
};

const getPropertyTypes = async () => {
  const summary = await fetchMarketSummary();
  const total = summary.propertyTypes.reduce((sum, item) => sum + item.count, 0);
  return {
    data: summary.propertyTypes.map((item) => ({
      type: propertyTypeLabel(item.propertyType),
      count: item.count,
      percentage: total ? Math.round((item.count / total) * 100) : 0,
    })),
  };
};

export default function DashboardPage() {
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('');
  const [timeRange, setTimeRange] = useState<string>('12');

  const months = Number(timeRange);

  const { data: stats, isLoading: statsLoading, isError, error, refetch } = useQuery({
    queryKey: ['market-dashboard', timeRange],
    queryFn: () => getMarketDashboard(months),
  });

  const { data: trends } = useQuery({
    queryKey: ['price-trends', timeRange],
    queryFn: () => getPriceTrends(months),
  });

  const { data: neighborhoods } = useQuery({
    queryKey: ['neighborhood-performance', selectedNeighborhood],
    queryFn: getNeighborhoodPerformance,
    select: (result) => ({
      data: selectedNeighborhood
        ? result.data.filter((n) => n.slug === selectedNeighborhood)
        : result.data,
    }),
  });

  const { data: propertyTypes } = useQuery({
    queryKey: ['property-types'],
    queryFn: getPropertyTypes,
  });

  const { data: neighborhoodOptions } = useQuery({
    queryKey: ['neighborhood-options'],
    queryFn: fetchPublicNeighborhoods,
  });

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <TableSkeleton rows={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
          <p className="font-semibold">Could not load the market dashboard</p>
          <p className="mt-1 text-sm text-rose-300/80">
            {error instanceof Error ? error.message : 'The market service did not respond.'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Hero */}
      <PageHero
        icon={BarChart3}
        title="Market Dashboard"
        description="The Addis Ababa market at a glance — prices, demand signals and neighborhood performance."
        accent="indigo"
        actions={<div className="flex flex-wrap gap-3">
          <select
            value={selectedNeighborhood}
            onChange={(e) => setSelectedNeighborhood(e.target.value)}
            className="px-4 py-2 bg-slate-900/50 backdrop-blur-xl border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:border-transparent"
          >
            <option value="">All Neighborhoods</option>
            {(neighborhoodOptions ?? []).map((n) => (
              <option key={n.slug} value={n.slug}>
                {n.name}
              </option>
            ))}
          </select>
          
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 bg-slate-900/50 backdrop-blur-xl border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:border-transparent"
          >
            <option value="3">Last 3 Months</option>
            <option value="6">Last 6 Months</option>
            <option value="12">Last 12 Months</option>
            <option value="24">Last 24 Months</option>
          </select>
        </div>}
      />

            {/* KPI Stats — flat strips, not cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="Median Asking Price"
          info={METRIC_HINTS.medianAskingPrice}
          value={formatRecordedAmount(stats?.medianAsking)}
          accent="indigo"
          trend={
            stats?.priceGrowth != null
              ? {
                  value: `${Math.abs(stats.priceGrowth).toFixed(1)}%`,
                  direction: stats.priceGrowth >= 0 ? 'up' : 'down',
                }
              : undefined
          }
        />
        <StatCard
          icon={BarChart3}
          label="Median Price / m²"
          value={formatRecordedAmount(stats?.medianPerSqm)}
          info={METRIC_HINTS.pricePerSqm}
          accent="emerald"
        />
        <StatCard
          icon={Home}
          label="Median Monthly Rent"
          info={METRIC_HINTS.medianMonthlyRent}
          value={formatRecordedAmount(stats?.medianRent)}
          accent="purple"
          trend={
            stats?.rentalGrowth != null
              ? {
                  value: `${Math.abs(stats.rentalGrowth).toFixed(1)}%`,
                  direction: stats.rentalGrowth >= 0 ? 'up' : 'down',
                }
              : undefined
          }
        />
        <StatCard
          icon={Percent}
          label="Active Listings"
          value={(stats?.activeListings ?? 0).toLocaleString()}
          info={METRIC_HINTS.activeListings}
          hint={`${stats?.neighborhoodsCovered ?? 0} neighborhoods covered`}
          accent="amber"
        />
      </div>

      {stats && (
        <MeaningPanel
          title="What the market is telling you"
          subtitle="Plain-language reading of the figures above, updated with the data on this page."
          caveat="Built from approved sale and rental listings in our records, not from completed transactions. Medians describe what is advertised; a thin month can move them. Sample size is shown on each neighborhood page."
          readings={marketReadings({
            medianAskingPrice: stats.medianAsking,
            medianMonthlyRent: stats.medianRent,
            priceGrowthPct: stats.priceGrowth,
            rentGrowthPct: stats.rentalGrowth,
            activeListings: stats.activeListings,
            neighborhoodsCovered: stats.neighborhoodsCovered,
          })}
        />
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Price Trend Chart */}
        <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-sky-200">Property Price Trend</h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Calendar className="w-4 h-4" />
              Last {timeRange} months
            </div>
          </div>
          
          {trends?.data.length ? (
            <div className="h-64 flex items-end justify-between gap-2">
              {trends.data.map((item) => (
                <div key={item.month} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-gradient-to-t from-blue-500/90 to-cyan-400/90 rounded-t-md transition-all hover:from-blue-400 hover:to-cyan-300"
                    style={{
                      height: `${(item.price / Math.max(...trends.data.map((d) => d.price))) * 200}px`,
                      minHeight: '20px',
                    }}
                  />
                  <div className="text-xs text-gray-400 mt-2">{item.month}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Loading monthly listing counts…
            </p>
          )}
        </div>

        {/* Neighborhood Performance */}
        <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-sky-200">Neighborhood Performance</h3>
            <MapPin className="w-5 h-5 text-sky-400" />
          </div>
          
          <div className="space-y-4">
            {neighborhoods?.data.map((neighborhood, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium text-white">{neighborhood.name}</div>
                  <div className="text-sm text-gray-400">
                    {formatRecordedAmount(neighborhood.avgPrice)}
                    {neighborhood.avgPriceIsCitywide && (
                      <span
                        className="ml-1 text-xs text-amber-300/80"
                        title="No sale listings recorded in this area, so the figure is the citywide median."
                      >
                        city median
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-400">{neighborhood.listings} listings</div>
                  <div className="text-sm text-gray-400" title={neighborhood.yieldNote ?? undefined}>
                    {neighborhood.yield != null ? `${neighborhood.yield.toFixed(1)}% yield` : '— yield'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Neighborhoods Table */}
        <div className="lg:col-span-2 rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-6">
          <h3 className="text-lg font-bold text-sky-200 mb-6">Top Neighborhoods</h3>
          
          <div className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Neighborhood</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">
                    Median Price
                    <InfoHint text={METRIC_HINTS.medianAskingPrice} label="Median price" />
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">
                    Listings
                    <InfoHint text={METRIC_HINTS.listingCount} label="Listings" />
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">
                    Gross Yield
                    <InfoHint text={METRIC_HINTS.rentalYield} label="Gross yield" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {neighborhoods?.data.map((neighborhood, index) => (
                  <tr key={index} className="border-b border-white/10 hover:bg-white/5">
                    <td className="py-3 px-4">
                      <div className="font-medium text-white">{neighborhood.name}</div>
                    </td>
                    <td className="py-3 px-4 text-right text-white">
                      {formatRecordedAmount(neighborhood.avgPrice)}
                      {neighborhood.avgPriceIsCitywide && (
                        <div className="text-xs text-amber-300/80">city median</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-300">{neighborhood.listings}</td>
                    <td className="py-3 px-4 text-right text-white" title={neighborhood.yieldNote ?? undefined}>
                      {neighborhood.yield != null ? `${neighborhood.yield.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Property Supply */}
        <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-6">
          <h3 className="text-lg font-bold text-sky-200 mb-6">Property Supply</h3>
          
          <div className="space-y-4">
            {propertyTypes?.data.map((type, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B'][index] }}
                  />
                  <span className="text-sm font-medium text-white">{type.type}</span>
                </div>
                <div className="text-sm text-gray-400">{type.count}</div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-white/5 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-300">Active Listings</span>
              <span className="text-lg font-bold text-white">{(stats?.activeListings ?? 0).toLocaleString()}</span>
            </div>
            <div className="text-sm text-gray-400">
              {stats?.note ?? 'Derived from verified public listings'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
