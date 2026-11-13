import { randomUUID } from 'crypto';

import { prisma } from '../../infrastructure/database/prisma';
import { publishEvent } from '../../infrastructure/kafka/client';
import { cacheGet, cacheSet } from '../../infrastructure/redis/client';
import { NotFoundError } from '../../shared/utils/errors';
import { buildPaginationMeta } from '../../shared/utils/response';
import { CACHE_KEYS, CACHE_TTL, KAFKA_TOPICS } from '../../shared/constants';
import { logger } from '../../shared/utils/logger';
import { EmailService } from './email.service';
import type { NotificationType, NotificationChannel } from '@prisma/client';

export interface NotificationTemplate {
  id: string;
  name: string;
  subject?: string;
  body: string;
  type: NotificationType;
  channels: NotificationChannel[];
  category: string;
  description?: string;
  variables?: string[];
}

export interface CreateNotificationInput {
  userId: string;
  type?: NotificationType;
  title: string;
  body: string;
  link?: string;
  channels?: NotificationChannel[];
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  scheduledAt?: Date;
}

export interface BulkNotificationInput {
  userIds: string[];
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  channels?: NotificationChannel[];
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  recentActivity: Array<{
    date: string;
    count: number;
  }>;
}

export interface NotificationSettings {
  email: boolean;
  inApp: boolean;
  push: boolean;
  sms: boolean;
  digest: boolean;
  digestFrequency?: 'daily' | 'weekly';
}

export const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
  'property_saved': {
    id: 'property_saved',
    name: 'Property Saved',
    subject: 'Property Added to Favorites',
    body: 'You have saved property: {{property_title}}. You can view it in your saved properties list.',
    type: 'PROPERTY',
    channels: ['IN_APP', 'EMAIL'],
    category: 'properties',
    description: 'Notification when a user saves a property',
    variables: ['property_title', 'property_id'],
  },
  'property_price_alert': {
    id: 'property_price_alert',
    name: 'Price Drop Alert',
    subject: 'Price Drop Alert for {{property_title}}',
    body: 'The price of {{property_title}} has dropped by {{price_drop}}%. View details now.',
    type: 'ALERT',
    channels: ['IN_APP', 'EMAIL', 'PUSH'],
    category: 'alerts',
    description: 'Alert when saved property price drops',
    variables: ['property_title', 'price_drop', 'property_id'],
  },
  'market_update': {
    id: 'market_update',
    name: 'Market Update',
    subject: 'Weekly Market Update - {{week}}',
    body: 'Here is your weekly market update for Addis Ababa. Prices have {{trend}} by {{percentage}}%.',
    type: 'MARKET',
    channels: ['EMAIL'],
    category: 'reports',
    description: 'Weekly market summary email',
    variables: ['week', 'trend', 'percentage'],
  },
  'scenario_result': {
    id: 'scenario_result',
    name: 'Scenario Analysis Complete',
    subject: 'Scenario Analysis Complete - {{scenario_name}}',
    body: 'Your scenario analysis "{{scenario_name}}" is complete. Price impact: {{price_impact}}%.',
    type: 'ANALYSIS',
    channels: ['IN_APP', 'EMAIL'],
    category: 'analysis',
    description: 'Notification when scenario analysis completes',
    variables: ['scenario_name', 'price_impact', 'scenario_id'],
  },
  'forecast_update': {
    id: 'forecast_update',
    name: 'Forecast Updated',
    subject: 'New Forecast Available - {{neighborhood}}',
    body: 'A new forecast has been generated for {{neighborhood}}. Check the latest predictions.',
    type: 'FORECAST',
    channels: ['IN_APP'],
    category: 'analysis',
    description: 'Alert when forecast is updated',
    variables: ['neighborhood', 'forecast_id'],
  },
  'new_listing': {
    id: 'new_listing',
    name: 'New Listing Alert',
    subject: 'New Listing Matched Your Search',
    body: 'A new property matching your saved search "{{search_name}}" has been listed.',
    type: 'ALERT',
    channels: ['IN_APP', 'EMAIL', 'PUSH'],
    category: 'alerts',
    description: 'Alert when new listing matches saved search',
    variables: ['search_name', 'property_title', 'property_id'],
  },
  'scheduled_status_change': {
    id: 'scheduled_status_change',
    name: 'Status Change Scheduled',
    subject: 'Property Status Change Scheduled',
    body: 'Your property "{{property_title}}" status will change to {{new_status}} on {{date}}.',
    type: 'NOTICE',
    channels: ['IN_APP', 'EMAIL'],
    category: 'notifications',
    description: 'Notification for scheduled property status change',
    variables: ['property_title', 'new_status', 'date'],
  },
  'bulk_import_complete': {
    id: 'bulk_import_complete',
    name: 'Bulk Import Complete',
    subject: 'Data Import Complete',
    body: 'Your bulk import job has completed. Processed {{total}} records, {{valid}} valid, {{rejected}} rejected.',
    type: 'SYSTEM',
    channels: ['IN_APP', 'EMAIL'],
    category: 'system',
    description: 'Notification when data import job completes',
    variables: ['total', 'valid', 'rejected', 'job_id'],
  },
};

