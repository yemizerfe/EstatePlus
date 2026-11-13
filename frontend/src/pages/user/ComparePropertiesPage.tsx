import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, X, MapPin, Scale } from 'lucide-react';
import { PageHero } from '../../components/ui/kit-core';
import { EmptyState, PrimaryButton, SecondaryButton } from '../../components/ui/kit-blocks';
import { getCompareList, removeFromCompare, CompareProperty } from '../../lib/compare';

const ComparePropertiesPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedProperties, setSelectedProperties] = useState<CompareProperty[]>(() => getCompareList());

  const handleRemoveProperty = (id: string) => {
    setSelectedProperties(removeFromCompare(id));
  };

  const comparisonRows: { label: string; key: string; format: (val: any) => string }[] = [
    { label: 'Price (recorded units)', key: 'price', format: (val: number) => val.toLocaleString() },
    { label: 'Price per m² (recorded units)', key: 'pricePerSqm', format: (val: number) => val.toLocaleString() },
    { label: 'Market Value (recorded units)', key: 'marketValue', format: (val: number) => val.toLocaleString() },
    { label: 'Size', key: 'size', format: (val: number) => `${val}m²` },
    { label: 'Bedrooms', key: 'bedrooms', format: (val: number) => val.toString() },
    { label: 'Bathrooms', key: 'bathrooms', format: (val: number) => val.toString() },
    { label: 'Rental Yield', key: 'rentalYield', format: (val: number) => `${val}%` },
    { label: 'Neighborhood', key: 'neighborhood', format: (val: string) => val },
  ];

  const getBestValue = (key: string, properties: CompareProperty[]) => {
    if (key === 'pricePerSqm' || key === 'price') {
      return Math.min(...properties.map((p) => p[key as keyof CompareProperty] as number));
    }
    if (key === 'rentalYield' || key === 'size' || key === 'bedrooms' || key === 'bathrooms') {
      return Math.max(...properties.map((p) => p[key as keyof CompareProperty] as number));
    }
    return null;
  };

  return (
    <div>
      <div className="space-y-6">
        {/* Page Hero */}
        <PageHero
          icon={Scale}
          title="Compare Properties"
          description="Line up to three properties side by side and spot the best value instantly."
          accent="indigo"
        />

        {selectedProperties.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="No properties selected"
            message="Add properties from your saved list or browse the market to start comparing."
            accent="indigo"
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <PrimaryButton onClick={() => navigate('/app/properties?mode=compare')}>Browse Properties</PrimaryButton>
                <SecondaryButton onClick={() => navigate('/app/saved-properties')}>View Saved</SecondaryButton>
              </div>
            }
          />
        ) : (
          <>
            {/* Comparison Table */}
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl overflow-hidden mb-8">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-6 py-4 text-left bg-white/5 w-48">
                        <span className="text-sm font-semibold text-gray-400 uppercase">Features</span>
                      </th>
                      {selectedProperties.map((property) => (
                        <th key={property.id} className="px-6 py-4 bg-slate-900/50 backdrop-blur-xl min-w-[300px]">
                          <div className="relative">
                            <button
                              onClick={() => handleRemoveProperty(property.id)}
                              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <img
                              src={property.image}
                              alt={property.title}
                              className="w-full h-40 object-cover rounded-lg mb-3"
                            />
                            <h3 className="font-bold text-white mb-1 text-left">{property.title}</h3>
                            <div className="flex items-center gap-1 text-sm text-gray-400 text-left">
                              <MapPin className="w-4 h-4" />
                              <span>{property.neighborhood}</span>
                            </div>
                          </div>
                        </th>
                      ))}
                      {selectedProperties.length < 3 && (
                        <th className="px-6 py-4 bg-white/5">
                          <button
                            onClick={() => navigate('/app/properties?mode=compare')}
                            className="w-full h-40 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-slate-400 hover:bg-white/5 transition-colors"
                            title="Add property to compare"
                          >
                            <Plus className="w-8 h-8 text-gray-500" />
                            <span className="text-sm text-gray-400">Add Property</span>
                          </button>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {comparisonRows.map((row) => {
                      const bestValue = getBestValue(row.key, selectedProperties);
                      return (
                        <tr key={row.key} className="hover:bg-white/5">
                          <td className="px-6 py-4 bg-white/5 font-semibold text-gray-300">
                            {row.label}
                          </td>
                          {selectedProperties.map((property) => {
                            const value = (property as any)[row.key];
                            const isBest = bestValue !== null && value === bestValue;
                            return (
                              <td
                                key={property.id}
                                className={`px-6 py-4 ${
                                  isBest ? 'bg-emerald-50' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`font-semibold ${
                                      isBest ? 'text-emerald-700' : 'text-white'
                                    }`}
                                  >
                                    {row.format(value)}
                                  </span>
                                  {isBest && (
                                    <span className="px-2 py-1 bg-emerald-600 text-white text-xs font-semibold rounded">
                                      Best
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          {selectedProperties.length < 3 && (
                            <td className="px-6 py-4 bg-white/5"></td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Value Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {selectedProperties.map((property) => (
                <div key={property.id} className="bg-slate-900/50 backdrop-blur-xl rounded-xl p-6">
                  <h3 className="font-bold text-white mb-4 truncate">{property.title}</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Value Score</span>
                      <span className="text-lg font-bold text-white">
                        {((property.marketValue / property.price) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">vs Market</span>
                      <span
                        className={`text-sm font-semibold ${
                          property.price < property.marketValue
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        }`}
                      >
                        {property.price < property.marketValue ? 'Below' : 'Above'} {Math.abs(((property.price - property.marketValue) / property.marketValue) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="pt-3 border-t border-white/10">
                      <Link
                        to={`/app/properties/${property.id}`}
                        className="block w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm text-center"
                      >
                        View Full Details
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ComparePropertiesPage;
