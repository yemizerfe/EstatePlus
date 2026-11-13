import { Prisma, AmenityType, StatisticType } from '@prisma/client';
import dayjs from 'dayjs';

import { prisma } from '../../infrastructure/database/prisma';
import { cacheGet, cacheSet, cacheDelPattern } from '../../infrastructure/redis/client';
import { CACHE_KEYS, CACHE_TTL } from '../../shared/constants';
import { etbEligiblePropertyWhere } from '../../shared/utils/eligibility';
import { NotFoundError, BadRequestError } from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';
import { mean, median, percentileChange, removeOutliers, standardDeviation } from '../../shared/utils/statistics';
import { auditLogger } from '../../middleware/auditLog';

// ─── Interfaces ──────────────────────────────────────────────

export interface NeighborhoodQuery {
  city?: string;
  subcity?: string;
  isActive?: boolean;
  search?: string;
  sortBy?: 'name' | 'population' | 'areaSqkm' | 'walkScore';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateNeighborhoodDto {
  name: string;
  slug: string;
  city: string;
  subcity?: string;
  description?: string;
  areaSqkm?: number;
  population?: number;
  establishedYear?: number;
  averageIncome?: number;
  centerLat?: number;
  centerLng?: number;
  walkScore?: number;
  safetyRating?: number;
  coordinates?: any; // GeoJSON
  metadata?: any;
}

export interface UpdateNeighborhoodDto {
  name?: string;
  description?: string;
  areaSqkm?: number;
  population?: number;
  averageIncome?: number;
  walkScore?: number;
  safetyRating?: number;
  isActive?: boolean;
  metadata?: any;
}

export interface AddAmenityDto {
  amenityType: AmenityType;
  name: string;
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  distance?: number;
  rating?: number;
  verified?: boolean;
  metadata?: any;
}

export interface RecordStatisticDto {
  period: string;
  statisticType: StatisticType;
  value: number;
  unit?: string;
  source?: string;
  metadata?: any;
}

// ─── Core CRUD Operations ────────────────────────────────────

export async function listNeighborhoods(query?: NeighborhoodQuery) {
  const cached = await cacheGet<unknown[]>(CACHE_KEYS.NEIGHBORHOOD_LIST);
  if (cached && !query) return cached;

  const where: Prisma.NeighborhoodWhereInput = {
    ...(query?.city && { city: { contains: query.city, mode: 'insensitive' } }),
    ...(query?.subcity && { subcity: { contains: query.subcity, mode: 'insensitive' } }),
    ...(query?.isActive !== undefined && { isActive: query.isActive }),
    ...(query?.search && {
      OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } }
      ]
    })
  };

  const orderBy: Prisma.NeighborhoodOrderByWithRelationInput = 
    query?.sortBy ? { [query.sortBy]: query.sortOrder || 'asc' } : { name: 'asc' };

  const neighborhoods = await prisma.neighborhood.findMany({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      subcity: true,
      description: true,
      areaSqkm: true,
      population: true,
      centerLat: true,
      centerLng: true,
      walkScore: true,
      safetyRating: true,
      isActive: true,
      _count: { 
        select: { 
          properties: true,
          amenities: true 
        } 
      },
    },
    orderBy,
  });

  if (!query) {
    await cacheSet(CACHE_KEYS.NEIGHBORHOOD_LIST, neighborhoods, CACHE_TTL.LONG);
  }
  
  return neighborhoods;
}

export async function getNeighborhoodBySlug(slug: string) {
  const neighborhood = await prisma.neighborhood.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      subcity: true,
      description: true,
      areaSqkm: true,
      population: true,
      establishedYear: true,
      averageIncome: true,
      centerLat: true,
      centerLng: true,
      walkScore: true,
      safetyRating: true,
      isActive: true,
      coordinates: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
      _count: { 
        select: { 
          properties: true,
          amenities: true,
          statistics: true
        } 
      },
    },
  });
  
  if (!neighborhood) throw new NotFoundError('Neighborhood');
  return neighborhood;
}

