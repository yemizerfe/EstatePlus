import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { fetchPublicNeighborhood, formatAmount } from '../../api/publicData';
import StatCard from '../../components/ui/StatCard';
import { DollarSign, TrendingUp, Home, Percent } from 'lucide-react';

export default function NeighborhoodDetailPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: neighborhood, isLoading } = useQuery({
    queryKey: ['public-neighborhood', slug],
    queryFn: () => fetchPublicNeighborhood(slug!),
    enabled: !!slug,
  });

  if (isLoading) return <div>Loading...</div>;
  if (!neighborhood) return <div>Neighborhood not found</div>;

  const priceMetric = neighborhood.sale.medianAskingPrice;
  const price = priceMetric.value;
  const rentMetric = neighborhood.rent.medianMonthlyRent;
  const rent = rentMetric.value;

  return (
    <div className="space-y-6">
      <div>
        <h1>{neighborhood.name}</h1>
        <p className="text-gray-600 mt-1">Market analysis and trends</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title={`Median Asking Price · n=${priceMetric.sampleSize}`} value={formatAmount(price)} icon={DollarSign} />
        <StatCard title={`Median Price per m² · n=${neighborhood.sale.medianPricePerSqm.sampleSize}`} value={formatAmount(neighborhood.sale.medianPricePerSqm.value)} icon={Home} />
        <StatCard title={`Median Monthly Rent · n=${rentMetric.sampleSize}`} value={formatAmount(rent)} icon={TrendingUp} />
        <StatCard title="Rental Yield" value={price && rent ? `${((rent * 12) / price * 100).toFixed(1)}%` : '—'} icon={Percent} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="mb-4">Price vs Rent Trend</h2>
            <div className="h-80 flex items-center justify-center text-gray-500">
              Trend data coming from integrated market statistics.
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="mb-3">Market Indicators</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-600">Active Listings</dt>
                <dd className="mt-1">
                  <span className="font-medium">{neighborhood.activeListings.sale + neighborhood.activeListings.rent}</span>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Sale Records</dt>
                <dd className="mt-1">
                  <span className="font-medium">{neighborhood.sale.medianAskingPrice.sampleSize}</span>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Rent Records</dt>
                <dd className="mt-1">
                  <span className="font-medium">{neighborhood.rent.medianMonthlyRent.sampleSize}</span>
                </dd>
              </div>
            </dl>
          </div>

          <div className="card">
            <h3 className="mb-3">Median Data Notes</h3>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Sale status</dt>
                <dd className="text-sm">{priceMetric.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Rent status</dt>
                <dd className="text-sm">{rentMetric.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Minimum sample</dt>
                <dd className="text-sm">{neighborhood.sale.medianAskingPrice.minimumSampleSize}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
