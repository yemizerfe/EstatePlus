import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Building2,
  Calendar,
  Download,
  FileText,
  Pencil,
  Printer,
} from 'lucide-react';

import { InfoHint, PageHero } from '../../components/ui/kit-core';
import { METRIC_HINTS, indicatorHint } from '../../lib/metricHints';
import { TableSkeleton } from '../../components/ui/kit-blocks';
import { getReport } from '../../api/reports';
import { downloadFile, toCsv } from '../../lib/csv';

/**
 * Generated report view (`/app/analyst-reports/:id`).
 *
 * The backend snapshots market statistics and the latest economic indicators
 * when a report is created, so this page only renders what was stored with the
 * report — it never recomputes figures. "Print / PDF" uses the browser's print
 * dialog, which produces the PDF without a server-side renderer.
 */

interface MarketStatRow {
  id: string;
  period: string;
  avgPrice: string | null;
  medianPrice: string | null;
  pricePerSqm: string | null;
  avgRentalPrice: string | null;
  priceGrowth: string | null;
  rentGrowth: string | null;
  activeListings: number | null;
  sampleSize: number | null;
  propertyType: string | null;
  neighborhood: { name: string } | null;
}

interface MarketSnapshot {
  marketStatistics?: MarketStatRow[];
  propertyCountByType?: Array<{ propertyType: string; _count: { id: number } }>;
  listingCountByStatus?: Array<{ status: string; _count: { id: number } }>;
  generatedAt?: string;
}

interface EconomicIndicatorRow {
  indicatorType: string;
  value: string | number;
  unit?: string | null;
  recordedAt?: string;
  source?: string | null;
}

interface EconomicSnapshot {
  indicators?: Record<string, EconomicIndicatorRow>;
  count?: number;
  generatedAt?: string;
}

