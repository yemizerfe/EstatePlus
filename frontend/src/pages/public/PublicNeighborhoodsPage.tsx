import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  TrendingUp,
  MapPin,
  ArrowRight,
  Sparkles,
  Clock,
  Loader2,
  Building2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import Footer from '../../components/Footer';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchPublicNeighborhoods,
  formatAmount,
  metricNote,
  type Metric,
  type PublicNeighborhood,
} from '../../api/publicData';

/**
 * Neighborhood browser driven by `GET /api/v1/public/neighborhoods`.
 *
 * Only values the database can support are shown. A neighborhood with fewer
 * listings than the minimum sample size shows "Not enough data" plus the
 * sample count — never a placeholder price, growth rate or yield.
 */

function MetricCell({
  label,
  metric,
}: {
  label: string;
  metric: Metric;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-white">{formatAmount(metric.value)}</p>
      <p className="text-[11px] text-gray-500 mt-0.5">{metricNote(metric)}</p>
    </div>
  );
}

/** A figure is only rendered when the database holds the listings behind it. */
const reported = (metric: Metric) => metric.value !== null;

function NeighborhoodCard({ neighborhood }: { neighborhood: PublicNeighborhood }) {
  const saleListings = neighborhood.activeListings.sale;
  const rentListings = neighborhood.activeListings.rent;
  const saleMetrics = [
    { label: 'Median asking', metric: neighborhood.sale.medianAskingPrice },
    { label: 'Median per m²', metric: neighborhood.sale.medianPricePerSqm },
    { label: 'Median rent', metric: neighborhood.rent.medianMonthlyRent },
  ].filter((entry) => reported(entry.metric));

  return (
    <Link
      to={`/neighborhoods/${neighborhood.slug}`}
      className="group relative rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl overflow-hidden border border-white/10 hover:border-blue-500/50 transition-all duration-300"
    >
      <div className="relative h-44 overflow-hidden bg-slate-800">
        {neighborhood.imageUrl ? (
          <img
            src={neighborhood.imageUrl}
            alt={`Property in ${neighborhood.name}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
            <Building2 className="w-10 h-10 text-slate-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="text-2xl font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">
            {neighborhood.name}
          </h3>
          <div className="flex items-center gap-2 text-gray-300">
            <MapPin className="w-4 h-4" />
            <span className="text-sm">
              {neighborhood.subcity ? `${neighborhood.subcity} sub-city` : 'Addis Ababa'}
            </span>
            <span className="ml-auto rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white">
              {saleListings + rentListings} active
            </span>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-4 text-sm text-gray-400 mb-4 pb-4 border-b border-white/10">
          <span>
            <span className="font-semibold text-white">{saleListings}</span> for sale
          </span>
          <span>
            <span className="font-semibold text-white">{rentListings}</span> for rent
          </span>
          {neighborhood.population !== null && (
            <span className="ml-auto">{neighborhood.population.toLocaleString()} residents</span>
          )}
        </div>

        {saleMetrics.length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {saleMetrics.map((entry) => (
              <MetricCell key={entry.label} label={entry.label} metric={entry.metric} />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-blue-400">Explore area</span>
          <ArrowRight className="w-5 h-5 text-blue-400 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
}

const PublicNeighborhoodsPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const neighborhoodsQuery = useQuery({
    queryKey: ['public-neighborhoods'],
    queryFn: fetchPublicNeighborhoods,
    retry: 1,
  });

  const [onlyWithListings, setOnlyWithListings] = useState(false);

  const neighborhoods = neighborhoodsQuery.data ?? [];
  const activity = (n: PublicNeighborhood) => n.activeListings.sale + n.activeListings.rent;
  const withListings = neighborhoods.filter((n) => activity(n) > 0).length;
  // Every neighborhood and sub-city is listed; areas that hold listings sort
  // first. The City itself is never an area card.
  const filteredNeighborhoods = neighborhoods
    .filter((n) => n.slug !== 'addis-ababa')
    .filter((n) => !onlyWithListings || activity(n) > 0)
    .filter((n) =>
      [n.name, n.subcity, n.city]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(searchTerm.toLowerCase())),
    )
    .sort((a, b) => {
      if (activity(b) !== activity(a)) return activity(b) - activity(a);
      return a.name.localeCompare(b.name);
    });

  const lastUpdated = neighborhoodsQuery.dataUpdatedAt
    ? new Date(neighborhoodsQuery.dataUpdatedAt)
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,24,39,1),rgba(0,0,0,1))]" />
      <div className="fixed inset-0 opacity-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      <div className="fixed top-20 left-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-xl border border-blue-500/30 text-blue-300 px-6 py-2 rounded-full text-sm font-semibold mb-6">
            <Sparkles className="w-4 h-4" />
            Market Intelligence
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-6">
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Explore
            </span>{' '}
            <span className="text-white">Neighborhoods</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Median prices calculated from the active listings EstatePlus actually holds, with the
            sample size behind every figure.
          </p>
          <div className="flex items-center justify-center gap-2 mt-6 text-sm text-gray-400">
            <Clock className="w-4 h-4 text-blue-400" />
            {lastUpdated ? `Data loaded ${lastUpdated.toLocaleString()}` : 'Loading data…'}
          </div>
        </div>

        <div className="max-w-2xl mx-auto mb-12">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search neighborhoods…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {neighborhoods.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm text-gray-400">
              <span>
                {neighborhoods.length} areas · {withListings} with active listings
              </span>
              <button
                type="button"
                onClick={() => setOnlyWithListings((value) => !value)}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-medium text-gray-200 transition-colors hover:border-blue-400/50 hover:text-white"
              >
                {onlyWithListings ? 'Show every area' : 'Only areas with listings'}
              </button>
            </div>
          )}
        </div>

        {neighborhoodsQuery.isError && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center mb-12">
            <Loader2 className="w-8 h-8 text-blue-400 mx-auto mb-3 animate-spin" />
            <h3 className="text-xl font-bold mb-2">Reconnecting to the neighborhood feed</h3>
            <p className="text-gray-400 mb-5">The connection dropped while loading areas.</p>
            <button
              type="button"
              onClick={() => neighborhoodsQuery.refetch()}
              className="rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Retry now
            </button>
          </div>
        )}

        {neighborhoodsQuery.isLoading && (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-3" /> Loading neighborhoods…
          </div>
        )}

        {neighborhoodsQuery.data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {filteredNeighborhoods.map((neighborhood) => (
                <NeighborhoodCard key={neighborhood.id} neighborhood={neighborhood} />
              ))}
              {filteredNeighborhoods.length === 0 && (
                <p className="col-span-full py-10 text-center text-gray-400">
                  No neighborhood matches “{searchTerm}”.
                </p>
              )}
            </div>

            <p className="text-center text-sm text-gray-500 mb-12">
              Showing {filteredNeighborhoods.length} of {neighborhoods.length} Addis Ababa
              sub-cities and neighborhoods. Each card carries the number of active listings recorded
              in that area.
            </p>
          </>
        )}

        {neighborhoodsQuery.data === undefined && (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-3" /> Loading neighborhoods…
          </div>
        )}

        <div className="relative p-12 rounded-3xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-cyan-500/20 backdrop-blur-xl border border-white/20 text-center">
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              Get Neighborhood Alerts
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              {isAuthenticated
                ? 'Receive notifications about market changes in your preferred neighborhoods'
                : 'Sign up to receive notifications about market changes in your preferred neighborhoods'}
            </p>
            {isAuthenticated ? (
              <Link
                to="/app/notifications"
                className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 rounded-2xl font-bold text-white text-lg hover:scale-105 transition-all"
              >
                Open notifications
                <TrendingUp className="w-6 h-6" />
              </Link>
            ) : (
              <Link
                to="/register"
                className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 rounded-2xl font-bold text-white text-lg hover:scale-105 transition-all"
              >
                Create Free Account
                <ArrowRight className="w-6 h-6" />
              </Link>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default PublicNeighborhoodsPage;