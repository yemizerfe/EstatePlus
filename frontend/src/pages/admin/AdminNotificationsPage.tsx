import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CheckCircle,
  AlertCircle,
  Info,
  AlertTriangle,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

import { apiClient } from '../../api/client';

interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  status: 'read' | 'unread';
  recipient: string;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: AdminNotification[];
  total: number;
  page: number;
  pages: number;
  stats: { total: number; unread: number; critical: number; high: number };
}

const PAGE_SIZE = 20;

const fetchNotifications = async (params: {
  type: string;
  priority: string;
  page: number;
}): Promise<NotificationsResponse> => {
  const query = new URLSearchParams({ page: String(params.page), limit: String(PAGE_SIZE) });
  if (params.type !== 'all') query.set('type', params.type);
  if (params.priority !== 'all') query.set('priority', params.priority);
  const { data } = await apiClient.get<{ data: NotificationsResponse }>(
    `/admin/notifications?${query.toString()}`,
  );
  return data.data;
};

const AdminNotificationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  const queryKey = ['admin-notifications', filterType, filterPriority, page];
  const notificationsQuery = useQuery({
    queryKey,
    queryFn: () => fetchNotifications({ type: filterType, priority: filterPriority, page }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
  };

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/admin/notifications/${id}/read`);
    },
    onSuccess: () => {
      setSelectedIds([]);
      setError('');
      invalidate();
    },
    onError: (err: any) =>
      setError(err?.response?.data?.message || 'Could not mark the notification as read'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await apiClient.delete(`/admin/notifications/${id}`);
      }
    },
    onSuccess: () => {
      setSelectedIds([]);
      setError('');
      invalidate();
    },
    onError: (err: any) =>
      setError(err?.response?.data?.message || 'Could not delete the selected notifications'),
  });

  const readAllMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ data: { updated: number } }>(
        '/admin/notifications/read-all',
      );
      return data.data;
    },
    onSuccess: () => {
      setSelectedIds([]);
      setError('');
      invalidate();
    },
    onError: (err: any) =>
      setError(err?.response?.data?.message || 'Could not mark notifications as read'),
  });

  const data = notificationsQuery.data;
  const notifications = useMemo(() => data?.notifications ?? [], [data]);

  const allSelected = notifications.length > 0 && selectedIds.length === notifications.length;

  const toggleSelect = (id: string) =>
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  const typeIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'SECURITY':
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'SYSTEM':
        return <AlertCircle className="w-5 h-5 text-blue-400" />;
      case 'MARKET':
      case 'PROPERTY':
        return <Info className="w-5 h-5 text-purple-400" />;
      case 'REPORT':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      default:
        return <Bell className="w-5 h-5 text-gray-400" />;
    }
  };

  const priorityClass = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'high':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'low':
        return 'bg-slate-700/50 text-gray-400 border-white/10';
      default:
        return 'bg-slate-800/50 text-gray-300 border-white/10';
    }
  };

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Notifications
          </h1>
          <p className="text-gray-400 mt-1">
            Platform-wide notification feed with delivery status and recipient.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => notificationsQuery.refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 border border-white/10 text-gray-300 rounded-lg hover:bg-white/5"
          >
            <RefreshCw
              className={`w-4 h-4 ${notificationsQuery.isFetching ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
          <button
            onClick={() => readAllMutation.mutate()}
            disabled={readAllMutation.isPending || (stats?.unread ?? 0) === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white disabled:opacity-40"
          >
            <Check className="w-4 h-4" />
            {readAllMutation.isPending ? 'Marking…' : 'Mark all read'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats?.total ?? 0 },
          { label: 'Unread', value: stats?.unread ?? 0 },
          { label: 'Critical', value: stats?.critical ?? 0 },
          { label: 'High', value: stats?.high ?? 0 },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-5"
          >
            <p className="text-sm text-gray-400">{stat.label}</p>
            <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterType}
          onChange={(event) => {
            setFilterType(event.target.value);
            setPage(1);
          }}
          className="px-4 py-2 border border-white/20 rounded-xl bg-slate-900/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All types</option>
          <option value="SYSTEM">System</option>
          <option value="SECURITY">Security</option>
          <option value="MARKET">Market</option>
          <option value="PROPERTY">Property</option>
          <option value="REPORT">Report</option>
        </select>
        <select
          value={filterPriority}
          onChange={(event) => {
            setFilterPriority(event.target.value);
            setPage(1);
          }}
          className="px-4 py-2 border border-white/20 rounded-xl bg-slate-900/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        {selectedIds.length > 0 && (
          <>
            <button
              onClick={() => selectedIds.forEach((id) => markReadMutation.mutate(id))}
              disabled={markReadMutation.isPending}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-300 text-sm"
            >
              <Check className="w-4 h-4" /> Mark {selectedIds.length} read
            </button>
            <button
              onClick={() => deleteMutation.mutate(selectedIds)}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm"
            >
              <Trash2 className="w-4 h-4" /> Delete {selectedIds.length}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
        {notificationsQuery.isLoading ? (
          <p className="p-6 text-sm text-gray-400">Loading notifications…</p>
        ) : notifications.length === 0 ? (
          <div className="p-10 text-center">
            <Bell className="w-9 h-9 text-gray-500 mx-auto mb-3" />
            <p className="text-white font-semibold">No notifications found</p>
            <p className="text-sm text-gray-400 mt-1">
              Nothing matches these filters in the current range.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-6 py-3 border-b border-white/10 bg-slate-900/40">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() =>
                  setSelectedIds(allSelected ? [] : notifications.map((item) => item.id))
                }
                aria-label="Select all notifications"
                className="h-4 w-4 rounded border-white/20 bg-slate-900"
              />
              <span className="text-xs uppercase tracking-wider text-gray-400">
                {allSelected ? 'Clear selection' : 'Select all on page'}
              </span>
            </div>
            <div className="divide-y divide-white/10">
              {notifications.map((notification) => (
                <div key={notification.id} className="flex items-start gap-4 px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(notification.id)}
                    onChange={() => toggleSelect(notification.id)}
                    aria-label={`Select ${notification.title}`}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900"
                  />
                  <div className="mt-0.5">{typeIcon(notification.type)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-white">{notification.title}</p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${priorityClass(
                          notification.priority,
                        )}`}
                      >
                        {notification.priority}
                      </span>
                      {notification.status === 'unread' && (
                        <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[11px] font-semibold text-blue-300">
                          unread
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-400">{notification.message}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      {notification.recipient} ·{' '}
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {notification.status === 'unread' && (
                      <button
                        onClick={() => markReadMutation.mutate(notification.id)}
                        className="p-2 rounded-lg text-blue-300 hover:bg-blue-500/10"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteMutation.mutate([notification.id])}
                      className="p-2 rounded-lg text-red-300 hover:bg-red-500/10"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Page {data.page} of {data.pages} · {data.total.toLocaleString()} notifications
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="p-2 rounded-lg border border-white/10 text-gray-300 disabled:opacity-40 hover:bg-white/5"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= data.pages}
              onClick={() => setPage((value) => value + 1)}
              className="p-2 rounded-lg border border-white/10 text-gray-300 disabled:opacity-40 hover:bg-white/5"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotificationsPage;