export async function createNeighborhood(data: CreateNeighborhoodDto, userId: string) {
  // Check if slug already exists
  const existing = await prisma.neighborhood.findUnique({
    where: { slug: data.slug }
  });

  if (existing) {
    throw new BadRequestError('Neighborhood with this slug already exists');
  }

  const neighborhood = await prisma.neighborhood.create({
    data: {
      ...data,
      areaSqkm: data.areaSqkm,
      population: data.population,
      averageIncome: data.averageIncome,
      centerLat: data.centerLat,
      centerLng: data.centerLng,
      walkScore: data.walkScore,
      safetyRating: data.safetyRating
    },
    include: {
      _count: {
        select: { properties: true, amenities: true }
      }
    }
  });

  // Invalidate cache
  await cacheDelPattern('neighborhood:*');

  auditLogger.info('Neighborhood created', {
    neighborhoodId: neighborhood.id,
    name: neighborhood.name,
    userId
  });

  return neighborhood;
}

export async function updateNeighborhood(slug: string, data: UpdateNeighborhoodDto, userId: string) {
  const existing = await prisma.neighborhood.findUnique({ where: { slug } });
  if (!existing) throw new NotFoundError('Neighborhood');

  const updated = await prisma.neighborhood.update({
    where: { slug },
    data: {
      ...data,
      areaSqkm: data.areaSqkm,
      averageIncome: data.averageIncome,
      walkScore: data.walkScore,
      safetyRating: data.safetyRating
    },
    include: {
      _count: {
        select: { properties: true, amenities: true }
      }
    }
  });

  // Invalidate cache
  await cacheDelPattern('neighborhood:*');

  auditLogger.info('Neighborhood updated', {
    neighborhoodId: updated.id,
    slug,
    userId,
    changes: data
  });

  return updated;
}

export async function deleteNeighborhood(slug: string, userId: string) {
  const existing = await prisma.neighborhood.findUnique({
    where: { slug },
    include: {
      _count: { select: { properties: true } }
    }
  });

  if (!existing) throw new NotFoundError('Neighborhood');

  if (existing._count.properties > 0) {
    throw new BadRequestError(
      `Cannot delete neighborhood with ${existing._count.properties} properties. Please reassign or delete properties first.`
    );
  }

  await prisma.neighborhood.delete({ where: { slug } });

  // Invalidate cache
  await cacheDelPattern('neighborhood:*');

  auditLogger.info('Neighborhood deleted', {
    neighborhoodId: existing.id,
    slug,
    userId
  });

  return { message: 'Neighborhood deleted successfully' };
}

// ─── Statistics & Analytics ──────────────────────────────────

