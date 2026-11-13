import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHero } from '../../components/ui/kit-core';
import {
  Search,
  MapPin, 
  Bed, 
  Bath, 
  Square, 
  Heart,
  TrendingUp,
  Star,
  Grid3x3,
  List,
  SlidersHorizontal,
  Scale,
  Check
} from 'lucide-react';
import { useProperties } from '../../hooks/useProperties';
import { getNeighborhoods } from '../../api/market';
import type { Property, PropertySearchQuery } from '../../types';
import { fetchBinaListings, fetchBinaStats } from '../../api/publicData';
import {
  fetchSavedProperties,
  createSavedProperty,
  deleteSavedProperty,
  SavePropertyPayload,
} from '../../api/savedProperties';
import { addToCompare, CompareProperty } from '../../lib/compare';
import { propertyGallery } from '../../lib/propertyImages';

/** Card-level view of a property, derived from the API payload. */
interface ExplorerProperty {
  id: string;
  title: string;
  images: string[];
  featured: boolean;
  status: 'for_sale' | 'for_rent';
  rating: number | null;
  priceGrowth: number | null;
  neighborhood: string;
  location: string;
  price: number;
  pricePerSqm: number;
  area: number;
  bedrooms: number;
  bathrooms: number;
}

/** Raw filter values as typed in the UI (all strings until submitted). */
interface ExplorerFilters {
  neighborhood: string;
  propertyType: string;
  status: string;
  bedrooms: string;
  minPrice: string;
  maxPrice: string;
  minArea: string;
  featured: boolean;
}

const EMPTY_FILTERS: ExplorerFilters = {
  neighborhood: '',
  propertyType: '',
  status: '',
  bedrooms: '',
  minPrice: '',
  maxPrice: '',
  minArea: '',
  featured: false,
};

function imageUrls(property: Property): string[] {
  const raw = (property as Property & {
    images?: Array<{ imageUrl?: string } | string>;
  }).images;
  const recorded = (Array.isArray(raw) ? raw : [])
    .map((image) => (typeof image === 'string' ? image : image.imageUrl ?? ''))
    .filter((url) => url.length > 0)
    .map((imageUrl) => ({ imageUrl }));
  // Feed artwork and missing photos are replaced by a photo of the advertised
  // home type (an interior matched to the bedroom count), never a banner or a
  // blank placeholder.
  return propertyGallery(
    {
      id: property.id,
      propertyType: property.propertyType,
      bedrooms: property.bedrooms,
      title: property.title,
    },
    recorded,
  ).map((image) => image.imageUrl);
}

/** Map an API property onto the card shape the explorer UI renders. */
function toExplorerProperty(property: Property): ExplorerProperty {
  const asking = Number(property.askingPrice) || 0;
  const rent = Number(property.rentalPrice) || 0;
  const price = asking || rent;
  const area = Number(property.sizeSqm) || 0;
  return {
    id: property.id,
    title: property.title,
    images: imageUrls(property),
    featured: false,
    status: asking > 0 ? 'for_sale' : 'for_rent',
    rating: null,
    priceGrowth: null,
    neighborhood: property.neighborhood?.name ?? 'Addis Ababa',
    location: property.address ?? property.neighborhood?.name ?? 'Addis Ababa',
    price,
    pricePerSqm: area > 0 ? Math.round(price / area) : 0,
    area,
    bedrooms: Number(property.bedrooms) || 0,
    bathrooms: Number(property.bathrooms) || 0,
  };
}

