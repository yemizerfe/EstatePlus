import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin,
  Search,
  Download
} from 'lucide-react';
import { InfoHint, PageHero } from '../../components/ui/kit-core';
import { METRIC_HINTS } from '../../lib/metricHints';
import { TableSkeleton } from '../../components/ui/kit-blocks';

// Live data: neighbourhood medians come from the public API, computed from
// stored Addis Ababa listings. A metric whose `scope` is `city` is backed by the
// citywide sample because the area recorded no listings of its own, so the card
// shows it as citywide instead of presenting it as a local figure.
import {
  fetchPublicNeighborhoods,
  formatCompact,
  formatPct,
  type Metric,
} from '../../api/publicData';
import { downloadCsv } from '../../lib/csv';

interface NeighborhoodRow {
  id: string;
  name: string;
  slug: string;
  city: string;
  subcity: string | null;
  medianPrice: Metric;
  medianRent: Metric;
  listingCount: number;
  saleListings: number;
  rentListings: number;
  priceGrowth: number | null;
  rentGrowth: number | null;
}

const getNeighborhoods = async (): Promise<{ neighborhoods: NeighborhoodRow[] }> => {
  const neighborhoods = await fetchPublicNeighborhoods();
  return {
    neighborhoods: neighborhoods
      .map((neighborhood) => ({
        id: neighborhood.id,
        name: neighborhood.name,
        slug: neighborhood.slug,
        city: neighborhood.city,
        subcity: neighborhood.subcity,
        medianPrice: neighborhood.sale.medianAskingPrice,
        medianRent: neighborhood.rent.medianMonthlyRent,
        listingCount: neighborhood.activeListings.sale + neighborhood.activeListings.rent,
        saleListings: neighborhood.activeListings.sale,
        rentListings: neighborhood.activeListings.rent,
        priceGrowth: neighborhood.growth?.pricePct ?? null,
        rentGrowth: neighborhood.growth?.rentPct ?? null,
      }))
      .sort((a, b) => b.listingCount - a.listingCount || a.name.localeCompare(b.name)),
  };
};

/** `—` for an empty sample, otherwise the compact amount plus its basis. */
const metricLabel = (metric: Metric): string => {
  if (metric.value === null) return '—';
  return formatCompact(metric.value);
};

const metricScopeLabel = (metric: Metric): string => {
  if (metric.value === null) return 'No listings recorded';
  if (metric.scope === 'city') return `Citywide · n=${metric.sampleSize}`;
  return `Local · n=${metric.localSampleSize ?? metric.sampleSize}`;
};

