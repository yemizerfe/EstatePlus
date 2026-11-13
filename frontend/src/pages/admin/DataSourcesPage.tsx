import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Database,
  Search,
  RefreshCw,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
  Layers,
} from 'lucide-react';

import {
  createDataSource,
  getDataSources,
  getDataSourceStats,
  type DataSourceJob,
} from '../../api/dataSources';

const PAGE_SIZE = 12;

const SOURCE_TYPES = [
  'CSV_UPLOAD',
  'EXCEL_UPLOAD',
  'API',
  'SCRAPER',
  'MANUAL_ENTRY',
  'EXTERNAL_FEED',
  'OTHER',
];

const typeLabel = (type: string) =>
  type
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const JobStatusBadge: React.FC<{ status: DataSourceJob['status'] }> = ({ status }) => {
  const styles: Record<string, string> = {
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  const icons: Record<string, React.ReactNode> = {
    completed: <CheckCircle2 className="w-3.5 h-3.5" />,
    processing: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
    pending: <Clock className="w-3.5 h-3.5" />,
    failed: <XCircle className="w-3.5 h-3.5" />,
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${
        styles[status] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      }`}
    >
      {icons[status]}
      {status}
    </span>
  );
};

const AddSourceModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}> = ({ isOpen, onClose, onCreated }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    sourceType: 'API',
    description: '',
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createDataSource({
        name: form.name.trim(),
        sourceType: form.sourceType,
        description: form.description.trim() || undefined,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['admin-data-sources'] });
      queryClient.invalidateQueries({ queryKey: ['admin-data-source-stats'] });
      setForm({ name: '', sourceType: 'API', description: '' });
      setError('');
      onCreated(created.id);
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Could not create data source');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="flex items-start justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white">Add data source</h2>
            <p className="text-sm text-gray-400 mt-1">
              Register the origin of the data your team imports.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          className="p-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.name.trim()) {
              setError('A name is required');
              return;
            }
            setError('');
            mutation.mutate();
          }}
        >
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="e.g. RE/MAX Addis listings export"
              className="w-full px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
            <select
              value={form.sourceType}
              onChange={(event) => setForm({ ...form, sourceType: event.target.value })}
              className="w-full px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50"
            >
              {SOURCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {typeLabel(type)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              rows={3}
              placeholder="Who provides it, how often it is delivered, licence notes…"
              className="w-full px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-white/20 text-gray-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium disabled:opacity-50"
            >
              {mutation.isPending ? 'Creating…' : 'Create data source'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DataSourcesPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [sourceType, setSourceType] = useState('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const statsQuery = useQuery({
    queryKey: ['admin-data-source-stats'],
    queryFn: getDataSourceStats,
  });

  const listQuery = useQuery({
    queryKey: ['admin-data-sources', page, sourceType],
    queryFn: () =>
      getDataSources({
        page,
        limit: PAGE_SIZE,
        ...(sourceType ? { sourceType } : {}),
      }),
  });

  const sources = listQuery.data?.dataSources ?? [];
  const filtered = search.trim()
    ? sources.filter((source) => {
        const needle = search.trim().toLowerCase();
        return (
          source.name.toLowerCase().includes(needle) ||
          source.sourceType.toLowerCase().includes(needle) ||
          (source.description ?? '').toLowerCase().includes(needle)
        );
      })
    : sources;

  const stats = statsQuery.data;

  const statCards = [
    { label: 'Data sources', value: stats ? stats.totalSources.toLocaleString() : '—' },
    {
      label: 'Import jobs (30d)',
      value: stats ? stats.recentJobsCount.toLocaleString() : '—',
    },
    {
      label: 'Successful jobs (30d)',
      value: stats ? stats.successfulJobsCount.toLocaleString() : '—',
    },
    {
      label: 'Success rate',
      value: stats ? `${stats.successRate.toFixed(1)}%` : '—',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Data Sources
          </h1>
          <p className="text-gray-400 mt-1">
            Origins recorded for every imported dataset, with their recent import activity.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 shadow-lg shadow-blue-500/20 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Data Source
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-5"
          >
            <p className="text-sm text-gray-400">{card.label}</p>
            <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search sources on this page"
            className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <select
          value={sourceType}
          onChange={(event) => {
            setSourceType(event.target.value);
            setPage(1);
          }}
          className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50"
        >
          <option value="">All types</option>
          {SOURCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {typeLabel(type)}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            listQuery.refetch();
            statsQuery.refetch();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-gray-300 hover:bg-white/5"
        >
          <RefreshCw className={`w-4 h-4 ${listQuery.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {listQuery.isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="h-28 rounded-2xl bg-slate-800/50 border border-white/10 animate-pulse"
            />
          ))}
        </div>
      ) : listQuery.isError ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
          <div>
            <p className="font-semibold text-red-300">Could not load data sources</p>
            <p className="text-sm text-red-200/80 mt-1">
              {(listQuery.error as any)?.response?.data?.message ||
                (listQuery.error as Error)?.message}
            </p>
            <button
              onClick={() => listQuery.refetch()}
              className="mt-3 text-sm font-medium text-red-200 underline"
            >
              Try again
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-12 text-center">
          <Layers className="w-10 h-10 text-gray-500 mx-auto mb-3" />
          <p className="text-white font-semibold">
            {sources.length === 0 ? 'No data sources yet' : 'Nothing matches your search'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {sources.length === 0
              ? 'Add the origin of your first dataset to keep imports traceable.'
              : 'Clear the search box to see every source on this page.'}
          </p>
          {sources.length === 0 && (
            <button
              onClick={() => setShowAdd(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600"
            >
              <Plus className="w-4 h-4" /> Add Data Source
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map((source) => {
            const latest = source.recentJobs[0];
            return (
              <button
                key={source.id}
                onClick={() => navigate(`/admin/data-sources/${source.id}`)}
                className="text-left bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6 hover:border-blue-500/40 hover:shadow-lg transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
                      <Database className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{source.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {typeLabel(source.sourceType)}
                      </p>
                    </div>
                  </div>
                  {latest && <JobStatusBadge status={latest.status} />}
                </div>

                {source.description && (
                  <p className="text-sm text-gray-400 mt-3 line-clamp-2">{source.description}</p>
                )}

                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/10">
                  <div>
                    <p className="text-xs text-gray-500">Import jobs</p>
                    <p className="text-sm font-medium text-white mt-1">
                      {source.recentJobs.length} recent
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Records received</p>
                    <p className="text-sm font-medium text-white mt-1">
                      {source.recentJobs
                        .reduce((total, job) => total + job.recordsReceived, 0)
                        .toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Added</p>
                    <p className="text-sm font-medium text-white mt-1">
                      {new Date(source.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-3">
                  {source.creator ? `Created by ${source.creator.name}` : 'Creator removed'}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {listQuery.data && listQuery.data.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Page {listQuery.data.page} of {listQuery.data.pages} ·{' '}
            {listQuery.data.total.toLocaleString()} sources
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={!listQuery.data.hasPrev}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="p-2 rounded-lg border border-white/10 text-gray-300 disabled:opacity-40 hover:bg-white/5"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={!listQuery.data.hasNext}
              onClick={() => setPage((current) => current + 1)}
              className="p-2 rounded-lg border border-white/10 text-gray-300 disabled:opacity-40 hover:bg-white/5"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <AddSourceModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={(id) => {
          setShowAdd(false);
          navigate(`/admin/data-sources/${id}`);
        }}
      />
    </div>
  );
};

export default DataSourcesPage;
