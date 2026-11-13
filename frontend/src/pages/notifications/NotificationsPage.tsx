import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageHero } from '../../components/ui/kit-core';
import {
  dismissNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '../../api/notifications';
import {
  Bell,
  Search,
  CheckCircle,
  MessageSquare,
  Calendar,
  DollarSign,
  AlertCircle,
  Info,
  Clock,
  Trash2,
  Check
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'inquiry' | 'viewing' | 'system' | 'price' | 'approval';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

/** Notifications are read from the notifications service, never local fixtures. */
const TYPE_MAP: Record<NotificationItem['type'], Notification['type']> = {
  PRICE_ALERT: 'price',
  NEW_LISTING: 'system',
  PROPERTY_APPROVED: 'approval',
  PROPERTY_REJECTED: 'approval',
  SYSTEM: 'system',
};

const getNotifications = async (): Promise<Notification[]> => {
  const { items } = await fetchNotifications({ limit: 100 });
  return items.map((item) => ({
    id: item.id,
    type: TYPE_MAP[item.type] ?? 'system',
    title: item.title,
    message: item.body,
    timestamp: item.createdAt,
    read: item.isRead,
    actionUrl: item.link ?? undefined,
  }));
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'inquiry' | 'viewing' | 'system' | 'price' | 'approval'>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
  });

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const dismiss = useMutation({
    mutationFn: dismissNotification,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  /** Open a notification: mark it read, then follow its stored link. */
  const openNotification = async (notification: Notification) => {
    if (!notification.read) await markRead.mutateAsync(notification.id);
    if (notification.actionUrl) navigate(notification.actionUrl);
  };

  const filteredNotifications = notifications?.filter(notification => {
    const matchesSearch = notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notification.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || notification.type === typeFilter;
    const matchesRead = !showUnreadOnly || !notification.read;
    return matchesSearch && matchesType && matchesRead;
  });

  const stats = {
    total: notifications?.length || 0,
    unread: notifications?.filter(n => !n.read).length || 0,
    priceAlerts: notifications?.filter(n => n.type === 'price').length || 0,
    approvals: notifications?.filter(n => n.type === 'approval').length || 0
  };

  const getTypeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'inquiry': return <MessageSquare className="w-5 h-5 text-blue-400" />;
      case 'viewing': return <Calendar className="w-5 h-5 text-purple-400" />;
      case 'approval': return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'price': return <DollarSign className="w-5 h-5 text-amber-400" />;
      case 'system': return <Info className="w-5 h-5 text-gray-400" />;
    }
  };

  const getTypeBadgeColor = (type: Notification['type']) => {
    switch (type) {
      case 'inquiry': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'viewing': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'approval': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'price': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'system': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  return (
    <div className="space-y-6">
      <PageHero
        icon={Bell}
        title="Notifications"
        description="Stay updated with your property activity and important alerts."
        accent="indigo"
        actions={
          <button
            onClick={async () => {
              await markAllNotificationsRead();
              await refetch();
            }}
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
          >
            <Check className="w-4 h-4" />
            Mark All
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Bell className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats.total}</div>
              <div className="text-sm text-gray-400">Total Notifications</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/20 rounded-xl">
              <AlertCircle className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats.unread}</div>
              <div className="text-sm text-gray-400">Unread</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <MessageSquare className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats.priceAlerts}</div>
              <div className="text-sm text-gray-400">Price alerts</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <Calendar className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats.approvals}</div>
              <div className="text-sm text-gray-400">Approvals</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-4 py-2.5 bg-slate-800/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all" className="bg-slate-800">All Types</option>
            <option value="price" className="bg-slate-800">Price alerts</option>
            <option value="approval" className="bg-slate-800">Approvals</option>
            <option value="system" className="bg-slate-800">System</option>
          </select>

          <button
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={`px-4 py-2.5 rounded-lg border transition-all ${
              showUnreadOnly
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-slate-800/50 text-gray-300 border-white/20 hover:bg-white/10'
            }`}
          >
            Unread Only
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        ) : filteredNotifications && filteredNotifications.length > 0 ? (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-slate-900/50 backdrop-blur-xl border rounded-2xl p-5 transition-all cursor-pointer ${
                notification.read 
                  ? 'border-white/10 hover:border-white/20' 
                  : 'border-blue-500/30 hover:border-blue-500/50 bg-blue-500/5'
              }`}
              onClick={() => { void openNotification(notification); }}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${notification.read ? 'bg-slate-800/50' : 'bg-blue-500/20'}`}>
                  {getTypeIcon(notification.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-white">{notification.title}</h3>
                      {!notification.read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${getTypeBadgeColor(notification.type)}`}>
                      {notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}
                    </span>
                  </div>

                  <p className="text-gray-400 text-sm mb-3">{notification.message}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{getTimeAgo(notification.timestamp)}</span>
                    </div>

                    <div className="flex gap-2">
                      {notification.actionUrl && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            void openNotification(notification);
                          }}
                          className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 transition-colors"
                        >
                          View Details
                        </button>
                      )}
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          dismiss.mutate(notification.id);
                        }}
                        disabled={dismiss.isPending}
                        aria-label={`Dismiss ${notification.title}`}
                        className="p-1.5 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
            <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Notifications</h3>
            <p className="text-gray-400">
              {searchTerm || typeFilter !== 'all' || showUnreadOnly
                ? 'Try adjusting your filters'
                : 'You\'re all caught up!'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
