import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ForbiddenError } from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';

export interface CreateDataSourceDto {
  name: string;
  sourceType: string;
  description?: string;
}

export interface UpdateDataSourceDto {
  name?: string;
  sourceType?: string;
  description?: string;
}

export interface DataSourceFilters {
  sourceType?: string;
  createdBy?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Create a new data source
 */
export async function createDataSource(dto: CreateDataSourceDto, createdBy: string) {
  const dataSource = await prisma.dataSource.create({
    data: {
      name: dto.name,
      sourceType: dto.sourceType,
      description: dto.description,
      createdBy
    },
    include: {
      creator: {
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
    msg: 'Data source created', 
    dataSourceId: dataSource.id, 
    name: dto.name,
    createdBy 
  });

  return dataSource;
}

/**
 * Get data sources with filters and pagination
 */
export async function getDataSources(filters: DataSourceFilters = {}) {
  const {
    sourceType,
    createdBy,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = filters;

  // Guard against NaN/negative values reaching Prisma (which rejects `skip: NaN`).
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 20;
  const skip = (safePage - 1) * safeLimit;

  const where: any = {};

  if (sourceType) {
    where.sourceType = sourceType;
  }

  if (createdBy) {
    where.createdBy = createdBy;
  }

  const [dataSources, total] = await Promise.all([
    prisma.dataSource.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        importJobs: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            recordsReceived: true,
            recordsValid: true,
            recordsRejected: true,
            startedAt: true,
            completedAt: true
          }
        }
      }
    }),
    prisma.dataSource.count({ where })
  ]);

  return {
    dataSources: dataSources.map(source => ({
      id: source.id,
      name: source.name,
      sourceType: source.sourceType,
      description: source.description,
      creator: source.creator ? {
        id: source.creator.id,
        name: `${source.creator.firstName} ${source.creator.lastName}`,
        email: source.creator.email
      } : null,
      recentJobs: source.importJobs,
      createdAt: source.createdAt
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1
  };
}

/**
 * Get a specific data source by ID
 */
export async function getDataSourceById(id: string) {
  const dataSource = await prisma.dataSource.findUnique({
    where: { id },
    include: {
      creator: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      importJobs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          jobType: true,
          status: true,
          recordsReceived: true,
          recordsValid: true,
          recordsRejected: true,
          fileName: true,
          startedAt: true,
          completedAt: true,
          errorLog: true
        }
      }
    }
  });

  if (!dataSource) {
    throw new NotFoundError('Data source not found');
  }

  return dataSource;
}

/**
 * Update a data source
 */
export async function updateDataSource(id: string, dto: UpdateDataSourceDto, userId: string) {
  const dataSource = await prisma.dataSource.findUnique({
    where: { id },
    select: { createdBy: true }
  });

  if (!dataSource) {
    throw new NotFoundError('Data source not found');
  }

  if (dataSource.createdBy !== userId) {
    throw new ForbiddenError('You can only update your own data sources');
  }

  const updatedDataSource = await prisma.dataSource.update({
    where: { id },
    data: dto,
    include: {
      creator: {
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
    msg: 'Data source updated', 
    dataSourceId: id, 
    userId,
    changes: dto 
  });

  return updatedDataSource;
}

/**
 * Delete a data source
 */
export async function deleteDataSource(id: string, userId: string) {
  const dataSource = await prisma.dataSource.findUnique({
    where: { id },
    select: { createdBy: true }
  });

  if (!dataSource) {
    throw new NotFoundError('Data source not found');
  }

  if (dataSource.createdBy !== userId) {
    throw new ForbiddenError('You can only delete your own data sources');
  }

  // Check if there are any associated import jobs
  const jobCount = await prisma.dataImportJob.count({
    where: { sourceId: id }
  });

  if (jobCount > 0) {
    // Don't delete, just mark as inactive or return error
    throw new ForbiddenError('Cannot delete data source with associated import jobs');
  }

  await prisma.dataSource.delete({
    where: { id }
  });

  logger.info({ 
    msg: 'Data source deleted', 
    dataSourceId: id, 
    userId 
  });
}

/**
 * Get data sources by creator
 */
export async function getDataSourcesByCreator(creatorId: string, filters: {
  sourceType?: string;
  page?: number;
  limit?: number;
} = {}) {
  const { sourceType, page = 1, limit = 20 } = filters;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 20;
  const skip = (safePage - 1) * safeLimit;

  const where: any = { createdBy: creatorId };

  if (sourceType) {
    where.sourceType = sourceType;
  }

  const [dataSources, total] = await Promise.all([
    prisma.dataSource.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        importJobs: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            status: true,
            completedAt: true
          }
        }
      }
    }),
    prisma.dataSource.count({ where })
  ]);

  return {
    dataSources: dataSources.map(source => ({
      id: source.id,
      name: source.name,
      sourceType: source.sourceType,
      description: source.description,
      lastJobStatus: source.importJobs[0]?.status || null,
      lastJobCompletedAt: source.importJobs[0]?.completedAt || null,
      createdAt: source.createdAt
    })),
    total,
    page,
    pages: Math.ceil(total / limit)
  };
}

/**
 * Get data source statistics
 */
export async function getDataSourceStats() {
  const [totalSources, sourcesByType, recentJobs] = await Promise.all([
    prisma.dataSource.count(),
    prisma.dataSource.groupBy({
      by: ['sourceType'],
      _count: { id: true }
    }),
    prisma.dataImportJob.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      }
    })
  ]);

  const successfulJobs = await prisma.dataImportJob.count({
    where: {
      status: 'completed',
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      }
    }
  });

  return {
    totalSources,
    sourcesByType: sourcesByType.reduce((acc, item) => {
      acc[item.sourceType] = item._count.id;
      return acc;
    }, {} as Record<string, number>),
    recentJobsCount: recentJobs,
    successfulJobsCount: successfulJobs,
    successRate: recentJobs > 0 ? (successfulJobs / recentJobs) * 100 : 0
  };
}