import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Download, X, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

import { apiClient } from '../../api/client';
import DataTable from '../../components/admin/DataTable';

interface AuditLogRow {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

interface AuditLogPage {
  logs: AuditLogRow[];
  total: number;
  page: number;
  pages: number;
}

const PAGE_SIZE = 20;
const FETCH_LIMIT = 200;

const RANGES: Record<string, number> = {
  today: 1,
  '7days': 7,
  '30days': 30,
  '90days': 90,
};

const fetchAuditLogs = async (rangeKey: string): Promise<AuditLogPage> => {
  const days = RANGES[rangeKey] ?? 7;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await apiClient.get<{ data: AuditLogPage }>('/admin/audit-logs', {
    params: { startDate, limit: FETCH_LIMIT, page: 1 },
  });
  return data.data;
};

const fmtTimestamp = (iso: string) => new Date(iso).toLocaleString();

const toCsv = (rows: AuditLogRow[]) => {
  const header = ['timestamp', 'user', 'action', 'resource', 'resourceId', 'ipAddress', 'userAgent'];
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [
    header.join(','),
    ...rows.map((row) =>
      [row.timestamp, row.user, row.action, row.resource, row.resourceId, row.ipAddress, row.userAgent]
        .map(escape)
        .join(','),
    ),
  ].join('\n');
};

const AuditLogsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [dateRange, setDateRange] = useState('7days');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  const logsQuery = useQuery({
    queryKey: ['admin-audit-logs', dateRange],
    queryFn: () => fetchAuditLogs(dateRange),
  });

  const allLogs = logsQuery.data?.logs ?? [];

  const actionOptions = useMemo(
    () => [...new Set(allLogs.map((log) => log.action))].sort(),
    [allLogs],
  );
  const resourceOptions = useMemo(
    () => [...new Set(allLogs.map((log) => log.resource))].sort(),
    [allLogs],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return allLogs.filter((log) => {
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      if (resourceFilter !== 'all' && log.resource !== resourceFilter) return false;
      if (!needle) return true;
      return (
        log.user.toLowerCase().includes(needle) ||
        log.action.toLowerCase().includes(needle) ||
        log.resource.toLowerCase().includes(needle) ||
        (log.resourceId ?? '').toLowerCase().includes(needle)
      );
    });
  }, [allLogs, search, actionFilter, resourceFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleExport = () => {
    if (filtered.length === 0) return;
    const blob = new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${dateRange}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      key: 'timestamp',
      label: 'Timestamp',
      render: (value: string) => (
        <span className="text-sm text-white font-mono">{fmtTimestamp(value)}</span>
      ),
    },
    {
      key: 'user',
      label: 'Actor',
      render: (value: string) => <span className="text-sm text-white">{value}</span>,
    },
    {
      key: 'action',
      label: 'Action',
      render: (value: string) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-mono font-medium bg-blue-500/20 text-blue-300">
          {value}
        </span>
      ),
    },
    {
      key: 'resource',
      label: 'Resource',
      render: (value: string, row: AuditLogRow) => (
        <div>
          <p className="text-sm text-white">{value}</p>
          {row.resourceId && (
            <p className="text-xs text-gray-500 font-mono truncate max-w-[180px]">
              {row.resourceId}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'ipAddress',
      label: 'IP Address',
      render: (value: string | null) => (
        <span className="text-sm text-gray-400 font-mono">{value ?? '—'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Audit Logs
          </h1>
          <p className="text-gray-400 mt-1">
            Append-only record of administrative and authentication activity.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 border border-white/10 text-gray-300 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-40"
        >
          <Download className="w-5 h-5" />
          Export CSV ({filtered.length})
        </button>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search actor, action, resource…"
              className="w-full pl-10 pr-4 py-2 border border-white/20 rounded-xl bg-slate-900/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={dateRange}
            onChange={(event) => {
              setDateRange(event.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border border-white/20 rounded-xl bg-slate-900/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="today">Today</option>
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="90days">Last 90 days</option>
          </select>

          <select
            value={resourceFilter}
            onChange={(event) => {
              setResourceFilter(event.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border border-white/20 rounded-xl bg-slate-900/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All resources</option>
            {resourceOptions.map((resource) => (
              <option key={resource} value={resource}>
                {resource}
              </option>
            ))}
          </select>

          <select
            value={actionFilter}
            onChange={(event) => {
              setActionFilter(event.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border border-white/20 rounded-xl bg-slate-900/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All actions</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>
      </div>

      {logsQuery.isLoading ? (
        <div className="flex items-center justify-center h-64 bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : logsQuery.isError ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
          <div>
            <p className="font-semibold text-red-300">Could not load audit logs</p>
            <p className="text-sm text-red-200/80 mt-1">
              {(logsQuery.error as any)?.response?.data?.message ||
                (logsQuery.error as Error)?.message}
            </p>
          </div>
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={pageRows}
            emptyMessage="No audit events in this range"
            onRowClick={(row) => setSelected(row as AuditLogRow)}
          />
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">
                Page {currentPage} of {pages} · {filtered.length} events
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="p-2 rounded-lg border border-white/10 text-gray-300 disabled:opacity-40 hover:bg-white/5"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={currentPage >= pages}
                  onClick={() => setPage((value) => value + 1)}
                  className="p-2 rounded-lg border border-white/10 text-gray-300 disabled:opacity-40 hover:bg-white/5"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-4">
        <p className="text-sm text-gray-400">
          <strong className="text-gray-200">Note:</strong> audit logs are append-only; entries
          cannot be edited or deleted from this screen.
        </p>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="flex items-start justify-between p-6 border-b border-white/10">
              <div>
                <h2 className="text-lg font-bold text-white">Audit event</h2>
                <p className="text-sm text-gray-400 mt-1 font-mono">{selected.id}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <dl className="p-6 space-y-3 text-sm">
              {[
                ['Timestamp', fmtTimestamp(selected.timestamp)],
                ['Actor', selected.user],
                ['Action', selected.action],
                ['Resource', selected.resource],
                ['Resource ID', selected.resourceId ?? '—'],
                ['IP address', selected.ipAddress ?? '—'],
                ['User agent', selected.userAgent ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4">
                  <dt className="text-gray-400">{label}</dt>
                  <dd className="text-white text-right break-all">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogsPage;
