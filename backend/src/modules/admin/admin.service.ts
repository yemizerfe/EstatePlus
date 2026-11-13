import { prisma } from '../../infrastructure/database/prisma';
import { checkRabbitHealth } from '../../infrastructure/rabbitmq/client';
import { checkRedisHealth } from '../../infrastructure/redis/client';
import { BadRequestError, NotFoundError } from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';
import { notificationService } from '../notifications/notifications.service';
import * as propertiesService from '../properties/properties.service';

// Dashboard Statistics
export async function getDashboardStats() {
  const [
    totalUsers,
    activeUsers,
    organizations,
    dataSources,
    properties,
    pendingApprovals
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: 'PROPERTY_OWNER' } }), // Using property owners as organizations proxy
    prisma.dataSource.count(),
    prisma.property.count(),
    prisma.property.count({ where: { status: 'PENDING' } })
  ]);

  // Calculate user growth (last 30 days vs previous 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const [recentUsers, previousUsers] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.user.count({ 
      where: { 
        createdAt: { 
          gte: sixtyDaysAgo,
          lt: thirtyDaysAgo 
        } 
      } 
    })
  ]);

  const userGrowth = previousUsers > 0 
    ? `${((recentUsers - previousUsers) / previousUsers * 100).toFixed(1)}%`
    : '+100%';

  return {
    totalUsers,
    activeUsers,
    organizations,
    dataSources,
    properties,
    pendingApprovals,
    userGrowth,
    systemStatus: 'operational'
  };
}

interface ServiceCheck {
  name: string;
  icon: string;
  status: 'operational' | 'degraded' | 'down';
  latency: string;
  lastCheck: string;
  version: string;
  details: string;
}

/** Run a health probe, measuring how long it took. */
async function probe(check: () => Promise<boolean>): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    const ok = await check();
    return { ok, latencyMs: Date.now() - start };
  } catch (error) {
    logger.warn({ msg: 'Health probe failed', error });
    return { ok: false, latencyMs: Date.now() - start };
  }
}

/** Human-readable process uptime, e.g. "2d 4h 12m". */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// System Health
export async function getSystemHealth() {
  const [db, redis, rabbit, jobCounts] = await Promise.all([
    probe(async () => {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    }),
    probe(checkRedisHealth),
    probe(checkRabbitHealth),
    prisma.dataImportJob
      .groupBy({ by: ['status'], _count: { status: true } })
      .catch(() => [] as Array<{ status: string; _count: { status: number } }>),
  ]);

  const pendingJobs = jobCounts
    .filter((row) => row.status === 'PENDING' || row.status === 'PROCESSING')
    .reduce((total, row) => total + row._count.status, 0);
  const failedJobs = jobCounts
    .filter((row) => row.status === 'FAILED')
    .reduce((total, row) => total + row._count.status, 0);

  const now = new Date().toLocaleTimeString();

  const services: ServiceCheck[] = [
    {
      name: 'API Server',
      icon: 'activity',
      status: 'operational',
      latency: '—',
      lastCheck: now,
      version: '1.0.0',
      details: `Process up for ${formatUptime(process.uptime())}`,
    },
    {
      name: 'PostgreSQL',
      icon: 'database',
      status: db.ok ? 'operational' : 'down',
      latency: db.ok ? `${db.latencyMs}ms` : 'N/A',
      lastCheck: now,
      version: '—',
      details: db.ok ? 'Connection pool responding' : 'Query failed — check DATABASE_URL',
    },
    {
      name: 'Redis Cache',
      icon: 'zap',
      status: redis.ok ? 'operational' : 'down',
      latency: redis.ok ? `${redis.latencyMs}ms` : 'N/A',
      lastCheck: now,
      version: '—',
      details: redis.ok ? 'Cache responding to PING' : 'Unreachable — cache disabled',
    },
    {
      name: 'RabbitMQ',
      icon: 'message',
      status: rabbit.ok ? 'operational' : 'down',
      latency: rabbit.ok ? `${rabbit.latencyMs}ms` : 'N/A',
      lastCheck: now,
      version: '—',
      details: rabbit.ok ? 'Broker reachable' : 'Unreachable — jobs run in-process',
    },
    {
      name: 'Import queue',
      icon: 'boxes',
      status: failedJobs > 0 ? 'degraded' : 'operational',
      latency: '—',
      lastCheck: now,
      version: '—',
      details: `${pendingJobs} pending · ${failedJobs} failed job${failedJobs === 1 ? '' : 's'}`,
    },
  ];

  const operational = services.filter((service) => service.status === 'operational').length;
  const degraded = services.filter((service) => service.status === 'degraded').length;
  const down = services.filter((service) => service.status === 'down').length;
  const measured = services.filter((service) => service.latency.endsWith('ms'));
  const averageLatency = measured.length
    ? `${Math.round(
        measured.reduce((total, service) => total + parseInt(service.latency, 10), 0) /
          measured.length,
      )}ms`
    : 'N/A';

  return {
    services,
    overview: {
      totalServices: services.length,
      operational,
      degraded,
      down,
      averageLatency,
    },
  };
}

