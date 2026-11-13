import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertCircle, BarChart3, Home, Ruler, TrendingUp } from 'lucide-react';

import { PageHero, StatCard } from '../../components/ui/kit-core';
import { EmptyState, TableSkeleton } from '../../components/ui/kit-blocks';
import { getMyProperties } from '../../api/properties';
import { fetchMarketTrends, formatAmount, formatPct } from '../../api/publicData';

const RANGES = [
  { value: '3', label: 'Last 3 months' },
  { value: '6', label: 'Last 6 months' },
  { value: '12', label: 'Last 12 months' },
  { value: '24', label: 'Last 24 months' },
];

export default function AnalyticsPage() {
  const [months, setMonths] = useState('12');

  const propertiesQuery = useQuery({
    queryKey: ['owner-portfolio'],
    queryFn: () => getMyProperties({ limit: 100 }),
  });

  const trendsQuery = useQuery({
    queryKey: ['owner-market-trends', months],
    queryFn: () => fetchMarketTrends(Number(months)),
    retry: 1,
  });

  const properties = propertiesQuery.data?.properties ?? [];

  const portfolio = useMemo(() => {
    const priced = properties.filter((property) => Number(property.askingPrice) > 0);
    const totalAsking = priced.reduce((sum, property) => sum + Number(property.askingPrice), 0);
    const totalArea = properties.reduce((sum, property) => sum + Number(property.sizeSqm || 0), 0);
    return {
      count: properties.length,
      averageAsking: priced.length > 0 ? totalAsking / priced.length : null,
      averageSize: properties.length > 0 ? totalArea / properties.length : null,
      pricePerSqm:
        totalArea > 0 && priced.length > 0
          ? priced.reduce((sum, property) => sum + Number(property.askingPrice), 0) / totalArea
          : null,
    };
  }, [properties]);

  const trend = trendsQuery.data;
  const points = (trend?.points ?? []).filter((point) => point.medianPrice !== null);
  const maxPrice = Math.max(...points.map((point) => point.medianPrice ?? 0), 1);

  return (
    <div className="space-y-6">
      <PageHero
        icon={BarChart3}
        title="Portfolio Analytics"
        description="Your owned properties alongside the market medians stored for the selected window."
        accent="purple"
        actions={
          <select
            value={months}
            onChange={(event) => setMonths(event.target.value)}
            className="rounded-lg border border-white/20 bg-slate-800/50 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {RANGES.map((range) => (
              <option key={range.value} value={range.value} className="bg-slate-800">
                {range.label}
              </option>
            ))}
          </select>
        }
      />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
        <StatCard
          icon={Home}
          label="Properties owned"
          value={portfolio.count}
          hint="records in your name"
          accent="sky"
        />
        <StatCard
          icon={TrendingUp}
          label="Average asking price"
          value={portfolio.averageAsking ? `ETB ${formatAmount(Math.round(portfolio.averageAsking))}` : '—'}
          hint="mean of your priced properties"
          accent="emerald"
        />
        <StatCard
          icon={Ruler}
          label="Average size"
          value={portfolio.averageSize ? `${Math.round(portfolio.averageSize)} m²` : '—'}
          hint="across your listings"
          accent="purple"
        />
        <StatCard
          icon={BarChart3}
          label={`Market change (${months} mo)`}
          value={
            trend?.comparison.status === 'available'
              ? formatPct(trend.comparison.priceChangePct)
              : '—'
          }
          hint={
            trend?.comparison.status === 'available'
              ? `median sale-to-sale across ${points.length} month${points.length === 1 ? '' : 's'}`
              : 'not comparable in this window'
          }
          accent="amber"
        />
      </div>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Citywide median asking price</h2>
            <p className="mt-1 text-sm text-slate-400">
              Monthly medians of approved sale listings, with the sample behind each point.
            </p>
          </div>
          <TrendingUp className="h-5 w-5 text-sky-400" />
        </div>

        {trendsQuery.isLoading ? (
          <TableSkeleton rows={3} />
        ) : trendsQuery.isError ? (
          <EmptyState
            icon={AlertCircle}
            title="Market trends could not be loaded"
            message="The trend API did not respond, so no chart is drawn."
            accent="rose"
          />
        ) : points.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No priced months in this window"
            message="No month inside the selected window holds a priced sale listing, so there is nothing to plot."
            accent="sky"
          />
        ) : (
          <div className="space-y-3">
            {points.map((point) => (
              <div key={point.month} className="flex items-center gap-4">
                <span className="w-16 text-xs text-slate-400">{point.label}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400"
                    style={{ width: `${((point.medianPrice ?? 0) / maxPrice) * 100}%` }}
                  />
                </div>
                <span className="w-28 text-right text-xs font-semibold text-white">
                  {formatAmount(point.medianPrice)}
                </span>
                <span className="w-16 text-right text-xs text-slate-500">n={point.priceSampleSize}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50">
        <div className="flex items-center justify-between border-b border-white/10 p-5">
          <h2 className="text-xl font-bold text-white">Your properties</h2>
          <Link to="/app/my-properties" className="text-sm text-sky-300 hover:text-sky-200">
            Manage properties
          </Link>
        </div>

        {propertiesQuery.isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={4} />
          </div>
        ) : properties.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Home}
              title="No properties yet"
              message="Add a property and its price, size and status will be reported here."
              accent="sky"
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-white/10">
                  <th className="px-5 py-3 text-left font-medium">Property</th>
                  <th className="px-5 py-3 text-right font-medium">Asking price</th>
                  <th className="px-5 py-3 text-right font-medium">Size</th>
                  <th className="px-5 py-3 text-right font-medium">Price / m²</th>
                  <th className="px-5 py-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((property) => (
                  <tr key={property.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="px-5 py-4">
                      <Link to={`/app/properties/${property.id}`} className="font-medium text-white hover:text-sky-300">
                        {property.title}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {property.neighborhood?.name ?? property.address ?? 'Addis Ababa'}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right text-white">
                      ETB {formatAmount(Number(property.askingPrice))}
                    </td>
                    <td className="px-5 py-4 text-right text-slate-300">
                      {Math.round(Number(property.sizeSqm))} m²
                    </td>
                    <td className="px-5 py-4 text-right text-slate-300">
                      ETB{' '}
                      {formatAmount(
                        Math.round(Number(property.askingPrice) / Math.max(Number(property.sizeSqm), 1)),
                      )}
                    </td>
                    <td className="px-5 py-4 text-right text-slate-400">{property.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
