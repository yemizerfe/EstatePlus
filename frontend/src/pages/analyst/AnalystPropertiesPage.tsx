import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Building2, 
  Search, 
  Filter, 
  Calendar, 
  DollarSign, 
  Bed, 
  Bath, 
  Car,
  Eye,
  BarChart3,
  Download,
  Clock
} from 'lucide-react';
import { InfoHint, PageHero } from '../../components/ui/kit-core';
import { METRIC_HINTS } from '../../lib/metricHints';
import { TableSkeleton } from '../../components/ui/kit-blocks';

import { searchProperties } from '../../api/properties';
import { propertyTypeLabel } from '../../api/publicData';
import { downloadCsv } from '../../lib/csv';

const NO_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#1e293b"/><text x="60" y="64" font-family="sans-serif" font-size="11" fill="#64748b" text-anchor="middle">No photo</text></svg>',
  );

const PROPERTY_TYPE_QUERY: Record<string, string> = {
  apartment: 'APARTMENT',
  villa: 'VILLA',
  condominium: 'CONDOMINIUM',
  office: 'OFFICE',
  retail: 'RETAIL',
  warehouse: 'WAREHOUSE',
  land: 'LAND',
};

const STATUS_QUERY: Record<string, string> = {
  active: 'ACTIVE',
  pending: 'PENDING',
  sold: 'SOLD',
  rented: 'RENTED',
  draft: 'DRAFT',
  approved: 'APPROVED',
  inactive: 'INACTIVE',
  archived: 'ARCHIVED',
};

const daysBetween = (iso: string | null | undefined) => {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
};

const formatDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

