import type { Prisma } from '@prisma/client';

import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ForbiddenError } from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';

export interface CreateReportDto {
  title: string;
  description?: string;
  period?: string;
  neighborhoodIds?: string[];
  analysis?: string;
  conclusions?: string;
}

export interface UpdateReportDto {
  title?: string;
  description?: string;
  analysis?: string;
  conclusions?: string;
}

export interface ReportFilters {
  authorId?: string;
  period?: string;
  neighborhood?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Create a new market report
 */
export async function createReport(dto: CreateReportDto, authorId: string) {
  // Gather market data for the report
  const marketData = await gatherMarketData(dto.period, dto.neighborhoodIds);
  const economicData = await gatherEconomicData(dto.period);

  const report = await prisma.report.create({
    data: {
      title: dto.title,
      description: dto.description,
      period: dto.period,
      neighborhoodIds: dto.neighborhoodIds || [],
      marketData,
      economicData,
      analysis: dto.analysis,
      conclusions: dto.conclusions,
      authorId
    },
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  });

  logger.info({ 
    msg: 'Report created', 
    reportId: report.id, 
    authorId,
    title: dto.title 
  });

  return report;
}

/**
 * Get reports with filters and pagination
 */
export async function getReports(filters: ReportFilters = {}) {
  const {
    authorId,
    period,
    neighborhood,
    page = 1,
    limit = 20,
    sortBy = 'generatedAt',
    sortOrder = 'desc'
  } = filters;

  const skip = (page - 1) * limit;

  const where: any = {};

  if (authorId) {
    where.authorId = authorId;
  }

  if (period) {
    where.period = period;
  }

  if (neighborhood) {
    // Check if neighborhood ID is in the neighborhoodIds array
    where.neighborhoodIds = {
      has: neighborhood
    };
  }

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder } as Prisma.ReportOrderByWithRelationInput,
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    }),
    prisma.report.count({ where })
  ]);

  return {
    reports: reports.map(report => ({
      id: report.id,
      title: report.title,
      description: report.description,
      period: report.period,
      neighborhoodIds: report.neighborhoodIds,
      author: {
        id: report.author.id,
        name: `${report.author.firstName} ${report.author.lastName}`,
        email: report.author.email
      },
      generatedAt: report.generatedAt,
      updatedAt: report.updatedAt
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1
  };
}

/**
 * Get a specific report by ID
 */
export async function getReportById(id: string, _userId?: string) {
  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  });

  if (!report) {
    throw new NotFoundError('Report not found');
  }

  return report;
}

/**
 * Update a report
 */
export async function updateReport(id: string, dto: UpdateReportDto, userId: string) {
  const report = await prisma.report.findUnique({
    where: { id },
    select: { authorId: true }
  });

  if (!report) {
    throw new NotFoundError('Report not found');
  }

  if (report.authorId !== userId) {
    throw new ForbiddenError('You can only update your own reports');
  }

  const updatedReport = await prisma.report.update({
    where: { id },
    data: dto,
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  });

  logger.info({ 
    msg: 'Report updated', 
    reportId: id, 
    userId,
    changes: dto 
  });

  return updatedReport;
}

/**
 * Delete a report
 */
export async function deleteReport(id: string, userId: string) {
  const report = await prisma.report.findUnique({
    where: { id },
    select: { authorId: true }
  });

  if (!report) {
    throw new NotFoundError('Report not found');
  }

  if (report.authorId !== userId) {
    throw new ForbiddenError('You can only delete your own reports');
  }

  await prisma.report.delete({
    where: { id }
  });

  logger.info({ 
    msg: 'Report deleted', 
    reportId: id, 
    userId 
  });
}

/**
 * Get reports by author
 */
export async function getReportsByAuthor(authorId: string, filters: {
  page?: number;
  limit?: number;
} = {}) {
  const { page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where: { authorId },
      skip,
      take: limit,
      orderBy: { generatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        period: true,
        generatedAt: true,
        updatedAt: true
      }
    }),
    prisma.report.count({ where: { authorId } })
  ]);

  return {
    reports,
    total,
    page,
    pages: Math.ceil(total / limit)
  };
}

/**
 * Generate automated market data for report
 */
async function gatherMarketData(period?: string, neighborhoodIds?: string[]) {
  const where: any = {};
  
  if (period) {
    where.period = period;
  }

  if (neighborhoodIds && neighborhoodIds.length > 0) {
    where.neighborhoodId = { in: neighborhoodIds };
  }

  // Get market statistics
  const marketStats = await prisma.marketStatistic.findMany({
    where,
    include: {
      neighborhood: true
    },
    orderBy: { period: 'desc' },
    take: 50
  });

  // Get property counts by type
  const propertyCountByType = await prisma.property.groupBy({
    by: ['propertyType'],
    where: neighborhoodIds && neighborhoodIds.length > 0 ? {
      neighborhoodId: { in: neighborhoodIds }
    } : {},
    _count: { id: true }
  });

  // Get listing counts by status
  const listingCountByStatus = await prisma.listing.groupBy({
    by: ['status'],
    where: neighborhoodIds && neighborhoodIds.length > 0 ? {
      property: {
        neighborhoodId: { in: neighborhoodIds }
      }
    } : {},
    _count: { id: true }
  });

  return {
    marketStatistics: marketStats,
    propertyCountByType,
    listingCountByStatus,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Get economic indicators for report
 */
async function gatherEconomicData(_period?: string) {
  // A report captures the latest observation of each indicator at generation
  // time. Filtering by the report month would usually return nothing, because
  // indicators are published less often than monthly listings, and would make
  // the section contradict its own "latest observation" label.
  const indicators = await prisma.economicIndicator.findMany({
    orderBy: { recordedAt: 'desc' },
    take: 20
  });

  // Group by indicator type to get latest values
  const indicatorsByType = indicators.reduce((acc, indicator) => {
    if (!acc[indicator.indicatorType] || indicator.recordedAt > acc[indicator.indicatorType].recordedAt) {
      acc[indicator.indicatorType] = indicator;
    }
    return acc;
  }, {} as Record<string, any>);

  return {
    indicators: indicatorsByType,
    count: indicators.length,
    generatedAt: new Date().toISOString()
  };
}