export class NotificationService {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Create a notification
   */
  async createNotification(input: CreateNotificationInput) {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type ?? 'SYSTEM',
        title: input.title.slice(0, 200),
        body: input.body.slice(0, 500),
        link: input.link?.slice(0, 255),
        channels: input.channels ?? ['IN_APP'],
        priority: input.priority ?? 'normal',
        scheduledAt: input.scheduledAt,
        // A freshly created notification is unread; only an explicit read call
        // moves it out of the bell badge.
        isRead: false,
        readAt: null,
      },
    });

    // Publish event for async processing
    if (input.channels && input.channels.length > 0) {
      await publishEvent({
        eventType: 'NOTIFICATION_CREATED',
        aggregateId: notification.id,
        payload: {
          notificationId: notification.id,
          userId: input.userId,
          channels: input.channels,
          scheduledAt: input.scheduledAt?.toISOString(),
        },
        occurredAt: new Date().toISOString(),
      }, KAFKA_TOPICS.NOTIFICATION_EVENTS);
    }

    // Send email if channel is included
    if (input.channels?.includes('EMAIL')) {
      try {
        const recipient = await prisma.user.findUnique({
          where: { id: input.userId },
          select: { email: true },
        });
        await this.emailService.sendTemplatedEmail({
          id: randomUUID(),
          type: 'EMAIL_NOTIFICATION',
          createdAt: new Date().toISOString(),
          recipients: recipient ? [recipient.email] : [],
          template: input.type?.toLowerCase() ?? 'notification',
          data: {
            title: input.title,
            body: input.body,
            link: input.link,
          },
          userId: input.userId,
        });
      } catch (emailError) {
        logger.warn({ msg: 'Email notification failed', notificationId: notification.id, error: emailError });
      }
    }

    return notification;
  }

  /**
   * Create bulk notifications
   */
  async createBulkNotifications(input: BulkNotificationInput) {
    const notifications = await prisma.notification.createMany({
      data: input.userIds.map(userId => ({
        userId,
        type: input.type,
        title: input.title.slice(0, 200),
        body: input.body.slice(0, 500),
        link: input.link?.slice(0, 255),
        channels: input.channels ?? ['IN_APP'],
        priority: 'normal',
        isRead: false,
      })),
    });

    return {
      total: notifications.count,
      success: notifications.count,
      failed: 0,
    };
  }

  /**
   * Create notification from template
   */
  async createFromTemplate(templateId: string, userId: string, variables: Record<string, string>) {
    const template = NOTIFICATION_TEMPLATES[templateId];
    if (!template) throw new NotFoundError('Notification template not found');

    // Replace variables in template
    let title = template.name;
    let body = template.body;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      title = title.replace(regex, value);
      body = body.replace(regex, value);
    });

    return this.createNotification({
      userId,
      type: template.type,
      title,
      body,
      channels: template.channels,
    });
  }

  /**
   * List notifications with filtering
   */
  async listNotifications(
    userId: string,
    opts: { 
      page?: number; 
      limit?: number; 
      unreadOnly?: boolean;
      type?: NotificationType;
      channels?: NotificationChannel[];
    }
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
    
    const where: any = { userId };
    if (opts.unreadOnly) where.isRead = false;
    if (opts.type) where.type = opts.type;
    if (opts.channels) {
      where.AND = opts.channels.map(channel => ({
        channels: { has: channel },
      }));
    }

    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { items, unreadCount, meta: buildPaginationMeta(total, page, limit) };
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const cacheKey = `${CACHE_KEYS.USER_PERMISSIONS}:unread:${userId}`;
    const cached = await cacheGet<{ count: number }>(cacheKey);
    if (cached) return cached;

    const count = await prisma.notification.count({ where: { userId, isRead: false } });
    await cacheSet(cacheKey, { count }, CACHE_TTL.SHORT);
    return { count };
  }

  /**
   * Get notification stats
   */
  async getNotificationStats(userId: string): Promise<NotificationStats> {
    const cacheKey = `${CACHE_KEYS.USER_PERMISSIONS}:stats:${userId}`;
    const cached = await cacheGet<NotificationStats>(cacheKey);
    if (cached) return cached;

    const stats = await prisma.notification.groupBy({
      by: ['type', 'priority'],
      _count: { _all: true },
      where: { userId },
    });

    const byType: Record<string, number> = {};
    const byPriority: Record<string, number> = {};

    stats.forEach((row) => {
      byType[row.type] = (byType[row.type] ?? 0) + row._count._all;
      byPriority[row.priority] = (byPriority[row.priority] ?? 0) + row._count._all;
    });

    const unreadCount = await prisma.notification.count({ where: { userId, isRead: false } });
    const total = await prisma.notification.count({ where: { userId } });

    // Recent activity (last 7 days), bucketed by calendar day.
    const recent = await prisma.notification.findMany({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const perDay = new Map<string, number>();
    for (const row of recent) {
      const day = row.createdAt.toISOString().slice(0, 10);
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
    }
    const recentActivity = [...perDay.entries()].map(([date, count]) => ({ date, count }));

    const result: NotificationStats = { total, unread: unreadCount, byType, byPriority, recentActivity };
    await cacheSet(cacheKey, result, CACHE_TTL.SHORT);
    return result;
  }

  /**
   * Mark notification as read
   */
  async markRead(userId: string, id: string) {
    const notification = await prisma.notification.findUnique({ 
      where: { id }, 
      select: { userId: true } 
    });
    
    if (!notification || notification.userId !== userId) {
      throw new NotFoundError('Notification');
    }

    const result = await prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });

    // Clear unread count cache
    const cacheKey = `${CACHE_KEYS.USER_PERMISSIONS}:unread:${userId}`;
    await cacheSet(cacheKey, null, CACHE_TTL.SHORT);

    return result;
  }

  /**
   * Mark all notifications as read
   */
  async markAllRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    // Clear unread count cache
    const cacheKey = `${CACHE_KEYS.USER_PERMISSIONS}:unread:${userId}`;
    await cacheSet(cacheKey, null, CACHE_TTL.SHORT);

    return { success: true };
  }

  /**
   * Dismiss/delete notification
   */
  async dismiss(userId: string, id: string) {
    const notification = await prisma.notification.findUnique({ 
      where: { id }, 
      select: { userId: true } 
    });
    
    if (!notification || notification.userId !== userId) {
      throw new NotFoundError('Notification');
    }

    await prisma.notification.delete({ where: { id } });

    return { success: true };
  }

  /**
   * Delete old notifications (cleanup)
   */
  async cleanupOldNotifications(days: number = 90) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoff },
      },
    });

    logger.info({ msg: 'Cleaned up old notifications', count: result.count, days });
    return { count: result.count };
  }

  /**
   * Get notification settings
   */
  async getSettings(_userId: string) {
    // Default settings
    const defaults: NotificationSettings = {
      email: true,
      inApp: true,
      push: false,
      sms: false,
      digest: false,
    };

    // In a real implementation, fetch from database
    return defaults;
  }

  /**
   * Update notification settings
   */
  async updateSettings(_userId: string, settings: Partial<NotificationSettings>) {
    // In a real implementation, save to database
    return { success: true, settings };
  }

  /**
   * Send scheduled notifications
   */
  async processScheduledNotifications() {
    const scheduled = await prisma.notification.findMany({
      where: {
        scheduledAt: { lte: new Date() },
        isRead: false,
      },
    });

    const processed: string[] = [];

    for (const notification of scheduled) {
      try {
        // Send notifications via configured channels
        if (notification.channels.includes('EMAIL')) {
          const recipient = await prisma.user.findUnique({
            where: { id: notification.userId },
            select: { email: true },
          });
          if (!recipient) continue;

          await this.emailService.sendTemplatedEmail({
            id: randomUUID(),
            type: 'EMAIL_NOTIFICATION',
            createdAt: new Date().toISOString(),
            recipients: [recipient.email],
            template: notification.type.toLowerCase(),
            data: {
              title: notification.title,
              body: notification.body,
              link: notification.link,
            },
            userId: notification.userId,
          });
        }

        // Mark as sent
        await prisma.notification.update({
          where: { id: notification.id },
          data: { isRead: true, readAt: new Date() },
        });

        processed.push(notification.id);
      } catch (error) {
        logger.error({ 
          msg: 'Failed to send scheduled notification', 
          notificationId: notification.id, 
          error 
        });
      }
    }

    return { processed, total: scheduled.length };
  }

  /**
   * Send digest notification
   */
  async sendDigest(userId: string, type: 'daily' | 'weekly' = 'daily') {
    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        createdAt: { 
          gte: new Date(Date.now() - (type === 'daily' ? 1 : 7) * 24 * 60 * 60 * 1000) 
        },
        channels: { has: 'EMAIL' },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (notifications.length === 0) {
      return { skipped: true, reason: 'No notifications to include' };
    }

    // Send digest email
    const body = this.generateDigestBody(notifications, type);
    
    const recipient = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!recipient) throw new NotFoundError('User');

    await this.emailService.sendTemplatedEmail({
      id: randomUUID(),
      type: 'EMAIL_NOTIFICATION',
      createdAt: new Date().toISOString(),
      recipients: [recipient.email],
      template: 'digest',
      data: {
        type,
        notifications,
        count: notifications.length,
        body,
      },
      userId,
    });

    return { 
      success: true, 
      count: notifications.length,
      type,
    };
  }

  private generateDigestBody(notifications: any[], type: string) {
    const lines = [
      `**${type.charAt(0).toUpperCase() + type.slice(1)} Digest**`,
      `Sent at ${new Date().toLocaleString()}`,
      '',
      notifications.map(n => 
        `- ${n.title} (${n.createdAt.toLocaleString()})`
      ).join('\n'),
    ];

    return lines.join('\n');
  }
}

// Export singleton instance
export const notificationService = new NotificationService();