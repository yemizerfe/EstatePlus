import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Database, 
  RefreshCw,
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  Eye,
  Plus,
  Search,
  Download,
  Activity
} from 'lucide-react';
import { InfoHint, PageHero } from '../../components/ui/kit-core';
import { TableSkeleton } from '../../components/ui/kit-blocks';

import {
  createDataSource,
  getDataSources,
  getDataSourceStats,
  type DataSourceRecord,
  type DataSourceJob,
} from '../../api/dataSources';
import { downloadFile } from '../../lib/csv';

type SourceStatus = 'connected' | 'syncing' | 'warning' | 'error' | 'disconnected';

interface SyncEntry {
  id: string;
  timestamp: string;
  status: 'success' | 'partial' | 'failed' | 'pending';
  recordsProcessed: number;
  duration: number;
  errors: string[];
  message: string;
}

const jobStatusToSourceStatus = (job: DataSourceJob | undefined): SourceStatus => {
  if (!job) return 'disconnected';
  switch (job.status) {
    case 'completed':
      return job.recordsRejected > 0 ? 'warning' : 'connected';
    case 'processing':
    case 'pending':
      return 'syncing';
    case 'failed':
      return 'error';
    default:
      return 'disconnected';
  }
};

const jobStatusToHistoryStatus = (status: DataSourceJob['status']): SyncEntry['status'] => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
};

const mapDataSource = (source: DataSourceRecord): DataSource => {
  const jobs = source.recentJobs ?? [];
  const latest = jobs[0];
  const totals = jobs.reduce(
    (acc, job) => ({
      received: acc.received + job.recordsReceived,
      valid: acc.valid + job.recordsValid,
      rejected: acc.rejected + job.recordsRejected,
    }),
    { received: 0, valid: 0, rejected: 0 },
  );

  const successRate =
    totals.received > 0 ? (totals.valid / totals.received) * 100 : 0;

  return {
    id: source.id,
    name: source.name,
    type: source.sourceType,
    category: source.sourceType,
    status: jobStatusToSourceStatus(latest),
    lastSync: latest?.completedAt ?? latest?.startedAt ?? source.createdAt,
    nextSync: null,
    recordsImported: totals.valid,
    errorCount: totals.rejected,
    successRate,
    dataTypes: [],
    frequency: latest ? 'On demand' : 'Never run',
    endpoint: source.sourceType,
    description: source.description ?? 'No description recorded for this source.',
    configuration: {
      creator: source.creator?.name ?? 'System',
      jobsRecorded: jobs.length,
    },
    health: {
      uptime: null,
      avgResponseTime: null,
      lastError: latest?.status === 'failed' ? 'Most recent import failed' : null,
    },
  };
};

const mapSyncHistory = (source: DataSourceRecord): SyncEntry[] =>
  (source.recentJobs ?? []).map((job) => {
    const started = job.startedAt ? new Date(job.startedAt).getTime() : null;
    const finished = job.completedAt ? new Date(job.completedAt).getTime() : null;
    return {
      id: job.id,
      timestamp: job.startedAt ?? job.completedAt ?? source.createdAt,
      status: jobStatusToHistoryStatus(job.status),
      recordsProcessed: job.recordsValid,
      duration: started != null && finished != null ? Math.max(0, Math.round((finished - started) / 1000)) : 0,
      errors: job.recordsRejected > 0 ? [`${job.recordsRejected} records rejected`] : [],
      message:
        job.status === 'completed'
          ? `Imported ${job.recordsValid} of ${job.recordsReceived} records`
          : job.status === 'failed'
            ? 'Import failed'
            : `Import ${job.status}`,
    };
  });

interface DataSource {
  id: string;
  name: string;
  type: string;
  category: string;
  status: SourceStatus;
  lastSync: string;
  nextSync: string | null;
  recordsImported: number;
  errorCount: number;
  successRate: number;
  dataTypes: string[];
  frequency: string;
  endpoint: string;
  description: string;
  configuration: Record<string, string | number | boolean>;
  health: {
    uptime: number | null;
    avgResponseTime: number | null;
    lastError: string | null;
  };
}

