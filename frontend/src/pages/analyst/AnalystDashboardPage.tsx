import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Home, 
  DollarSign, 
  BarChart3, 
  MapPin, 
  RefreshCw,
  TrendingUp,
  Building2,
  Activity,
  Eye
} from 'lucide-react';
import { InfoHint, PageHero, StatCard } from '../../components/ui/kit-core';
import { METRIC_HINTS } from '../../lib/metricHints';
import { TableSkeleton } from '../../components/ui/kit-blocks';
import { LineChart, DonutChart } from '../../components/charts';

// Real data layer: every figure below comes from the EstatePlus API
// (public market endpoints + grounded AI summary), never from sample values.
import {
  fetchMarketSummary,
  fetchMarketTrends,
  fetchPublicNeighborhoods,
} from '../../api/publicData';
import { getMarketSummary } from '../../api/ai';

interface MarketIntelligence {
  medianPrice: number | null;
  medianRent: number | null;
  activeListings: number;
  saleListings: number;
  rentListings: number;
  priceGrowth: number | null;
  inventoryChange: number | null;
  currencyNote: string;
  asOf: string | null;
}

interface TrendPointRow {
  month: string;
  price: number | null;
  rent: number | null;
  [key: string]: unknown;
}

interface SupplyMetrics {
  activeListings: number;
  newListings: number | null;
  soldListings: number | null;
  inventoryChange: number | null;
}

interface TypeSlice {
  type: string;
  count: number;
  percentage: number;
  [key: string]: unknown;
}

interface NeighborhoodRow {
  name: string;
  medianPrice: number | null;
  medianRent: number | null;
  listings: number;
  growth: number | null;
}

const getMarketIntelligence = async (args: {
  period: string;
}): Promise<MarketIntelligence> => {
  const months = Number(args.period) || 12;
  const [summary, trends] = await Promise.all([
    fetchMarketSummary(),
    fetchMarketTrends(months),
  ]);

  const comparison = trends.comparison;
  const inventoryChange =
    comparison.previousListingCount > 0
      ? ((comparison.currentListingCount - comparison.previousListingCount) /
          comparison.previousListingCount) *
        100
      : null;

  return {
    medianPrice: summary.sale.medianAskingPrice.value,
    medianRent: summary.rent.medianMonthlyRent.value,
    activeListings: summary.activeListings.total,
    saleListings: summary.activeListings.sale,
    rentListings: summary.activeListings.rent,
    priceGrowth: comparison.priceChangePct,
    inventoryChange,
    currencyNote: summary.currencyNote,
    asOf: summary.dataAsOf,
  };
};

const getPriceTrends = async (args: { period: string }): Promise<{ data: TrendPointRow[] }> => {
  const trends = await fetchMarketTrends(Number(args.period) || 12);
  return {
    data: trends.points.map((point) => ({
      month: point.label,
      price: point.medianPrice,
      rent: point.medianRent,
    })),
  };
};

const getSupplyMetrics = async (): Promise<{ data: SupplyMetrics }> => {
  const [summary, trends] = await Promise.all([fetchMarketSummary(), fetchMarketTrends(12)]);
  const comparison = trends.comparison;
  const inventoryChange =
    comparison.previousListingCount > 0
      ? ((comparison.currentListingCount - comparison.previousListingCount) /
          comparison.previousListingCount) *
        100
      : null;

  const closed = summary.closedListings ?? { sold: 0, rented: 0 };
  return {
    data: {
      activeListings: summary.activeListings.total,
      newListings: comparison.currentListingCount,
      // Completed listings recorded with a SOLD / RENTED status in this system.
      soldListings: closed.sold + closed.rented,
      inventoryChange,
    },
  };
};

const getPropertyTypeDistribution = async (): Promise<{ data: TypeSlice[] }> => {
  const summary = await fetchMarketSummary();
  const total = summary.propertyTypes.reduce((acc, item) => acc + item.count, 0);
  return {
    data: summary.propertyTypes.map((item) => ({
      type: item.propertyType,
      count: item.count,
      percentage: total > 0 ? Number(((item.count / total) * 100).toFixed(1)) : 0,
    })),
  };
};