const getProperties = async (args: {
  filters: FilterState;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}) => {
  const { filters, sortBy, sortOrder } = args;
  const numeric = (value: string) => (value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : undefined);

  const apiSortBy =
    sortBy === 'price' ? 'price' : sortBy === 'daysOnMarket' || sortBy === 'dateListed' ? 'createdAt' : 'createdAt';

  const result = await searchProperties({
    page: 1,
    limit: 100,
    search: filters.search.trim() || undefined,
    propertyType: PROPERTY_TYPE_QUERY[filters.propertyType] as never,
    status: STATUS_QUERY[filters.status] as never,
    minPrice: numeric(filters.priceRange.min),
    maxPrice: numeric(filters.priceRange.max),
    bedrooms: filters.bedrooms === 'all' ? undefined : Number(filters.bedrooms),
    sortBy: apiSortBy,
    sortOrder,
  });

  const mapped: Property[] = result.properties
    .map((property) => {
      const askingPrice = Number(property.askingPrice ?? 0);
      const rentalPrice = property.rentalPrice != null ? Number(property.rentalPrice) : null;
      const listingType = askingPrice > 0 ? 'sale' : rentalPrice ? 'rent' : 'sale';
      return {
        id: property.id,
        title: property.title,
        address: property.address ?? '—',
        neighborhood: property.neighborhood?.name ?? 'Unassigned',
        neighborhoodSlug: property.neighborhood?.slug ?? null,
        type: propertyTypeLabel(property.propertyType),
        listingType,
        price: listingType === 'rent' ? (rentalPrice ?? 0) : askingPrice,
        rentalPrice,
        area: property.sizeSqm != null ? Number(property.sizeSqm) : 0,
        bedrooms: property.bedrooms ?? 0,
        bathrooms: property.bathrooms ?? 0,
        parking: 0,
        status: String(property.status ?? '').toLowerCase() || 'unknown',
        dateListedRaw: property.listingDate ?? property.createdAt,
        dateListed: formatDate(property.listingDate ?? property.createdAt),
        daysOnMarket: daysBetween(property.listingDate ?? property.createdAt),
        images: [],
        features: [],
        priceHistory: [],
      };
    })
    .filter((property) => {
      if (filters.neighborhood !== 'all') {
        const wanted = filters.neighborhood.toLowerCase();
        const matches =
          property.neighborhoodSlug?.toLowerCase() === wanted ||
          property.neighborhood.toLowerCase() === wanted;
        if (!matches) return false;
      }
      if (filters.listingType !== 'all' && property.listingType !== filters.listingType) return false;
      if (filters.dateRange.from && property.dateListedRaw < filters.dateRange.from) return false;
      if (filters.dateRange.to) {
        const to = `${filters.dateRange.to}T23:59:59`;
        if (property.dateListedRaw > to) return false;
      }
      return true;
    });

  const salePrices = mapped.filter((p) => p.price > 0).map((p) => p.price);
  const rents = mapped
    .map((p) => p.rentalPrice)
    .filter((value): value is number => value != null && value > 0);
  const mean = (values: number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

  return {
    properties: mapped,
    total: result.meta?.total ?? mapped.length,
    summary: {
      totalListings: result.meta?.total ?? mapped.length,
      avgPrice: Math.round(mean(salePrices)),
      avgRent: Math.round(mean(rents)),
      avgDaysOnMarket: Math.round(mean(mapped.map((p) => p.daysOnMarket))),
    },
  };
};

interface FilterState {
  search: string;
  location: string;
  neighborhood: string;
  propertyType: string;
  listingType: string;
  priceRange: {
    min: string;
    max: string;
  };
  bedrooms: string;
  status: string;
  dateRange: {
    from: string;
    to: string;
  };
}

interface Property {
  id: string;
  title: string;
  address: string;
  neighborhood: string;
  neighborhoodSlug: string | null;
  type: string;
  listingType: string;
  price: number;
  rentalPrice: number | null;
  area: number;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  status: string;
  dateListedRaw: string;
  dateListed: string;
  daysOnMarket: number;
  images: string[];
  features: string[];
  priceHistory: Array<{ date: string; price: number }>;
}

export default function AnalystPropertiesPage() {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    location: 'addis-ababa',
    neighborhood: 'all',
    propertyType: 'all',
    listingType: 'all',
    priceRange: {
      min: '',
      max: ''
    },
    bedrooms: 'all',
    status: 'all',
    dateRange: {
      from: '',
      to: ''
    }
  });

  const navigate = useNavigate();
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('dateListed');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Data queries
  const { data: propertiesData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['analyst-properties', filters, sortBy, sortOrder],
    queryFn: () => getProperties({ filters, sortBy, sortOrder }),
  });

  const formatCurrency = (amount: number, isRent: boolean = false) => {
    if (isRent) {
      if (amount >= 1000) {
        return `${(amount / 1000).toFixed(0)}K/month`;
      }
      return `${amount.toLocaleString()}/month`;
    }
    
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    }
    return `${(amount / 1000).toFixed(0)}K`;
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-500/20 text-green-400 border-green-500/30',
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      sold: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      rented: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      expired: 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles] || styles.active}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const handlePropertyView = (property: Property) => {
    setSelectedProperty(property);
  };

  const handlePropertyAnalyze = (propertyId: string) => {
    navigate(`/app/properties/${propertyId}`);
  };

  const handleExport = () => {
    const rows = (propertiesData?.properties ?? []).map((property) => [
      property.title,
      property.neighborhood,
      property.address,
      property.type,
      property.listingType === 'rent' ? 'Rent' : 'Sale',
      property.price || '',
      property.area || '',
      property.bedrooms,
      property.bathrooms,
      property.status,
      property.dateListed,
      property.daysOnMarket,
      `${window.location.origin}/properties/${property.id}`,
    ]);

    downloadCsv(
      `analyst-listings-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Title', 'Neighborhood', 'Address', 'Type', 'Listing type', 'Price (ETB)', 'Size (m²)', 'Bedrooms', 'Bathrooms', 'Status', 'Listed on', 'Days on market', 'URL'],
      rows,
    );
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  if (isLoading) return <TableSkeleton />;

  if (isError) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
          <p className="font-semibold">Could not load properties</p>
          <p className="mt-1 text-sm text-rose-300/80">
            {error instanceof Error ? error.message : 'The property service did not respond.'}
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
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <PageHero
        icon={Building2}
        title="Properties & Listings"
        description="Market listing data and property analysis"
        accent="emerald"
        actions={
          <div className="flex items-center gap-4">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-xl text-emerald-400 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-white/10 rounded-xl transition-colors"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>
        }
      />

      <div className="p-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">{propertiesData?.summary.totalListings.toLocaleString()}</div>
                <div className="flex items-center text-gray-400">
                  Total Listings
                  <InfoHint text={METRIC_HINTS.listingCount} label="Total listings" />
                </div>
              </div>
              <Building2 className="w-8 h-8 text-emerald-400" />
            </div>
          </div>
          
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">{formatCurrency(propertiesData?.summary.avgPrice || 0)}</div>
                <div className="flex items-center text-gray-400">
                  Avg Sale Price
                  <InfoHint text={METRIC_HINTS.averageAskingPrice} label="Average sale price" />
                </div>
              </div>
              <DollarSign className="w-8 h-8 text-green-400" />
            </div>
          </div>
          
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">{formatCurrency(propertiesData?.summary.avgRent || 0, true)}</div>
                <div className="flex items-center text-gray-400">
                  Avg Rent
                  <InfoHint text={METRIC_HINTS.averageMonthlyRent} label="Average rent" />
                </div>
              </div>
              <Calendar className="w-8 h-8 text-purple-400" />
            </div>
          </div>
          
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">{propertiesData?.summary.avgDaysOnMarket}d</div>
                <div className="flex items-center text-gray-400">
                  Avg Days on Market
                  <InfoHint text={METRIC_HINTS.daysOnMarket} label="Average days on market" />
                </div>
              </div>
              <Clock className="w-8 h-8 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="lg:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search properties..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              {/* Neighborhood */}
              <select
                value={filters.neighborhood}
                onChange={(e) => setFilters({ ...filters, neighborhood: e.target.value })}
                className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="all">All Neighborhoods</option>
                <option value="bole">Bole</option>
                <option value="kazanchis">Kazanchis</option>
                <option value="cmc">CMC</option>
                <option value="megenagna">Megenagna</option>
                <option value="sarbet">Sarbet</option>
              </select>

              {/* Property Type */}
              <select
                value={filters.propertyType}
                onChange={(e) => setFilters({ ...filters, propertyType: e.target.value })}
                className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="apartment">Apartment</option>
                <option value="villa">Villa</option>
                <option value="house">House</option>
                <option value="office">Office</option>
                <option value="retail">Retail</option>
                <option value="land">Land</option>
              </select>

              {/* Sale/Rent */}
              <select
                value={filters.listingType}
                onChange={(e) => setFilters({ ...filters, listingType: e.target.value })}
                className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="all">Sale & Rent</option>
                <option value="sale">For Sale</option>
                <option value="rent">For Rent</option>
              </select>

              {/* Bedrooms */}
              <select
                value={filters.bedrooms}
                onChange={(e) => setFilters({ ...filters, bedrooms: e.target.value })}
                className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="all">Any Bedrooms</option>
                <option value="1">1 Bedroom</option>
                <option value="2">2 Bedrooms</option>
                <option value="3">3 Bedrooms</option>
                <option value="4">4+ Bedrooms</option>
              </select>

              {/* Status */}
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="sold">Sold</option>
                <option value="rented">Rented</option>
                <option value="expired">Expired</option>
              </select>

              {/* Price Range */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Min price"
                  value={filters.priceRange.min}
                  onChange={(e) => setFilters({ 
                    ...filters, 
                    priceRange: { ...filters.priceRange, min: e.target.value }
                  })}
                  className="flex-1 px-3 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="Max price"
                  value={filters.priceRange.max}
                  onChange={(e) => setFilters({ 
                    ...filters, 
                    priceRange: { ...filters.priceRange, max: e.target.value }
                  })}
                  className="flex-1 px-3 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}

        {/* Properties Table */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-gray-300">Property</th>
                  <th className="text-left py-3 px-4 text-gray-300">Location</th>
                  <th className="text-left py-3 px-4 text-gray-300">Type</th>
                  <th 
                    className="text-right py-3 px-4 text-gray-300 cursor-pointer hover:text-white"
                    onClick={() => handleSort('price')}
                  >
                    Price {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="text-right py-3 px-4 text-gray-300">
                    Area
                    <InfoHint
                      text="The property size in square metres, as recorded by the lister. Asking price per square metre is this figure used as a divisor on the Price column."
                      label="Area"
                    />
                  </th>
                  <th className="text-center py-3 px-4 text-gray-300">Status</th>
                  <th 
                    className="whitespace-nowrap text-center py-3 px-4 text-gray-300 cursor-pointer hover:text-white"
                    onClick={() => handleSort('dateListed')}
                  >
                    Date Listed {sortBy === 'dateListed' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="whitespace-nowrap text-right py-3 px-4 text-gray-300 cursor-pointer hover:text-white"
                    onClick={() => handleSort('daysOnMarket')}
                  >
                    Days on Market {sortBy === 'daysOnMarket' && (sortOrder === 'asc' ? '↑' : '↓')}
                    <InfoHint text={METRIC_HINTS.daysOnMarket} label="Days on market" />
                  </th>
                  <th className="text-center py-3 px-4 text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {propertiesData?.properties.map((property) => (
                  <tr key={property.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={property.images[0] ?? NO_IMAGE}
                          alt={property.title}
                          className="w-12 h-12 rounded-lg object-cover bg-slate-800"
                        />
                        <div>
                          <div className="font-medium text-white">{property.title}</div>
                          <div className="text-sm text-gray-400 flex items-center gap-2">
                            <Bed className="w-3 h-3" />
                            {property.bedrooms}
                            <Bath className="w-3 h-3" />
                            {property.bathrooms}
                            <Car className="w-3 h-3" />
                            {property.parking}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-white">{property.neighborhood}</div>
                      <div className="text-sm text-gray-400">{property.address}</div>
                    </td>
                    <td className="py-4 px-4 text-white">{property.type}</td>
                    <td className="py-4 px-4 text-right text-white font-medium">
                      {formatCurrency(property.price, property.listingType === 'rent')}
                    </td>
                    <td className="py-4 px-4 text-right text-gray-300">{property.area}m²</td>
                    <td className="py-4 px-4 text-center">{getStatusBadge(property.status)}</td>
                    <td className="whitespace-nowrap py-4 px-4 text-center text-gray-300">{property.dateListed}</td>
                    <td className="whitespace-nowrap py-4 px-4 text-right text-gray-300">{property.daysOnMarket}</td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handlePropertyView(property)}
                          className="p-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-lg text-emerald-400 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handlePropertyAnalyze(property.id)}
                          className="p-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-blue-400 transition-colors"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Property Detail Modal */}
        {selectedProperty && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">{selectedProperty.title}</h2>
                <button
                  onClick={() => setSelectedProperty(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Property Image */}
                <div>
                  <img
                    src={selectedProperty.images[0] ?? NO_IMAGE}
                    alt={selectedProperty.title}
                    className="w-full h-64 rounded-xl object-cover bg-slate-800"
                  />
                </div>

                {/* Property Details */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Property Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-gray-400">Type</div>
                        <div className="text-white">{selectedProperty.type}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Status</div>
                        <div>{getStatusBadge(selectedProperty.status)}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Area</div>
                        <div className="text-white">{selectedProperty.area}m²</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Price</div>
                        <div className="text-white font-semibold">
                          {formatCurrency(selectedProperty.price, selectedProperty.listingType === 'rent')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Features</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedProperty.features.length ? (
                        selectedProperty.features.map((feature, index) => (
                          <span key={index} className="px-3 py-1 bg-slate-700 text-gray-300 rounded-full text-sm">
                            {feature}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-500">No features recorded for this listing.</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Market Analysis</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="text-gray-400">Days on Market</div>
                        <div className="text-white font-semibold">{selectedProperty.daysOnMarket} days</div>
                      </div>
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="text-gray-400">Price Changes</div>
                        <div className="text-white font-semibold">{selectedProperty.priceHistory.length - 1}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Price History</h3>
                    <div className="space-y-2">
                      {selectedProperty.priceHistory.length === 0 && (
                        <span className="text-sm text-gray-500">No asking-price changes recorded.</span>
                      )}
                      {selectedProperty.priceHistory.map((entry, index) => (
                        <div key={index} className="flex justify-between items-center p-2 bg-slate-800/30 rounded-lg">
                          <span className="text-gray-400">{entry.date}</span>
                          <span className="text-white font-medium">
                            {formatCurrency(entry.price, selectedProperty.listingType === 'rent')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}