export default function DataSourcesPage() {
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSource, setNewSource] = useState({ name: '', sourceType: 'csv', description: '' });
  const [addError, setAddError] = useState('');
  const queryClient = useQueryClient();

  // Data queries
  const { data: sourcesData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['data-sources'],
    queryFn: () => getDataSources({ limit: 100 }),
  });

  const { data: stats } = useQuery({
    queryKey: ['data-source-stats'],
    queryFn: getDataSourceStats,
  });

  const sources = (sourcesData?.dataSources ?? []).map(mapDataSource);

  const historyData = selectedSource
    ? mapSyncHistory(sourcesData?.dataSources.find((s) => s.id === selectedSource.id) ?? {
        id: selectedSource.id,
        name: selectedSource.name,
        sourceType: selectedSource.type,
        description: selectedSource.description,
        creator: null,
        recentJobs: [],
        createdAt: selectedSource.lastSync,
      })
    : [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'syncing':
        return <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'disconnected':
        return <XCircle className="w-5 h-5 text-gray-400" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      connected: 'bg-green-500/20 text-green-400 border-green-500/30',
      syncing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      error: 'bg-red-500/20 text-red-400 border-red-500/30',
      disconnected: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      success: 'bg-green-500/20 text-green-400 border-green-500/30',
      partial: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      pending: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles] || styles.disconnected}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const createSourceMutation = useMutation({
    mutationFn: () =>
      createDataSource({
        name: newSource.name.trim(),
        sourceType: newSource.sourceType,
        description: newSource.description.trim() || undefined,
      }),
    onSuccess: () => {
      setShowAddSource(false);
      setNewSource({ name: '', sourceType: 'csv', description: '' });
      setAddError('');
      void queryClient.invalidateQueries({ queryKey: ['data-sources'] });
      void queryClient.invalidateQueries({ queryKey: ['data-source-stats'] });
    },
    onError: (mutationError: any) => {
      setAddError(
        mutationError?.response?.data?.message ||
          mutationError?.message ||
          'Could not register the data source.',
      );
    },
  });

  /** Download the registry (with its recent job summary) as JSON. */
  const handleExportConfig = () => {
    downloadFile(
      `data-sources-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          totalSources: sourcesData?.total ?? sources.length,
          sources: (sourcesData?.dataSources ?? []).map((source) => ({
            id: source.id,
            name: source.name,
            sourceType: source.sourceType,
            description: source.description,
            createdAt: source.createdAt,
            recentJobs: source.recentJobs,
          })),
        },
        null,
        2,
      ),
      'application/json;charset=utf-8',
    );
  };

  const handleViewSource = (source: DataSource) => {
    setSelectedSource(source);
    setShowHistory(false);
  };

  const handleViewHistory = (source: DataSource) => {
    setSelectedSource(source);
    setShowHistory(true);
  };

  const filteredSources = sources.filter(source => {
    const matchesSearch = source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         source.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || source.status === filterStatus;
    const matchesCategory = filterCategory === 'all' || source.category === filterCategory;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  if (isLoading) return <TableSkeleton />;

  if (isError) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
          <p className="font-semibold">Could not load data sources</p>
          <p className="mt-1 text-sm text-rose-300/80">
            {error instanceof Error ? error.message : 'The data-source service did not respond.'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <PageHero
        icon={Database}
        title="Data Sources"
        description="Manage external data sources and synchronization"
        accent="sky"
        actions={
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setAddError('');
                setShowAddSource(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 rounded-xl text-sky-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Source
            </button>
            <button
              onClick={handleExportConfig}
              disabled={!sources.length}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-white/10 rounded-xl transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export Config
            </button>
          </div>
        }
      />

      <div className="p-6">
        {/* Registry summary */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
            <div className="flex items-center text-xs uppercase tracking-wider text-gray-400">
              Registered Sources
              <InfoHint
                text="The number of external data providers configured for this platform, whether or not they have run yet. It says nothing about how reliable each one is."
                label="Registered sources"
              />
            </div>
            <div className="mt-1 text-2xl font-bold text-white">
              {(stats?.totalSources ?? sources.length).toLocaleString()}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
            <div className="flex items-center text-xs uppercase tracking-wider text-gray-400">
              Imports (7 days)
              <InfoHint
                text="How many import jobs ran in the last seven days, counting each attempt once. A retried job appears as a separate run."
                label="Imports in the last 7 days"
              />
            </div>
            <div className="mt-1 text-2xl font-bold text-white">
              {(stats?.recentJobsCount ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
            <div className="flex items-center text-xs uppercase tracking-wider text-gray-400">
              Success Rate (7 days)
              <InfoHint
                text="Completed import jobs divided by all import jobs attempted in the last seven days, as a percentage. 100% means every run finished without an error."
                label="Success rate"
              />
            </div>
            <div className="mt-1 text-2xl font-bold text-white">
              {(stats?.successRate ?? 0).toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search data sources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="connected">Connected</option>
              <option value="syncing">Syncing</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="disconnected">Disconnected</option>
            </select>

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              {Array.from(new Set(sources.map((source) => source.category))).map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            {/* Sync All Button */}
            <button
              onClick={handleRefresh}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 rounded-xl text-sky-400 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Data Sources Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {filteredSources?.map((source) => (
            <div key={source.id} className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusIcon(source.status)}
                    <h3 className="text-lg font-bold text-white">{source.name}</h3>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{source.description}</p>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(source.status)}
                    <span className="px-2 py-1 bg-slate-700/50 text-gray-300 rounded-full text-xs">
                      {source.type}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-slate-800/50 rounded-xl">
                  <div className="text-lg font-bold text-white">{source.recordsImported.toLocaleString()}</div>
                  <div className="flex items-center text-xs text-gray-400">
                    Records Imported
                    <InfoHint
                      text="Total rows this source has written into the database. Re-importing the same listing updates it rather than creating a duplicate, so this is a count of stored records, not of downloads."
                      label="Records imported"
                    />
                  </div>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-xl">
                  <div className="text-lg font-bold text-white">{source.successRate.toFixed(1)}%</div>
                  <div className="flex items-center text-xs text-gray-400">
                    Success Rate
                    <InfoHint
                      text="Share of this source's sync attempts that finished without an error. A low figure usually means the source page changed shape or was temporarily unreachable."
                      label="Success rate"
                    />
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Last Sync</span>
                  <span className="text-white">{new Date(source.lastSync).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Frequency</span>
                  <span className="text-white">{source.frequency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Errors</span>
                  <span className={source.errorCount > 0 ? 'text-red-400' : 'text-green-400'}>
                    {source.errorCount}
                  </span>
                </div>
                {source.health.uptime !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Uptime</span>
                    <span className="text-white">{source.health.uptime.toFixed(1)}%</span>
                  </div>
                )}
              </div>

              {/* Data Types */}
              <div className="mb-4">
                <div className="text-xs text-gray-400 mb-2">Data Types</div>
                <div className="flex flex-wrap gap-1">
                  {source.dataTypes.length ? (
                    source.dataTypes.map((type, index) => (
                      <span key={index} className="px-2 py-1 bg-sky-500/20 text-sky-400 text-xs rounded-full">
                        {type}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-500">
                      {source.frequency === 'Never run'
                        ? 'No imports recorded'
                        : 'Detected from import payloads'}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleViewSource(source)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 rounded-lg text-sky-400 text-sm transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>
                <button
                  onClick={() => handleViewHistory(source)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-white/10 rounded-lg text-gray-400 text-sm transition-colors"
                >
                  <Activity className="w-4 h-4" />
                  History
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  title="Refresh source status"
                  className="flex items-center justify-center p-2 bg-slate-800/50 hover:bg-slate-700/50 border border-white/10 rounded-lg text-gray-400 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Source Detail Modal */}
        {selectedSource && !showHistory && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">{selectedSource.name}</h2>
                <button
                  onClick={() => setSelectedSource(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Configuration */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Configuration</h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <div className="text-gray-400 text-sm">Endpoint</div>
                      <div className="text-white font-mono text-sm break-all">{selectedSource.endpoint}</div>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <div className="text-gray-400 text-sm">Type</div>
                      <div className="text-white">{selectedSource.type}</div>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <div className="text-gray-400 text-sm">Frequency</div>
                      <div className="text-white">{selectedSource.frequency}</div>
                    </div>
                    {Object.entries(selectedSource.configuration).map(([key, value]) => (
                      <div key={key} className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="text-gray-400 text-sm capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
                        <div className="text-white font-mono text-sm">
                          {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Health & Status */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Health & Performance</h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <div className="text-gray-400 text-sm">Status</div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(selectedSource.status)}
                        <span className="text-white capitalize">{selectedSource.status}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <div className="text-gray-400 text-sm">Uptime</div>
                      <div className="text-white">{selectedSource.health.uptime?.toFixed(1)}%</div>
                    </div>
                    {selectedSource.health.avgResponseTime && (
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="text-gray-400 text-sm">Avg Response Time</div>
                        <div className="text-white">{selectedSource.health.avgResponseTime}ms</div>
                      </div>
                    )}
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <div className="text-gray-400 text-sm">Success Rate</div>
                      <div className="text-white">{selectedSource.successRate.toFixed(1)}%</div>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <div className="text-gray-400 text-sm">Total Records</div>
                      <div className="text-white">{selectedSource.recordsImported.toLocaleString()}</div>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <div className="text-gray-400 text-sm">Error Count</div>
                      <div className={selectedSource.errorCount > 0 ? 'text-red-400' : 'text-green-400'}>
                        {selectedSource.errorCount}
                      </div>
                    </div>
                    {selectedSource.health.lastError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <div className="text-red-400 text-sm">Last Error</div>
                        <div className="text-red-300 text-sm">{selectedSource.health.lastError}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* History Modal */}
        {selectedSource && showHistory && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">{selectedSource.name} - Sync History</h2>
                <button
                  onClick={() => setSelectedSource(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>

              {historyData.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No import runs recorded for this source yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-gray-300">Timestamp</th>
                        <th className="text-center py-3 px-4 text-gray-300">Status</th>
                        <th className="text-right py-3 px-4 text-gray-300">Records</th>
                        <th className="text-right py-3 px-4 text-gray-300">Duration</th>
                        <th className="text-left py-3 px-4 text-gray-300">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.map((entry) => (
                        <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-3 px-4 text-white">
                            {new Date(entry.timestamp).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {getStatusBadge(entry.status)}
                          </td>
                          <td className="py-3 px-4 text-right text-white">
                            {entry.recordsProcessed.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-300">
                            {formatDuration(entry.duration)}
                          </td>
                          <td className="py-3 px-4 text-gray-300">
                            <div>{entry.message}</div>
                            {entry.errors.length > 0 && (
                              <div className="text-red-400 text-sm mt-1">
                                {entry.errors.join(', ')}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Source modal */}
      {showAddSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6">
            <h2 className="text-xl font-bold text-white">Register a data source</h2>
            <p className="mt-1 text-sm text-gray-400">
              Sources group the import jobs recorded for a feed, file or manual entry stream.
            </p>

            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!newSource.name.trim()) {
                  setAddError('Give the source a name.');
                  return;
                }
                createSourceMutation.mutate();
              }}
            >
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">Name</label>
                <input
                  value={newSource.name}
                  onChange={(event) => setNewSource({ ...newSource, name: event.target.value })}
                  placeholder="e.g. Real.et weekly feed"
                  className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2 text-white placeholder-gray-500 focus:border-transparent focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">Source type</label>
                <select
                  value={newSource.sourceType}
                  onChange={(event) => setNewSource({ ...newSource, sourceType: event.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2 text-white focus:border-transparent focus:ring-2 focus:ring-sky-500"
                >
                  {['csv', 'excel', 'api', 'scraper', 'manual', 'external_feed', 'other'].map((type) => (
                    <option key={type} value={type}>
                      {type.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">Description</label>
                <textarea
                  value={newSource.description}
                  onChange={(event) => setNewSource({ ...newSource, description: event.target.value })}
                  rows={3}
                  placeholder="What does this source provide?"
                  className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2 text-white placeholder-gray-500 focus:border-transparent focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {addError && (
                <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                  {addError}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSource(false)}
                  className="rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-slate-700/50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSourceMutation.isPending}
                  className="rounded-xl border border-sky-500/30 bg-sky-600/20 px-4 py-2 text-sm font-semibold text-sky-300 hover:bg-sky-600/30 disabled:opacity-50"
                >
                  {createSourceMutation.isPending ? 'Saving…' : 'Create source'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}