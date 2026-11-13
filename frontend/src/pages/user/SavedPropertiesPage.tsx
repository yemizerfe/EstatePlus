import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, MapPin, Bed, Bath, Square, Trash2, TrendingUp, Scale } from 'lucide-react';
import { PageHero, StatCard } from '../../components/ui/kit-core';
import { EmptyState, TableSkeleton } from '../../components/ui/kit-blocks';
import {
  fetchSavedProperties,
  deleteSavedProperty,
  SavedProperty,
} from '../../api/savedProperties';
import { addToCompare } from '../../lib/compare';

const formatPrice = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M` : `${Math.round(n / 1_000)}k`;

const SavedPropertiesPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: savedProperties, isLoading } = useQuery({
    queryKey: ['saved-properties'],
    queryFn: fetchSavedProperties,
  });

  const removeMutation = useMutation({
    mutationFn: (propertyId: string) => deleteSavedProperty(propertyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-properties'] }),
  });

  const handleRemove = (propertyId: string) => {
    removeMutation.mutate(propertyId);
  };

  const handleCompare = (property: SavedProperty) => {
    addToCompare({
      id: property.propertyId,
      title: property.title,
      location: 'Addis Ababa',
      neighborhood: property.neighborhood,
      price: property.price,
      pricePerSqm: property.size ? Math.round(property.price / property.size) : 0,
      size: property.size ?? 0,
      bedrooms: property.beds ?? 0,
      bathrooms: property.baths ?? 0,
      rentalYield: 6,
      marketValue: Math.round(property.price * 0.98),
      image: property.image,
    });
    navigate('/app/compare');
  };

  const list = savedProperties ?? [];
  const avgPrice = list.length > 0 ? list.reduce((acc, p) => acc + p.price, 0) / list.length : 0;

  return (
    <div>
      <div className="space-y-6">
        {/* Page Hero */}
        <PageHero
          icon={Heart}
          title="Saved Properties"
          description="Everything you've saved in one place — track prices and act when the moment is right."
          accent="rose"
        />

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <StatCard
            icon={Heart}
            label="Total Saved"
            value={list.length}
            hint="properties in your list"
            accent="rose"
          />
          <StatCard
            icon={Square}
            label="Avg Price"
            value={avgPrice > 0 ? formatPrice(avgPrice) : '—'}
            hint="across your saved list"
            accent="sky"
          />
          <StatCard
            icon={TrendingUp}
            label="Est. Value"
            value={list.length > 0 ? formatPrice(list.reduce((acc, p) => acc + p.price, 0)) : '—'}
            hint="combined asking price"
            accent="emerald"
          />
        </div>

        {/* Properties List */}
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="No saved properties yet"
            message="Start exploring the market and tap the heart on any property you like."
            accent="rose"
            action={
              <Link
                to="/app/properties"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md"
              >
                Browse Properties
              </Link>
            }
          />
        ) : (
          <div className="space-y-6">
            {list.map((property) => (
              <div
                key={property.propertyId}
                className="bg-slate-900/60 backdrop-blur-xl rounded-2xl overflow-hidden shadow-lg shadow-slate-950/20 hover:border-blue-400/30 transition-all"
              >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6">
                  {/* Image */}
                  <div className="md:col-span-1">
                    {property.image ? (
                      <img
                        src={property.image}
                        alt={property.title}
                        className="w-full h-48 md:h-full object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-full h-48 md:h-full flex items-center justify-center bg-slate-900/50 backdrop-blur-xl/10 rounded-lg">
                        <Heart className="w-8 h-8 text-slate-300" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="md:col-span-2">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-bold text-white mb-2">{property.title}</h3>
                        <div className="flex items-center gap-2 text-gray-400 mb-3">
                          <MapPin className="w-4 h-4" />
                          <span className="text-sm">
                            {property.neighborhood}, Addis Ababa
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemove(property.propertyId)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
                        title="Remove from saved"
                        disabled={removeMutation.isPending}
                      >
                        <Trash2 className="w-5 h-5 text-gray-500 group-hover:text-red-500" />
                      </button>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-gray-400 mb-4">
                      <div className="flex items-center gap-2">
                        <Square className="w-4 h-4" />
                        <span>{property.size ? `${property.size}m²` : 'Size N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Bed className="w-4 h-4" />
                        <span>{property.beds} Beds</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Bath className="w-4 h-4" />
                        <span>{property.baths} Baths</span>
                      </div>
                    </div>

                    <div className="text-sm text-gray-500">
                      Saved on {new Date(property.savedAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Price & Actions */}
                  <div className="md:col-span-1 flex flex-col justify-between">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Price</p>
                      <p className="text-2xl font-bold text-white mb-2">
                        {property.price.toLocaleString()}
                      </p>
                    </div>

                    <div className="space-y-2 mt-4">
                      <Link
                        to={`/app/properties/${property.propertyId}`}
                        className="block w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-center rounded-xl hover:opacity-95 transition-all"
                      >
                        View Details
                      </Link>
                      <button
                        onClick={() => handleCompare(property)}
                        className="flex w-full items-center justify-center gap-1.5 px-4 py-2 bg-slate-800/80 border border-white/10 text-white text-center rounded-xl hover:bg-slate-800 transition-colors"
                      >
                        <Scale className="w-4 h-4" />
                        Compare
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedPropertiesPage;