export default function AnalystNeighborhoodsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCity, setFilterCity] = useState('all');
  const navigate = useNavigate();

  const { data: neighborhoodsData, isLoading } = useQuery({
    queryKey: ['analyst-neighborhoods'],
    queryFn: getNeighborhoods
  });

  const filteredNeighborhoods = neighborhoodsData?.neighborhoods.filter(n => {
    const matchesSearch = n.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCity = filterCity === 'all' || n.city.toLowerCase().includes(filterCity.toLowerCase());
    return matchesSearch && matchesCity;
  });

  const openNeighborhood = (slug: string) => {
    navigate(`/app/analyst-neighborhoods/${encodeURIComponent(slug)}`);
  };

  const handleExport = () => {
    downloadCsv(
      `neighborhoods-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Neighborhood', 'Sub-city', 'City', 'Sale listings', 'Rent listings', 'Median sale price (ETB)', 'Sale basis', 'Median rent (ETB)', 'Rent basis', 'Sale growth (%)'],
      (filteredNeighborhoods ?? []).map((n) => [
        n.name,
        n.subcity ?? '',
        n.city,
        n.saleListings,
        n.rentListings,
        n.medianPrice.value ?? '',
        metricScopeLabel(n.medianPrice),
        n.medianRent.value ?? '',
        metricScopeLabel(n.medianRent),
        n.priceGrowth ?? '',
      ]),
    );
  };

  if (isLoading) return <TableSkeleton />;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <PageHero
        icon={MapPin}
        title="Neighborhood Analysis"
        description="Explore and analyze neighborhood market data"
        accent="sky"
        actions={
          <div className="flex items-center gap-4">
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="px-4 py-2 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 rounded-xl text-sky-400 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            >
              <option value="all">All Cities</option>
              <option value="addis-ababa">Addis Ababa</option>
            </select>
            <button
              onClick={handleExport}
              disabled={!filteredNeighborhoods?.length}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 rounded-xl text-sky-400 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        }
      />

      <div className="p-6">
        {/* Search */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search neighborhoods..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Neighborhoods Grid */}
        <p className="-mt-2 mb-3 text-xs text-gray-500">
          Each card reports the median asking price, median rent, active listings and month-on-month
          sale growth for that area. Hover the ⓘ in the table header below for a plain-language
          explanation of each figure.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNeighborhoods?.map((neighborhood) => (
            <div
              key={neighborhood.id}
              role="button"
              tabIndex={0}
              onClick={() => openNeighborhood(neighborhood.slug)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openNeighborhood(neighborhood.slug);
                }
              }}
              className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 cursor-pointer hover:border-sky-500/50 transition-all hover:shadow-lg hover:shadow-sky-500/10"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">{neighborhood.name}</h3>
                  <p className="text-sm text-gray-400">{neighborhood.subcity ?? neighborhood.city}</p>
                </div>
                <MapPin className="w-5 h-5 text-sky-400" />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-slate-800/50 rounded-xl">
                  <div className="text-gray-400 text-sm mb-1">Median Price</div>
                  <div className="text-lg font-bold text-white">{metricLabel(neighborhood.medianPrice)}</div>
                  <div className="text-xs text-gray-500 mt-1">{metricScopeLabel(neighborhood.medianPrice)}</div>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-xl">
                  <div className="text-gray-400 text-sm mb-1">Median Rent</div>
                  <div className="text-lg font-bold text-white">{metricLabel(neighborhood.medianRent)}</div>
                  <div className="text-xs text-gray-500 mt-1">{metricScopeLabel(neighborhood.medianRent)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-800/50 rounded-xl">
                  <div className="text-gray-400 text-sm mb-1">Listings</div>
                  <div className="text-lg font-bold text-white">{neighborhood.listingCount}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {neighborhood.saleListings} sale · {neighborhood.rentListings} rent
                  </div>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-xl">
                  <div className="text-gray-400 text-sm mb-1">Sale growth</div>
                  <div
                    className={`text-lg font-bold ${
                      neighborhood.priceGrowth == null
                        ? 'text-gray-400'
                        : neighborhood.priceGrowth >= 0
                          ? 'text-green-400'
                          : 'text-red-400'
                    }`}
                  >
                    {formatPct(neighborhood.priceGrowth)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">vs previous month</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredNeighborhoods?.length === 0 && (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
            <MapPin className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No Neighborhoods Found</h3>
            <p className="text-gray-400">Try adjusting your search or filters</p>
          </div>
        )}

        {/* Neighborhood List Table */}
        <div className="mt-8 bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-6">All Neighborhoods</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-gray-300">Neighborhood</th>
                  <th className="text-left py-3 px-4 text-gray-300">City</th>
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
                    Sale growth
                    <InfoHint text={METRIC_HINTS.saleGrowth} label="Sale growth" />
                  </th>
                  <th className="text-center py-3 px-4 text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredNeighborhoods?.map((neighborhood) => (
                  <tr key={neighborhood.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4 font-medium text-white">{neighborhood.name}</td>
                    <td className="py-3 px-4 text-gray-300">{neighborhood.city}</td>
                    <td className="py-3 px-4 text-right text-white">
                      {metricLabel(neighborhood.medianPrice)}
                      <div className="text-xs text-gray-500">{metricScopeLabel(neighborhood.medianPrice)}</div>
                    </td>
                    <td className="py-3 px-4 text-right text-white">
                      {metricLabel(neighborhood.medianRent)}
                      <div className="text-xs text-gray-500">{metricScopeLabel(neighborhood.medianRent)}</div>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-300">{neighborhood.listingCount}</td>
                    <td
                      className={`py-3 px-4 text-right font-medium ${
                        neighborhood.priceGrowth == null
                          ? 'text-gray-400'
                          : neighborhood.priceGrowth >= 0
                            ? 'text-green-400'
                            : 'text-red-400'
                      }`}
                    >
                      {formatPct(neighborhood.priceGrowth)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => openNeighborhood(neighborhood.slug)}
                        className="px-4 py-2 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 rounded-lg text-sky-400 text-sm transition-colors"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
