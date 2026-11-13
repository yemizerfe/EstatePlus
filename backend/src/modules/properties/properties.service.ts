import { PropertyType, PropertyCondition, PropertyStatus, Prisma } from '@prisma/client';

import { prisma } from '../../infrastructure/database/prisma';
import { publishEvent } from '../../infrastructure/kafka/client';
import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from '../../infrastructure/redis/client';
import { CACHE_TTL, KAFKA_TOPICS } from '../../shared/constants';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';
import { parsePagination } from '../../shared/utils/pagination';
import { buildPaginationMeta } from '../../shared/utils/response';
import { auditLogger } from '../../middleware/auditLog';

export interface CreatePropertyDto {
  title: string;
  description?: string;
  propertyType: PropertyType;
  condition: PropertyCondition;
  neighborhoodId: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  sizeSqm: number;
  bedrooms: number;
  bathrooms: number;
  askingPrice: number;
  rentalPrice?: number;
  listingDate: string;
}

export interface UpdatePropertyDto {
  title?: string;
  description?: string;
  condition?: PropertyCondition;
  address?: string;
  latitude?: number;
  longitude?: number;
  sizeSqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  askingPrice?: number;
  rentalPrice?: number;
}

export interface PropertyStatusTransition {
  fromStatus: PropertyStatus;
  toStatus: PropertyStatus;
  reason?: string;
  scheduledDate?: Date;
}

export interface PropertySearchQuery {
  page?: number;
  limit?: number;
  neighborhoodId?: string;
  propertyType?: PropertyType;
  status?: PropertyStatus;
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
  bedrooms?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  ownedBy?: string; // Filter by owner for property management
  createdAfter?: Date;
  createdBefore?: Date;
}

const PROPERTY_SELECT = {
  id: true,
  title: true,
  description: true,
  propertyType: true,
  condition: true,
  neighborhoodId: true,
  address: true,
  latitude: true,
  longitude: true,
  sizeSqm: true,
  bedrooms: true,
  bathrooms: true,
  askingPrice: true,
  rentalPrice: true,
  listingDate: true,
  status: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
  neighborhood: { select: { id: true, name: true, slug: true } },
  images: {
    where: { isPrimary: true },
    take: 1,
    select: { imageUrl: true },
  },
  owner: { select: { firstName: true, lastName: true, email: true } },
};

export async function searchProperties(query: PropertySearchQuery) {
  // Generate cache key based on query parameters
  const cacheKey = `property:search:${JSON.stringify(query)}`;
  
  // Try to get from cache first
  const cachedResult = await cacheGet<{ properties: any[]; meta: any }>(cacheKey);
  if (cachedResult) {
    logger.debug({ msg: 'Cache hit for property search', cacheKey });
    return cachedResult;
  }

  const { page, limit, offset, sortOrder } = parsePagination(query, 'created_at');

  const where: Prisma.PropertyWhereInput = {
    ...(query.neighborhoodId && { neighborhoodId: query.neighborhoodId }),
    ...(query.propertyType && { propertyType: query.propertyType }),
    ...(query.status && { status: query.status }),
    ...(query.ownedBy && { ownerId: query.ownedBy }),
    ...((query.minPrice || query.maxPrice) && {
      askingPrice: {
        ...(query.minPrice && { gte: query.minPrice }),
        ...(query.maxPrice && { lte: query.maxPrice }),
      },
    }),
    ...((query.minSize || query.maxSize) && {
      sizeSqm: {
        ...(query.minSize && { gte: query.minSize }),
        ...(query.maxSize && { lte: query.maxSize }),
      },
    }),
    ...(query.bedrooms && { bedrooms: query.bedrooms }),
    ...((query.createdAfter || query.createdBefore) && {
      createdAt: {
        ...(query.createdAfter && { gte: query.createdAfter }),
        ...(query.createdBefore && { lte: query.createdBefore }),
      },
    }),
    ...(query.search && {
      OR: [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { address: { contains: query.search, mode: 'insensitive' } },
      ],
    }),
  };

  const orderBy: Prisma.PropertyOrderByWithRelationInput =
    query.sortBy === 'price'
      ? { askingPrice: sortOrder }
      : query.sortBy === 'size'
      ? { sizeSqm: sortOrder }
      : query.sortBy === 'status'
      ? { status: sortOrder }
      : { createdAt: sortOrder };

  const [properties, total] = await Promise.all([
    prisma.property.findMany({ 
      where, 
      select: {
        ...PROPERTY_SELECT,
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }, 
      skip: offset, 
      take: limit, 
      orderBy 
    }),
    prisma.property.count({ where }),
  ]);

  const result = { properties, meta: buildPaginationMeta(total, page, limit) };
  
  // Cache the result (shorter TTL for search results since they change frequently)
  await cacheSet(cacheKey, result, CACHE_TTL.SHORT);
  
  return result;
}