export async function getNeighborhoodStats(slug: string) {
  const cacheKey = CACHE_KEYS.NEIGHBORHOOD_STATS(slug);
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const neighborhood = await prisma.neighborhood.findUnique({ where: { slug } });
  if (!neighborhood) throw new NotFoundError('Neighborhood');

  const now = dayjs();
  const currentPeriod = now.format('YYYY-MM');
  const prevPeriod = now.subtract(1, 'month').format('YYYY-MM');

  // Active listings
  const activeProperties = await prisma.property.findMany({
    // APPROVED is the canonical live status; ACTIVE is kept for legacy rows.
    where: {
      neighborhoodId: neighborhood.id,
      status: { in: ['APPROVED', 'ACTIVE'] },
      ...etbEligiblePropertyWhere(),
    },
    select: { askingPrice: true, rentalPrice: true, sizeSqm: true },
  });

  const prices = removeOutliers(activeProperties.map((p) => Number(p.askingPrice)));
  const rentals = removeOutliers(
    activeProperties.filter((p) => p.rentalPrice).map((p) => Number(p.rentalPrice)),
  );
  
  const avgPrice = mean(prices);
  const medianPrice = median(prices);
  const avgRent = mean(rentals);
  const pricePerSqm = activeProperties.length > 0
    ? mean(activeProperties.map((p) => Number(p.askingPrice) / Number(p.sizeSqm)))
    : 0;

  // Market stats for growth calculation
  const [currentStats, prevStats] = await Promise.all([
    prisma.marketStatistic.findFirst({
      where: { neighborhoodId: neighborhood.id, period: currentPeriod },
    }),
    prisma.marketStatistic.findFirst({
      where: { neighborhoodId: neighborhood.id, period: prevPeriod },
    }),
  ]);

  const priceGrowth = currentStats?.avgPrice && prevStats?.avgPrice
    ? percentileChange(Number(currentStats.avgPrice), Number(prevStats.avgPrice))
    : 0;

  const rentalYield = avgPrice > 0 && avgRent > 0 ? ((avgRent * 12) / avgPrice) * 100 : 0;

  // Supply level: based on active listings count
  const supplyLevel = activeProperties.length > 100 ? 'high' : activeProperties.length > 30 ? 'medium' : 'low';

  // Demand indicator: price growth as proxy
  const demandIndicator = priceGrowth > 3 ? 'high' : priceGrowth > 0 ? 'medium' : 'low';

  // Get amenity counts
  const amenityCounts = await prisma.neighborhoodAmenity.groupBy({
    by: ['amenityType'],
    where: { neighborhoodId: neighborhood.id },
    _count: true
  });

  const stats = {
    neighborhood: { 
      id: neighborhood.id, 
      name: neighborhood.name, 
      slug: neighborhood.slug,
      population: neighborhood.population,
      areaSqkm: Number(neighborhood.areaSqkm),
      walkScore: neighborhood.walkScore,
      safetyRating: Number(neighborhood.safetyRating)
    },
    market: {
      avgPrice,
      medianPrice,
      pricePerSqm,
      avgRent,
      rentalYield: Number(rentalYield.toFixed(2)),
      priceGrowth: Number(priceGrowth.toFixed(2)),
      activeListings: activeProperties.length,
      supplyLevel,
      demandIndicator
    },
    amenities: {
      total: amenityCounts.reduce((sum, a) => sum + a._count, 0),
      byType: amenityCounts.map(a => ({
        type: a.amenityType,
        count: a._count
      }))
    },
    calculatedAt: new Date().toISOString(),
  };

  await cacheSet(cacheKey, stats, CACHE_TTL.MEDIUM);
  logger.info({ msg: 'neighborhood.stats.calculated', neighborhood: slug, duration: '0ms' });
  return stats;
}