const money = (value: string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return numeric.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

const pct = (value: string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return `${numeric > 0 ? '+' : ''}${(numeric * 100).toFixed(1)}%`;
};

const formatDate = (iso: string | undefined | null): string =>
  iso ? new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const reportQuery = useQuery({
    queryKey: ['report', id],
    queryFn: () => getReport(id!),
    enabled: Boolean(id),
  });

  const report = reportQuery.data;
  const marketData = (report?.marketData ?? {}) as MarketSnapshot;
  const economicData = (report?.economicData ?? {}) as EconomicSnapshot;

  const stats = marketData.marketStatistics ?? [];
  const indicators = Object.values(economicData.indicators ?? {});
  const typeCounts = marketData.propertyCountByType ?? [];
  const statusCounts = marketData.listingCountByStatus ?? [];

  const handleExportCsv = () => {
    const rows = stats.map((row) => [
      row.period,
      row.neighborhood?.name ?? 'City-wide',
      row.propertyType ?? 'All types',
      money(row.medianPrice),
      money(row.avgPrice),
      money(row.pricePerSqm),
      money(row.avgRentalPrice),
      row.priceGrowth != null ? pct(row.priceGrowth) : '—',
      row.activeListings ?? '',
      row.sampleSize ?? '',
    ]);

    downloadFile(
      `${(report?.title ?? 'report').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`,
      toCsv(
        ['Period', 'Neighborhood', 'Property type', 'Median price', 'Average price', 'Price per m²', 'Average rent', 'Price growth', 'Active listings', 'Sample size'],
        rows,
      ),
    );
  };

  if (reportQuery.isLoading) return <TableSkeleton />;

  if (reportQuery.isError || !report) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
          <p className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-5 w-5" /> Could not load this report
          </p>
          <p className="mt-1 text-sm text-rose-300/80">
            It may have been deleted, or the reports service did not respond.
          </p>
          <button
            onClick={() => navigate('/app/analyst-reports')}
            className="mt-4 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
          >
            Back to reports
          </button>
        </div>
      </div>
    );
  }

  const sections = (report.description ?? '')
    .replace(/^Sections:\s*/i, '')
    .split(',')
    .map((section) => section.trim())
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="print:hidden">
        <PageHero
          icon={FileText}
          title={report.title}
          description={report.description ?? 'Market report'}
          accent="amber"
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => navigate('/app/analyst-reports')}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2 transition-colors hover:bg-slate-700/50"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <Link
                to={`/app/analyst-reports/edit/${report.id}`}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2 transition-colors hover:bg-slate-700/50"
              >
                <Pencil className="w-4 h-4" /> Edit
              </Link>
              <button
                onClick={handleExportCsv}
                disabled={!stats.length}
                className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-600/20 px-4 py-2 text-amber-300 transition-colors hover:bg-amber-600/30 disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> Export data
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-600/20 px-4 py-2 text-amber-300 transition-colors hover:bg-amber-600/30"
              >
                <Printer className="w-4 h-4" /> Print / PDF
              </button>
            </div>
          }
        />
      </div>

      <div className="p-6 print:p-0">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
              <div className="text-xs uppercase tracking-wider text-gray-400">Period</div>
              <div className="mt-1 text-lg font-bold text-white">{report.period ?? 'Not set'}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
              <div className="text-xs uppercase tracking-wider text-gray-400">Author</div>
              <div className="mt-1 text-lg font-bold text-white">{report.author.name?.trim() || report.author.email}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
              <div className="text-xs uppercase tracking-wider text-gray-400">Generated</div>
              <div className="mt-1 text-lg font-bold text-white">{formatDate(report.generatedAt)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
              <div className="text-xs uppercase tracking-wider text-gray-400">Market rows</div>
              <div className="mt-1 text-lg font-bold text-white">{stats.length}</div>
            </div>
          </div>

          {sections.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
                <Calendar className="h-4 w-4 text-amber-400" /> Requested sections
              </h2>
              <div className="flex flex-wrap gap-2">
                {sections.map((section) => (
                  <span
                    key={section}
                    className="rounded-full border border-white/10 bg-slate-800/60 px-3 py-1 text-xs font-medium text-gray-200"
                  >
                    {section}
                  </span>
                ))}
              </div>
            </div>
          )}

          <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-white">
              <BarChart3 className="h-4 w-4 text-amber-400" /> Market statistics
            </h2>
            <p className="mb-4 text-sm text-gray-400">
              Snapshot stored with this report on {formatDate(marketData.generatedAt)}.
            </p>

            {stats.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-gray-300">
                No market statistics were recorded for the selected period, so the report contains no
                market table. Generate a report for a period that has listings.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-300">
                      <th className="px-3 py-2 text-left">Period</th>
                      <th className="px-3 py-2 text-left">Neighborhood</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-right">
                        Median
                        <InfoHint text={METRIC_HINTS.medianAskingPrice} label="Median price" />
                      </th>
                      <th className="px-3 py-2 text-right">
                        Avg
                        <InfoHint text={METRIC_HINTS.averageAskingPrice} label="Average price" />
                      </th>
                      <th className="px-3 py-2 text-right">
                        Price/m²
                        <InfoHint text={METRIC_HINTS.pricePerSqm} label="Price per square metre" />
                      </th>
                      <th className="px-3 py-2 text-right">
                        Avg rent
                        <InfoHint text={METRIC_HINTS.averageMonthlyRent} label="Average rent" />
                      </th>
                      <th className="px-3 py-2 text-right">
                        Growth
                        <InfoHint text={METRIC_HINTS.saleGrowth} label="Price growth" />
                      </th>
                      <th className="px-3 py-2 text-right">
                        Listings
                        <InfoHint text={METRIC_HINTS.activeListings} label="Active listings" />
                      </th>
                      <th className="px-3 py-2 text-right">
                        n
                        <InfoHint text={METRIC_HINTS.sampleSize} label="Sample size" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((row) => (
                      <tr key={row.id} className="border-b border-white/5">
                        <td className="px-3 py-2 text-white">{row.period}</td>
                        <td className="px-3 py-2 text-gray-200">{row.neighborhood?.name ?? 'City-wide'}</td>
                        <td className="px-3 py-2 text-gray-300">{row.propertyType ?? 'All'}</td>
                        <td className="px-3 py-2 text-right text-white">{money(row.medianPrice)}</td>
                        <td className="px-3 py-2 text-right text-gray-300">{money(row.avgPrice)}</td>
                        <td className="px-3 py-2 text-right text-gray-300">{money(row.pricePerSqm)}</td>
                        <td className="px-3 py-2 text-right text-gray-300">{money(row.avgRentalPrice)}</td>
                        <td className="px-3 py-2 text-right text-gray-300">{pct(row.priceGrowth)}</td>
                        <td className="px-3 py-2 text-right text-gray-300">{row.activeListings ?? '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-300">{row.sampleSize ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                <Building2 className="h-4 w-4 text-amber-400" /> Property mix
                <InfoHint text={METRIC_HINTS.propertyTypeMix} label="Property mix" />
              </h2>
              {typeCounts.length === 0 ? (
                <p className="text-sm text-gray-400">No property types were recorded.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {typeCounts.map((row) => (
                    <li key={row.propertyType} className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-gray-300">{row.propertyType.toLowerCase().replace('_', ' ')}</span>
                      <span className="font-semibold text-white">{row._count.id}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
              <h2 className="mb-4 text-lg font-bold text-white">Listing status</h2>
              {statusCounts.length === 0 ? (
                <p className="text-sm text-gray-400">No listings were recorded.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {statusCounts.map((row) => (
                    <li key={row.status} className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-gray-300">{row.status.toLowerCase()}</span>
                      <span className="font-semibold text-white">{row._count.id}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
            <h2 className="mb-1 text-lg font-bold text-white">Economic indicators</h2>
            <p className="mb-4 text-sm text-gray-400">
              Latest observation of each indicator at generation time ({economicData.count ?? 0} records scanned).
            </p>

            {indicators.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-gray-300">
                No economic indicators were recorded for the selected period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-300">
                      <th className="px-3 py-2 text-left">Indicator</th>
                      <th className="px-3 py-2 text-right">Value</th>
                      <th className="px-3 py-2 text-left">Recorded</th>
                      <th className="px-3 py-2 text-left">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indicators.map((indicator) => (
                      <tr key={indicator.indicatorType} className="border-b border-white/5">
                        <td className="px-3 py-2 text-white">
                          {indicator.indicatorType.replace(/_/g, ' ').toLowerCase()}
                          {indicatorHint(indicator.indicatorType) && (
                            <InfoHint
                              text={indicatorHint(indicator.indicatorType)!}
                              label={indicator.indicatorType.replace(/_/g, ' ').toLowerCase()}
                            />
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-200">
                          {money(String(indicator.value))}
                          {indicator.unit ? ` ${indicator.unit}` : ''}
                        </td>
                        <td className="px-3 py-2 text-gray-300">{formatDate(indicator.recordedAt)}</td>
                        <td className="px-3 py-2 text-gray-400">{indicator.source ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {report.analysis && (
            <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
              <h2 className="mb-3 text-lg font-bold text-white">Analysis</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-gray-300">{report.analysis}</p>
            </section>
          )}

          {report.conclusions && (
            <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
              <h2 className="mb-3 text-lg font-bold text-white">Conclusions</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-gray-300">{report.conclusions}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
