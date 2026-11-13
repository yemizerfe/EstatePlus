import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Calculator, 
  BarChart3, 
  MapPin,
  Building2,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { InfoHint, PageHero } from '../../components/ui/kit-core';
import { METRIC_HINTS } from '../../lib/metricHints';
import { TableSkeleton } from '../../components/ui/kit-blocks';
import { BarChart, DonutChart } from '../../components/charts';

import {
  fetchPublicNeighborhoods,
  fetchPublicListings,
  propertyTypeLabel,
  type PublicListingCard,
} from '../../api/publicData';
import { downloadCsv } from '../../lib/csv';

interface FilterState {
  period: string;
  neighborhood: string;
  propertyType: string;
  listingType: string;
}

const PROPERTY_TYPE_QUERY: Record<string, string> = {
  apartment: 'APARTMENT',
  villa: 'VILLA',
  house: 'VILLA',
  office: 'OFFICE',
  retail: 'RETAIL',
  land: 'LAND',
};

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
};

const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

const pearson = (xs: number[], ys: number[]) => {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    const x = xs[i]! - mx;
    const y = ys[i]! - my;
    num += x * y;
    dx += x * x;
    dy += y * y;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? null : num / den;
};

const significanceFor = (r: number) => {
  const abs = Math.abs(r);
  if (abs >= 0.7) return 'Very High';
  if (abs >= 0.5) return 'High';
  if (abs >= 0.3) return 'Medium';
  return 'Low';
};

/** Public listing feed caps at 60 rows, so all sample-based figures are estimates. */
const fetchSaleSample = (filters: FilterState) =>
  fetchPublicListings({
    listingType: 'sale',
    neighborhood: filters.neighborhood === 'all' ? undefined : filters.neighborhood,
    propertyType: PROPERTY_TYPE_QUERY[filters.propertyType] as never,
    limit: 60,
  });

const getPriceByNeighborhood = async (filters: FilterState) => {
  const neighborhoods = await fetchPublicNeighborhoods();
  // Only a metric computed from this area's own listings is published as an
  // area figure. When the backend falls back to the citywide sample the cell
  // stays empty, otherwise one number would look like every area's median.
  const localValue = (metric: { value: number | null; scope?: 'local' | 'city'; localSampleSize?: number }) =>
    metric.scope === 'city' ? null : metric.value;

  const rows = neighborhoods
    .filter((n) => filters.neighborhood === 'all' || n.slug === filters.neighborhood)
    .map((n) => ({
      slug: n.slug,
      neighborhood: n.name,
      medianPrice: localValue(n.sale.medianAskingPrice),
      localSample: n.sale.medianAskingPrice.localSampleSize ?? 0,
      pricePerSqm: localValue(n.sale.medianPricePerSqm),
      listings: n.activeListings.sale,
      growth: n.growth?.pricePct ?? null,
    }));

  return { data: rows };
};

const getNeighborhoodOptions = async (): Promise<Array<{ slug: string; name: string }>> => {
  const neighborhoods = await fetchPublicNeighborhoods();
  return neighborhoods.map((n) => ({ slug: n.slug, name: n.name }));
};

const getPriceByPropertyType = async (filters: FilterState) => {
  const { listings } = await fetchSaleSample(filters);
  const groups = new Map<string, PublicListingCard[]>();
  listings.forEach((listing) => {
    if (listing.price == null) return;
    const key = listing.propertyType;
    const bucket = groups.get(key) ?? [];
    bucket.push(listing);
    groups.set(key, bucket);
  });

  const data = Array.from(groups.entries())
    .map(([type, group]) => {
      const prices = group.map((listing) => Number(listing.price));
      const perSqm = group
        .filter((listing) => listing.sizeSqm && listing.price)
        .map((listing) => Number(listing.price) / Number(listing.sizeSqm));
      return {
        type: propertyTypeLabel(type),
        medianPrice: median(prices) ?? 0,
        avgPrice: mean(prices) ?? 0,
        pricePerSqm: median(perSqm) ?? 0,
        count: group.length,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
      };
    })
    .sort((a, b) => b.count - a.count);

  return { data, sampled: listings.length };
};

