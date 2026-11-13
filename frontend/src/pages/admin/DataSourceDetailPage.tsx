import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Database,
  Pencil,
  Trash2,
  Save,
  X,
  AlertTriangle,
  ExternalLink,
  FileText,
  User as UserIcon,
} from 'lucide-react';

import ConfirmDialog from '../../components/admin/ConfirmDialog';
import {
  deleteDataSource,
  getDataSource,
  updateDataSource,
} from '../../api/dataSources';
import { JobStatusBadge } from './DataSourcesPage';

const typeLabel = (type: string) =>
  type
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString() : '—';

const DataSourceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', sourceType: '', description: '' });

  const detailQuery = useQuery({
    queryKey: ['admin-data-source', id],
    queryFn: () => getDataSource(id as string),
    enabled: Boolean(id),
  });

  const source = detailQuery.data;

  useEffect(() => {
    if (source) {
      setForm({
        name: source.name,
        sourceType: source.sourceType,
        description: source.description ?? '',
      });
    }
  }, [source]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateDataSource(id as string, {
        name: form.name.trim(),
        sourceType: form.sourceType,
        description: form.description.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-data-source', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-data-sources'] });
      setIsEditing(false);
      setError('');
    },
    onError: (err: any) =>
      setError(err?.response?.data?.message || 'Could not save this data source'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDataSource(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-data-sources'] });
      queryClient.invalidateQueries({ queryKey: ['admin-data-source-stats'] });
      navigate('/admin/data-sources');
    },
    onError: (err: any) => {
      setConfirmDelete(false);
      setError(err?.response?.data?.message || 'Could not delete this data source');
    },
  });

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 rounded-xl bg-slate-800/60 animate-pulse" />
        <div className="h-64 rounded-2xl bg-slate-800/50 border border-white/10 animate-pulse" />
      </div>
    );
  }

  if (detailQuery.isError || !source) {
    return (
      <div className="space-y-4">
        <Link
          to="/admin/data-sources"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> All data sources
        </Link>
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
          <p className="font-semibold text-red-300">Data source not available</p>
          <p className="text-sm text-red-200/80 mt-1">
            {(detailQuery.error as any)?.response?.data?.message ||
              'It may have been deleted, or the link is wrong.'}
          </p>
        </div>
      </div>
    );
  }

  const totals = source.importJobs.reduce(
    (acc, job) => ({
      received: acc.received + job.recordsReceived,
      valid: acc.valid + job.recordsValid,
      rejected: acc.rejected + job.recordsRejected,
    }),
    { received: 0, valid: 0, rejected: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/admin/data-sources"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" /> All data sources
          </Link>
          <div className="flex items-center gap-3 mt-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{source.name}</h1>
              <p className="text-sm text-gray-400">{typeLabel(source.sourceType)}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/60 border border-white/10 text-gray-200 hover:bg-white/5"
            >
              <Pencil className="w-4 h-4" /> Edit
            </button>
          ) : (
            <button
              onClick={() => {
                setIsEditing(false);
                setError('');
                setForm({
                  name: source.name,
                  sourceType: source.sourceType,
                  description: source.description ?? '',
                });
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/60 border border-white/10 text-gray-200 hover:bg-white/5"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          )}
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <h2 className="font-semibold text-white mb-4">Details</h2>
            {isEditing ? (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!form.name.trim()) {
                    setError('A name is required');
                    return;
                  }
                  updateMutation.mutate();
                }}
              >
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                  <input
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                  <input
                    value={form.sourceType}
                    onChange={(event) => setForm({ ...form, sourceType: event.target.value })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {updateMutation.isPending ? 'Saving…' : 'Save changes'}
                </button>
              </form>
            ) : (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Type</dt>
                  <dd className="text-sm text-white mt-1">{typeLabel(source.sourceType)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Created</dt>
                  <dd className="text-sm text-white mt-1">{formatDateTime(source.createdAt)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Description</dt>
                  <dd className="text-sm text-gray-300 mt-1 whitespace-pre-line">
                    {source.description?.trim() || 'No description recorded.'}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Created by</dt>
                  <dd className="text-sm text-white mt-1 flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-gray-500" />
                    {source.creator
                      ? `${source.creator.firstName} ${source.creator.lastName} (${source.creator.email})`
                      : 'Creator account removed'}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="font-semibold text-white">Recent import jobs</h2>
              <Link
                to="/admin/import"
                className="text-sm text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
              >
                Import data <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
            {source.importJobs.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  No import jobs have used this source yet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {source.importJobs.map((job) => (
                  <div key={job.id} className="px-6 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm text-white">
                        <span className="font-medium">{job.jobType}</span>
                        {job.fileName && (
                          <span className="text-gray-500 truncate max-w-[220px]">
                            {job.fileName}
                          </span>
                        )}
                      </div>
                      <JobStatusBadge status={job.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
                      <span>{job.recordsReceived.toLocaleString()} received</span>
                      <span>{job.recordsValid.toLocaleString()} valid</span>
                      <span>{job.recordsRejected.toLocaleString()} rejected</span>
                      <span>Started {formatDateTime(job.startedAt)}</span>
                      <span>Finished {formatDateTime(job.completedAt)}</span>
                    </div>
                    {job.errorLog && (
                      <p className="mt-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2 whitespace-pre-line">
                        {job.errorLog}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <h2 className="font-semibold text-white mb-4">Import totals</h2>
            <div className="space-y-3">
              {[
                { label: 'Jobs shown', value: source.importJobs.length },
                { label: 'Records received', value: totals.received },
                { label: 'Records valid', value: totals.valid },
                { label: 'Records rejected', value: totals.rejected },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{row.label}</span>
                  <span className="font-medium text-white">{row.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Totals cover the most recent {source.importJobs.length} job
              {source.importJobs.length === 1 ? '' : 's'} recorded against this source.
            </p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <h2 className="font-semibold text-white mb-2">Live integrations</h2>
            <p className="text-sm text-gray-400">
              Scheduled feeds (NBE, World Bank, CBE, OSM) sync from the integrations screen, not
              from a stored data source.
            </p>
            <Link
              to="/admin/integrations"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300"
            >
              Open integrations <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete data source?"
        message={
          source.importJobs.length > 0
            ? 'This source is referenced by import jobs and the server may refuse to delete it. Those jobs keep their own records; only this source entry is removed.'
            : 'This removes the source entry from the registry. This cannot be undone.'
        }
        confirmText={deleteMutation.isPending ? 'Deleting…' : 'Delete'}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

export default DataSourceDetailPage;