export async function getPropertyById(id: string) {
  const cacheKey = `property:detail:${id}`;
  
  // Try to get from cache first
  const cachedProperty = await cacheGet<any>(cacheKey);
  if (cachedProperty) {
    logger.debug({ msg: 'Cache hit for property detail', propertyId: id });
    return cachedProperty;
  }

  const property = await prisma.property.findUnique({
    where: { id },
    select: {
      ...PROPERTY_SELECT,
      history: { orderBy: { changedAt: 'desc' }, take: 20 },
    },
  });
  if (!property) throw new NotFoundError('Property');
  
  // Cache the property detail (longer TTL since property details don't change often)
  await cacheSet(cacheKey, property, CACHE_TTL.LONG);
  
  return property;
}

export async function createProperty(dto: CreatePropertyDto, userId: string) {
  const property = await prisma.property.create({
    data: {
      ...dto,
      askingPrice: dto.askingPrice,
      rentalPrice: dto.rentalPrice ?? null,
      listingDate: new Date(dto.listingDate),
      ownerId: userId,
    },
    select: PROPERTY_SELECT,
  });

  // Invalidate relevant cache entries
  await Promise.all([
    cacheDelPattern('property:search:*'), // Invalidate all search results
    cacheDelPattern('property:stats:*'), // Invalidate statistics
  ]);

  await publishEvent(
    {
      eventType: 'PROPERTY_CREATED',
      aggregateId: property.id,
      payload: { propertyId: property.id, neighborhoodId: property.neighborhoodId, price: dto.askingPrice },
      occurredAt: new Date().toISOString(),
    },
    KAFKA_TOPICS.PROPERTY_EVENTS,
  );

  logger.info({ msg: 'Property created', propertyId: property.id, userId });
  return property;
}

export async function updateProperty(
  id: string,
  dto: UpdatePropertyDto,
  userId: string,
  userRole: string,
) {
  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Property');
  if (existing.ownerId !== userId && !['admin', 'analyst'].includes(userRole)) {
    throw new ForbiddenError('You can only edit your own properties');
  }

  // Track price change
  const priceChanged =
    dto.askingPrice !== undefined &&
    Number(existing.askingPrice) !== dto.askingPrice;

  const updated = await prisma.property.update({
    where: { id },
    data: {
      ...dto,
    },
    select: PROPERTY_SELECT,
  });

  // Record history for meaningful changes
  const trackableFields: (keyof UpdatePropertyDto)[] = ['askingPrice', 'rentalPrice', 'condition'];
  for (const field of trackableFields) {
    const oldVal = String(existing[field as keyof typeof existing] ?? '');
    const newVal = String(dto[field] ?? '');
    if (dto[field] !== undefined && oldVal !== newVal) {
      await prisma.propertyHistory.create({
        data: { propertyId: id, fieldName: field, oldValue: oldVal, newValue: newVal, changedBy: userId },
      });
    }
  }

  if (priceChanged) {
    await publishEvent(
      {
        eventType: 'PRICE_CHANGED',
        aggregateId: id,
        payload: {
          propertyId: id,
          oldPrice: Number(existing.askingPrice),
          newPrice: dto.askingPrice,
          neighborhoodId: existing.neighborhoodId,
        },
        occurredAt: new Date().toISOString(),
      },
      KAFKA_TOPICS.PROPERTY_EVENTS,
    );
  }

  // Invalidate cache entries for this property
  await Promise.all([
    cacheDel(`property:detail:${id}`), // Invalidate property detail cache
    cacheDelPattern('property:search:*'), // Invalidate all search results
    cacheDelPattern('property:stats:*'), // Invalidate statistics
  ]);

  auditLogger.info('Property updated', {
    propertyId: id,
    userId,
    changes: dto
  });

  return updated;
}