const BUCKETS: Array<{ range: string; test: (price: number) => boolean }> = [
  { range: 'Under 5M', test: (p) => p < 5_000_000 },
  { range: '5M - 10M', test: (p) => p >= 5_000_000 && p < 10_000_000 },
  { range: '10M - 15M', test: (p) => p >= 10_000_000 && p < 15_000_000 },
  { range: '15M - 25M', test: (p) => p >= 15_000_000 && p < 25_000_000 },
  { range: '25M - 40M', test: (p) => p >= 25_000_000 && p < 40_000_000 },
  { range: 'Over 40M', test: (p) => p >= 40_000_000 },
];

const getPriceDistribution = async (filters: FilterState) => {
  const { listings } = await fetchSaleSample(filters);
  const prices = listings.map((listing) => listing.price).filter((p): p is number => p != null);
  const total = prices.length;

  const data = BUCKETS.map((bucket) => {
    const count = prices.filter(bucket.test).length;
    return {
      range: bucket.range,
      count,
      percentage: total ? Math.round((count / total) * 1000) / 10 : 0,
    };
  });

  return { data, total, sampled: listings.length };
};

const getPropertyFactors = async (filters: FilterState) => {
  const { listings } = await fetchSaleSample(filters);
  const usable = listings.filter((listing) => listing.price != null);

  const correlations = {
    area: pearson(
      usable.filter((l) => l.sizeSqm != null).map((l) => Number(l.sizeSqm)),
      usable.filter((l) => l.sizeSqm != null).map((l) => Number(l.price)),
    ),
    bedrooms: pearson(
      usable.map((l) => Number(l.bedrooms)),
      usable.map((l) => Number(l.price)),
    ),
    bathrooms: pearson(
      usable.map((l) => Number(l.bathrooms)),
      usable.map((l) => Number(l.price)),
    ),
  };

  const factors = [
    {
      factor: 'Area (sq m)',
      correlation: correlations.area,
      note: correlations.area == null
        ? 'Not enough listings with recorded size to compute a correlation.'
        : 'Pearson correlation between recorded size and asking price in the sampled listings.',
    },
    {
      factor: 'Bedrooms',
      correlation: correlations.bedrooms,
      note: correlations.bedrooms == null
        ? 'Not enough listings to compute a correlation.'
        : 'Pearson correlation between bedroom count and asking price in the sampled listings.',
    },
    {
      factor: 'Bathrooms',
      correlation: correlations.bathrooms,
      note: correlations.bathrooms == null
        ? 'Not enough listings to compute a correlation.'
        : 'Pearson correlation between bathroom count and asking price in the sampled listings.',
    },
    {
      factor: 'Location',
      correlation: null,
      note: 'Neighborhood-level effects are visible in the Neighborhoods tab but are not scored as a correlation here.',
    },
    {
      factor: 'Amenities',
      correlation: null,
      note: 'Amenity data is not exposed by the public listing feed, so no score can be computed.',
    },
  ]
    .filter((factor): factor is { factor: string; correlation: number; note: string } => factor.correlation != null)
    .map((factor) => ({
      ...factor,
      correlation: factor.correlation,
      significance: significanceFor(factor.correlation),
    }))
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

  return {
    factors,
    sampleSize: usable.length,
  };
};