const getNeighborhoodComparison = async (): Promise<{ data: NeighborhoodRow[] }> => {
  const neighborhoods = await fetchPublicNeighborhoods();
  return {
    data: neighborhoods
      .filter((neighborhood) => neighborhood.activeListings.sale + neighborhood.activeListings.rent > 0)
      .sort(
        (a, b) =>
          b.activeListings.sale +
          b.activeListings.rent -
          (a.activeListings.sale + a.activeListings.rent),
      )
      .slice(0, 8)
      .map((neighborhood) => ({
        name: neighborhood.name,
        medianPrice: neighborhood.sale.medianAskingPrice.value,
        medianRent: neighborhood.rent.medianMonthlyRent.value,
        listings: neighborhood.activeListings.sale + neighborhood.activeListings.rent,
        // Month-over-month change of this area's own asking-price median.
        growth: neighborhood.growth?.pricePct ?? null,
      })),
  };
};

const getAIMarketSummary = async (): Promise<{
  summary: string;
  dataSource: string;
  period: string;
  lastUpdated: string;
}> => {
  try {
    const answer = await getMarketSummary();
    const grounding = answer.grounding;
    return {
      summary: answer.answer,
      dataSource:
        grounding.citations.length > 0
          ? grounding.citations.map((citation) => citation.label).join(' · ')
          : 'EstatePlus listing database',
      period: `Last ${grounding.scope.months} months`,
      lastUpdated: new Date(grounding.generatedAt).toLocaleString(),
    };
  } catch {
    // No AI provider configured: write the summary from the same stored figures
    // the dashboard shows instead of leaving the panel empty.
    const [summary, trends] = await Promise.all([fetchMarketSummary(), fetchMarketTrends(12)]);
    const price = summary.sale.medianAskingPrice.value;
    const rent = summary.rent.medianMonthlyRent.value;
    const change = trends.comparison.priceChangePct;
    const parts = [
      `${summary.activeListings.total} active listings across ${summary.neighborhoodsCovered} neighborhoods`,
      price !== null
        ? `a median asking price of ${Math.round(price).toLocaleString()} ETB (n=${summary.sale.medianAskingPrice.sampleSize})`
        : null,
      rent !== null
        ? `a median monthly rent of ${Math.round(rent).toLocaleString()} ETB (n=${summary.rent.medianMonthlyRent.sampleSize})`
        : null,
      change !== null
        ? `asking prices moved ${change > 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(1)}% between the earliest and latest recorded months`
        : null,
    ].filter(Boolean);
    return {
      summary: `${parts.join(', ')}. Figures are medians of the listings stored in this platform, shown with their sample sizes.`,
      dataSource: 'EstatePlus listing database',
      period: 'Last 12 months',
      lastUpdated: new Date(summary.generatedAt).toLocaleString(),
    };
  }
};

interface FilterState {
  period: string;
  propertyType: string;
  listingType: string;
}

