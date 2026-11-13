import { prisma } from '../infrastructure/database/prisma';
import { cacheGet, cacheSet } from '../infrastructure/redis/client';
import { logger } from '../shared/utils/logger';
import { NotFoundError } from '../shared/utils/errors';
cacheGet;
cacheSet;
export interface AuditLogFilters {
  userId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}
export interface AuditLogStats {
  totalEvents: number;
  uniqueUsers: number;
  byAction: Record<string, number>;
  byResource: Record<string, number>;
  recentActivity: Array<{
    date: string;
    count: number;
  }>;
  topUsers: Array<{
    userId: string;
    userName: string;
    count: number;
  }>;
}
export interface AuditTrail {
  resourceType: string;
  resourceId: string;
  timeline: Array<{
    id: string;
    action: string;
    userId: string;
    userName: string;
    timestamp: Date;
    changes: any;
  }>;
}
export class AuditService {
  async queryAuditLogs(filters: AuditLogFilters = {}) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const offset = (page - 1) * limit;

    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.resource) where.resource = filters.resource;
    if (filters.resourceId) where.resourceId = filters.resourceId;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getAuditLogById(id: string) {
    const log = await prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!log) throw new NotFoundError('Audit log not found');
    return log;
  }

  async getAuditStats(filters: {
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<AuditLogStats> {
    const where: any = {};
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [
      totalEvents,
      uniqueUsers,
      byAction,
      byResource,
      topUsers,
      recentActivity,
    ] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where: { ...where, userId: { not: null } },
        distinct: ['userId'],
        select: { userId: true },
      }).then(users => users.length),
      prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
      }),
      prisma.auditLog.groupBy({
        by: ['resource'],
        where,
        _count: { resource: true },
        orderBy: { _count: { resource: 'desc' } },
      }),
      this.getTopUsers(where),
      this.getRecentActivity(7),
    ]);

    const byActionMap: Record<string, number> = {};
    byAction.forEach(item => {
      byActionMap[item.action] = item._count.action;
    });

    const byResourceMap: Record<string, number> = {};
    byResource.forEach(item => {
      byResourceMap[item.resource] = item._count.resource;
    });

    const stats: AuditLogStats = {
      totalEvents,
      uniqueUsers: uniqueUsers,
      byAction: byActionMap,
      byResource: byResourceMap,
      recentActivity: recentActivity,
      topUsers: topUsers,
    };

    return stats;
  }

  private async getRecentActivity(days: number = 7): Promise<Array<{ date: string; count: number }>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = await prisma.auditLog.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: { createdAt: true },
    });

    const activityMap: Record<string, number> = {};
    logs.forEach(log => {
      const date = log.createdAt.toISOString().split('T')[0];
      activityMap[date] = (activityMap[date] || 0) + 1;
    });

    return Object.entries(activityMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private async getTopUsers(where: any): Promise<Array<{ userId: string; userName: string; count: number }>> {
    const userActivity = await prisma.auditLog.groupBy({
      by: ['userId'],
      where: { ...where, userId: { not: null } },
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 10,
    });

    const userIds = userActivity.map(item => item.userId!);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    return userActivity.map(item => {
      const user = userMap.get(item.userId!);
      return {
        userId: item.userId!,
        userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown User',
        count: item._count.userId,
      };
    });
  }

  async getResourceAuditTrail(resourceType: string, resourceId: string): Promise<AuditTrail> {
    const logs = await prisma.auditLog.findMany({
      where: {
        resource: resourceType,
        resourceId: resourceId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const timeline = logs.map(log => ({
      id: log.id,
      action: log.action,
      userId: log.userId ?? 'system',
      userName: log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System',
      timestamp: log.createdAt,
      changes: this.extractChanges(log.oldData, log.newData),
    }));

    return {
      resourceType,
      resourceId,
      timeline,
    };
  }

  private extractChanges(oldData: any, newData: any): any {
    if (!oldData && !newData) return null;
    if (!oldData) return { added: newData };
    if (!newData) return { removed: oldData };

    const changes: any = {};

    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

    allKeys.forEach(key => {
      const oldValue = oldData[key];
      const newValue = newData[key];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[key] = {
          from: oldValue,
          to: newValue,
        };
      }
    });

    return Object.keys(changes).length > 0 ? changes : null;
  }

  async getUserActivitySummary(userId: string, days: number = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalActions, actionBreakdown, resourceBreakdown, recentActions] = await Promise.all([
      prisma.auditLog.count({
        where: {
          userId,
          createdAt: { gte: startDate },
        },
      }),
      prisma.auditLog.groupBy({
        by: ['action'],
        where: {
          userId,
          createdAt: { gte: startDate },
        },
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
      }),
      prisma.auditLog.groupBy({
        by: ['resource'],
        where: {
          userId,
          createdAt: { gte: startDate },
        },
        _count: { resource: true },
        orderBy: { _count: { resource: 'desc' } },
      }),
      prisma.auditLog.findMany({
        where: {
          userId,
          createdAt: { gte: startDate },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          resource: true,
          resourceId: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      userId,
      period: { days, startDate },
      totalActions,
      actionBreakdown: actionBreakdown.map(item => ({
        action: item.action,
        count: item._count.action,
      })),
      resourceBreakdown: resourceBreakdown.map(item => ({
        resource: item.resource,
        count: item._count.resource,
      })),
      recentActions,
    };
  }

  async exportAuditLogs(filters: AuditLogFilters = {}): Promise<string> {
    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.resource) where.resource = filters.resource;
    if (filters.resourceId) where.resourceId = filters.resourceId;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000, // Limit export size
    });

    const headers = ['ID', 'Timestamp', 'User', 'Email', 'Action', 'Resource', 'Resource ID', 'IP Address'];
    const rows = logs.map(log => [
      log.id,
      log.createdAt.toISOString(),
      log.user ? `${log.user.firstName} ${log.user.lastName}` : 'N/A',
      log.user?.email || 'N/A',
      log.action,
      log.resource,
      log.resourceId || 'N/A',
      log.ipAddress || 'N/A',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csv;
  }

  async detectSuspiciousActivity(options: {
    threshold?: number;
    timeWindowMinutes?: number;
  } = {}) {
    const threshold = options.threshold ?? 50; // Actions per time window
    const timeWindowMinutes = options.timeWindowMinutes ?? 5;
    const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

    const recentActivity = await prisma.auditLog.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: cutoffTime },
        userId: { not: null },
      },
      _count: { userId: true },
      having: {
        userId: {
          _count: {
            gte: threshold,
          },
        },
      },
    });

    const suspiciousUserIds = recentActivity.map(item => item.userId!);

    if (suspiciousUserIds.length === 0) {
      return { suspicious: false, users: [] };
    }

    const users = await prisma.user.findMany({
      where: { id: { in: suspiciousUserIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });

    return {
      suspicious: true,
      users: recentActivity.map(activity => {
        const user = users.find(u => u.id === activity.userId);
        return {
          userId: activity.userId!,
          userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
          email: user?.email,
          actionCount: activity._count.userId,
          timeWindow: `${timeWindowMinutes} minutes`,
        };
      }),
    };
  }

  async cleanupOldLogs(retentionDays: number = 365) {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    logger.info({
      msg: 'Cleaned up old audit logs',
      deleted: result.count,
      retentionDays,
    });

    return {
      deleted: result.count,
      cutoffDate,
      retentionDays,
    };
  }

  async getComplianceReport(filters: {
    startDate: Date;
    endDate: Date;
  }) {
    const where = {
      createdAt: {
        gte: filters.startDate,
        lte: filters.endDate,
      },
    };

    const [
      totalEvents,
      authenticationEvents,
      dataAccessEvents,
      dataModificationEvents,
      adminActions,
      failedAttempts,
    ] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.count({
        where: {
          ...where,
          action: {
            in: ['USER_LOGIN', 'USER_LOGOUT', 'LOGIN_FAILED', 'PASSWORD_CHANGED'],
          },
        },
      }),
      prisma.auditLog.count({
        where: {
          ...where,
          action: {
            contains: 'VIEW',
          },
        },
      }),
      prisma.auditLog.count({
        where: {
          ...where,
          action: {
            in: ['CREATE', 'UPDATE', 'DELETE'],
          },
        },
      }),
      prisma.auditLog.count({
        where: {
          ...where,
          user: {
            role: 'ADMIN',
          },
        },
      }),
      prisma.auditLog.count({
        where: {
          ...where,
          action: 'LOGIN_FAILED',
        },
      }),
    ]);

    return {
      period: {
        start: filters.startDate,
        end: filters.endDate,
      },
      summary: {
        totalEvents,
        authenticationEvents,
        dataAccessEvents,
        dataModificationEvents,
        adminActions,
        failedAttempts,
      },
      compliance: {
        auditingEnabled: true,
        retentionPolicy: '365 days',
        encryptionAtRest: true,
        accessControls: 'RBAC enabled',
      },
    };
  }
}

// Export singleton instance
export const auditService = new AuditService();