export default function PricingAnalysisPage() {
  const [filters, setFilters] = useState<FilterState>({
    period: '12',
    neighborhood: 'all',
    propertyType: 'all',
    listingType: 'sale'
  });

  const [activeTab, setActiveTab] = useState('neighborhoods');
  const queryClient = useQueryClient();

  // Data queries
  const { data: neighborhoodData, isLoading: neighborhoodLoading } = useQuery({
    queryKey: ['price-by-neighborhood', filters],
    queryFn: () => getPriceByNeighborhood(filters)
  });

  const { data: neighborhoodOptions } = useQuery({
    queryKey: ['pricing-neighborhood-options'],
    queryFn: getNeighborhoodOptions,
  });

  const { data: propertyTypeData, isLoading: propertyTypeLoading } = useQuery({
    queryKey: ['price-by-type', filters],
    queryFn: () => getPriceByPropertyType(filters)
  });

  const { data: distributionData, isLoading: distributionLoading } = useQuery({
    queryKey: ['price-distribution', filters],
    queryFn: () => getPriceDistribution(filters)
  });

  const { data: factorsData, isLoading: factorsLoading } = useQuery({
    queryKey: ['property-factors', filters],
    queryFn: () => getPropertyFactors(filters)
  });

  const formatCurrency = (amount: number | null) => {
    if (amount == null) return '—';
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    }
    return `${(amount / 1000).toFixed(0)}K`;
  };

  const formatPercentage = (value: number | null) => {
    if (value == null) return '—';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const getCorrelationColor = (correlation: number | null) => {
    if (correlation == null) return 'text-gray-400';
    if (correlation >= 0.7) return 'text-green-400';
    if (correlation >= 0.5) return 'text-yellow-400';
    if (correlation >= 0.3) return 'text-orange-400';
    return 'text-red-400';
  };

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['price-by-neighborhood'] });
    void queryClient.invalidateQueries({ queryKey: ['price-by-type'] });
    void queryClient.invalidateQueries({ queryKey: ['price-distribution'] });
    void queryClient.invalidateQueries({ queryKey: ['property-factors'] });
  };

  /** Export whichever tab is open, using the rows currently on screen. */
  const handleExport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (activeTab === 'neighborhoods') {
      downloadCsv(
        `pricing-by-neighborhood-${stamp}.csv`,
        ['Neighborhood', 'Median sale price (ETB)', 'Local sale sample', 'Median price per m² (ETB)', 'Sale listings', 'Sale growth vs previous month (%)'],
        (neighborhoodData?.data ?? []).map((row) => [
          row.neighborhood,
          row.medianPrice ?? '',
          row.localSample,
          row.pricePerSqm ?? '',
          row.listings,
          row.growth ?? '',
        ]),
      );
      return;
    }

    if (activeTab === 'property-types') {
      downloadCsv(
        `pricing-by-property-type-${stamp}.csv`,
        ['Property type', 'Median price (ETB)', 'Average price (ETB)', 'Median price per m² (ETB)', 'Listings in sample', 'Min price', 'Max price'],
        (propertyTypeData?.data ?? []).map((row) => [
          row.type,
          row.medianPrice,
          row.avgPrice,
          row.pricePerSqm,
          row.count,
          row.minPrice,
          row.maxPrice,
        ]),
      );
      return;
    }

    if (activeTab === 'distribution') {
      downloadCsv(
        `price-distribution-${stamp}.csv`,
        ['Price range (ETB)', 'Listings', 'Share (%)'],
        (distributionData?.data ?? []).map((row) => [row.range, row.count, row.percentage]),
      );
      return;
    }

    downloadCsv(
      `price-factors-${stamp}.csv`,
      ['Factor', 'Correlation', 'Significance', 'Note'],
      (factorsData?.factors ?? []).map((row) => [
        row.factor,
        row.correlation.toFixed(3),
        row.significance,
        row.note,
      ]),
    );
  };

  if (neighborhoodLoading) return <TableSkeleton />;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <PageHero
        icon={Calculator}
        title="Pricing Analysis"
        description="Comprehensive property price analysis across markets. Every figure has a ⓘ that explains, in plain language, what the number means and how it was calculated."
        accent="purple"
        actions={
          <div className="flex items-center gap-4">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-400 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Analysis
            </button>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-white/10 rounded-xl transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        }
      />

      <div className="p-6">
        {/* Filters */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Analysis Filters</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Period */}
            <select
              value={filters.period}
              onChange={(e) => setFilters({ ...filters, period: e.target.value })}
              className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="3">Last 3 months</option>
              <option value="6">Last 6 months</option>
              <option value="12">Last 12 months</option>
              <option value="24">Last 2 years</option>
            </select>

            {/* Neighborhood */}
            <select
              value={filters.neighborhood}
              onChange={(e) => setFilters({ ...filters, neighborhood: e.target.value })}
              className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Neighborhoods</option>
              {(neighborhoodOptions ?? []).map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.name}
                </option>
              ))}
            </select>

            {/* Property Type */}
            <select
              value={filters.propertyType}
              onChange={(e) => setFilters({ ...filters, propertyType: e.target.value })}
              className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="apartment">Apartment</option>
              <option value="villa">Villa</option>
              <option value="house">House</option>
              <option value="office">Office</option>
              <option value="retail">Retail</option>
              <option value="land">Land</option>
            </select>

            {/* Listing Type */}
            <select
              value={filters.listingType}
              onChange={(e) => setFilters({ ...filters, listingType: e.target.value })}
              className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="sale">For Sale</option>
              <option value="rent">For Rent</option>
            </select>
          </div>
        </div>

        {/* Analysis Tabs */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8">
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { id: 'neighborhoods', label: 'By Neighborhood', icon: <MapPin className="w-4 h-4" /> },
              { id: 'property-types', label: 'By Property Type', icon: <Building2 className="w-4 h-4" /> },
              { id: 'distribution', label: 'Price Distribution', icon: <BarChart3 className="w-4 h-4" /> },
              { id: 'factors', label: 'Price Factors', icon: <Calculator className="w-4 h-4" /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'bg-slate-800/50 text-gray-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'neighborhoods' && (
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Price by Neighborhood</h3>
              <p className="mb-6 text-sm text-gray-400">
                Medians are calculated from each area's own listings. Areas without a local
                sample are left empty rather than filled with the citywide figure.
              </p>
              {neighborhoodLoading ? (
                <TableSkeleton />
              ) : (
                <div className="space-y-6">
                  {/* Chart */}
                  <div className="h-80">
                    <BarChart
                      data={(neighborhoodData?.data ?? []).filter((row) => row.medianPrice != null)}
                      xKey="neighborhood"
                      bars={[{ key: 'medianPrice', color: '#a855f7', name: 'Median Price' }]}
                    />
                  </div>

                  {/* Table */}
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
                            Local sample
                            <InfoHint text={METRIC_HINTS.localSample} label="Local sample" />
                          </th>
                          <th className="text-right py-3 px-4 text-gray-300">
                            Price/m²
                            <InfoHint text={METRIC_HINTS.pricePerSqm} label="Price per square metre" />
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
                        {neighborhoodData?.data.map((item, index) => (
                          <tr key={index} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-3 px-4 font-medium text-white">{item.neighborhood}</td>
                            <td className="py-3 px-4 text-right text-white">{formatCurrency(item.medianPrice)}</td>
                            <td className="py-3 px-4 text-right text-gray-300">{item.localSample}</td>
                            <td className="py-3 px-4 text-right text-gray-300">
                              {item.pricePerSqm != null ? item.pricePerSqm.toLocaleString() : '—'}
                            </td>
                            <td className="py-3 px-4 text-right text-gray-300">{item.listings}</td>
                            <td className={`py-3 px-4 text-right font-medium ${item.growth == null ? 'text-gray-400' : item.growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {formatPercentage(item.growth)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'property-types' && (
            <div>
              <h3 className="text-xl font-bold text-white mb-6">Price by Property Type</h3>
              {propertyTypeLoading ? (
                <TableSkeleton />
              ) : (
                <div className="space-y-6">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {propertyTypeData?.data.slice(0, 3).map((type, index) => (
                      <div key={index} className="p-4 bg-slate-800/50 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-white">{type.type}</h4>
                          <Building2 className="w-5 h-5 text-purple-400" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="flex items-center text-gray-400">
                              Median
                              <InfoHint text={METRIC_HINTS.medianAskingPrice} label="Median price" />
                            </span>
                            <span className="text-white font-medium">{formatCurrency(type.medianPrice)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="flex items-center text-gray-400">
                              Median/m²
                              <InfoHint text={METRIC_HINTS.pricePerSqm} label="Median price per square metre" />
                            </span>
                            <span className="text-white">
                              {type.pricePerSqm ? type.pricePerSqm.toLocaleString() : '—'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="flex items-center text-gray-400">
                              Count
                              <InfoHint text={METRIC_HINTS.sampleSize} label="Count" />
                            </span>
                            <span className="text-white">{type.count}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Full Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-3 px-4 text-gray-300">Property Type</th>
                          <th className="text-right py-3 px-4 text-gray-300">
                            Median Price
                            <InfoHint text={METRIC_HINTS.medianAskingPrice} label="Median price" />
                          </th>
                          <th className="text-right py-3 px-4 text-gray-300">
                            Avg Price
                            <InfoHint text={METRIC_HINTS.averageAskingPrice} label="Average price" />
                          </th>
                          <th className="text-right py-3 px-4 text-gray-300">
                            Price/m²
                            <InfoHint text={METRIC_HINTS.pricePerSqm} label="Price per square metre" />
                          </th>
                          <th className="text-right py-3 px-4 text-gray-300">
                            Count
                            <InfoHint text={METRIC_HINTS.sampleSize} label="Count" />
                          </th>
                          <th className="text-right py-3 px-4 text-gray-300">
                            Price Range
                            <InfoHint text={METRIC_HINTS.priceRange} label="Price range" />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {propertyTypeData?.data.map((type, index) => (
                          <tr key={index} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-3 px-4 font-medium text-white">{type.type}</td>
                            <td className="py-3 px-4 text-right text-white">{formatCurrency(type.medianPrice)}</td>
                            <td className="py-3 px-4 text-right text-gray-300">{formatCurrency(type.avgPrice)}</td>
                            <td className="py-3 px-4 text-right text-gray-300">
                              {type.pricePerSqm ? type.pricePerSqm.toLocaleString() : '—'}
                            </td>
                            <td className="py-3 px-4 text-right text-gray-300">{type.count}</td>
                            <td className="py-3 px-4 text-right text-gray-300">
                              {formatCurrency(type.minPrice)} - {formatCurrency(type.maxPrice)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'distribution' && (
            <div>
              <h3 className="flex items-center text-xl font-bold text-white mb-6">
                Price Distribution
                <InfoHint text={METRIC_HINTS.priceBandShare} label="Price distribution" />
              </h3>
              {distributionLoading ? (
                <TableSkeleton />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Chart */}
                  <div className="h-80">
                    <DonutChart
                      data={distributionData?.data || []}
                      labelKey="range"
                      valueKey="count"
                    />
                  </div>

                  {/* Statistics */}
                  <div className="space-y-4">
                    {distributionData?.data.map((item, index) => (
                      <div key={index} className="p-4 bg-slate-800/50 rounded-xl">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-medium">{item.range}</span>
                          <span className="text-purple-400 font-bold">{item.percentage}%</span>
                        </div>
                        <div className="mt-2">
                          <div className="w-full bg-slate-700 rounded-full h-2">
                            <div 
                              className="bg-purple-500 h-2 rounded-full" 
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                          <div className="text-sm text-gray-400 mt-1">{item.count.toLocaleString()} properties</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'factors' && (
            <div>
              <h3 className="flex items-center text-xl font-bold text-white mb-6">
                Property Price Factors
                <InfoHint text={METRIC_HINTS.correlation} label="Correlation score" />
              </h3>
              {factorsLoading ? (
                <TableSkeleton />
              ) : (
                <div className="space-y-6">
                  {/* Correlation Overview */}
                  {factorsData?.factors.length ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {factorsData.factors.slice(0, 3).map((factor, index) => (
                        <div key={factor.factor} className="p-6 bg-slate-800/50 rounded-xl text-center">
                          <div className={`text-3xl font-bold mb-2 ${getCorrelationColor(factor.correlation)}`}>
                            {factor.correlation.toFixed(2)}
                          </div>
                          <div className="text-white font-medium">{factor.factor}</div>
                          <div className="text-gray-400 text-sm">
                            {index === 0 ? 'Strongest Factor' : `${factor.significance} Correlation`}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-800/50 rounded-xl text-gray-400 text-sm">
                      Not enough sampled listings with recorded attributes to compute correlations.
                    </div>
                  )}

                  <p className="text-xs text-gray-500">
                    Computed from {factorsData?.sampleSize ?? 0} sampled sale listings (the public feed returns up to 60).
                  </p>

                  {/* Detailed Analysis */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-3 px-4 text-gray-300">Factor</th>
                          <th className="text-center py-3 px-4 text-gray-300">
                            Correlation
                            <InfoHint text={METRIC_HINTS.correlation} label="Correlation" />
                          </th>
                          <th className="text-center py-3 px-4 text-gray-300">
                            Significance
                            <InfoHint
                              text="How reliably a factor moves with price in this sample. It is a plain-language band for the correlation score: Very High (0.7+), High (0.5–0.7), Medium (0.3–0.5) and Low (below 0.3)."
                              label="Significance"
                            />
                          </th>
                          <th className="text-left py-3 px-4 text-gray-300">Analysis Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {factorsData?.factors.map((factor, index) => (
                          <tr key={index} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-3 px-4 font-medium text-white">{factor.factor}</td>
                            <td className={`py-3 px-4 text-center font-bold ${getCorrelationColor(factor.correlation)}`}>
                              {factor.correlation.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                factor.significance === 'Very High' ? 'bg-green-500/20 text-green-400' :
                                factor.significance === 'High' ? 'bg-yellow-500/20 text-yellow-400' :
                                factor.significance === 'Medium' ? 'bg-orange-500/20 text-orange-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {factor.significance}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-gray-300">{factor.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Disclaimer */}
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="text-amber-400 mt-1">⚠️</div>
                      <div>
                        <div className="text-amber-300 font-medium mb-1">Analysis Disclaimer</div>
                        <div className="text-amber-200/80 text-sm">
                          Correlation values indicate statistical relationships but do not imply causation. 
                          Market prices are influenced by multiple complex factors including economic conditions, 
                          supply-demand dynamics, and external market forces not captured in this analysis.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}