export async function deleteProperty(id: string, userId: string, userRole: string) {
  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Property');
  if (existing.ownerId !== userId && userRole !== 'admin') {
    throw new ForbiddenError('You can only delete your own properties');
  }
  await prisma.property.update({ where: { id }, data: { status: 'INACTIVE' } });
  
  // Invalidate cache entries for this property
  await Promise.all([
    cacheDel(`property:detail:${id}`), // Invalidate property detail cache
    cacheDelPattern('property:search:*'), // Invalidate all search results
    cacheDelPattern('property:stats:*'), // Invalidate statistics
  ]);
  
  logger.info({ msg: 'Property deactivated', propertyId: id, userId });
}

// ─── Property Lifecycle Management ────────────────────────────────────────

// Valid status transitions map
const VALID_STATUS_TRANSITIONS: Record<PropertyStatus, PropertyStatus[]> = {
  DRAFT: ['PENDING', 'ARCHIVED'],
  PENDING: ['ACTIVE', 'APPROVED', 'REJECTED', 'SOLD', 'RENTED', 'INACTIVE'],
  APPROVED: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
  REJECTED: ['PENDING', 'ARCHIVED'],
  ACTIVE: ['INACTIVE', 'SOLD', 'RENTED', 'PENDING', 'UNDER_CONTRACT'],
  INACTIVE: ['ACTIVE', 'ARCHIVED'],
  SOLD: ['INACTIVE', 'ARCHIVED'],
  RENTED: ['INACTIVE', 'ACTIVE', 'ARCHIVED'],
  UNDER_CONTRACT: ['SOLD', 'ACTIVE', 'INACTIVE'],
  ARCHIVED: ['INACTIVE'], // Limited recovery from archived
};

export async function changePropertyStatus(
  id: string, 
  transition: PropertyStatusTransition, 
  userId: string,
  userRole: string
) {
  const property = await prisma.property.findUnique({ 
    where: { id },
    include: { listings: { where: { status: 'ACTIVE' } } }
  });
  
  if (!property) throw new NotFoundError('Property');
  
  // Check permissions
  const isOwner = property.ownerId === userId;
  const isAdmin = userRole === 'admin';
  const isAnalyst = userRole === 'analyst';
  
  if (!isOwner && !isAdmin && !isAnalyst) {
    throw new ForbiddenError('You can only manage your own properties');
  }

  // Validate status transition
  const validTransitions = VALID_STATUS_TRANSITIONS[transition.fromStatus];
  if (!validTransitions.includes(transition.toStatus)) {
    throw new BadRequestError(
      `Invalid status transition from ${transition.fromStatus} to ${transition.toStatus}`
    );
  }

  if (property.status !== transition.fromStatus) {
    throw new BadRequestError(
      `Property status is ${property.status}, expected ${transition.fromStatus}`
    );
  }

  // Business rules for specific transitions
  await validateStatusTransitionRules(property, transition, userId);

  // Perform the transition
  const updatedProperty = await prisma.$transaction(async (tx) => {
    // Update property status
    const updated = await tx.property.update({
      where: { id },
      data: { 
        status: transition.toStatus,
        ...(transition.scheduledDate && { listingDate: transition.scheduledDate })
      },
      include: {
        neighborhood: { select: { id: true, name: true, slug: true } },
        listings: { where: { status: 'ACTIVE' } },
        images: { take: 3, orderBy: { isPrimary: 'desc' } }
      }
    });

    // Record history
    await tx.propertyHistory.create({
      data: {
        propertyId: id,
        fieldName: 'status',
        oldValue: transition.fromStatus,
        newValue: transition.toStatus,
        changedBy: userId,
        notes: transition.reason
      }
    });

    // Handle cascading effects based on new status
    await handleStatusTransitionEffects(tx, property, transition);

    return updated;
  });

  // Publish events
  await publishEvent({
    eventType: 'PROPERTY_STATUS_CHANGED',
    aggregateId: id,
    payload: {
      propertyId: id,
      fromStatus: transition.fromStatus,
      toStatus: transition.toStatus,
      reason: transition.reason,
      userId
    },
    occurredAt: new Date().toISOString()
  }, KAFKA_TOPICS.PROPERTY_EVENTS);

  // Invalidate cache entries for this property
  await Promise.all([
    cacheDel(`property:detail:${id}`), // Invalidate property detail cache
    cacheDelPattern('property:search:*'), // Invalidate all search results
    cacheDelPattern('property:stats:*'), // Invalidate statistics
  ]);

  auditLogger.info('Property status changed', {
    propertyId: id,
    fromStatus: transition.fromStatus,
    toStatus: transition.toStatus,
    userId,
    reason: transition.reason
  });

  return updatedProperty;
}

