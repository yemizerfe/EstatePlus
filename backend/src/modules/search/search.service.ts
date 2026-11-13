import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { etbEligiblePropertyWhere } from '../../shared/utils/eligibility';
import { BadRequestError } from '../../shared/utils/errors';

export interface SearchFilters {
  q?: string;
  propertyType?: string;
  listingType?: 'sale' | 'rent' | 'both';
  bedrooms?: number;
  bathrooms?: number;
  minPrice?: number;
  maxPrice?: number;
  neighborhood?: string;
  page?: number;
  limit?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'size_desc';
}

interface SearchResult {
  properties: Array<{
    id: string;
    title: string;
    propertyType: string;
    neighborhood: { id: string; name: string; slug: string } | null;
    price: number | null;
    sizeSqm: number | null;
    bedrooms: number;
    bathrooms: number;
    imageUrl: string | null;
    status: string;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const PAGE_DEFAULT = 1;
const LIMIT_DEFAULT = 20;
const LIMIT_MAX = 50;

export async function searchProperties(filters: SearchFilters): Promise<SearchResult> {
  const page = Math.max(1, Number(filters.page ?? PAGE_DEFAULT));
  const limit = Math.min(LIMIT_MAX, Math.max(1, Number(filters.limit ?? LIMIT_DEFAULT)));
  const skip = (page - 1) * limit;

  const where: Prisma.PropertyWhereInput = {
    status: { in: ['ACTIVE', 'APPROVED'] },
    // Search results carry birr prices, so imported rows without an ETB amount
    // are excluded the same way the market aggregates exclude them.
    AND: [etbEligiblePropertyWhere()],
  };

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: 'insensitive' } },
      { description: { contains: filters.q, mode: 'insensitive' } },
      { address: { contains: filters.q, mode: 'insensitive' } },
    ];
  }

  if (filters.propertyType) {
    where.propertyType = filters.propertyType as any;
  }

  if (filters.neighborhood) {
    where.neighborhood = {
      name: { contains: filters.neighborhood, mode: 'insensitive' },
    };
  }

  if (filters.listingType) {
    const listingWhere: any = {};
    if (filters.listingType === 'sale') listingWhere.listingType = 'SALE';
    else if (filters.listingType === 'rent') listingWhere.listingType = 'RENT';
    else listingWhere.listingType = { in: ['SALE', 'RENT', 'BOTH'] };

    where.listings = {
      some: listingWhere,
    };
  }

  if (filters.bedrooms && filters.bedrooms > 0) {
    where.bedrooms = { gte: filters.bedrooms };
  }

  if (filters.bathrooms && filters.bathrooms > 0) {
    where.bathrooms = { gte: filters.bathrooms };
  }

  if (filters.minPrice !== undefined && filters.minPrice > 0) {
    where.askingPrice = { gte: filters.minPrice };
  }

  if (filters.maxPrice !== undefined && filters.maxPrice > 0) {
    if (where.askingPrice) {
      (where.askingPrice as any).lte = filters.maxPrice;
    } else {
      where.askingPrice = { lte: filters.maxPrice };
    }
  }

  const orderBy: Prisma.PropertyOrderByWithRelationInput =
    filters.sort === 'price_asc'
      ? { askingPrice: 'asc' as const }
      : filters.sort === 'price_desc'
        ? { askingPrice: 'desc' as const }
        : filters.sort === 'size_desc'
          ? { sizeSqm: 'desc' as const }
          : { createdAt: 'desc' as const };

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        neighborhood: {
          select: { id: true, name: true, slug: true },
        },
        listings: {
          select: { currentPrice: true },
          take: 1,
          orderBy: { listedAt: 'desc' } as const,
        },
      },
    }),
    prisma.property.count({ where }),
  ]);

  return {
    properties: properties.map((property) => {
      const activePrice = (property as any).listings?.[0]?.currentPrice ?? (property as any).askingPrice;
      return {
        id: property.id,
        title: property.title,
        propertyType: property.propertyType,
        neighborhood: property.neighborhood,
        price: activePrice,
        sizeSqm: Number(property.sizeSqm),
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        imageUrl: null,
        status: property.status,
        createdAt: property.createdAt,
      };
    }),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function searchPropertiesByIds(ids: string[]): Promise<Array<{
  id: string;
  title: string;
  propertyType: string;
  neighborhood: { id: string; name: string; slug: string } | null;
  price: number | null;
  sizeSqm: number | null;
  bedrooms: number;
  bathrooms: number;
  imageUrl: string | null;
  status: string;
  createdAt: Date;
}>> {
  if (!ids.length) return [];

  const where: Prisma.PropertyWhereInput = {
    id: { in: ids },
    status: { in: ['ACTIVE', 'APPROVED'] },
  };
  const properties = await prisma.property.findMany({
      where,
      include: {
        neighborhood: {
          select: { id: true, name: true, slug: true },
        },
        listings: {
          select: { currentPrice: true },
          take: 1,
          orderBy: { listedAt: 'desc' } as const,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

  return properties.map((property) => {
    const activePrice = (property as any).listings?.[0]?.currentPrice ?? (property as any).askingPrice;
    return {
      id: property.id,
      title: property.title,
      propertyType: property.propertyType,
      neighborhood: property.neighborhood,
      price: activePrice,
      sizeSqm: Number(property.sizeSqm),
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      imageUrl: null,
      status: property.status,
      createdAt: property.createdAt,
    };
  });
}

export function validateSearchFilters(filters: SearchFilters): void {
  if (filters.page !== undefined && filters.page < 1) {
    throw new BadRequestError('Page must be >= 1');
  }
  if (filters.limit !== undefined && filters.limit < 1) {
    throw new BadRequestError('Limit must be >= 1');
  }
  if (filters.limit !== undefined && filters.limit > LIMIT_MAX) {
    throw new BadRequestError(`Limit must be <= ${LIMIT_MAX}`);
  }
  if (filters.bedrooms !== undefined && filters.bedrooms < 0) {
    throw new BadRequestError('Bedrooms must be >= 0');
  }
  if (filters.bathrooms !== undefined && filters.bathrooms < 0) {
    throw new BadRequestError('Bathrooms must be >= 0');
  }
  if (filters.minPrice !== undefined && filters.minPrice < 0) {
    throw new BadRequestError('Min price must be >= 0');
  }
  if (filters.maxPrice !== undefined && filters.maxPrice < 0) {
    throw new BadRequestError('Max price must be >= 0');
  }
  if (
    filters.minPrice !== undefined &&
    filters.maxPrice !== undefined &&
    filters.minPrice > filters.maxPrice
  ) {
    throw new BadRequestError('Min price must be <= max price');
  }
}
