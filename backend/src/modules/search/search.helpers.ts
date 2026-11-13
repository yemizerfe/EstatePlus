import { Prisma } from '@prisma/client';

/**
 * Helper functions for property search and filtering
 */

/** Advanced filter shape accepted by the property search endpoints. */
export interface AdvancedPropertySearchQuery {
  propertyType?: string | string[];
  status?: string | string[];
  condition?: string | string[];
  neighborhoodId?: string | string[];
  city?: string;
  subcity?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  maxBathrooms?: number;
  minSizeSqm?: number;
  maxSizeSqm?: number;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  hasImages?: boolean;
  hasActiveListings?: boolean;
  ownedBy?: string;
  searchQuery?: string;
}

export function buildPropertyFilters(filters: any): Prisma.PropertyWhereInput {
  const where: Prisma.PropertyWhereInput = {};

  // Basic filters
  if (filters.propertyType) {
    where.propertyType = Array.isArray(filters.propertyType)
      ? { in: filters.propertyType }
      : filters.propertyType;
  }

  if (filters.status) {
    where.status = Array.isArray(filters.status)
      ? { in: filters.status }
      : filters.status;
  }

  if (filters.condition) {
    where.condition = Array.isArray(filters.condition)
      ? { in: filters.condition }
      : filters.condition;
  }

  // Location filters
  if (filters.neighborhoodId) {
    where.neighborhoodId = Array.isArray(filters.neighborhoodId)
      ? { in: filters.neighborhoodId }
      : filters.neighborhoodId;
  }

  if (filters.city) {
    (where as any).city = { contains: filters.city, mode: 'insensitive' };
  }

  if (filters.subcity) {
    (where as any).subcity = { contains: filters.subcity, mode: 'insensitive' };
  }

  // Price filters
  if (filters.minPrice || filters.maxPrice) {
    where.askingPrice = {
      ...(filters.minPrice && { gte: filters.minPrice }),
      ...(filters.maxPrice && { lte: filters.maxPrice })
    };
  }

  // Size filters
  if (filters.minSize || filters.maxSize) {
    where.sizeSqm = {
      ...(filters.minSize && { gte: filters.minSize }),
      ...(filters.maxSize && { lte: filters.maxSize })
    };
  }

  // Room filters
  if (filters.minBedrooms || filters.maxBedrooms) {
    where.bedrooms = {
      ...(filters.minBedrooms && { gte: filters.minBedrooms }),
      ...(filters.maxBedrooms && { lte: filters.maxBedrooms })
    };
  }

  if (filters.minBathrooms || filters.maxBathrooms) {
    where.bathrooms = {
      ...(filters.minBathrooms && { gte: filters.minBathrooms }),
      ...(filters.maxBathrooms && { lte: filters.maxBathrooms })
    };
  }

  // Date filters
  if (filters.listedAfter || filters.listedBefore) {
    where.listingDate = {
      ...(filters.listedAfter && { gte: filters.listedAfter }),
      ...(filters.listedBefore && { lte: filters.listedBefore })
    };
  }

  // Text search
  if (filters.search) {
    const searchFields = filters.searchFields || ['title', 'description', 'address'];
    const searchConditions = [];

    if (searchFields.includes('title')) {
      searchConditions.push({ title: { contains: filters.search, mode: 'insensitive' as const } });
    }
    if (searchFields.includes('description')) {
      searchConditions.push({ description: { contains: filters.search, mode: 'insensitive' as const } });
    }
    if (searchFields.includes('address')) {
      searchConditions.push({ address: { contains: filters.search, mode: 'insensitive' as const } });
    }

    where.OR = searchConditions;
  }

  // Advanced filters
  if (filters.hasImages) {
    where.images = { some: {} };
  }

  if (filters.hasActiveListings) {
    where.listings = {
      some: { status: 'ACTIVE' }
    };
  }

  if (filters.ownedBy) {
    where.ownerId = filters.ownedBy;
  }

  return where;
}

export function calculateSearchRelevance(property: any, searchQuery?: string): number {
  if (!searchQuery) return 1;

  let relevanceScore = 0;
  const query = searchQuery.toLowerCase();

  // Title match (highest weight)
  if (property.title?.toLowerCase().includes(query)) {
    relevanceScore += 10;
    if (property.title.toLowerCase().startsWith(query)) {
      relevanceScore += 5; // Bonus for starting with query
    }
  }

  // Exact neighborhood name match
  if (property.neighborhood?.name?.toLowerCase().includes(query)) {
    relevanceScore += 8;
  }

  // Description match
  if (property.description?.toLowerCase().includes(query)) {
    relevanceScore += 3;
  }

  // Address match
  if (property.address?.toLowerCase().includes(query)) {
    relevanceScore += 5;
  }

  // Property type match
  if (property.propertyType?.toLowerCase().includes(query)) {
    relevanceScore += 7;
  }

  return Math.max(relevanceScore, 1); // Minimum relevance of 1
}

export function buildSearchSortOrder(
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
): Prisma.PropertyOrderByWithRelationInput[] {
  const order = sortOrder || 'desc';

  switch (sortBy) {
    case 'price':
      return [{ askingPrice: order }];
    case 'size':
      return [{ sizeSqm: order }];
    case 'bedrooms':
      return [{ bedrooms: order }];
    case 'updated':
      return [{ updatedAt: order }];
    case 'distance':
      // This would require custom sorting after query
      return [{ createdAt: order }];
    case 'relevance':
      // This would require custom sorting after query
      return [{ createdAt: order }];
    case 'created':
    default:
      return [{ createdAt: order }];
  }
}

export function parseSearchArrayParams(param: any): string[] | undefined {
  if (!param) return undefined;
  return Array.isArray(param) ? param : [param];
}

export function getSearchFiltersSummary(filters: AdvancedPropertySearchQuery): string {
  const parts = [];

  if (filters.propertyType) {
    const types = Array.isArray(filters.propertyType) ? filters.propertyType : [filters.propertyType];
    parts.push(`Type: ${types.join(', ')}`);
  }

  if (filters.minPrice || filters.maxPrice) {
    const price = [];
    if (filters.minPrice) price.push(`Min: $${filters.minPrice.toLocaleString()}`);
    if (filters.maxPrice) price.push(`Max: $${filters.maxPrice.toLocaleString()}`);
    parts.push(`Price: ${price.join(', ')}`);
  }

  if (filters.minBedrooms || filters.maxBedrooms) {
    const beds = [];
    if (filters.minBedrooms) beds.push(`Min: ${filters.minBedrooms}`);
    if (filters.maxBedrooms) beds.push(`Max: ${filters.maxBedrooms}`);
    parts.push(`Bedrooms: ${beds.join(', ')}`);
  }

  if (filters.neighborhoodId) {
    const neighborhoods = Array.isArray(filters.neighborhoodId) 
      ? filters.neighborhoodId.length 
      : 1;
    parts.push(`${neighborhoods} neighborhood(s)`);
  }

  if (filters.latitude && filters.longitude) {
    parts.push(`Within ${filters.radiusKm || 5}km radius`);
  }

  return parts.length > 0 ? parts.join(' • ') : 'All properties';
}