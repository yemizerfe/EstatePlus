import { apiClient } from './client';

export type NotificationType =
  | 'PRICE_ALERT'
  | 'NEW_LISTING'
  | 'PROPERTY_APPROVED'
  | 'PROPERTY_REJECTED'
  | 'SYSTEM';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  unreadCount: number;
}

export async function fetchNotifications(opts: {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
} = {}): Promise<NotificationsResponse> {
  const params = new URLSearchParams();
  if (opts.page) params.set('page', String(opts.page));
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.unreadOnly) params.set('unread', 'true');
  // The notifications route answers with `items`/`unreadCount` at the top
  // level; older clients wrapped them in `data`, so both shapes are accepted.
  const { data } = await apiClient.get<
    | NotificationsResponse
    | { data: NotificationsResponse }
  >(`/notifications?${params.toString()}`);
  const payload = 'data' in data && data.data ? data.data : (data as NotificationsResponse);
  return {
    items: payload.items ?? [],
    unreadCount: payload.unreadCount ?? (payload.items ?? []).filter((item) => !item.isRead).length,
  };
}

export async function fetchUnreadCount(): Promise<number> {
  const { data } = await apiClient.get<{ data?: { count: number }; count?: number }>(
    '/notifications/unread-count',
  );
  return data.data?.count ?? data.count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.patch(`/notifications/${id}/read`, {});
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.post('/notifications/read-all', {});
}

export async function dismissNotification(id: string): Promise<void> {
  await apiClient.delete(`/notifications/${id}`);
}
