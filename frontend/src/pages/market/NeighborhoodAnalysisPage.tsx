import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { InfoHint, PageHero } from '../../components/ui/kit-core';
import { METRIC_HINTS } from '../../lib/metricHints';
import { neighborhoodReadings } from '../../lib/marketMeaning';
import { MeaningPanel } from '../../components/ui/MeaningPanel';
import { TableSkeleton } from '../../components/ui/kit-blocks';
import { 
  MapPin, 
  TrendingUp, 
  TrendingDown,
} from 'lucide-react';

import {
  fetchMarketTrends,
  fetchPublicListings,
  fetchPublicNeighborhoods,
  propertyTypeLabel,
  type PublicNeighborhood,
} from '../../api/publicData';
import { getNeighborhoodAmenities, type NeighborhoodAmenityRecord } from '../../api/neighborhoods';

interface NeighborhoodData {
  slug: string;
  name: string;
  avgPrice: number | null;
  priceGrowth: number | null;
  avgRent: number | null;
  rentGrowth: number | null;
  rentalYield: number | null;
  totalProperties: number;
  amenities: {
    schools: number | null;
    hospitals: number | null;
    malls: number | null;
    restaurants: number | null;
    total: number;
  };
  priceHistory: Array<{
    month: string;
    price: number;
    rent: number;
  }>;
  priceHistoryNote: string;
  propertyTypes: Array<{
    type: string;
    count: number;
    percentage: number;
    avgPrice: number;
  }>;
}

const metricValue = (metric?: { status: string; value: number | null }) =>
  metric && metric.status === 'available' ? metric.value : null;

const neighborhoodToData = (n: PublicNeighborhood): NeighborhoodData => {
  const price = metricValue(n.sale.medianAskingPrice);
  const rent = metricValue(n.rent.medianMonthlyRent);
  const grossYield = price && rent ? ((rent * 12) / price) * 100 : null;

  return {
    slug: n.slug,
    name: n.name,
    avgPrice: price,
    priceGrowth: n.growth?.pricePct ?? null,
    avgRent: rent,
    rentGrowth: n.growth?.rentPct ?? null,
    rentalYield: grossYield,
    totalProperties: n.activeListings.sale + n.activeListings.rent,
    amenities: {
      schools: null,
      hospitals: null,
      malls: null,
      restaurants: null,
      total: 0,
    },
    priceHistory: [],
    priceHistoryNote:
      'Neighborhood-level monthly series are not published yet; the chart shows the Addis Ababa city-wide trend.',
    propertyTypes: [],
  };
};

const getNeighborhoodData = async (slug: string): Promise<NeighborhoodData> => {
  const [neighborhoods, trends, listingsResult, amenityData] = await Promise.all([
    fetchPublicNeighborhoods(),
    fetchMarketTrends(12),
    fetchPublicListings({ neighborhood: slug, limit: 60 }),
    getNeighborhoodAmenities(slug).catch(() => null),
  ]);

  const match = neighborhoods.find((n) => n.slug === slug);
  if (!match) {
    throw new Error('Neighborhood not found');
  }

  const base = neighborhoodToData(match);

  if (amenityData) {
    const count = (...types: string[]) =>
      amenityData.amenities.filter((amenity: NeighborhoodAmenityRecord) =>
        types.includes(amenity.amenityType),
      ).length;
    base.amenities = {
      schools: count('SCHOOL', 'UNIVERSITY', 'LIBRARY'),
      hospitals: count('HOSPITAL', 'CLINIC', 'PHARMACY'),
      malls: count('SHOPPING_MALL', 'MARKET', 'SUPERMARKET'),
      restaurants: count('RESTAURANT', 'CAFE'),
      total: amenityData.amenities.length,
    };
  }
  base.priceHistory = trends.points
    .filter((point) => point.medianPrice != null)
    .map((point) => ({
      month: point.label,
      price: Number(point.medianPrice),
      rent: point.medianRent != null ? Number(point.medianRent) : 0,
    }));

  const groups = new Map<string, number[]>();
  listingsResult.listings.forEach((listing) => {
    if (listing.price == null) return;
    const bucket = groups.get(listing.propertyType) ?? [];
    bucket.push(Number(listing.price));
    groups.set(listing.propertyType, bucket);
  });
  const totalPriced = Array.from(groups.values()).reduce((sum, prices) => sum + prices.length, 0);
  base.propertyTypes = Array.from(groups.entries())
    .map(([type, prices]) => ({
      type: propertyTypeLabel(type),
      count: prices.length,
      percentage: totalPriced ? (prices.length / totalPriced) * 100 : 0,
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
    }))
    .sort((a, b) => b.count - a.count);

  return base;
};