async function validateStatusTransitionRules(
  property: any,
  transition: PropertyStatusTransition,
  userId: string
) {
  // Rule: Only property owner or admin can mark as SOLD/RENTED
  if (['SOLD', 'RENTED'].includes(transition.toStatus)) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (property.ownerId !== userId && user?.role !== 'ADMIN') {
      throw new ForbiddenError('Only property owner or admin can mark property as sold/rented');
    }
  }

  // Rule: Cannot mark as SOLD if there are active rental listings
  if (transition.toStatus === 'SOLD') {
    const activeRentalListings = property.listings?.filter(
      (listing: any) => listing.listingType === 'RENT' && listing.status === 'ACTIVE'
    );
    if (activeRentalListings?.length > 0) {
      throw new BadRequestError('Cannot mark property as sold while having active rental listings');
    }
  }

  // Rule: Cannot mark as RENTED if there are active sale listings
  if (transition.toStatus === 'RENTED') {
    const activeSaleListings = property.listings?.filter(
      (listing: any) => listing.listingType === 'SALE' && listing.status === 'ACTIVE'
    );
    if (activeSaleListings?.length > 0) {
      throw new BadRequestError('Cannot mark property as rented while having active sale listings');
    }
  }

  // Rule: ARCHIVED status requires reason
  if (transition.toStatus === 'ARCHIVED' && !transition.reason) {
    throw new BadRequestError('Reason is required when archiving a property');
  }
}

async function handleStatusTransitionEffects(
  tx: any,
  property: any,
  transition: PropertyStatusTransition
) {
  // When property becomes INACTIVE, SOLD, or RENTED - deactivate all listings
  if (['INACTIVE', 'SOLD', 'RENTED', 'ARCHIVED'].includes(transition.toStatus)) {
    await tx.listing.updateMany({
      where: {
        propertyId: property.id,
        status: 'ACTIVE'
      },
      data: {
        status: transition.toStatus === 'SOLD' ? 'SOLD' :
               transition.toStatus === 'RENTED' ? 'RENTED' : 'INACTIVE'
      }
    });
  }

  // When property becomes ACTIVE - reactivate listings if appropriate
  if (transition.toStatus === 'ACTIVE' && transition.fromStatus === 'INACTIVE') {
    await tx.listing.updateMany({
      where: {
        propertyId: property.id,
        status: 'INACTIVE'
      },
      data: { status: 'ACTIVE' }
    });
  }
}

