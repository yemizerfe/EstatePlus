import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  Home,
  Loader2,
  ShieldCheck,
  Trash2,
  TrendingDown,
  X,
} from 'lucide-react';
import {
  dismissNotification,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '../api/notifications';

const typeMeta: Record<string, { icon: typeof Home; chip: string }> = {
  PRICE_ALERT: { icon: TrendingDown, chip: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
  NEW_LISTING: { icon: Home, chip: 'bg-sky-500/20 text-sky-400 border border-sky-500/30' },
  PROPERTY_APPROVED: { icon: Check, chip: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
  PROPERTY_REJECTED: { icon: X, chip: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  SYSTEM: { icon: ShieldCheck, chip: 'bg-slate-500/20 text-slate-400 border border-slate-500/30' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Badge counter polls lightly so new events appear without a refresh
  const unreadQuery = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: fetchUnreadCount,
    refetchInterval: 30_000,
  });
  const unread = unreadQuery.data ?? 0;

  const listQuery = useQuery({
    queryKey: ['notifications', unreadOnly],
    queryFn: () => fetchNotifications({ limit: 20, unreadOnly }),
    enabled: open,
  });

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    ]);

  const markRead = useMutation({ mutationFn: markNotificationRead, onSuccess: invalidate });
  const markAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: invalidate });
  const dismiss = useMutation({ mutationFn: dismissNotification, onSuccess: invalidate });

  const handleItemClick = (item: NotificationItem) => {
    if (!item.isRead) markRead.mutate(item.id);
    if (item.link) {
      navigate(item.link);
      setOpen(false);
    }
  };

  const items = listQuery.data?.items ?? [];

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        title="Notifications"
        className="relative p-2.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-300 group"
      >
        <Bell className="w-5 h-5 group-hover:animate-wiggle" />
        {unread > 0 && (
          <>
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-50 animate-fade-in-up">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-sm">Notifications</h3>
              {unread > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {unread} new
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={unread === 0 || markAll.isPending}
              className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-white disabled:opacity-40 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Mark all read
            </button>
          </div>

          <div className="flex gap-1 px-3 pt-2.5 pb-1">
            {(['all', 'unread'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setUnreadOnly(tab === 'unread')}
                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${
                  unreadOnly === (tab === 'unread')
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {tab}
                {tab === 'unread' && unread > 0 && ` (${unread})`}
              </button>
            ))}
          </div>

          <div className="max-h-[24rem] overflow-y-auto custom-scrollbar">
            {listQuery.isLoading ? (
              <div className="flex items-center justify-center py-10 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <Bell className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-300">
                  {unreadOnly ? 'No unread notifications' : "You're all caught up!"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Alerts about your properties will appear here.
                </p>
              </div>
            ) : (
              items.map((item) => {
                const meta = typeMeta[item.type] ?? typeMeta.SYSTEM;
                const Icon = meta.icon;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`group flex gap-3 px-4 py-3 border-b border-white/5 cursor-pointer transition-colors ${
                      item.isRead ? 'hover:bg-white/5' : 'bg-blue-500/10 hover:bg-blue-500/20'
                    }`}
                  >
                    <span
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.chip}`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm ${
                            item.isRead ? 'text-gray-300' : 'font-semibold text-white'
                          }`}
                        >
                          {item.title}
                        </p>
                        <span className="text-[11px] text-gray-500 shrink-0">
                          {timeAgo(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{item.body}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 shrink-0">
                      {!item.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1" />}
                      <button
                        type="button"
                        aria-label="Dismiss notification"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismiss.mutate(item.id);
                        }}
                        className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-gray-500 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-4 py-2.5 bg-white/5 border-t border-white/10 flex items-center justify-between">
            <span className="text-[11px] text-gray-500">Showing latest {items.length || 20}</span>
            {unreadOnly && (
              <button
                type="button"
                onClick={() => setUnreadOnly(false)}
                className="text-[11px] font-semibold text-gray-400 hover:text-white"
              >
                View all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