const getComparableNeighborhoods = async (currentSlug: string) => {
  const neighborhoods = await fetchPublicNeighborhoods();
  return neighborhoods
    .filter((n) => n.slug !== currentSlug)
    .map((n) => {
      const price = metricValue(n.sale.medianAskingPrice);
      const rent = metricValue(n.rent.medianMonthlyRent);
      return {
        slug: n.slug,
        name: n.name,
        avgPrice: price,
        growth: n.growth?.pricePct ?? null,
        yield: price && rent ? ((rent * 12) / price) * 100 : null,
      };
    })
    .sort((a, b) => (b.avgPrice ?? 0) - (a.avgPrice ?? 0))
    .slice(0, 6);
};

export default function NeighborhoodAnalysisPage() {
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('');
  const [compareNeighborhood, setCompareNeighborhood] = useState<string>('');

  const { data: neighborhoodList } = useQuery({
    queryKey: ['public-neighborhoods', 'options'],
    queryFn: fetchPublicNeighborhoods,
  });

  const activeSlug = selectedNeighborhood || neighborhoodList?.[0]?.slug || '';

  const { data: neighborhoodData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['neighborhood-data', activeSlug],
    queryFn: () => getNeighborhoodData(activeSlug),
    enabled: !!activeSlug,
  });

  const { data: compareData } = useQuery({
    queryKey: ['neighborhood-data', compareNeighborhood],
    queryFn: () => getNeighborhoodData(compareNeighborhood),
    enabled: !!compareNeighborhood,
  });

  const { data: comparables } = useQuery({
    queryKey: ['comparable-neighborhoods', activeSlug],
    queryFn: () => getComparableNeighborhoods(activeSlug),
    enabled: !!activeSlug,
  });

  if (!activeSlug) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-gray-400">
          No neighborhoods have published listings yet.
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
          <p className="font-semibold">Could not load neighborhood data</p>
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

  if (isLoading || !neighborhoodData) {
    return (
      <div className="space-y-6">
        <TableSkeleton rows={7} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Hero */}
      <PageHero
        icon={MapPin}
        title="Neighborhood Analysis"
        description="Comprehensive neighborhood intelligence with side-by-side market comparison."
        accent="sky"
        actions={
          <div className="flex gap-3">
            <select
              value={activeSlug}
              onChange={(e) => setSelectedNeighborhood(e.target.value)}
              className="px-4 py-2 bg-slate-900/50 backdrop-blur-xl border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(neighborhoodList ?? []).map((n) => (
                <option key={n.slug} value={n.slug}>
                  {n.name}
                </option>
              ))}
            </select>

            <select
              value={compareNeighborhood}
              onChange={(e) => setCompareNeighborhood(e.target.value)}
              className="px-4 py-2 bg-slate-900/50 backdrop-blur-xl border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Compare with...</option>
              {(neighborhoodList ?? [])
                .filter((n) => n.slug !== activeSlug)
                .map((n) => (
                  <option key={n.slug} value={n.slug}>
                    {n.name}
                  </option>
                ))}
            </select>
          </div>
        }
      />

      {/* Main Neighborhood Info */}
      <div className="bg-gradient-to-r from-slate-50 to-white rounded-2xl p-8 border border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center">
            <MapPin className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{neighborhoodData.name}</h2>
            <p className="text-gray-400">Addis Ababa, Ethiopia</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-white mb-1">
              {neighborhoodData.avgPrice != null
                ? Math.round(neighborhoodData.avgPrice).toLocaleString()
                : '—'}
            </div>
            <div className="mb-2 flex items-center justify-center text-sm text-gray-400">
              Median Asking Price
              <InfoHint text={METRIC_HINTS.medianAskingPrice} label="Median asking price" />
            </div>
            {neighborhoodData.priceGrowth != null ? (
              <div className={`flex items-center justify-center gap-1 text-sm font-medium ${
                neighborhoodData.priceGrowth > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {neighborhoodData.priceGrowth > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {neighborhoodData.priceGrowth > 0 ? '+' : ''}{neighborhoodData.priceGrowth}%
              </div>
            ) : (
              <div className="text-sm text-gray-500">Growth not published</div>
            )}
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-white mb-1">
              {neighborhoodData.avgRent != null
                ? Math.round(neighborhoodData.avgRent).toLocaleString()
                : '—'}
            </div>
            <div className="mb-2 flex items-center justify-center text-sm text-gray-400">
              Median Monthly Rent
              <InfoHint text={METRIC_HINTS.medianMonthlyRent} label="Median monthly rent" />
            </div>
            {neighborhoodData.rentGrowth != null ? (
              <div className={`flex items-center justify-center gap-1 text-sm font-medium ${
                neighborhoodData.rentGrowth > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {neighborhoodData.rentGrowth > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {neighborhoodData.rentGrowth > 0 ? '+' : ''}{neighborhoodData.rentGrowth}%
              </div>
            ) : (
              <div className="text-sm text-gray-500">Growth not published</div>
            )}
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-white mb-1">
              {neighborhoodData.rentalYield != null ? `${neighborhoodData.rentalYield.toFixed(1)}%` : '—'}
            </div>
            <div className="mb-2 flex items-center justify-center text-sm text-gray-400">
              Gross Rental Yield
              <InfoHint text={METRIC_HINTS.rentalYield} label="Gross rental yield" />
            </div>
            <div className="text-sm text-gray-500">
              {neighborhoodData.rentalYield != null
                ? 'Annual rent ÷ median asking price'
                : 'Needs both sale and rent data'}
            </div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-white mb-1">
              {neighborhoodData.totalProperties}
            </div>
            <div className="mb-2 flex items-center justify-center text-sm text-gray-400">
              Active Properties
              <InfoHint text={METRIC_HINTS.activeListings} label="Active properties" />
            </div>
            <div className="text-sm text-gray-400">
              {neighborhoodData.totalProperties} approved listing
              {neighborhoodData.totalProperties === 1 ? '' : 's'} recorded
            </div>
          </div>
        </div>
      </div>

      <MeaningPanel
        title={`What ${neighborhoodData.name} means for you`}
        subtitle="The same figures, translated into what they imply for a buyer, a tenant and an investor."
        caveat="Readings use the medians and listing counts on this page. Neighborhood monthly series are not published yet, so growth compares the latest recorded month with the month before it across the city sample."
        readings={neighborhoodReadings({
          name: neighborhoodData.name,
          medianAskingPrice: neighborhoodData.avgPrice,
          medianMonthlyRent: neighborhoodData.avgRent,
          priceGrowthPct: neighborhoodData.priceGrowth,
          rentGrowthPct: neighborhoodData.rentGrowth,
          activeListings: neighborhoodData.totalProperties,
        })}
      />

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Price Trend Chart */}
        <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white">Price & Rent Trends</h3>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-slate-600 rounded-full"></div>
                <span className="text-gray-400">Price</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-slate-400 rounded-full"></div>
                <span className="text-gray-400">Rent</span>
              </div>
            </div>
          </div>
          
          {neighborhoodData.priceHistory.length ? (
            <div className="h-64 flex items-end justify-between gap-2">
              {neighborhoodData.priceHistory.map((item) => (
                <div key={item.month} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-gradient-to-t from-slate-600 to-slate-400 rounded-t-md"
                    style={{
                      height: `${(item.price / Math.max(...neighborhoodData.priceHistory.map((d) => d.price))) * 180}px`,
                      minHeight: '20px',
                    }}
                  />
                  <div
                    className="w-full bg-gradient-to-t from-slate-400 to-slate-300 rounded-t-md"
                    style={{
                      height: `${(item.rent / Math.max(1, ...neighborhoodData.priceHistory.map((d) => d.rent))) * 60}px`,
                      minHeight: '10px',
                    }}
                  />
                  <div className="text-xs text-gray-400 mt-1">{item.month}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No verified monthly data for this neighborhood yet.</p>
          )}
          <p className="mt-3 text-xs text-gray-500">{neighborhoodData.priceHistoryNote}</p>
        </div>

        {/* Property Type Distribution */}
        <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-6">
          <h3 className="flex items-center text-lg font-bold text-white mb-6">
            Property Type Distribution
            <InfoHint text={METRIC_HINTS.propertyTypeMix} label="Property type distribution" />
          </h3>
          
          <div className="space-y-4">
            {neighborhoodData.propertyTypes.map((type, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: ['#475569', '#64748b', '#94a3b8', '#cbd5e1'][index] }}
                    />
                    <span className="font-medium text-white">{type.type}</span>
                  </div>
                  <div className="text-sm text-gray-400">
                    {type.count} ({type.percentage.toFixed(1)}%)
                  </div>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full"
                    style={{ 
                      width: `${type.percentage}%`,
                      backgroundColor: ['#475569', '#64748b', '#94a3b8', '#cbd5e1'][index]
                    }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Avg: {type.avgPrice.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Amenities recorded for this area */}
      <div className="grid grid-cols-1 gap-8">
        {/* Amenities */}
        <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <MapPin className="w-6 h-6 text-gray-400" />
            <h3 className="text-lg font-bold text-white">Local Amenities</h3>
          </div>
          
          <div className="mb-4 flex items-center justify-between text-sm text-gray-400">
            <span>Places recorded for this neighborhood</span>
            <span>{neighborhoodData.amenities.total} total</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <div className="text-2xl font-bold text-white mb-1">
                {neighborhoodData.amenities.schools ?? '—'}
              </div>
              <div className="text-sm text-gray-400">Schools</div>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <div className="text-2xl font-bold text-white mb-1">
                {neighborhoodData.amenities.hospitals ?? '—'}
              </div>
              <div className="text-sm text-gray-400">Hospitals</div>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <div className="text-2xl font-bold text-white mb-1">
                {neighborhoodData.amenities.malls ?? '—'}
              </div>
              <div className="text-sm text-gray-400">Malls</div>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <div className="text-2xl font-bold text-white mb-1">
                {neighborhoodData.amenities.restaurants ?? '—'}
              </div>
              <div className="text-sm text-gray-400">Restaurants</div>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      {compareData && (
        <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-6">
          <h3 className="text-lg font-bold text-white mb-6">
            Comparison: {neighborhoodData.name} vs {compareData.name}
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Metric</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">{neighborhoodData.name}</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">{compareData.name}</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">
                    Difference
                    <InfoHint
                      text="How much higher or lower this area's figure is than the comparison area, as a percentage of the comparison area's figure. +10% means this area is a tenth higher."
                      label="Difference"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="py-3 px-4 text-white">
                    Median Asking Price
                    <InfoHint text={METRIC_HINTS.medianAskingPrice} label="Median asking price" />
                  </td>
                  <td className="py-3 px-4 text-right text-white">
                    {neighborhoodData.avgPrice != null ? Math.round(neighborhoodData.avgPrice).toLocaleString() : '—'}
                  </td>
                  <td className="py-3 px-4 text-right text-white">
                    {compareData.avgPrice != null ? Math.round(compareData.avgPrice).toLocaleString() : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-gray-300">
                    {neighborhoodData.avgPrice != null && compareData.avgPrice
                      ? `${neighborhoodData.avgPrice > compareData.avgPrice ? '+' : ''}${(((neighborhoodData.avgPrice - compareData.avgPrice) / compareData.avgPrice) * 100).toFixed(1)}%`
                      : '—'}
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-3 px-4 text-white">
                    Price Growth
                    <InfoHint text={METRIC_HINTS.saleGrowth} label="Price growth" />
                  </td>
                  <td className="py-3 px-4 text-right text-white">
                    {neighborhoodData.priceGrowth != null ? `${neighborhoodData.priceGrowth}%` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right text-white">
                    {compareData.priceGrowth != null ? `${compareData.priceGrowth}%` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-gray-300">—</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-3 px-4 text-white">
                    Rental Yield
                    <InfoHint text={METRIC_HINTS.rentalYield} label="Rental yield" />
                  </td>
                  <td className="py-3 px-4 text-right text-white">
                    {neighborhoodData.rentalYield != null ? `${neighborhoodData.rentalYield.toFixed(1)}%` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right text-white">
                    {compareData.rentalYield != null ? `${compareData.rentalYield.toFixed(1)}%` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-gray-300">
                    {neighborhoodData.rentalYield != null && compareData.rentalYield != null
                      ? `${neighborhoodData.rentalYield > compareData.rentalYield ? '+' : ''}${(neighborhoodData.rentalYield - compareData.rentalYield).toFixed(1)}%`
                      : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Comparable Neighborhoods */}
      <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-6">
        <h3 className="text-lg font-bold text-white mb-6">Comparable Neighborhoods</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {comparables?.map((neighborhood, index) => (
            <div 
              key={index}
              className="p-4 border border-white/10 rounded-lg hover:border-white/20 cursor-pointer transition-colors"
              onClick={() => setSelectedNeighborhood(neighborhood.slug)}
            >
              <div className="font-medium text-white mb-2">{neighborhood.name}</div>
              <div className="text-sm text-gray-400 mb-1">
                {neighborhood.avgPrice != null ? Math.round(neighborhood.avgPrice).toLocaleString() : '—'}
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-400">
                  {neighborhood.growth != null
                    ? `${neighborhood.growth > 0 ? '+' : ''}${neighborhood.growth}% growth`
                    : 'Growth not published'}
                </div>
                <div className="text-sm text-gray-400">
                  {neighborhood.yield != null ? `${neighborhood.yield.toFixed(1)}% yield` : '— yield'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