export async function bulkUpdatePropertyStatus(
  propertyIds: string[],
  transition: PropertyStatusTransition,
  userId: string,
  userRole: string
) {
  const results = [];
  const errors = [];

  for (const propertyId of propertyIds) {
    try {
      const result = await changePropertyStatus(propertyId, transition, userId, userRole);
      results.push({ propertyId, success: true, property: result });
    } catch (error) {
      errors.push({ 
        propertyId, 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  auditLogger.info('Bulk property status update completed', {
    userId,
    totalProperties: propertyIds.length,
    successCount: results.length,
    errorCount: errors.length,
    transition
  });

  return { results, errors };
}

export async function getPropertyLifecycleHistory(id: string, userId: string) {
  const property = await prisma.property.findUnique({ 
    where: { id },
    include: {
      history: {
        include: {
          changedByUser: {
            select: { id: true, firstName: true, lastName: true, email: true }
          }
        },
        orderBy: { changedAt: 'desc' }
      }
    }
  });

  if (!property) throw new NotFoundError('Property');

  // Check if user can view lifecycle history (owner, admin, or analyst)
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const canView = property.ownerId === userId || 
                  ['ADMIN', 'ANALYST'].includes(user?.role || '');
  
  if (!canView) {
    throw new ForbiddenError('You can only view lifecycle history of your own properties');
  }

  return {
    propertyId: id,
    currentStatus: property.status,
    history: property.history.map(h => ({
      id: h.id,
      fieldName: h.fieldName,
      oldValue: h.oldValue,
      newValue: h.newValue,
      changedAt: h.changedAt,
      changedBy: {
        id: h.changedByUser.id,
        name: `${h.changedByUser.firstName} ${h.changedByUser.lastName}`,
        email: h.changedByUser.email
      },
      notes: h.notes
    }))
  };
}

export async function schedulePropertyStatusChange(
  id: string,
  transition: PropertyStatusTransition,
  scheduledDate: Date,
  userId: string,
  userRole: string
) {
  const property = await prisma.property.findUnique({ where: { id } });
  if (!property) throw new NotFoundError('Property');

  // Check permissions
  const isOwner = property.ownerId === userId;
  const isAdmin = userRole === 'admin';
  
  if (!isOwner && !isAdmin) {
    throw new ForbiddenError('You can only schedule status changes for your own properties');
  }

  if (scheduledDate <= new Date()) {
    throw new BadRequestError('Scheduled date must be in the future');
  }

  // Validate the transition is possible
  const validTransitions = VALID_STATUS_TRANSITIONS[transition.fromStatus];
  if (!validTransitions.includes(transition.toStatus)) {
    throw new BadRequestError(
      `Invalid status transition from ${transition.fromStatus} to ${transition.toStatus}`
    );
  }

  // Store scheduled status change (you might want to create a separate table for this)
  const scheduledChange = await prisma.propertyHistory.create({
    data: {
      propertyId: id,
      fieldName: 'scheduled_status_change',
      oldValue: transition.fromStatus,
      newValue: transition.toStatus,
      changedBy: userId,
      notes: `Scheduled for ${scheduledDate.toISOString()}. Reason: ${transition.reason || 'No reason provided'}`,
      changedAt: scheduledDate // Use scheduled date instead of now
    }
  });

  auditLogger.info('Property status change scheduled', {
    propertyId: id,
    fromStatus: transition.fromStatus,
    toStatus: transition.toStatus,
    scheduledDate,
    userId,
    reason: transition.reason
  });

  return {
    message: 'Status change scheduled successfully',
    scheduledChange: {
      id: scheduledChange.id,
      scheduledDate,
      fromStatus: transition.fromStatus,
      toStatus: transition.toStatus,
      reason: transition.reason
    }
  };
}

export async function getPropertyStatistics(userId?: string, userRole?: string) {
  // Generate cache key based on user context
  const cacheKey = `property:stats:${userId || 'global'}`;
  
  // Try to get from cache first
  const cachedStats = await cacheGet<any>(cacheKey);
  if (cachedStats) {
    logger.debug({ msg: 'Cache hit for property statistics', cacheKey });
    return cachedStats;
  }

  const baseWhere = userId && userRole !== 'admin' ? { ownerId: userId } : {};

  const [
    totalProperties,
    statusCounts,
    typeCounts,
    recentActivity,
    averagePriceByType
  ] = await Promise.all([
    // Total count
    prisma.property.count({ where: baseWhere }),

    // Count by status
    prisma.property.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: true
    }),

    // Count by type
    prisma.property.groupBy({
      by: ['propertyType'],
      where: baseWhere,
      _count: true
    }),

    // Recent activity (last 7 days)
    prisma.property.findMany({
      where: {
        ...baseWhere,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      },
      select: {
        id: true,
        title: true,
        status: true,
        propertyType: true,
        askingPrice: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    }),

    // Average price by property type
    prisma.property.groupBy({
      by: ['propertyType'],
      where: {
        ...baseWhere,
        status: 'ACTIVE'
      },
      _avg: {
        askingPrice: true
      },
      _count: true
    })
  ]);

  const stats = {
    totalProperties,
    byStatus: statusCounts.map(item => ({
      status: item.status,
      count: item._count
    })),
    byType: typeCounts.map(item => ({
      type: item.propertyType,
      count: item._count
    })),
    recentActivity,
    averagePrices: averagePriceByType.map(item => ({
      type: item.propertyType,
      averagePrice: item._avg.askingPrice,
      count: item._count
    }))
  };

  // Cache the statistics (medium TTL since they don't change too frequently)
  await cacheSet(cacheKey, stats, CACHE_TTL.MEDIUM);
  
  return stats;
}

export async function transferPropertyOwnership(
  propertyId: string,
  newOwnerId: string,
  currentUserId: string,
  userRole: string,
  reason?: string
) {
  const property = await prisma.property.findUnique({ 
    where: { id: propertyId },
    include: { owner: { select: { id: true, firstName: true, lastName: true, email: true } } }
  });
  
  if (!property) throw new NotFoundError('Property');

  // Only admin or current owner can transfer ownership
  const isCurrentOwner = property.ownerId === currentUserId;
  const isAdmin = userRole === 'admin';
  
  if (!isCurrentOwner && !isAdmin) {
    throw new ForbiddenError('Only property owner or admin can transfer ownership');
  }

  // Verify new owner exists and has appropriate role
  const newOwner = await prisma.user.findUnique({ where: { id: newOwnerId } });
  if (!newOwner) throw new NotFoundError('New owner user not found');
  
  if (!['PROPERTY_OWNER', 'ADMIN'].includes(newOwner.role)) {
    throw new BadRequestError('New owner must have PROPERTY_OWNER or ADMIN role');
  }

  const updatedProperty = await prisma.$transaction(async (tx) => {
    // Update property ownership
    const updated = await tx.property.update({
      where: { id: propertyId },
      data: { ownerId: newOwnerId },
      include: {
        neighborhood: { select: { id: true, name: true, slug: true } },
        owner: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });

    // Record ownership change in history
    await tx.propertyHistory.create({
      data: {
        propertyId,
        fieldName: 'ownership',
        oldValue: property.ownerId,
        newValue: newOwnerId,
        changedBy: currentUserId,
        notes: reason || 'Property ownership transferred'
      }
    });

    return updated;
  });

  // Publish ownership change event
  await publishEvent({
    eventType: 'PROPERTY_OWNERSHIP_TRANSFERRED',
    aggregateId: propertyId,
    payload: {
      propertyId,
      previousOwnerId: property.ownerId,
      newOwnerId,
      transferredBy: currentUserId,
      reason
    },
    occurredAt: new Date().toISOString()
  }, KAFKA_TOPICS.PROPERTY_EVENTS);

  // Invalidate cache entries for this property
  await Promise.all([
    cacheDel(`property:detail:${propertyId}`), // Invalidate property detail cache
    cacheDelPattern('property:search:*'), // Invalidate all search results
    cacheDelPattern('property:stats:*'), // Invalidate statistics
  ]);

  auditLogger.info('Property ownership transferred', {
    propertyId,
    previousOwnerId: property.ownerId,
    newOwnerId,
    transferredBy: currentUserId,
    reason
  });

  return {
    message: 'Property ownership transferred successfully',
    property: updatedProperty
  };
}
