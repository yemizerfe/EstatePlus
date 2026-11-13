import { Request, Response, NextFunction } from 'express';

import { AuthenticatedRequest, UserRole } from '../shared/types';
import { ForbiddenError } from '../shared/utils/errors';

// Define permissions for each role
export const ROLE_PERMISSIONS = {
  user: [
    'properties:read',
    'properties:save',
    'market:read',
    'neighborhoods:read',
    'profile:update',
    'notifications:read',
    'scenarios:create',
    'scenarios:read',
  ],
  property_owner: [
    // All user permissions plus:
    'properties:read',
    'properties:save',
    'properties:create',
    'properties:update',
    'properties:update_own',
    'properties:delete',
    'properties:delete_own',
    // Owners drive their own listing lifecycle; service layer enforces ownership.
    'properties:manage_status',
    'properties:view_history',
    'properties:view_statistics',
    'properties:schedule_changes',
    'properties:transfer_ownership',
    'listings:create',
    'listings:update_own',
    'listings:read',
    'market:read',
    'neighborhoods:read',
    'profile:update',
    'notifications:read',
    'scenarios:create',
    'scenarios:read',
  ],
  analyst: [
    // All user permissions plus:
    'properties:read',
    'properties:save',
    'market:read',
    'market:write',
    'neighborhoods:read',
    'neighborhoods:write',
    'economic_indicators:create',
    'economic_indicators:read',
    'economic_indicators:update',
    'economic_indicators:delete',
    'forecasts:create',
    'forecasts:read',
    'forecasts:update',
    'data_sources:create',
    'data_sources:read',
    'data_sources:update',
    'import_jobs:create',
    'import_jobs:read',
    'excel:upload',
    'excel:import',
    // Import routes are guarded with these permission names.
    'IMPORT_DATA',
    'IMPORT_EXCEL',
    'VALIDATE_DATA',
    'VIEW_IMPORT_JOBS',
    'VIEW_SYSTEM_STATUS',
    'data-sources:read',
    'reports:create',
    'reports:read',
    'reports:update',
    'scenarios:create',
    'scenarios:read',
    'scenarios:update',
    'scenarios:delete',
    'profile:update',
    'notifications:read',
    'ai:use',
    // Analytics/administration routes use these names directly.
    'market:view_analysis',
    'market:calculate_statistics',
    'properties:view_history',
    'properties:view_statistics',
    'neighborhoods:create',
    'neighborhoods:update',
    'neighborhoods:delete',
    'neighborhoods:manage_amenities',
    'neighborhoods:record_statistics',
    'economics:create',
    'economics:delete',
    'economics:view_analysis',
    'data-sources:create',
    'data-sources:update',
    'data-sources:delete',
    'properties:bulk_manage',
    // Audit permissions
    'VIEW_AUDIT_LOGS',
    'VIEW_SECURITY_LOGS',
    'VIEW_COMPLIANCE_REPORTS',
  ],
  admin: [
    '*', // Admin has all permissions
  ],
} as const;

export function authorize(...roles: (UserRole | string)[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!roles.includes((req as AuthenticatedRequest).user.role as string)) {
      throw new ForbiddenError(
        `Access denied. Required roles: ${roles.join(', ')}`,
      );
    }
    next();
  };
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(userRole: UserRole, permission: string): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole] as readonly string[];
  
  // Admin has all permissions
  if (rolePermissions.includes('*')) {
    return true;
  }
  
  return rolePermissions.includes(permission);
}

/**
 * Authorization middleware that checks for specific permissions
 */
export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const userRole = (req as AuthenticatedRequest).user.role;
    
    if (!hasPermission(userRole, permission)) {
      throw new ForbiddenError(
        `Access denied. Required permission: ${permission}`,
      );
    }
    
    next();
  };
}

/**
 * Check if user can access their own resources
 */
export function requireOwnership(getResourceUserId: (req: AuthenticatedRequest) => string | Promise<string>) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const currentUserId = authReq.user.sub;
    const resourceUserId = await getResourceUserId(authReq);
    
    // Admin can access all resources
    if (authReq.user.role === 'admin') {
      return next();
    }
    
    if (currentUserId !== resourceUserId) {
      throw new ForbiddenError('Access denied. You can only access your own resources.');
    }
    
    next();
  };
}

/**
 * Combine role and permission checks
 */
export function requireRoleAndPermission(roles: UserRole[], permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const userRole = (req as AuthenticatedRequest).user.role;
    
    // Check if user has required role
    if (!roles.includes(userRole)) {
      throw new ForbiddenError(`Access denied. Required roles: ${roles.join(', ')}`);
    }
    
    // Check if user has required permission
    if (!hasPermission(userRole, permission)) {
      throw new ForbiddenError(`Access denied. Required permission: ${permission}`);
    }
    
    next();
  };
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): readonly string[] {
  return ROLE_PERMISSIONS[role] as readonly string[];
}