// Recent Activity
export async function getRecentActivity() {
  const auditLogs = await prisma.auditLog.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { firstName: true, lastName: true, email: true }
      }
    }
  });

  const activities = auditLogs.map(log => ({
    id: log.id,
    actor: log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System',
    action: log.action,
    resource: log.resource,
    timestamp: formatTimeAgo(log.createdAt),
    status: 'success'
  }));

  return { activities };
}

// System Alerts
export async function getSystemAlerts() {
  const alerts = await prisma.alert.findMany({
    where: { acknowledgedBy: null },
    take: 5,
    orderBy: { createdAt: 'desc' }
  });

  return {
    alerts: alerts.map(alert => ({
      id: alert.id,
      type: alert.severity === 'critical' ? 'error' : alert.severity === 'warning' ? 'warning' : 'info',
      message: alert.message,
      timestamp: formatTimeAgo(alert.createdAt)
    }))
  };
}

// User Management
export async function getUsers(filters: {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const { search, role, status, page = 1, limit = 10 } = filters;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } }
    ];
  }

  if (role && role !== 'all') {
    // The API speaks lower-case roles; Prisma's enum is upper-case.
    where.role = role.toUpperCase();
  }

  if (status && status !== 'all') {
    where.isActive = status === 'active';
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        profilePicture: true
      }
    }),
    prisma.user.count({ where })
  ]);

  return {
    users: users.map(user => ({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      role: user.role.toUpperCase(),
      status: user.isActive ? 'active' : 'suspended',
      lastActive: user.lastLoginAt ? formatTimeAgo(user.lastLoginAt) : 'Never',
      createdAt: user.createdAt.toLocaleDateString(),
      avatar: user.profilePicture
    })),
    total,
    page,
    pages: Math.ceil(total / limit)
  };
}

// User Details
export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      properties: {
        take: 5,
        orderBy: { createdAt: 'desc' }
      },
      auditLogs: {
        take: 10,
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    role: user.role.toUpperCase(),
    status: user.isActive ? 'active' : 'suspended',
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    profilePicture: user.profilePicture,
    firstName: user.firstName,
    lastName: user.lastName,
    properties: user.properties,
    recentActivity: user.auditLogs.map(log => ({
      id: log.id,
      action: log.action,
      resource: log.resource,
      timestamp: formatTimeAgo(log.createdAt)
    }))
  };
}

// Update User
export async function updateUser(userId: string, updates: {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: 'user' | 'property_owner' | 'analyst' | 'admin';
  isActive?: boolean;
}) {
  const { role, ...rest } = updates;
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...rest,
      ...(role ? { role: role.toUpperCase() as any } : {}),
    },
  });

  logger.info({ msg: 'User updated', userId, updates });
  return user;
}

// Roles Management
export async function getRoles() {
  // Since we're using enum for roles, we'll return static data with dynamic counts
  const roleCounts = await prisma.user.groupBy({
    by: ['role'],
    _count: { role: true }
  });

  const roleMap = Object.fromEntries(
    roleCounts.map(({ role, _count }) => [role, _count.role])
  );

  const roles = [
    {
      id: 'user',
      name: 'User',
      description: 'Standard user with basic access',
      userCount: roleMap.USER || 0,
      permissions: ['view_properties', 'save_properties', 'create_scenarios']
    },
    {
      id: 'property_owner',
      name: 'Property Owner',
      description: 'Can list and manage properties',
      userCount: roleMap.PROPERTY_OWNER || 0,
      permissions: ['view_properties', 'save_properties', 'create_scenarios', 'list_properties', 'manage_own_properties']
    },
    {
      id: 'analyst',
      name: 'Analyst',
      description: 'Market analyst with advanced tools',
      userCount: roleMap.ANALYST || 0,
      permissions: ['view_properties', 'save_properties', 'create_scenarios', 'advanced_analytics', 'create_reports', 'ai_insights']
    },
    {
      id: 'admin',
      name: 'Administrator',
      description: 'Full system access',
      userCount: roleMap.ADMIN || 0,
      permissions: ['all_permissions']
    }
  ];

  return { roles };
}

