import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getProperties, getNeighborhoods } from '../../api/market';
import type { PropertySearchQuery } from '../../types';
import { Building2, MapPin, Maximize } from 'lucide-react';

export default function PropertiesPage() {
  const [filters, setFilters] = useState({ neighborhoodId: '', propertyType: '', search: '', page: 1 });

  const { data, isLoading } = useQuery({
    queryKey: ['properties', filters],
    queryFn: () =>
      getProperties({
        page: filters.page,
        limit: 20,
        ...(filters.neighborhoodId ? { neighborhoodId: filters.neighborhoodId } : {}),
        ...(filters.propertyType
          ? { propertyType: filters.propertyType as PropertySearchQuery['propertyType'] }
          : {}),
        ...(filters.search ? { search: filters.search } : {}),
      }),
  });

  const { data: neighborhoods } = useQuery({
    queryKey: ['neighborhoods'],
    queryFn: () => getNeighborhoods(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>Properties</h1>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Search</label>
            <input
              type="text"
              placeholder="Search properties..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Neighborhood</label>
            <select
              value={filters.neighborhoodId}
              onChange={(e) => setFilters({ ...filters, neighborhoodId: e.target.value, page: 1 })}
              className="input"
            >
              <option value="">All</option>
              {neighborhoods?.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Type</label>
            <select
              value={filters.propertyType}
              onChange={(e) => setFilters({ ...filters, propertyType: e.target.value, page: 1 })}
              className="input"
            >
              <option value="">All</option>
              <option value="APARTMENT">Apartment</option>
              <option value="CONDOMINIUM">Condominium</option>
              <option value="VILLA">Villa</option>
              <option value="OFFICE">Office</option>
              <option value="RETAIL">Retail</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading properties...</div>
      ) : data && data.properties.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.properties.map((property) => (
              <Link key={property.id} to={`/properties/${property.id}`} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="badge-blue">{property.propertyType}</div>
                  <div className="badge-gray">{property.status}</div>
                </div>
                <h3 className="font-semibold text-lg mb-2 line-clamp-1">{property.title}</h3>
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">{property.description}</p>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {property.neighborhood.name}
                  </div>
                  <div className="flex items-center">
                    <Maximize className="w-4 h-4 mr-1" />
                    {property.sizeSqm} m² · {property.bedrooms} bed · {property.bathrooms} bath
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <div className="text-2xl font-bold text-brand-600">ETB {property.askingPrice.toLocaleString()}</div>
                  {property.rentalPrice && (
                    <div className="text-sm text-gray-600 mt-1">Rent: ETB {property.rentalPrice.toLocaleString()}/mo</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {data.properties.length} of {data.meta.total} properties
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                disabled={!data.meta.hasPrev}
                className="btn-secondary disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                disabled={!data.meta.hasNext}
                className="btn-secondary disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="card text-center py-12 text-gray-500">
          <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p>No properties found</p>
        </div>
      )}
    </div>
  );
}