export default function PropertyExplorerPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  
  // Filters state
  const [filters, setFilters] = useState<ExplorerFilters>({ ...EMPTY_FILTERS });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inSelectMode = searchParams.get('mode') === 'compare';
  const queryClient = useQueryClient();

  // Only send parameters the backend validates; empty UI values are omitted.
  const apiQuery: PropertySearchQuery = {
    page,
    limit: 20,
    ...(filters.neighborhood ? { neighborhoodId: filters.neighborhood } : {}),
    ...(filters.propertyType ? { propertyType: filters.propertyType as PropertySearchQuery['propertyType'] } : {}),
    ...(filters.bedrooms ? { bedrooms: Number(filters.bedrooms) } : {}),
    ...(filters.minPrice ? { minPrice: Number(filters.minPrice) } : {}),
    ...(filters.maxPrice ? { maxPrice: Number(filters.maxPrice) } : {}),
    ...(filters.minArea ? { minSize: Number(filters.minArea) } : {}),
    ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
  };

  // Use the real API with React Query hooks
  const { data, isLoading } = useProperties(apiQuery);

  // Real neighborhoods for the location filter.
  const { data: neighborhoodOptions } = useQuery({
    queryKey: ['neighborhoods'],
    queryFn: () => getNeighborhoods(),
  });

  const cards: ExplorerProperty[] = (data?.properties ?? []).map(toExplorerProperty).filter((p) => {
    if (filters.status === 'for_sale' && p.status !== 'for_sale') return false;
    if (filters.status === 'for_rent' && p.status !== 'for_rent') return false;
    return true;
  });

  // Saved properties — drives the filled-heart state and toggle behaviour.
  const { data: savedProperties } = useQuery({
    queryKey: ['saved-properties'],
    queryFn: fetchSavedProperties,
  });
  const savedIds = new Set((savedProperties ?? []).map((s) => s.propertyId));

  // BinaSmart integrated listings & medians (pulled from the integrated source).
  const { data: binaListings, isLoading: binaLoading } = useQuery({
    queryKey: ['bina-listings'],
    queryFn: fetchBinaListings,
    enabled: true,
  });
  const { data: binaStats } = useQuery({
    queryKey: ['bina-stats'],
    queryFn: fetchBinaStats,
    enabled: true,
  });

  const savePropertyMutation = useMutation({
    mutationFn: (payload: SavePropertyPayload) => createSavedProperty(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-properties'] }),
  });

  const unsavePropertyMutation = useMutation({
    mutationFn: (propertyId: string) => deleteSavedProperty(propertyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-properties'] }),
  });

  const handleFilterChange = (key: keyof ExplorerFilters, value: string | boolean) => {
    setFilters(prev => ({ 
      ...prev, 
      [key]: value,
    }));
    setPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setFilters({ ...EMPTY_FILTERS });
    setSearchQuery('');
    setPage(1);
  };

  const toggleFavorite = (property: ExplorerProperty) => {
    if (savedIds.has(property.id)) {
      unsavePropertyMutation.mutate(property.id);
    } else {
      savePropertyMutation.mutate({
        propertyId: property.id,
        title: property.title,
        neighborhood: property.neighborhood,
        image: property.images[0] ?? '',
        price: property.price,
        size: property.area,
        beds: property.bedrooms,
        baths: property.bathrooms,
      });
    }
  };

  const toCompareProperty = (property: ExplorerProperty): CompareProperty => ({
    id: property.id,
    title: property.title,
    location: property.location,
    neighborhood: property.neighborhood,
    price: property.price,
    pricePerSqm: property.pricePerSqm,
    size: property.area,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    rentalYield: 0,
    marketValue: property.price,
    image: property.images[0] ?? '',
  });

  const handleCompare = (property: ExplorerProperty) => {
    addToCompare(toCompareProperty(property));
    navigate('/app/compare');
  };

  const totalPages = Math.max(1, data?.meta?.totalPages ?? 1);

  /** Move to another results page and bring the list back into view. */
  const changePage = (nextPage: number) => {
    const clamped = Math.min(Math.max(1, nextPage), totalPages);
    if (clamped === page) return;
    setPage(clamped);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** Up to five page buttons centred on the current page. */
  const visiblePages = (() => {
    const count = Math.min(5, totalPages);
    const start = Math.min(Math.max(1, page - 2), Math.max(1, totalPages - count + 1));
    return Array.from({ length: count }, (_, index) => start + index);
  })();

  const formatPrice = (price: number, status: string) => {
    const formatted = price.toLocaleString();
    return status === 'for_rent' ? `${formatted}/month` : formatted;
  };

  return (
    <div className="space-y-6">
      {/* Page Hero */}
      <PageHero
        icon={Search}
        title="Property Explorer"
        description={`${data?.meta?.total ?? 0} properties available across Addis Ababa.`}
        accent="indigo"
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-2 border border-white/20 rounded-lg hover:bg-white/5"
            >
              {viewMode === 'grid' ? <List className="w-5 h-5" /> : <Grid3x3 className="w-5 h-5" />}
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </button>
          </div>
        }
      />

      {/* Selection mode banner (reached from the compare page's "Add property" plus sign) */}
      {inSelectMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <Scale className="w-5 h-5 text-indigo-600" />
            <p className="text-sm font-medium text-indigo-900">
              Choose a property to compare — each card has a “Compare” button.
            </p>
          </div>
          <Link
            to="/app/compare"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Check className="w-4 h-4" />
            View Compare
          </Link>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
        <input
          type="text"
          placeholder="Search by neighborhood, property type, or features..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-slate-900/50 backdrop-blur-xl border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white">Filters</h3>
            <button
              onClick={clearFilters}
              className="text-gray-400 hover:text-white text-sm"
            >
              Clear All
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Neighborhood</label>
              <select
                value={filters.neighborhood}
                onChange={(e) => handleFilterChange('neighborhood', e.target.value)}
                className="w-full px-3 py-2 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Neighborhoods</option>
                {(neighborhoodOptions ?? []).map((n: { id: string; name: string }) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Property Type</label>
              <select
                value={filters.propertyType}
                onChange={(e) => handleFilterChange('propertyType', e.target.value)}
                className="w-full px-3 py-2 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="APARTMENT">Apartment</option>
                <option value="VILLA">Villa</option>
                <option value="CONDOMINIUM">Condominium</option>
                <option value="OFFICE">Office</option>
                <option value="RETAIL">Retail</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">For Sale & Rent</option>
                <option value="for_sale">For Sale</option>
                <option value="for_rent">For Rent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Bedrooms</label>
              <select
                value={filters.bedrooms}
                onChange={(e) => handleFilterChange('bedrooms', e.target.value)}
                className="w-full px-3 py-2 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Any</option>
                <option value="1">1+</option>
                <option value="2">2+</option>
                <option value="3">3+</option>
                <option value="4">4+</option>
                <option value="5">5+</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Min Price (ETB)</label>
              <input
                type="number"
                placeholder="Min price"
                value={filters.minPrice}
                onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                className="w-full px-3 py-2 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Max Price (ETB)</label>
              <input
                type="number"
                placeholder="Max price"
                value={filters.maxPrice}
                onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                className="w-full px-3 py-2 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Min Area (sqm)</label>
              <input
                type="number"
                placeholder="Min area"
                value={filters.minArea}
                onChange={(e) => handleFilterChange('minArea', e.target.value)}
                className="w-full px-3 py-2 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.featured}
                  onChange={(e) => handleFilterChange('featured', e.target.checked)}
                  className="w-4 h-4 text-white border-white/20 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-300">Featured Only</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* BinaSmart integrated market medians */}
      {binaStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="rounded-2xl bg-slate-900/50 backdrop-blur-xl p-6 border border-white/10">
            <div className="text-sm text-gray-400 uppercase tracking-wider mb-2">Median Asking Price</div>
            <div className="text-2xl font-bold text-white">
              {binaStats.medianAskingPrice.value !== null ? `ETB ${binaStats.medianAskingPrice.value.toLocaleString()}` : '—'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Median of {binaStats.medianAskingPrice.sampleSize} sale records
            </div>
          </div>
          <div className="rounded-2xl bg-slate-900/50 backdrop-blur-xl p-6 border border-white/10">
            <div className="text-sm text-gray-400 uppercase tracking-wider mb-2">Median Monthly Rent</div>
            <div className="text-2xl font-bold text-white">
              {binaStats.medianMonthlyRent.value !== null ? `ETB ${binaStats.medianMonthlyRent.value.toLocaleString()}` : '—'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Median of {binaStats.medianMonthlyRent.sampleSize} rent records
            </div>
          </div>
          <div className="rounded-2xl bg-slate-900/50 backdrop-blur-xl p-6 border border-white/10">
            <div className="text-sm text-gray-400 uppercase tracking-wider mb-2">Median Price per Sqm</div>
            <div className="text-2xl font-bold text-white">
              {binaStats.medianPricePerSqm.value !== null ? `ETB ${binaStats.medianPricePerSqm.value.toLocaleString()}` : '—'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Median of {binaStats.medianPricePerSqm.sampleSize} records
            </div>
          </div>
        </div>
      )}
      {/* BinaSmart integrated listings */}
      {binaLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
      ) : binaListings && binaListings.listings.length > 0 ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">BinaSmart Integrated Listings</h3>
            <p className="text-sm text-gray-400">
              {binaListings.resultCount} records fetched from BinaSmart · {binaListings.note}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {binaListings.listings.map((l) => (
              <div key={l.sourceKey} className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-medium text-gray-300 mb-1">{l.title ?? 'Untitled'}</div>
                <div className="text-xs text-gray-500 mb-3">{l.neighborhood ?? 'Location not reported'} · {l.propertyType ?? 'Property type not reported'}</div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-lg font-bold text-white">
                    {l.priceAmount != null && l.currency
                      ? `${l.currency} ${l.priceAmount.toLocaleString()}`
                      : l.priceOriginal ?? 'Price or currency unclear'}
                  </div>
                  <span className="text-xs text-gray-400">{l.priceBasis ?? l.pricePeriod ?? 'Basis unclear'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                  <div>{l.size != null ? l.size.toLocaleString() + ' sqm' : 'sqm —'}</div>
                  <div>{l.beds != null ? `${l.beds} bd` : 'bd —'}</div>
                </div>
                {l.link && (
                  <a href={l.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline mt-3">
                    View on BinaSmart
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      ) : null}
      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
      ) : (
        <>
          {/* Property Grid/List */}
          <div className={
            viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              : 'space-y-4'
          }>
            {cards.map((property) => (
              <div key={property.id} className={`bg-slate-900/50 backdrop-blur-xl rounded-2xl/60 overflow-hidden hover:shadow-lg transition-all ${
                viewMode === 'list' ? 'flex' : ''
              }`}>
                {/* Image */}
                <div className={`relative ${viewMode === 'list' ? 'w-80 flex-shrink-0' : 'aspect-[4/3]'}`}>
                  <img
                    src={property.images[0]}
                    alt={property.title}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex gap-2">
                    {property.featured && (
                      <span className="px-2 py-1 bg-slate-900 text-white text-xs font-medium rounded-md">
                        Featured
                      </span>
                    )}
                    <span className={`px-2 py-1 text-xs font-medium rounded-md ${
                      property.status === 'for_sale' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {property.status === 'for_sale' ? 'For Sale' : 'For Rent'}
                    </span>
                  </div>

                  {/* Favorite Button */}
                  <button
                    onClick={() => toggleFavorite(property)}
                    className="absolute top-3 right-3 p-2 bg-white/90 rounded-full hover:bg-slate-900/50 backdrop-blur-xl transition-colors"
                    title={savedIds.has(property.id) ? 'Remove from saved' : 'Save property'}
                  >
                    <Heart className={`w-4 h-4 ${
                      savedIds.has(property.id) ? 'text-red-500 fill-current' : 'text-gray-400'
                    }`} />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">{property.title}</h3>
                      <div className="flex items-center gap-2 text-gray-400">
                        <MapPin className="w-4 h-4" />
                        <span className="text-sm">{property.neighborhood}</span>
                        {property.rating && (
                          <>
                            <span className="text-gray-500">•</span>
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 text-yellow-400 fill-current" />
                              <span className="text-sm">{property.rating}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {property.priceGrowth && (
                      <div className="flex items-center gap-1 text-sm text-green-600">
                        <TrendingUp className="w-4 h-4" />
                        {property.priceGrowth}%
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mb-4 text-sm text-gray-400">
                    {property.bedrooms > 0 && (
                      <div className="flex items-center gap-1">
                        <Bed className="w-4 h-4" />
                        {property.bedrooms} bed
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Bath className="w-4 h-4" />
                      {property.bathrooms} bath
                    </div>
                    <div className="flex items-center gap-1">
                      <Square className="w-4 h-4" />
                      {property.area} sqm
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-white">
                        {formatPrice(property.price, property.status)}
                      </div>
                      <div className="text-sm text-gray-400">
                        ETB {property.pricePerSqm.toLocaleString()}/sqm
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCompare(property)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 border border-white/20 text-gray-300 rounded-lg hover:bg-white/5 transition-colors"
                        title="Add to compare"
                      >
                        <Scale className="w-4 h-4" />
                        Compare
                      </button>
                      <Link
                        to={`/app/properties/${property.id}`}
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination — driven by the API's own page metadata */}
          {(data?.meta?.totalPages ?? 1) > 1 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => changePage(page - 1)}
                disabled={page <= 1}
                className="px-4 py-2 border border-white/20 rounded-lg hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              {visiblePages.map((pageNumber) => (
                <button
                  key={pageNumber}
                  onClick={() => changePage(pageNumber)}
                  aria-current={pageNumber === page ? 'page' : undefined}
                  className={
                    pageNumber === page
                      ? 'px-4 py-2 bg-slate-900 text-white rounded-lg'
                      : 'px-4 py-2 border border-white/20 rounded-lg hover:bg-white/5'
                  }
                >
                  {pageNumber}
                </button>
              ))}
              <button
                onClick={() => changePage(page + 1)}
                disabled={page >= (data?.meta?.totalPages ?? 1)}
                className="px-4 py-2 border border-white/20 rounded-lg hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
              <span className="ml-2 text-sm text-gray-400">
                Page {page} of {data?.meta?.totalPages ?? 1}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
