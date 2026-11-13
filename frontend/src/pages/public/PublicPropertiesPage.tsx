import React, { useMemo, useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  MapPin,
  Bed,
  Bath,
  Square,
  X,
  ArrowRight,
  Sparkles,
  Clock,
  Building2,
  Loader2,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import Footer from '../../components/Footer';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchPublicListings,
  fetchPublicNeighborhoods,
  formatDate,
  propertyTypeLabel,
  type PublicListingsQuery,
} from '../../api/publicData';

/**
 * Public property browser.
 *
 * Data comes from `GET /api/v1/public/listings` — active listings on approved
 * properties. There is no static sample data here: when the database holds
 * nothing, the page says so.
 */

const PROPERTY_TYPE_OPTIONS = [
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'CONDOMINIUM', label: 'Condominium' },
  { value: 'OFFICE', label: 'Office' },
  { value: 'RETAIL', label: 'Retail' },
  { value: 'WAREHOUSE', label: 'Warehouse' },
  { value: 'LAND', label: 'Land' },
];

const MAX_RESULTS = 60;

const PublicPropertiesPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  // Deep links from an area or property type start on that filter.
  const [filters, setFilters] = useState({
    propertyType: searchParams.get('propertyType') ?? '',
    neighborhood: searchParams.get('neighborhood') ?? '',
    listingType: (searchParams.get('listingType') ?? '') as '' | 'sale' | 'rent',
    minPrice: searchParams.get('minPrice') ?? '',
    maxPrice: searchParams.get('maxPrice') ?? '',
    bedrooms: searchParams.get('bedrooms') ?? '',
  });

  const query: PublicListingsQuery = useMemo(
    () => ({
      limit: MAX_RESULTS,
      ...(filters.propertyType ? { propertyType: filters.propertyType } : {}),
      ...(filters.neighborhood ? { neighborhood: filters.neighborhood } : {}),
      ...(filters.listingType ? { listingType: filters.listingType } : {}),
      ...(filters.minPrice ? { minPrice: Number(filters.minPrice) } : {}),
      ...(filters.maxPrice ? { maxPrice: Number(filters.maxPrice) } : {}),
      ...(filters.bedrooms ? { minBedrooms: Number(filters.bedrooms) } : {}),
    }),
    [filters],
  );

  const listingsQuery = useQuery({
    queryKey: ['public-listings', query],
    queryFn: () => fetchPublicListings(query),
    retry: 1,
  });

  const neighborhoodsQuery = useQuery({
    queryKey: ['public-neighborhoods'],
    queryFn: fetchPublicNeighborhoods,
    retry: 1,
  });

  const listings = listingsQuery.data?.listings ?? [];
  const total = listingsQuery.data?.total ?? 0;

  const visibleListings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return listings;
    return listings.filter((listing) =>
      [listing.title, listing.neighborhood, listing.address, listing.propertyType]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term)),
    );
  }, [listings, searchTerm]);

  const lastUpdated = useMemo(() => {
    if (listings.length === 0) return null;
    return listings.reduce((latest, listing) =>
      new Date(listing.updatedAt) > new Date(latest.updatedAt) ? listing : latest,
    ).updatedAt;
  }, [listings]);

  const hasActiveFilters =
    filters.propertyType !== '' ||
    filters.neighborhood !== '' ||
    filters.listingType !== '' ||
    filters.minPrice !== '' ||
    filters.maxPrice !== '' ||
    filters.bedrooms !== '';

  const clearFilters = () => {
    setFilters({
      propertyType: '',
      neighborhood: '',
      listingType: '',
      minPrice: '',
      maxPrice: '',
      bedrooms: '',
    });
    setSearchTerm('');
  };

  const hasNoDataAtAll = !listingsQuery.isLoading && !listingsQuery.isError && total === 0 && !hasActiveFilters && !searchTerm;

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
            Property Listings
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-6">
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Browse
            </span>{' '}
            <span className="text-white">Properties</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Active listings published by verified owners on EstatePlus.
          </p>
          <div className="flex items-center justify-center gap-2 mt-6 text-sm text-gray-400">
            <Clock className="w-4 h-4 text-blue-400" />
            {listingsQuery.isLoading
              ? 'Loading listings…'
              : lastUpdated
                ? `Latest listing update: ${formatDate(lastUpdated)}`
                : 'No listing updates recorded yet'}
          </div>
        </div>

        {/* Search */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search within the loaded listings by title, address or neighborhood..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="relative rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-6 mb-8 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-blue-400" />
              Filters
            </h3>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </button>
              )}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <SlidersHorizontal className="w-5 h-5" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
              <select
                value={filters.propertyType}
                onChange={(e) => setFilters({ ...filters, propertyType: e.target.value })}
                className="px-4 py-2 bg-slate-800/50 border border-white/20 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                {PROPERTY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={filters.neighborhood}
                onChange={(e) => setFilters({ ...filters, neighborhood: e.target.value })}
                className="px-4 py-2 bg-slate-800/50 border border-white/20 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Neighborhoods</option>
                {(neighborhoodsQuery.data ?? []).map((neighborhood) => (
                  <option key={neighborhood.id} value={neighborhood.slug}>
                    {neighborhood.name}
                  </option>
                ))}
              </select>

              <select
                value={filters.listingType}
                onChange={(e) =>
                  setFilters({ ...filters, listingType: e.target.value as '' | 'sale' | 'rent' })
                }
                className="px-4 py-2 bg-slate-800/50 border border-white/20 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sale or Rent</option>
                <option value="sale">For Sale</option>
                <option value="rent">For Rent</option>
              </select>

              <input
                type="number"
                min={0}
                placeholder="Min price"
                value={filters.minPrice}
                onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                className="px-4 py-2 bg-slate-800/50 border border-white/20 text-white placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <input
                type="number"
                min={0}
                placeholder="Max price"
                value={filters.maxPrice}
                onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                className="px-4 py-2 bg-slate-800/50 border border-white/20 text-white placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <select
                value={filters.bedrooms}
                onChange={(e) => setFilters({ ...filters, bedrooms: e.target.value })}
                className="px-4 py-2 bg-slate-800/50 border border-white/20 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Any Bedrooms</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}+ Bedrooms
                  </option>
                ))}
              </select>

              <div className="px-4 py-2 text-xs text-gray-500 self-center">
                Price filter applies to the listing type you select.
              </div>
            </div>
          )}
        </div>

        {/* Result count */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <p className="text-gray-400 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-blue-400" />
            {listingsQuery.isLoading ? (
              'Loading…'
            ) : listingsQuery.isError ? (
              'Could not load listings'
            ) : (
              <>
                Showing <span className="font-semibold text-white">{visibleListings.length}</span> of{' '}
                <span className="font-semibold text-white">{total}</span>{' '}
                {total === 1 ? 'active listing' : 'active listings'}
                {total > MAX_RESULTS && ` (first ${MAX_RESULTS})`}
              </>
            )}
          </p>
        </div>

        {listingsQuery.isError && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center mb-12">
            <Loader2 className="w-8 h-8 text-blue-400 mx-auto mb-3 animate-spin" />
            <h3 className="text-xl font-bold mb-2">Reconnecting to the listing feed</h3>
            <p className="text-gray-400 mb-5">The connection dropped while loading listings.</p>
            <button
              type="button"
              onClick={() => listingsQuery.refetch()}
              className="rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Retry now
            </button>
          </div>
        )}

        {listingsQuery.isLoading && (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-3" />
            Loading listings from the database…
          </div>
        )}

        {!listingsQuery.isLoading && !listingsQuery.isError && visibleListings.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {visibleListings.map((listing) => (
              <Link
                key={listing.listingId}
                to={`/properties/${listing.propertyId}`}
                className="group rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl overflow-hidden border border-white/10 hover:border-blue-500/50 transition-all duration-300"
              >
                <div className="relative h-48 overflow-hidden bg-slate-800/60">
                  {listing.imageUrl ? (
                    <img
                      src={listing.imageUrl}
                      alt={listing.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
                      <Building2 className="w-10 h-10 mb-2" />
                      <span className="text-xs">No image provided</span>
                    </div>
                  )}
                  <div className="absolute top-3 right-3 px-3 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold rounded-full">
                    {propertyTypeLabel(listing.propertyType)}
                  </div>
                  <div className="absolute top-3 left-3 px-3 py-1 bg-slate-900/80 text-white text-xs font-semibold rounded-full">
                    {listing.listingType === 'rent'
                      ? 'For Rent'
                      : listing.listingType === 'both'
                        ? 'Sale / Rent'
                        : 'For Sale'}
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                    {listing.title}
                  </h3>

                  <div className="flex items-center gap-2 text-gray-400 mb-4">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">
                      {[listing.neighborhood, listing.address].filter(Boolean).join(' · ') ||
                        'Location not provided'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-400 mb-4 pb-4 border-b border-white/10">
                    <div className="flex items-center gap-1">
                      <Square className="w-4 h-4" />
                      <span>{listing.sizeSqm !== null ? `${listing.sizeSqm} m²` : 'Size n/a'}</span>
                    </div>
                    {listing.bedrooms > 0 && (
                      <div className="flex items-center gap-1">
                        <Bed className="w-4 h-4" />
                        <span>{listing.bedrooms} Beds</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Bath className="w-4 h-4" />
                      <span>{listing.bathrooms} Baths</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">
                        {listing.listingType === 'rent' ? 'Monthly rent' : 'Asking price'}
                      </p>
                      <p className="text-2xl font-bold text-white">
                        ETB{' '}
                        {(listing.listingType === 'rent' ? listing.monthlyRent : listing.price)?.toLocaleString() ??
                          '—'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {listing.listingType === 'rent' ? 'per month' : 'asking price'}
                      </p>
                    </div>
                    <div className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg text-sm group-hover:scale-105 transition-all">
                      View Details →
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!listingsQuery.isLoading && !listingsQuery.isError && visibleListings.length === 0 && (
          <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 p-16 text-center mb-12">
            <div className="text-6xl mb-4">{hasNoDataAtAll ? '📊' : '🏠'}</div>
            <h3 className="text-xl font-bold text-white mb-2">
              {hasNoDataAtAll ? 'No published listings yet' : 'No listings match these filters'}
            </h3>
            <p className="text-gray-400 mb-6 max-w-xl mx-auto">
              {hasNoDataAtAll
                ? 'EstatePlus only shows listings that owners have actually published and that have been approved. Nothing external has been imported yet, so this space is intentionally empty rather than filled with sample properties.'
                : 'Widen the price range, choose another neighborhood, or clear the filters.'}
            </p>
            {hasNoDataAtAll ? (
              <Link
                to="/explore"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                See market coverage
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <button
                onClick={clearFilters}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Clear All Filters
              </button>
            )}
          </div>
        )}

        <div className="relative p-12 rounded-3xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-cyan-500/20 backdrop-blur-xl border border-white/20 text-center mt-12">
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              {isAuthenticated
                ? 'Save your favourite properties'
                : 'Sign up to save your favourite properties'}
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Get alerts when new properties match your criteria
            </p>
            {isAuthenticated ? (
              <Link
                to="/app/saved-properties"
                className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 rounded-2xl font-bold text-white text-lg hover:scale-105 transition-all"
              >
                Open saved properties
                <ArrowRight className="w-6 h-6" />
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

export default PublicPropertiesPage;