export default function AnalystDashboardPage() {
  const [filters, setFilters] = useState<FilterState>({
    period: '12', // Last 12 months
    propertyType: 'all',
    listingType: 'all' // sale, rent, all
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  // Data queries
  const { data: marketData, isLoading: marketLoading } = useQuery({
    queryKey: ['market-intelligence', filters],
    queryFn: () => getMarketIntelligence(filters)
  });

  const { data: priceTrends, isLoading: trendsLoading } = useQuery({
    queryKey: ['price-trends', filters],
    queryFn: () => getPriceTrends(filters)
  });

  const { data: supplyData, isLoading: supplyLoading } = useQuery({
    queryKey: ['supply-metrics'],
    queryFn: getSupplyMetrics
  });

  const { data: propertyTypes, isLoading: typesLoading } = useQuery({
    queryKey: ['property-types'],
    queryFn: getPropertyTypeDistribution
  });

  const { data: neighborhoods, isLoading: neighborhoodsLoading } = useQuery({
    queryKey: ['neighborhood-comparison'],
    queryFn: getNeighborhoodComparison
  });

  const { data: aiSummary, isLoading: aiLoading } = useQuery({
    queryKey: ['ai-market-summary', filters],
    queryFn: () => getAIMarketSummary()
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['market-intelligence'] }),
        queryClient.invalidateQueries({ queryKey: ['price-trends'] }),
        queryClient.invalidateQueries({ queryKey: ['supply-metrics'] }),
        queryClient.invalidateQueries({ queryKey: ['property-types'] }),
        queryClient.invalidateQueries({ queryKey: ['neighborhood-comparison'] }),
        queryClient.invalidateQueries({ queryKey: ['ai-market-summary'] }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || !Number.isFinite(amount)) return '—';
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    }
    return `${(amount / 1000).toFixed(0)}K`;
  };

  const formatPercentage = (value: number | null) => {
    if (value === null || !Number.isFinite(value)) return '—';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const growthTrend =
    marketData?.priceGrowth != null
      ? {
          value: formatPercentage(marketData.priceGrowth),
          direction: marketData.priceGrowth >= 0 ? ('up' as const) : ('down' as const),
        }
      : undefined;

  const inventoryTrend =
    marketData?.inventoryChange != null
      ? {
          value: formatPercentage(marketData.inventoryChange),
          direction: marketData.inventoryChange >= 0 ? ('up' as const) : ('down' as const),
        }
      : undefined;

  if (marketLoading) return <TableSkeleton />;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <PageHero
        icon={BarChart3}
        title="Market Intelligence"
        description="Addis Ababa, Ethiopia"
        accent="indigo"
        actions={
          <div className="flex flex-wrap items-center gap-4">
            {/* Period Selector */}
            <select
              value={filters.period}
              onChange={(e) => setFilters({ ...filters, period: e.target.value })}
              className="px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="3">Last 3 months</option>
              <option value="6">Last 6 months</option>
              <option value="12">Last 12 months</option>
              <option value="24">Last 2 years</option>
            </select>

            {/* Property Type Selector */}
            <select
              value={filters.propertyType}
              onChange={(e) => setFilters({ ...filters, propertyType: e.target.value })}
              className="px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="apartment">Apartment</option>
              <option value="villa">Villa</option>
              <option value="house">House</option>
              <option value="office">Office</option>
              <option value="retail">Retail</option>
              <option value="land">Land</option>
            </select>

            {/* Sale/Rent Selector */}
            <select
              value={filters.listingType}
              onChange={(e) => setFilters({ ...filters, listingType: e.target.value })}
              className="px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">Sale & Rent</option>
              <option value="sale">For Sale</option>
              <option value="rent">For Rent</option>
            </select>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-xl transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
      />

      <div className="p-6 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Median Price"
            value={formatCurrency(marketData?.medianPrice ?? null)}
            icon={DollarSign}
            info={METRIC_HINTS.medianAskingPrice}
            trend={growthTrend}
            accent="emerald"
          />
          <StatCard
            label="Price Growth"
            value={formatPercentage(marketData?.priceGrowth ?? null)}
            icon={TrendingUp}
            hint="Latest period vs previous"
            info={METRIC_HINTS.saleGrowth}
            accent="sky"
          />
          <StatCard
            label="Median Rent"
            value={formatCurrency(marketData?.medianRent ?? null)}
            icon={Home}
            hint="Monthly"
            info={METRIC_HINTS.medianMonthlyRent}
            accent="purple"
          />
          <StatCard
            label="Active Listings"
            value={marketData?.activeListings?.toLocaleString() || '0'}
            icon={Building2}
            info={METRIC_HINTS.activeListings}
            trend={inventoryTrend}
            accent="amber"
          />
        </div>
        {marketData?.currencyNote && (
          <p className="text-xs text-gray-500">{marketData.currencyNote}</p>
        )}

        {/* Charts Row 1 - Price and Rental Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Price Trend Chart */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Price Trend</h3>
              <BarChart3 className="w-5 h-5 text-green-400" />
            </div>
            {trendsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
              </div>
            ) : (
              <LineChart
                data={priceTrends?.data || []}
                xKey="month"
                lines={[{ key: 'price', color: '#10b981', name: 'Price' }]}
              />
            )}
          </div>

          {/* Rental Trend Chart */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Rental Trend</h3>
              <Home className="w-5 h-5 text-purple-400" />
            </div>
            {trendsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
              </div>
            ) : (
              <LineChart
                data={priceTrends?.data || []}
                xKey="month"
                lines={[{ key: 'rent', color: '#a855f7', name: 'Rent' }]}
              />
            )}
          </div>
        </div>

        {/* Charts Row 2 - Supply and Property Types */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Supply Metrics */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Supply Metrics</h3>
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            {supplyLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-800/50 rounded-xl">
                    <div className="text-2xl font-bold text-white">{supplyData?.data.activeListings.toLocaleString()}</div>
                    <div className="flex items-center text-sm text-gray-400">
                      Active Listings
                      <InfoHint text={METRIC_HINTS.activeListings} label="Active listings" />
                    </div>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-xl">
                    <div className="text-2xl font-bold text-green-400">{supplyData?.data.newListings ?? '—'}</div>
                    <div className="flex items-center text-sm text-gray-400">
                      New Listings
                      <InfoHint
                        text="Listings first recorded during the selected window. Re-imports of the same listing are not counted twice."
                        label="New listings"
                      />
                    </div>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-xl">
                    <div className="text-2xl font-bold text-blue-400">{supplyData?.data.soldListings ?? '—'}</div>
                    <div className="flex items-center text-sm text-gray-400">
                      Sold/Rented
                      <InfoHint
                        text="Listings marked sold or rented. We only mark a listing closed when its status was recorded, so this is a floor rather than the full number of transactions."
                        label="Sold or rented"
                      />
                    </div>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-xl">
                    <div className="text-2xl font-bold text-red-400">{formatPercentage(supplyData?.data.inventoryChange ?? null)}</div>
                    <div className="flex items-center text-sm text-gray-400">
                      Inventory Change
                      <InfoHint
                        text="Percentage change in active listings between the first and last month of the selected window. It shows supply pressure, not price movement."
                        label="Inventory change"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Property Type Distribution */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Property Type Distribution</h3>
              <Building2 className="w-5 h-5 text-amber-400" />
            </div>
            {typesLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
              </div>
            ) : (
              <DonutChart
                data={propertyTypes?.data || []}
                labelKey="type"
                valueKey="count"
              />
            )}
          </div>
        </div>

        {/* Neighborhood Comparison */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Neighborhood Comparison</h3>
            <MapPin className="w-5 h-5 text-cyan-400" />
          </div>
          {neighborhoodsLoading ? (
            <TableSkeleton />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-gray-300">Neighborhood</th>
                    <th className="text-right py-3 px-4 text-gray-300">
                      Median Price
                      <InfoHint text={METRIC_HINTS.medianAskingPrice} label="Median price" />
                    </th>
                    <th className="text-right py-3 px-4 text-gray-300">
                      Median Rent
                      <InfoHint text={METRIC_HINTS.medianMonthlyRent} label="Median rent" />
                    </th>
                    <th className="text-right py-3 px-4 text-gray-300">
                      Listings
                      <InfoHint text={METRIC_HINTS.listingCount} label="Listings" />
                    </th>
                    <th className="text-right py-3 px-4 text-gray-300">
                      Growth
                      <InfoHint text={METRIC_HINTS.saleGrowth} label="Growth" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {neighborhoods?.data.map((neighborhood, index) => (
                    <tr key={index} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 px-4 font-medium text-white">{neighborhood.name}</td>
                      <td className="py-3 px-4 text-right text-white">{formatCurrency(neighborhood.medianPrice)}</td>
                      <td className="py-3 px-4 text-right text-white">{formatCurrency(neighborhood.medianRent)}</td>
                      <td className="py-3 px-4 text-right text-gray-300">{neighborhood.listings}</td>
                      <td className={`py-3 px-4 text-right font-medium ${(neighborhood.growth ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {neighborhood.growth == null ? (
                          <span className="text-gray-500">single month</span>
                        ) : (
                          formatPercentage(neighborhood.growth)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* AI Market Summary */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">AI Market Summary</h3>
            <Eye className="w-5 h-5 text-indigo-400" />
          </div>
          {aiLoading ? (
            <div className="h-32 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-300 leading-relaxed">{aiSummary?.summary}</p>
              <div className="flex flex-wrap items-center gap-6 text-sm text-gray-400 border-t border-white/10 pt-4">
                <div>
                  <span className="font-medium">Data Source:</span> {aiSummary?.dataSource}
                </div>
                <div>
                  <span className="font-medium">Period:</span> {aiSummary?.period}
                </div>
                <div>
                  <span className="font-medium">Last Updated:</span> {aiSummary?.lastUpdated}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}