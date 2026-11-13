import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Eye, Map, MapPin } from 'lucide-react';

import NeighborhoodMap, { type NeighborhoodMarkerData } from '../../components/NeighborhoodMap';
import { InfoHint, PageHero } from '../../components/ui/kit-core';
import { METRIC_HINTS } from '../../lib/metricHints';
import { TableSkeleton } from '../../components/ui/kit-blocks';
import {
  fetchMarketSummary,
  fetchMarketTrends,
  fetchPublicNeighborhoods,
  formatAmount,
  formatPct,
  type Metric,
  type PublicNeighborhood,
} from '../../api/publicData';

type Period = 3 | 6 | 12 | 24;

const availableValue = (value: Metric): number | null => value.value;

const formatRecordedAmount = (value: number | null): string => formatAmount(value);

const metricNote = (metric: Metric): string => {
  if (metric.value === null) return 'No listings recorded yet';
  const basis = metric.scope === 'city'
    ? `citywide median · n=${metric.sampleSize}`
    : `median · n=${metric.sampleSize}`;
  return metric.confidence && metric.confidence !== 'high' ? `${basis} (${metric.confidence} confidence)` : basis;
};

function MetricCard({ label, value, note, info }: { label: string; value: string; note: string; info?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
      <p className="flex items-center text-sm text-slate-400">
        {label}
        {info && <InfoHint text={info} label={label} />}
      </p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{note}</p>
    </div>
  );
}

