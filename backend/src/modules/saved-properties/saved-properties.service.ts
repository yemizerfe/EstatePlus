import { prisma } from '../../infrastructure/database/prisma';
import { SavedPropertyCreateDto, SavedPropertyQueryDto } from './dto/saved-properties.dto';
import { auditLogger } from '../../middleware/auditLog';
import { ConflictError, NotFoundError } from '../../shared/utils/errors';

/** Relations every saved-property payload returns (card + price preview). */
const savedPropertyInclude = {
  property: {
    include: {
      images: { take: 1, orderBy: { isPrimary: 'desc' as const } },
      listings: { where: { status: 'ACTIVE' as const }, take: 1, orderBy: { listedAt: 'desc' as const } },
      neighborhood: { select: { id: true, name: true, city: true, subcity: true } },
    },
  },
};

export class SavedPropertiesService {
  // Save a property to user's saved list
  async saveProperty(userId: string, data: SavedPropertyCreateDto) {
    const existingSaved = await prisma.savedProperty.findFirst({
      where: { userId, propertyId: data.propertyId },
    });

    if (existingSaved) {
      throw new ConflictError('Property is already saved to your list');
    }

    const property = await prisma.property.findUnique({ where: { id: data.propertyId } });
    if (!property) {
      throw new NotFoundError('Property');
    }

    const savedProperty = await prisma.savedProperty.create({
      data: {
        userId,
        propertyId: data.propertyId,
        notes: data.notes,
        tags: data.tags ?? [],
      },
      include: savedPropertyInclude,
    });

    auditLogger.info('Property saved to user list', {
      userId,
      propertyId: data.propertyId,
      savedPropertyId: savedProperty.id,
    });

    return savedProperty;
  }

