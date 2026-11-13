import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types';
import { prisma } from '../infrastructure/database/prisma';
import { logger } from '../shared/utils/logger';

interface AuditLogData {
  action: string;
  resource: string;
  resourceId?: string;
  oldData?: any;
  newData?: any;
}

/**
 * Middleware to log important actions for audit trail
 */
export function auditLog(action: string, resource: string, options: {
  extractResourceId?: (req: AuthenticatedRequest) => string;
  extractOldData?: (req: AuthenticatedRequest) => Promise<any>;
  extractNewData?: (req: AuthenticatedRequest) => any;
} = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.sub;
      const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
      const userAgent = req.get('User-Agent');
      
      let auditData: AuditLogData = {
        action,
        resource,
      };
      
      // Extract resource ID if provided
      if (options.extractResourceId) {
        auditData.resourceId = options.extractResourceId(authReq);
      } else if (req.params.id) {
        auditData.resourceId = req.params.id;
      }
      
      // Extract old data if this is an update operation
      if (options.extractOldData && (action.includes('UPDATE') || action.includes('DELETE'))) {
        auditData.oldData = await options.extractOldData(authReq);
      }
      
      // For create/update operations, capture new data after the request
      const originalSend = res.send;
      res.send = function(data) {
        if (options.extractNewData && (action.includes('CREATE') || action.includes('UPDATE'))) {
          auditData.newData = options.extractNewData(authReq);
        }
        
        // Log the audit event
        createAuditLog({
          userId,
          action: auditData.action,
          resource: auditData.resource,
          resourceId: auditData.resourceId,
          oldData: auditData.oldData,
          newData: auditData.newData,
          ipAddress,
          userAgent,
        }).catch(error => {
          logger.error({ msg: 'Failed to create audit log', error });
        });
        
        return originalSend.call(this, data);
      };
      
      next();
    } catch (error) {
      logger.error({ msg: 'Audit log middleware error', error });
      next();
    }
  };
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(data: {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldData?: any;
  newData?: any;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId ?? null,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId || null,
        oldData: data.oldData ? JSON.parse(JSON.stringify(data.oldData)) : null,
        newData: data.newData ? JSON.parse(JSON.stringify(data.newData)) : null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
    });
  } catch (error) {
    logger.error({ msg: 'Failed to create audit log entry', error, data });
  }
}

/**
 * Structured application logger for auditable events.
 *
 * This writes to the application log only; durable audit records are written
 * with `createAuditLog` / the `auditLog` middleware. Call sites use
 * `auditLogger.info(message, meta)`.
 */
export const auditLogger = {
  info: (message: string, meta: Record<string, unknown> = {}): void => {
    logger.info({ msg: message, ...meta });
  },
  warn: (message: string, meta: Record<string, unknown> = {}): void => {
    logger.warn({ msg: message, ...meta });
  },
  error: (message: string, meta: Record<string, unknown> = {}): void => {
    logger.error({ msg: message, ...meta });
  },
};

/**
 * Specific audit log helpers for common operations
 */
export const AuditActions = {
  // Authentication
  LOGIN: 'USER_LOGIN',
  LOGOUT: 'USER_LOGOUT',
  LOGIN_FAILED: 'LOGIN_FAILED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PROFILE_UPDATED: 'PROFILE_UPDATED',
  
  // Properties
  PROPERTY_CREATED: 'PROPERTY_CREATED',
  PROPERTY_UPDATED: 'PROPERTY_UPDATED',
  PROPERTY_DELETED: 'PROPERTY_DELETED',
  PROPERTY_APPROVED: 'PROPERTY_APPROVED',
  PROPERTY_REJECTED: 'PROPERTY_REJECTED',
  
  // Listings
  LISTING_CREATED: 'LISTING_CREATED',
  LISTING_UPDATED: 'LISTING_UPDATED',
  LISTING_PRICE_CHANGED: 'LISTING_PRICE_CHANGED',
  
  // Market Data
  MARKET_STATS_CALCULATED: 'MARKET_STATS_CALCULATED',
  ECONOMIC_INDICATOR_CREATED: 'ECONOMIC_INDICATOR_CREATED',
  ECONOMIC_INDICATOR_UPDATED: 'ECONOMIC_INDICATOR_UPDATED',
  
  // Admin Actions
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_SUSPENDED: 'USER_SUSPENDED',
  USER_REACTIVATED: 'USER_REACTIVATED',
  
  // Data Management
  DATA_IMPORT_STARTED: 'DATA_IMPORT_STARTED',
  DATA_IMPORT_COMPLETED: 'DATA_IMPORT_COMPLETED',
  REPORT_GENERATED: 'REPORT_GENERATED',
  
  // Scenarios and Forecasts
  SCENARIO_CREATED: 'SCENARIO_CREATED',
  SCENARIO_EXECUTED: 'SCENARIO_EXECUTED',
  FORECAST_GENERATED: 'FORECAST_GENERATED',
} as const;

/**
 * Log authentication events
 */
export async function logAuthEvent(
  action: string,
  userId: string | null,
  data: {
    email?: string;
    ipAddress?: string;
    userAgent?: string;
    success?: boolean;
    reason?: string;
  }
): Promise<void> {
  await createAuditLog({
    userId: userId ?? undefined,
    action,
    resource: 'auth',
    newData: {
      email: data.email,
      success: data.success,
      reason: data.reason,
    },
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
  });
}

/**
 * Log property approval/rejection
 */
export async function logPropertyApproval(
  action: 'PROPERTY_APPROVED' | 'PROPERTY_REJECTED',
  adminId: string,
  propertyId: string,
  data: {
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  await createAuditLog({
    userId: adminId,
    action,
    resource: 'property',
    resourceId: propertyId,
    newData: {
      reason: data.reason,
    },
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
  });
}