export default function MarketExplorerPage() {
  const [period, setPeriod] = useState<Period>(12);
  const [selectedSlug, setSelectedSlug] = useState('all');
  const navigate = useNavigate();

  const summaryQuery = useQuery({
    queryKey: ['market-explorer-summary', period],
    queryFn: () => fetchMarketSummary(period),
    retry: 1,
  });
  const neighborhoodsQuery = useQuery({
    queryKey: ['market-explorer-neighborhoods'],
    queryFn: fetchPublicNeighborhoods,
    retry: 1,
  });
  const trendsQuery = useQuery({
    queryKey: ['market-explorer-trends', period],
    queryFn: () => fetchMarketTrends(period),
    retry: 1,
  });

  const neighborhoods = useMemo(
    () =>
      (neighborhoodsQuery.data ?? []).filter(
        (neighborhood) => selectedSlug === 'all' || neighborhood.slug === selectedSlug,
      ),
    [neighborhoodsQuery.data, selectedSlug],
  );

  const markers = useMemo<NeighborhoodMarkerData[]>(
    () =>
      neighborhoods
        .filter((neighborhood) => neighborhood.centerLat !== null && neighborhood.centerLng !== null)
        .map((neighborhood) => ({
          id: neighborhood.id,
          name: neighborhood.name,
          slug: neighborhood.slug,
          position: [neighborhood.centerLat!, neighborhood.centerLng!] as [number, number],
          avgPrice: availableValue(neighborhood.sale.medianAskingPrice),
          avgPricePerSqm: availableValue(neighborhood.sale.medianPricePerSqm),
          avgRent: availableValue(neighborhood.rent.medianMonthlyRent),
          properties: neighborhood.activeListings.sale + neighborhood.activeListings.rent,
          growth: null,
        })),
    [neighborhoods],
  );

  const selectedNeighborhood =
    neighborhoods.find((neighborhood) => neighborhood.slug === selectedSlug) ?? null;
  const isLoading =
    summaryQuery.isLoading || neighborhoodsQuery.isLoading || trendsQuery.isLoading;
  const error =
    summaryQuery.error ?? neighborhoodsQuery.error ?? trendsQuery.error;

  if (isLoading) return <TableSkeleton />;

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
          <p className="font-semibold">Could not load Addis Ababa market data</p>
          <p className="mt-1 text-sm text-rose-300/80">
            {error instanceof Error ? error.message : 'The market service did not respond.'}
          </p>
          <button
            onClick={() => {
              void summaryQuery.refetch();
              void neighborhoodsQuery.refetch();
              void trendsQuery.refetch();
            }}
            className="mt-4 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const summary = summaryQuery.data!;
  const trends = trendsQuery.data!;
  const saleMetric = summary.sale.medianAskingPrice;
  const rentMetric = summary.rent.medianMonthlyRent;
  const saleGrowth = trends.comparison.priceChangePct;
  const rentGrowth = trends.comparison.rentChangePct;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PageHero
        icon={Map}
        title="Addis Ababa Market Explorer"
        description={`Live listing medians for the last ${period} months from approved Addis Ababa records.`}
        accent="sky"
        actions={
          <select
            value={period}
            onChange={(event) => setPeriod(Number(event.target.value) as Period)}
            className="rounded-xl border border-white/20 bg-slate-900/70 px-4 py-2 text-white"
            aria-label="Market trend period"
          >
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
            <option value={24}>Last 24 months</option>
          </select>
        }
      />

      <main className="space-y-6 p-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Median sale asking price"
            info={METRIC_HINTS.medianAskingPrice}
            value={formatRecordedAmount(availableValue(saleMetric))}
            note={`${metricNote(saleMetric)} · ETB`}
          />
          <MetricCard
            label="Median monthly rent"
            info={METRIC_HINTS.medianMonthlyRent}
            value={formatRecordedAmount(availableValue(rentMetric))}
            note={`${metricNote(rentMetric)} · ETB/month`}
          />
          <MetricCard
            label={`Active listings (${period} mo)`}
            info={METRIC_HINTS.activeListings}
            value={summary.activeListings.total.toLocaleString()}
            note={`${summary.activeListings.sale} sale · ${summary.activeListings.rent} rent`}
          />
          <MetricCard
            label="Citywide change"
            info={METRIC_HINTS.saleGrowth}
            value={`Sale ${formatPct(saleGrowth)} · Rent ${formatPct(rentGrowth)}`}
            note={trends.comparison.note}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Neighborhood map</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Markers use recorded coordinates; no estimated locations are plotted.
                </p>
              </div>
              <MapPin className="h-5 w-5 text-sky-400" />
            </div>
            {markers.length ? (
              <NeighborhoodMap
                neighborhoods={markers}
                height="520px"
                onNeighborhoodSelect={(marker) => setSelectedSlug(marker.slug)}
              />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl bg-slate-800/50 text-sm text-slate-400">
                No Addis Ababa neighborhoods have verified coordinates yet.
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
              <label htmlFor="market-neighborhood" className="mb-3 block text-sm text-slate-400">
                Focus neighborhood
              </label>
              <select
                id="market-neighborhood"
                value={selectedSlug}
                onChange={(event) => setSelectedSlug(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-800/70 px-4 py-3 text-white"
              >
                <option value="all">All Addis Ababa</option>
                {(neighborhoodsQuery.data ?? []).map((neighborhood) => (
                  <option key={neighborhood.id} value={neighborhood.slug}>
                    {neighborhood.name}
                  </option>
                ))}
              </select>
              {selectedNeighborhood ? (
                <div className="mt-5 space-y-3">
                  <h3 className="text-lg font-bold">{selectedNeighborhood.name}</h3>
                  <p className="text-sm text-slate-400">
                    Median sale: {formatRecordedAmount(availableValue(selectedNeighborhood.sale.medianAskingPrice))}
                    <InfoHint text={METRIC_HINTS.medianAskingPrice} label="Median sale price" />
                  </p>
                  <p className="text-sm text-slate-400">
                    Median rent: {formatRecordedAmount(availableValue(selectedNeighborhood.rent.medianMonthlyRent))}
                    <InfoHint text={METRIC_HINTS.medianMonthlyRent} label="Median rent" />
                  </p>
                  <p className="text-sm text-slate-400">
                    Sale listings: {selectedNeighborhood.activeListings.sale} · Rent listings:{' '}
                    {selectedNeighborhood.activeListings.rent}
                  </p>
                  <button
                    onClick={() =>
                      navigate(`/app/analyst-neighborhoods?neighborhood=${encodeURIComponent(selectedNeighborhood.slug)}`)
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-600/20 px-3 py-2 text-sm text-sky-300 hover:bg-sky-600/30"
                  >
                    <Eye className="h-4 w-4" />
                    Neighborhood analysis
                  </button>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">
                  Select an area to inspect its medians and listing sample.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-sky-400" />
                <h3 className="font-bold">How to read these figures</h3>
              </div>
              <p className="text-sm leading-6 text-slate-400">{summary.basis}</p>
              <p className="mt-3 text-xs text-slate-500">
                Data as of {summary.dataAsOf ? new Date(summary.dataAsOf).toLocaleString() : 'no eligible listings'}.
                {' '}{trends.note}
              </p>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50">
          <div className="flex items-center justify-between border-b border-white/10 p-5">
            <div>
              <h2 className="text-xl font-bold">Addis Ababa neighborhoods</h2>
              <p className="mt-1 text-sm text-slate-400">
                Sale and rent medians are calculated independently from eligible listings.
              </p>
            </div>
            <BarChart3 className="h-5 w-5 text-sky-400" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-white/10">
                  <th className="px-5 py-3 text-left font-medium">Neighborhood</th>
                  <th className="px-5 py-3 text-right font-medium">
                    Median sale
                    <InfoHint text={METRIC_HINTS.medianAskingPrice} label="Median sale price" />
                  </th>
                  <th className="px-5 py-3 text-right font-medium">
                    Sale sample
                    <InfoHint text={METRIC_HINTS.sampleSize} label="Sale sample" />
                  </th>
                  <th className="px-5 py-3 text-right font-medium">
                    Median monthly rent
                    <InfoHint text={METRIC_HINTS.medianMonthlyRent} label="Median monthly rent" />
                  </th>
                  <th className="px-5 py-3 text-right font-medium">
                    Rent sample
                    <InfoHint text={METRIC_HINTS.sampleSize} label="Rent sample" />
                  </th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {neighborhoods.map((neighborhood: PublicNeighborhood) => (
                  <tr key={neighborhood.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="px-5 py-4 font-medium">{neighborhood.name}</td>
                    <td className="px-5 py-4 text-right">
                      {formatRecordedAmount(availableValue(neighborhood.sale.medianAskingPrice))}
                    </td>
                    <td className="px-5 py-4 text-right text-slate-400">
                      {neighborhood.sale.medianAskingPrice.sampleSize}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {formatRecordedAmount(availableValue(neighborhood.rent.medianMonthlyRent))}
                    </td>
                    <td className="px-5 py-4 text-right text-slate-400">
                      {neighborhood.rent.medianMonthlyRent.sampleSize}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() =>
                          navigate(`/app/analyst-neighborhoods?neighborhood=${encodeURIComponent(neighborhood.slug)}`)
                        }
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-300 hover:bg-white/5"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {neighborhoods.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      No Addis Ababa neighborhood records match this selection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
