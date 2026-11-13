import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchPublicNeighborhoods, formatCompact, formatPct } from '../../api/publicData';
import { MapPin, TrendingUp, DollarSign, Percent } from 'lucide-react';

export default function NeighborhoodsPage() {
  const { data: neighborhoods, isLoading } = useQuery({
    queryKey: ['public-neighborhoods'],
    queryFn: fetchPublicNeighborhoods,
  });

  if (isLoading) return <div>Loading neighborhoods...</div>;
  if (!neighborhoods || neighborhoods.length === 0) {
    return <div>No neighborhoods available.</div>;
  }

  return (
    <div className="space-y-6">
      <h1>Neighborhoods</h1>
      <p className="text-gray-600">Market data computed from integrated listings (median of real records).</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {neighborhoods.map((neighborhood, index) => {
          const priceMetric = neighborhood.sale.medianAskingPrice;
          const price = priceMetric.value;
          return (
            <Link
              key={neighborhood.id}
              to={`/neighborhoods/${neighborhood.slug}`}
              className="card hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-brand-600" />
                  <h3 className="font-semibold">{neighborhood.name}</h3>
                </div>
                <div className="badge-blue">#{index + 1}</div>
              </div>
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                Explore market data and trends for this neighborhood
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="flex items-center gap-1 text-gray-600 mb-1">
                    <DollarSign className="w-4 h-4" /> Median Asking Price
                  </div>
                  <div className="font-semibold">
                    {formatCompact(price)}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-gray-600 mb-1">
                    <Percent className="w-4 h-4" /> Rental Yield
                  </div>
                  <div className="font-semibold">
                    {neighborhood.rent.medianMonthlyRent.value !== null && price
                      ? formatPct(
                          ((neighborhood.rent.medianMonthlyRent.value * 12) / price) * 100
                        )
                      : '—'}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-gray-600">Active listings:</span>
                  <span className="font-medium">
                    {neighborhood.activeListings.sale + neighborhood.activeListings.rent}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
