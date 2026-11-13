import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';
import { ListingType, ListingStatus } from '@prisma/client';

export interface CreateListingDto {
  propertyId: string;
  listingType: ListingType;
  currentPrice: number;
  rentalPrice?: number;
  expiresAt?: Date;
}

export interface UpdateListingDto {
  currentPrice?: number;
  rentalPrice?: number;
  status?: ListingStatus;
  expiresAt?: Date;
}

export interface ListingFilters {
  propertyType?: string;
  neighborhood?: string;
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
  bedrooms?: number;
  bathrooms?: number;
  listingType?: ListingType;
  status?: ListingStatus;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Create a new listing for a property
 */
export async function createListing(dto: CreateListingDto, ownerId: string) {
  // Verify property ownership
  const property = await prisma.property.findUnique({
    where: { id: dto.propertyId },
    select: { id: true, ownerId: true, status: true }
  });

  if (!property) {
    throw new NotFoundError('Property not found');
  }

  if (property.ownerId !== ownerId) {
    throw new ForbiddenError('You can only create listings for your own properties');
  }

  if (property.status !== 'APPROVED') {
    throw new BadRequestError('Property must be approved before creating a listing');
  }

  // Check if active listing already exists
  const existingListing = await prisma.listing.findFirst({
    where: {
      propertyId: dto.propertyId,
      status: 'ACTIVE'
    }
  });

  if (existingListing) {
    throw new BadRequestError('Property already has an active listing');
  }

  const listing = await prisma.listing.create({
    data: {
      propertyId: dto.propertyId,
      listingType: dto.listingType,
      currentPrice: dto.currentPrice,
      originalPrice: dto.currentPrice,
      rentalPrice: dto.rentalPrice,
      expiresAt: dto.expiresAt,
      status: 'ACTIVE'
    },
    include: {
      property: {
        include: {
          neighborhood: true,
          images: true
        }
      }
    }
  });

  logger.info({ 
    msg: 'Listing created', 
    listingId: listing.id, 
    propertyId: dto.propertyId,
    ownerId 
  });

  return listing;
}

/**
 * Get listings with filters and pagination
 */
export async function getListings(filters: ListingFilters = {}) {
  const {
    propertyType,
    neighborhood,
    minPrice,
    maxPrice,
    minSize,
    maxSize,
    bedrooms,
    bathrooms,
    listingType,
    status = 'ACTIVE',
    page = 1,
    limit = 20,
    sortBy = 'listedAt',
    sortOrder = 'desc'
  } = filters;

  const skip = (page - 1) * limit;

  const where: any = {
    status,
    property: {}
  };

  if (propertyType) {
    where.property.propertyType = propertyType;
  }

  if (neighborhood) {
    where.property.neighborhood = {
      slug: neighborhood
    };
  }

  if (minPrice || maxPrice) {
    where.currentPrice = {};
    if (minPrice) where.currentPrice.gte = minPrice;
    if (maxPrice) where.currentPrice.lte = maxPrice;
  }

  if (minSize || maxSize) {
    where.property.sizeSqm = {};
    if (minSize) where.property.sizeSqm.gte = minSize;
    if (maxSize) where.property.sizeSqm.lte = maxSize;
  }

  if (bedrooms !== undefined) {
    where.property.bedrooms = bedrooms;
  }

  if (bathrooms !== undefined) {
    where.property.bathrooms = bathrooms;
  }

  if (listingType) {
    where.listingType = listingType;
  }

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        property: {
          include: {
            neighborhood: true,
            images: {
              where: { isPrimary: true },
              take: 1
            }
          }
        }
      }
    }),
    prisma.listing.count({ where })
  ]);

  return {
    listings: listings.map(listing => ({
      id: listing.id,
      listingType: listing.listingType,
      currentPrice: listing.currentPrice,
      originalPrice: listing.originalPrice,
      rentalPrice: listing.rentalPrice,
      status: listing.status,
      listedAt: listing.listedAt,
      expiresAt: listing.expiresAt,
      viewCount: listing.viewCount,
      inquiryCount: listing.inquiryCount,
      property: {
        id: listing.property.id,
        title: listing.property.title,
        description: listing.property.description,
        propertyType: listing.property.propertyType,
        condition: listing.property.condition,
        sizeSqm: listing.property.sizeSqm,
        bedrooms: listing.property.bedrooms,
        bathrooms: listing.property.bathrooms,
        address: listing.property.address,
        latitude: listing.property.latitude,
        longitude: listing.property.longitude,
        neighborhood: {
          id: listing.property.neighborhood.id,
          name: listing.property.neighborhood.name,
          slug: listing.property.neighborhood.slug
        },
        primaryImage: listing.property.images[0]?.imageUrl || null
      }
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1
  };
}

/**
 * Get a specific listing by ID
 */
export async function getListingById(id: string) {
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      property: {
        include: {
          neighborhood: true,
          location: true,
          images: {
            orderBy: { sortOrder: 'asc' }
          },
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profilePicture: true
            }
          }
        }
      },
      priceHistory: {
        orderBy: { changedAt: 'desc' },
        take: 10
      }
    }
  });

  if (!listing) {
    throw new NotFoundError('Listing not found');
  }

  // Increment view count
  await prisma.listing.update({
    where: { id },
    data: { viewCount: { increment: 1 } }
  });

  return listing;
}