// Organizations (using property owners as proxy)
export async function getOrganizations() {
  const propertyOwners = await prisma.user.findMany({
    where: { role: 'PROPERTY_OWNER' },
    include: {
      properties: {
        select: { id: true }
      }
    }
  });

  const organizations = propertyOwners.map(owner => ({
    id: owner.id,
    name: `${owner.firstName} ${owner.lastName}`,
    email: owner.email,
    type: 'Individual',
    propertiesCount: owner.properties.length,
    status: owner.isActive ? 'active' : 'inactive',
    createdAt: owner.createdAt.toLocaleDateString()
  }));

  return { organizations };
}

// Audit Logs
export async function getAuditLogs(filters: {
  search?: string;
  action?: string;
  resource?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}) {
  const { search, action, resource, userId, startDate, endDate, page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (search) {
    where.OR = [
      { action: { contains: search, mode: 'insensitive' } },
      { resource: { contains: search, mode: 'insensitive' } }
    ];
  }

  if (action && action !== 'all') {
    where.action = action;
  }

  if (resource && resource !== 'all') {
    where.resource = resource;
  }

  if (userId) {
    where.userId = userId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true }
        }
      }
    }),
    prisma.auditLog.count({ where })
  ]);

  return {
    logs: logs.map(log => ({
      id: log.id,
      timestamp: log.createdAt,
      user: log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System',
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent
    })),
    total,
    page,
    pages: Math.ceil(total / limit)
  };
}

