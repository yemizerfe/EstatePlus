import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getProperty, valuateProperty } from '../../api/properties';
import MapView from '../../components/map/MapView';
import { MapPin, Maximize, Bed, Bath, Calendar, TrendingUp } from 'lucide-react';

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: property, isLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: () => getProperty(id!),
    enabled: !!id,
  });

  const valuateMutation = useMutation({
    mutationFn: () => valuateProperty(id!),
    onSuccess: (valuation) => {
      queryClient.setQueryData(['valuation', id], valuation);
    },
  });

  const { data: valuation } = useQuery({
    queryKey: ['valuation', id],
    queryFn: () => valuateProperty(id!),
    enabled: false,
  });

  if (isLoading) return <div>Loading property...</div>;
  if (!property) return <div>Property not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>{property.title}</h1>
        <div className="badge-blue">{property.status}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-3xl font-bold text-brand-600">ETB {property.askingPrice.toLocaleString()}</h2>
                {property.rentalPrice && (
                  <p className="text-gray-600 mt-1">Rent: ETB {property.rentalPrice.toLocaleString()}/month</p>
                )}
              </div>
              <button onClick={() => valuateMutation.mutate()} className="btn-primary" disabled={valuateMutation.isPending}>
                {valuateMutation.isPending ? 'Valuating...' : 'Get Valuation'}
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Maximize className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-600">Size</div>
                  <div className="font-medium">{property.sizeSqm} m²</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Bed className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-600">Bedrooms</div>
                  <div className="font-medium">{property.bedrooms}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Bath className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-600">Bathrooms</div>
                  <div className="font-medium">{property.bathrooms}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-600">Listed</div>
                  <div className="font-medium">{new Date(property.listingDate).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          </div>

          {valuation && (
            <div className="card">
              <h2 className="mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Valuation Analysis
              </h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-600">Estimated Value</div>
                  <div className="text-2xl font-bold text-green-600">ETB {valuation.estimatedValue.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Price Status</div>
                  <div
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      valuation.priceStatus === 'below_market'
                        ? 'bg-green-100 text-green-800'
                        : valuation.priceStatus === 'above_market'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {valuation.priceStatus.replace('_', ' ')}
                  </div>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                Based on {valuation.comparableCount} comparable properties
                {valuation.confidenceScore && ` · Confidence: ${(valuation.confidenceScore * 100).toFixed(0)}%`}
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="mb-3">Description</h3>
            <p className="text-gray-700">{property.description || 'No description available'}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Location
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Neighborhood:</span>
                <span className="font-medium ml-2">{property.neighborhood.name}</span>
              </div>
              {property.address && (
                <div>
                  <span className="text-gray-600">Address:</span>
                  <span className="ml-2">{property.address}</span>
                </div>
              )}
            </div>
          </div>

          {property.latitude && property.longitude && (
            <MapView
              center={[property.latitude, property.longitude]}
              zoom={15}
              markers={[
                {
                  id: property.id,
                  position: [property.latitude, property.longitude],
                  title: property.title,
                  price: property.askingPrice,
                },
              ]}
              height="300px"
            />
          )}

          <div className="card">
            <h3 className="mb-3">Details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">Type:</dt>
                <dd className="font-medium">{property.propertyType}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Condition:</dt>
                <dd className="font-medium">{property.condition}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Price/m²:</dt>
                <dd className="font-medium">ETB {(property.askingPrice / property.sizeSqm).toLocaleString()}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