/**
 * Update a listing
 */
export async function updateListing(id: string, dto: UpdateListingDto, userId: string) {
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      property: {
        select: { ownerId: true }
      }
    }
  });

  if (!listing) {
    throw new NotFoundError('Listing not found');
  }

  if (listing.property.ownerId !== userId) {
    throw new ForbiddenError('You can only update your own listings');
  }

  // If price is being changed, record price history
  if (dto.currentPrice && dto.currentPrice !== Number(listing.currentPrice)) {
    await prisma.listingPriceHistory.create({
      data: {
        listingId: id,
        oldPrice: listing.currentPrice,
        newPrice: dto.currentPrice,
        changeReason: 'Price updated by owner'
      }
    });
  }

  const updatedListing = await prisma.listing.update({
    where: { id },
    data: dto,
    include: {
      property: {
        include: {
          neighborhood: true,
          images: true
        }
      }
    }
  });

  logger.info({ 
    msg: 'Listing updated', 
    listingId: id, 
    userId,
    changes: dto 
  });

  return updatedListing;
}

/**
 * Delete/deactivate a listing
 */
export async function deleteListing(id: string, userId: string) {
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      property: {
        select: { ownerId: true }
      }
    }
  });

  if (!listing) {
    throw new NotFoundError('Listing not found');
  }

  if (listing.property.ownerId !== userId) {
    throw new ForbiddenError('You can only delete your own listings');
  }

  // Instead of deleting, deactivate the listing
  await prisma.listing.update({
    where: { id },
    data: { status: 'WITHDRAWN' }
  });

  logger.info({ 
    msg: 'Listing deactivated', 
    listingId: id, 
    userId 
  });
}

/**
 * Get listings by property owner
 */
export async function getListingsByOwner(ownerId: string, filters: {
  status?: ListingStatus;
  page?: number;
  limit?: number;
} = {}) {
  const { status, page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;

  const where: any = {
    property: {
      ownerId
    }
  };

  if (status) {
    where.status = status;
  }

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      skip,
      take: limit,
      orderBy: { listedAt: 'desc' },
      include: {
        property: {
          include: {
            neighborhood: true,
            images: {
              where: { isPrimary: true },
              take: 1
            }
          }
        }
      }
    }),
    prisma.listing.count({ where })
  ]);

  return {
    listings,
    total,
    page,
    pages: Math.ceil(total / limit)
  };
}

/**
 * Get listing price history
 */
export async function getListingPriceHistory(listingId: string) {
  const history = await prisma.listingPriceHistory.findMany({
    where: { listingId },
    orderBy: { changedAt: 'desc' }
  });

  return history;
}

/**
 * Record a listing inquiry (for analytics)
 */
export async function recordListingInquiry(listingId: string) {
  await prisma.listing.update({
    where: { id: listingId },
    data: { inquiryCount: { increment: 1 } }
  });
}