// Data Sources
export async function getDataSources() {
  const dataSources = await prisma.dataSource.findMany({
    include: {
      creator: {
        select: { firstName: true, lastName: true }
      },
      importJobs: {
        take: 1,
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  return {
    dataSources: dataSources.map(source => ({
      id: source.id,
      name: source.name,
      type: source.sourceType,
      description: source.description,
      status: source.importJobs[0]?.status || 'idle',
      lastSync: source.importJobs[0]?.completedAt || null,
      createdBy: source.creator ? `${source.creator.firstName} ${source.creator.lastName}` : 'System',
      createdAt: source.createdAt
    }))
  };
}

/** Statuses that make up the admin moderation queue. */
const REVIEWABLE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

type ReviewableStatus = (typeof REVIEWABLE_STATUSES)[number];

/**
 * Listings waiting for (or already through) moderation, with everything an
 * admin needs to make a decision: owner contact, photos, location and price.
 */
export async function getPropertyApprovalQueue(filters: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const { status, search, page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;

  const statusFilter: ReviewableStatus | { in: ReviewableStatus[] } =
    status && (REVIEWABLE_STATUSES as readonly string[]).includes(status)
      ? (status as ReviewableStatus)
      : { in: [...REVIEWABLE_STATUSES] };

  const where: any = { status: statusFilter };

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { address: { contains: search, mode: 'insensitive' } },
      { neighborhood: { name: { contains: search, mode: 'insensitive' } } },
      { owner: { firstName: { contains: search, mode: 'insensitive' } } },
      { owner: { lastName: { contains: search, mode: 'insensitive' } } },
      { owner: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [rows, total, statusCounts] = await Promise.all([
    prisma.property.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        description: true,
        propertyType: true,
        address: true,
        sizeSqm: true,
        bedrooms: true,
        bathrooms: true,
        askingPrice: true,
        status: true,
        createdAt: true,
        ownerId: true,
        neighborhood: { select: { name: true } },
        owner: { select: { firstName: true, lastName: true, email: true } },
        images: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          take: 3,
          select: { imageUrl: true },
        },
      },
    }),
    prisma.property.count({ where }),
    prisma.property.groupBy({
      by: ['status'],
      where: { status: { in: [...REVIEWABLE_STATUSES] } },
      _count: { status: true },
    }),
  ]);

  const countFor = (value: ReviewableStatus) =>
    statusCounts.find((row) => row.status === value)?._count.status ?? 0;

  return {
    properties: rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      propertyType: row.propertyType,
      status: row.status,
      address: row.address,
      neighborhood: row.neighborhood?.name ?? null,
      sizeSqm: Number(row.sizeSqm),
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      askingPrice: Number(row.askingPrice),
      submittedAt: row.createdAt,
      owner: {
        name: `${row.owner.firstName} ${row.owner.lastName}`.trim(),
        email: row.owner.email,
      },
      images: row.images.map((image) => image.imageUrl),
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    counts: {
      pending: countFor('PENDING'),
      approved: countFor('APPROVED'),
      rejected: countFor('REJECTED'),
      total: REVIEWABLE_STATUSES.reduce((sum, value) => sum + countFor(value), 0),
    },
  };
}

/**
 * Approve or reject a pending listing. The transition goes through the same
 * lifecycle service owners use, so history, cache invalidation and audit
 * entries stay consistent, and the owner is notified of the outcome.
 */
export async function reviewProperty(
  propertyId: string,
  input: { decision: 'approve' | 'reject'; reason?: string },
  adminId: string,
) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, title: true, status: true, ownerId: true },
  });

  if (!property) {
    throw new NotFoundError('Property');
  }

  if (property.status !== 'PENDING') {
    throw new BadRequestError(
      `Only listings awaiting review can be approved or rejected (current status: ${property.status})`,
    );
  }

  const reason = input.reason?.trim();
  const approved = input.decision === 'approve';

  if (!approved && !reason) {
    throw new BadRequestError('A reason is required when rejecting a listing');
  }

  const updated = await propertiesService.changePropertyStatus(
    propertyId,
    {
      fromStatus: 'PENDING',
      toStatus: approved ? 'APPROVED' : 'REJECTED',
      ...(reason ? { reason } : {}),
    },
    adminId,
    'admin',
  );

  if (property.ownerId !== adminId) {
    await notificationService
      .createNotification({
        userId: property.ownerId,
        type: approved ? 'PROPERTY_APPROVED' : 'PROPERTY_REJECTED',
        title: approved ? 'Listing approved' : 'Listing needs changes',
        body: approved
          ? `"${property.title}" was approved and is now visible to buyers.`
          : `"${property.title}" was rejected. ${reason ?? ''}`.trim(),
        link: '/app/my-properties',
      })
      .catch((error) =>
        logger.warn({ msg: 'Could not notify owner about review', propertyId, error }),
      );
  }

  logger.info({
    msg: 'Admin reviewed property',
    propertyId,
    decision: input.decision,
    adminId,
  });

  return {
    id: updated.id,
    status: updated.status,
    reason: reason ?? null,
  };
}

// Notifications
export async function getAdminNotifications(filters: {
  type?: string;
  priority?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const { type, page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (type && type !== 'all') {
    where.type = type;
  }

  // For priority and status, we'll use mock logic since our notification model is simple
  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { firstName: true, lastName: true }
        }
      }
    }),
    prisma.notification.count({ where })
  ]);

  return {
    notifications: notifications.map(notif => ({
      id: notif.id,
      title: notif.title,
      message: notif.body,
      type: notif.type,
      priority: notif.priority,
      status: notif.isRead ? 'read' : 'unread',
      recipient: notif.user ? `${notif.user.firstName} ${notif.user.lastName}` : 'All Users',
      createdAt: notif.createdAt
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
    stats: {
      total,
      unread: await prisma.notification.count({ where: { isRead: false } }),
      critical: await prisma.notification.count({ where: { priority: 'critical' } }),
      high: await prisma.notification.count({ where: { priority: 'high' } }),
    },
  };
}

/** Mark any notification as read (admin scope, not only the caller's own). */
export async function markNotificationRead(id: string) {
  return prisma.notification.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
  });
}

/** Delete any notification (admin scope). */
export async function deleteNotification(id: string) {
  await prisma.notification.delete({ where: { id } });
}

/** Mark every unread notification as read. */
export async function markAllNotificationsRead() {
  const result = await prisma.notification.updateMany({
    where: { isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return { updated: result.count };
}

// Helper function
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
}