  // Get user's saved properties with filters and pagination
  async getSavedProperties(userId: string, query: SavedPropertyQueryDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'savedAt',
      sortOrder = 'desc',
      tags,
      search,
      minPrice,
      maxPrice,
      propertyType,
      city,
      subcity,
    } = query;

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };

    // Filters reach through the property + neighborhood relations.
    const propertyWhere: Record<string, unknown> = {};
    const neighborhoodWhere: Record<string, unknown> = {};

    if (search) {
      propertyWhere['OR'] = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (propertyType) {
      propertyWhere['propertyType'] = propertyType;
    }

    if (city) {
      neighborhoodWhere['city'] = { contains: city, mode: 'insensitive' };
    }

    if (subcity) {
      neighborhoodWhere['subcity'] = { contains: subcity, mode: 'insensitive' };
    }

    if (Object.keys(neighborhoodWhere).length > 0) {
      propertyWhere['neighborhood'] = neighborhoodWhere;
    }

    // Price filtering through active listings (listing price column is currentPrice).
    if (minPrice || maxPrice) {
      propertyWhere['listings'] = {
        some: {
          status: 'ACTIVE',
          ...(minPrice && { currentPrice: { gte: minPrice } }),
          ...(maxPrice && { currentPrice: { lte: maxPrice } }),
        },
      };
    }

    if (Object.keys(propertyWhere).length > 0) {
      where['property'] = propertyWhere;
    }

    if (tags && tags.length > 0) {
      where['tags'] = { hasSome: tags };
    }

    const [savedProperties, total] = await Promise.all([
      prisma.savedProperty.findMany({
        where,
        include: savedPropertyInclude,
        // SavedProperty has savedAt only; "updatedAt" ordering uses the saved
        // property's related property, which is the timestamp users care about.
        orderBy:
          sortBy === 'updatedAt'
            ? { property: { updatedAt: sortOrder } }
            : { savedAt: sortOrder },
        skip,
        take: limit,
      }),
      prisma.savedProperty.count({ where }),
    ]);

    return {
      data: savedProperties,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Update saved property (notes, tags)
  async updateSavedProperty(userId: string, savedPropertyId: string, data: Partial<SavedPropertyCreateDto>) {
    const savedProperty = await prisma.savedProperty.findFirst({
      where: { id: savedPropertyId, userId },
    });

    if (!savedProperty) {
      throw new NotFoundError('Saved property');
    }

    const updated = await prisma.savedProperty.update({
      where: { id: savedPropertyId },
      data: {
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
      },
      include: savedPropertyInclude,
    });

    auditLogger.info('Saved property updated', {
      userId,
      savedPropertyId,
      changes: data,
    });

    return updated;
  }

  // Remove property from saved list
  async removeSavedProperty(userId: string, savedPropertyId: string) {
    const savedProperty = await prisma.savedProperty.findFirst({
      where: { id: savedPropertyId, userId },
    });

    if (!savedProperty) {
      throw new NotFoundError('Saved property');
    }

    await prisma.savedProperty.delete({ where: { id: savedPropertyId } });

    auditLogger.info('Property removed from saved list', {
      userId,
      savedPropertyId,
      propertyId: savedProperty.propertyId,
    });

    return { message: 'Property removed from saved list' };
  }

  // Check if property is saved by user
  async isPropertySaved(userId: string, propertyId: string) {
    const savedProperty = await prisma.savedProperty.findFirst({
      where: { userId, propertyId },
    });

    return {
      isSaved: Boolean(savedProperty),
      savedPropertyId: savedProperty?.id ?? null,
    };
  }

  // Get saved properties summary/statistics
  async getSavedPropertiesSummary(userId: string) {
    const savedRows = await prisma.savedProperty.findMany({
      where: { userId },
      select: { propertyId: true },
    });
    const propertyIds = savedRows.map((row) => row.propertyId);

    if (propertyIds.length === 0) {
      return { totalSaved: 0, byType: [], byCity: [], recentActivity: [] };
    }

    const [byType, byCity, recentActivity] = await Promise.all([
      prisma.property.groupBy({
        by: ['propertyType'],
        where: { id: { in: propertyIds } },
        _count: true,
      }),
      prisma.neighborhood.groupBy({
        by: ['city'],
        where: { properties: { some: { id: { in: propertyIds } } } },
        _count: true,
      }),
      prisma.savedProperty.findMany({
        where: { userId },
        include: {
          property: {
            include: {
              images: { take: 1, orderBy: { isPrimary: 'desc' } },
              neighborhood: { select: { name: true, city: true, subcity: true } },
            },
          },
        },
        orderBy: { savedAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      totalSaved: savedRows.length,
      byType: byType.map((item) => ({ type: item.propertyType, count: item._count })),
      byCity: byCity.map((item) => ({ city: item.city, count: item._count })),
      recentActivity,
    };
  }

  // Bulk operations
  async bulkRemoveSavedProperties(userId: string, savedPropertyIds: string[]) {
    const result = await prisma.savedProperty.deleteMany({
      where: { id: { in: savedPropertyIds }, userId },
    });

    auditLogger.info('Bulk removed saved properties', {
      userId,
      removedCount: result.count,
      savedPropertyIds,
    });

    return {
      message: `${result.count} properties removed from saved list`,
      removedCount: result.count,
    };
  }

  // Add tags to multiple saved properties
  async bulkUpdateTags(userId: string, savedPropertyIds: string[], tags: string[]) {
    const savedProperties = await prisma.savedProperty.findMany({
      where: { id: { in: savedPropertyIds }, userId },
    });

    await Promise.all(
      savedProperties.map((sp) =>
        prisma.savedProperty.update({
          where: { id: sp.id },
          data: { tags: [...new Set([...sp.tags, ...tags])] },
        }),
      ),
    );

    auditLogger.info('Bulk updated saved properties tags', {
      userId,
      updatedCount: savedProperties.length,
      addedTags: tags,
    });

    return {
      message: `Tags added to ${savedProperties.length} saved properties`,
      updatedCount: savedProperties.length,
    };
  }
}
