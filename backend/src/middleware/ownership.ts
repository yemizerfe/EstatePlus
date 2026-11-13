import { AuthenticatedRequest } from '../shared/types';
import { prisma } from '../infrastructure/database/prisma';
import { NotFoundError, ForbiddenError } from '../shared/utils/errors';

/**
 * Helper functions to check resource ownership
 */

export async function getPropertyOwnerId(req: AuthenticatedRequest): Promise<string> {
  const propertyId = req.params.id || req.params.propertyId;
  if (!propertyId) {
    throw new NotFoundError('Property ID not provided');
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { ownerId: true }
  });

  if (!property) {
    throw new NotFoundError('Property not found');
  }

  return property.ownerId;
}

export async function getScenarioOwnerId(req: AuthenticatedRequest): Promise<string> {
  const scenarioId = req.params.id || req.params.scenarioId;
  if (!scenarioId) {
    throw new NotFoundError('Scenario ID not provided');
  }

  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    select: { createdBy: true }
  });

  if (!scenario) {
    throw new NotFoundError('Scenario not found');
  }

  return scenario.createdBy;
}

export async function getReportAuthorId(req: AuthenticatedRequest): Promise<string> {
  const reportId = req.params.id || req.params.reportId;
  if (!reportId) {
    throw new NotFoundError('Report ID not provided');
  }

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { authorId: true }
  });

  if (!report) {
    throw new NotFoundError('Report not found');
  }

  return report.authorId;
}

/**
 * Middleware to ensure property owner can only access their own properties
 */
export function requirePropertyOwnership() {
  return async (req: AuthenticatedRequest, _res: any, next: any): Promise<void> => {
    try {
      const currentUserId = req.user.sub;
      const userRole = req.user.role;
      
      // Admins and analysts can access all properties
      if (userRole === 'admin' || userRole === 'analyst') {
        return next();
      }
      
      // Property owners can only access their own properties
      if (userRole === 'property_owner') {
        const propertyOwnerId = await getPropertyOwnerId(req);
        
        if (currentUserId !== propertyOwnerId) {
          throw new ForbiddenError('You can only access your own properties');
        }
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to ensure users can only modify their own resources
 */
export function requireResourceOwnership(getOwnerId: (req: AuthenticatedRequest) => Promise<string>) {
  return async (req: AuthenticatedRequest, _res: any, next: any): Promise<void> => {
    try {
      const currentUserId = req.user.sub;
      const userRole = req.user.role;
      
      // Admins can access all resources
      if (userRole === 'admin') {
        return next();
      }
      
      const resourceOwnerId = await getOwnerId(req);
      
      if (currentUserId !== resourceOwnerId) {
        throw new ForbiddenError('You can only access your own resources');
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}