export async function getComprehensiveNeighborhoodAnalysis(slug: string) {
  const neighborhood = await prisma.neighborhood.findUnique({
    where: { slug },
    include: {
      amenities: {
        select: {
          id: true,
          amenityType: true,
          name: true,
          distance: true,
          rating: true
        }
      },
      statistics: {
        where: {
          period: dayjs().format('YYYY-MM')
        },
        select: {
          statisticType: true,
          value: true,
          unit: true
        }
      },
      properties: {
        where: { status: { in: ['APPROVED', 'ACTIVE'] }, ...etbEligiblePropertyWhere() },
        select: {
          propertyType: true,
          askingPrice: true,
          rentalPrice: true,
          createdAt: true
        }
      }
    }
  });

  if (!neighborhood) throw new NotFoundError('Neighborhood');

  // Calculate market metrics
  const prices = neighborhood.properties.map(p => Number(p.askingPrice));
  const rentals = neighborhood.properties
    .filter(p => p.rentalPrice)
    .map(p => Number(p.rentalPrice));

  // Property type distribution
  const typeDistribution = neighborhood.properties.reduce((acc, p) => {
    acc[p.propertyType] = (acc[p.propertyType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Amenity accessibility score (based on distance and ratings)
  const amenityScore = calculateAmenityScore(neighborhood.amenities);

  // Investment score (composite of multiple factors)
  const investmentScore = calculateInvestmentScore({
    priceGrowth: 0, // This would come from market stats
    rentalYield: rentals.length > 0 ? (mean(rentals) * 12) / mean(prices) * 100 : 0,
    amenityScore,
    walkScore: neighborhood.walkScore || 0,
    safetyRating: Number(neighborhood.safetyRating) || 0
  });

  return {
    neighborhood: {
      id: neighborhood.id,
      name: neighborhood.name,
      slug: neighborhood.slug,
      city: neighborhood.city,
      subcity: neighborhood.subcity,
      description: neighborhood.description,
      population: neighborhood.population,
      areaSqkm: Number(neighborhood.areaSqkm),
      walkScore: neighborhood.walkScore,
      safetyRating: Number(neighborhood.safetyRating)
    },
    market: {
      totalProperties: neighborhood.properties.length,
      avgPrice: mean(prices),
      medianPrice: median(prices),
      priceStdDev: standardDeviation(prices),
      avgRentalPrice: mean(rentals),
      typeDistribution
    },
    amenities: {
      total: neighborhood.amenities.length,
      byType: groupAmenitiesByType(neighborhood.amenities),
      accessibilityScore: amenityScore
    },
    statistics: neighborhood.statistics.reduce((acc, stat) => {
      acc[stat.statisticType] = {
        value: Number(stat.value),
        unit: stat.unit
      };
      return acc;
    }, {} as Record<string, any>),
    scores: {
      investment: investmentScore,
      walkability: neighborhood.walkScore || 0,
      safety: Number(neighborhood.safetyRating) || 0,
      amenityAccess: amenityScore
    },
    metadata: neighborhood.metadata
  };
}

function calculateAmenityScore(amenities: any[]): number {
  if (amenities.length === 0) return 0;

  // Weight amenities by type importance and accessibility
  const weights: Record<string, number> = {
    SCHOOL: 1.2,
    HOSPITAL: 1.3,
    SUPERMARKET: 1.0,
    PUBLIC_TRANSPORT: 1.1,
    PARK: 0.9,
    RESTAURANT: 0.7
  };

  const scores = amenities.map(amenity => {
    const typeWeight = weights[amenity.amenityType] || 0.8;
    const distanceScore = amenity.distance ? Math.max(0, 100 - amenity.distance / 50) : 50;
    const ratingScore = amenity.rating ? Number(amenity.rating) * 20 : 50;
    return (distanceScore * 0.6 + ratingScore * 0.4) * typeWeight;
  });

  return Math.min(100, mean(scores));
}

function groupAmenitiesByType(amenities: any[]) {
  return amenities.reduce((acc, amenity) => {
    if (!acc[amenity.amenityType]) {
      acc[amenity.amenityType] = [];
    }
    acc[amenity.amenityType].push({
      id: amenity.id,
      name: amenity.name,
      distance: amenity.distance,
      rating: Number(amenity.rating)
    });
    return acc;
  }, {} as Record<string, any[]>);
}

function calculateInvestmentScore(factors: {
  priceGrowth: number;
  rentalYield: number;
  amenityScore: number;
  walkScore: number;
  safetyRating: number;
}): number {
  // Weighted composite score (0-100)
  const weights = {
    priceGrowth: 0.25,
    rentalYield: 0.25,
    amenityScore: 0.20,
    walkScore: 0.15,
    safetyRating: 0.15
  };

  const normalizedPriceGrowth = Math.min(100, Math.max(0, (factors.priceGrowth + 5) * 10));
  const normalizedRentalYield = Math.min(100, factors.rentalYield * 10);
  const normalizedWalkScore = factors.walkScore;
  const normalizedSafetyRating = factors.safetyRating * 20;

  const score = 
    normalizedPriceGrowth * weights.priceGrowth +
    normalizedRentalYield * weights.rentalYield +
    factors.amenityScore * weights.amenityScore +
    normalizedWalkScore * weights.walkScore +
    normalizedSafetyRating * weights.safetyRating;

  return Math.round(Math.min(100, Math.max(0, score)));
}

export async function rankNeighborhoods() {
  const neighborhoods = await prisma.neighborhood.findMany({ 
    where: { isActive: true },
    select: { id: true, name: true, slug: true } 
  });

  const ranked = await Promise.all(
    neighborhoods.map(async (n) => {
      const props = await prisma.property.findMany({
        where: {
          neighborhoodId: n.id,
          status: { in: ['APPROVED', 'ACTIVE'] },
          ...etbEligiblePropertyWhere(),
        },
        select: { askingPrice: true, rentalPrice: true, sizeSqm: true },
      });
      
      if (props.length < 3) return { ...n, score: 0, activeListings: props.length };

      const prices = props.map((p) => Number(p.askingPrice));
      const rentals = props.filter((p) => p.rentalPrice).map((p) => Number(p.rentalPrice));
      const avgPrice = mean(prices);
      const avgRent = mean(rentals);
      const rentalYield = avgPrice > 0 && avgRent > 0 ? (avgRent * 12) / avgPrice : 0;

      // Simple composite score: rental yield (weight 0.6) + listing count (weight 0.4, normalised)
      const score = rentalYield * 0.6 + Math.min(props.length / 50, 1) * 0.4;

      return {
        ...n,
        avgPrice: Math.round(avgPrice),
        avgRent: Math.round(avgRent),
        rentalYield: Number((rentalYield * 100).toFixed(2)),
        activeListings: props.length,
        score: Number(score.toFixed(4)),
      };
    }),
  );

  return ranked.sort((a, b) => b.score - a.score);
}

// ─── Amenity Management ──────────────────────────────────────

export async function getNeighborhoodAmenities(slug: string, amenityType?: AmenityType) {
  const neighborhood = await prisma.neighborhood.findUnique({ where: { slug } });
  if (!neighborhood) throw new NotFoundError('Neighborhood');

  const amenities = await prisma.neighborhoodAmenity.findMany({
    where: {
      neighborhoodId: neighborhood.id,
      ...(amenityType && { amenityType })
    },
    orderBy: [
      { verified: 'desc' },
      { rating: 'desc' },
      { distance: 'asc' }
    ]
  });

  return {
    neighborhood: {
      id: neighborhood.id,
      name: neighborhood.name,
      slug: neighborhood.slug
    },
    amenities,
    summary: {
      total: amenities.length,
      verified: amenities.filter(a => a.verified).length,
      avgRating: mean(amenities.filter(a => a.rating).map(a => Number(a.rating)))
    }
  };
}

export async function addNeighborhoodAmenity(slug: string, data: AddAmenityDto, userId: string) {
  const neighborhood = await prisma.neighborhood.findUnique({ where: { slug } });
  if (!neighborhood) throw new NotFoundError('Neighborhood');

  // Calculate distance from neighborhood center if coordinates provided
  let distance = data.distance;
  if (data.latitude && data.longitude && neighborhood.centerLat && neighborhood.centerLng) {
    distance = calculateDistance(
      Number(neighborhood.centerLat),
      Number(neighborhood.centerLng),
      data.latitude,
      data.longitude
    );
  }

  const amenity = await prisma.neighborhoodAmenity.create({
    data: {
      neighborhoodId: neighborhood.id,
      amenityType: data.amenityType,
      name: data.name,
      description: data.description,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      distance,
      rating: data.rating,
      verified: data.verified || false,
      metadata: data.metadata
    }
  });

  // Invalidate cache
  await cacheDelPattern(`neighborhood:${slug}:*`);

  auditLogger.info('Amenity added to neighborhood', {
    neighborhoodId: neighborhood.id,
    amenityId: amenity.id,
    amenityType: data.amenityType,
    userId
  });

  return amenity;
}

export async function updateNeighborhoodAmenity(
  amenityId: string, 
  data: Partial<AddAmenityDto>, 
  userId: string
) {
  const existing = await prisma.neighborhoodAmenity.findUnique({
    where: { id: amenityId },
    include: { neighborhood: true }
  });

  if (!existing) throw new NotFoundError('Amenity');

  const updated = await prisma.neighborhoodAmenity.update({
    where: { id: amenityId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.description && { description: data.description }),
      ...(data.address && { address: data.address }),
      ...(data.latitude && { latitude: data.latitude }),
      ...(data.longitude && { longitude: data.longitude }),
      ...(data.distance && { distance: data.distance }),
      ...(data.rating && { rating: data.rating }),
      ...(data.verified !== undefined && { verified: data.verified }),
      ...(data.metadata && { metadata: data.metadata })
    }
  });

  // Invalidate cache
  await cacheDelPattern(`neighborhood:${existing.neighborhood.slug}:*`);

  auditLogger.info('Amenity updated', {
    amenityId,
    neighborhoodId: existing.neighborhoodId,
    userId,
    changes: data
  });

  return updated;
}

export async function deleteNeighborhoodAmenity(amenityId: string, userId: string) {
  const existing = await prisma.neighborhoodAmenity.findUnique({
    where: { id: amenityId },
    include: { neighborhood: true }
  });

  if (!existing) throw new NotFoundError('Amenity');

  await prisma.neighborhoodAmenity.delete({ where: { id: amenityId } });

  // Invalidate cache
  await cacheDelPattern(`neighborhood:${existing.neighborhood.slug}:*`);

  auditLogger.info('Amenity deleted', {
    amenityId,
    neighborhoodId: existing.neighborhoodId,
    userId
  });

  return { message: 'Amenity deleted successfully' };
}

// ─── Statistics Recording ────────────────────────────────────

export async function recordNeighborhoodStatistic(
  slug: string, 
  data: RecordStatisticDto, 
  userId: string
) {
  const neighborhood = await prisma.neighborhood.findUnique({ where: { slug } });
  if (!neighborhood) throw new NotFoundError('Neighborhood');

  const statistic = await prisma.neighborhoodStatistic.upsert({
    where: {
      neighborhoodId_period_statisticType: {
        neighborhoodId: neighborhood.id,
        period: data.period,
        statisticType: data.statisticType
      }
    },
    update: {
      value: data.value,
      unit: data.unit,
      source: data.source,
      metadata: data.metadata
    },
    create: {
      neighborhoodId: neighborhood.id,
      period: data.period,
      statisticType: data.statisticType,
      value: data.value,
      unit: data.unit,
      source: data.source,
      metadata: data.metadata
    }
  });

  // Invalidate cache
  await cacheDelPattern(`neighborhood:${slug}:*`);

  auditLogger.info('Neighborhood statistic recorded', {
    neighborhoodId: neighborhood.id,
    statisticId: statistic.id,
    statisticType: data.statisticType,
    period: data.period,
    userId
  });

  return statistic;
}

export async function getNeighborhoodStatistics(
  slug: string, 
  statisticType?: StatisticType,
  startPeriod?: string,
  endPeriod?: string
) {
  const neighborhood = await prisma.neighborhood.findUnique({ where: { slug } });
  if (!neighborhood) throw new NotFoundError('Neighborhood');

  const where: Prisma.NeighborhoodStatisticWhereInput = {
    neighborhoodId: neighborhood.id,
    ...(statisticType && { statisticType }),
    ...(startPeriod && endPeriod && {
      period: {
        gte: startPeriod,
        lte: endPeriod
      }
    })
  };

  const statistics = await prisma.neighborhoodStatistic.findMany({
    where,
    orderBy: [
      { period: 'desc' },
      { statisticType: 'asc' }
    ]
  });

  return {
    neighborhood: {
      id: neighborhood.id,
      name: neighborhood.name,
      slug: neighborhood.slug
    },
    statistics,
    summary: {
      totalRecords: statistics.length,
      types: [...new Set(statistics.map(s => s.statisticType))],
      periods: [...new Set(statistics.map(s => s.period))].sort().reverse()
    }
  };
}

// ─── Helper Functions ────────────────────────────────────────

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  // Haversine formula for calculating distance between two coordinates
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c); // Distance in meters
}
