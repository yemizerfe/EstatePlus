import { UserRole } from '../shared/types';
import { ROLE_PERMISSIONS, hasPermission } from '../middleware/authorize';
import { prisma } from '../infrastructure/database/prisma';

export interface PermissionCheck {
  userId: string;
  role: UserRole;
  resource: string;
  action: string;
  resourceId?: string;
}

/**
 * Comprehensive permission checking service
 */
export class PermissionsService {
  /**
   * Check if user can perform an action on a resource
   */
  static async canPerform(check: PermissionCheck): Promise<boolean> {
    const { role, resource, action } = check;
    const permission = `${resource}:${action}`;
    
    // Check basic role permission
    if (!hasPermission(role, permission)) {
      return false;
    }
    
    // For ownership-based permissions, check resource ownership
    if (check.resourceId) {
      return await this.checkResourceOwnership(check);
    }
    
    return true;
  }
  
  /**
   * Check ownership of specific resources
   */
  private static async checkResourceOwnership(check: PermissionCheck): Promise<boolean> {
    const { userId, role, resource, resourceId } = check;
    
    // Admin can access everything
    if (role === 'admin') {
      return true;
    }
    
    try {
      switch (resource) {
        case 'properties':
          return await this.checkPropertyOwnership(userId, role, resourceId!);
        
        case 'scenarios':
          return await this.checkScenarioOwnership(userId, role, resourceId!);
        
        case 'reports':
          return await this.checkReportOwnership(userId, role, resourceId!);
        
        case 'listings':
          return await this.checkListingOwnership(userId, role, resourceId!);
        
        default:
          return true; // For resources without ownership restrictions
      }
    } catch (error) {
      return false;
    }
  }
  
  private static async checkPropertyOwnership(userId: string, role: UserRole, propertyId: string): Promise<boolean> {
    // Analysts can view all properties
    if (role === 'analyst') {
      return true;
    }
    
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { ownerId: true }
    });
    
    return property?.ownerId === userId;
  }
  
  private static async checkScenarioOwnership(userId: string, role: UserRole, scenarioId: string): Promise<boolean> {
    // Analysts can access all scenarios
    if (role === 'analyst') {
      return true;
    }
    
    const scenario = await prisma.scenario.findUnique({
      where: { id: scenarioId },
      select: { createdBy: true }
    });
    
    return scenario?.createdBy === userId;
  }
  
  private static async checkReportOwnership(userId: string, role: UserRole, reportId: string): Promise<boolean> {
    // Only analysts and admins can access reports
    if (role !== 'analyst' && role !== 'admin') {
      return false;
    }
    
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: { authorId: true }
    });
    
    return report?.authorId === userId;
  }
  
  private static async checkListingOwnership(userId: string, role: UserRole, listingId: string): Promise<boolean> {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: { property: { select: { ownerId: true } } }
    });
    
    if (!listing) {
      return false;
    }
    
    // Analysts can view all listings
    if (role === 'analyst') {
      return true;
    }
    
    return listing.property.ownerId === userId;
  }
  
  /**
   * Get user permissions based on role
   */
  static getUserPermissions(role: UserRole): readonly string[] {
    return ROLE_PERMISSIONS[role];
  }
  
  /**
   * Check if user can access admin features
   */
  static canAccessAdmin(role: UserRole): boolean {
    return role === 'admin';
  }
  
  /**
   * Check if user can access analyst features
   */
  static canAccessAnalyst(role: UserRole): boolean {
    return role === 'admin' || role === 'analyst';
  }
  
  /**
   * Check if user can manage properties
   */
  static canManageProperties(role: UserRole): boolean {
    return role === 'admin' || role === 'property_owner';
  }
  
  /**
   * Check if user can create/manage listings
   */
  static canManageListings(role: UserRole): boolean {
    return role === 'admin' || role === 'property_owner';
  }
  
  /**
   * Check if user can access market data management
   */
  static canManageMarketData(role: UserRole): boolean {
    return role === 'admin' || role === 'analyst';
  }
  
  /**
   * Check if user can manage economic indicators
   */
  static canManageEconomicIndicators(role: UserRole): boolean {
    return role === 'admin' || role === 'analyst';
  }
  
  /**
   * Check if user can run data imports
   */
  static canRunDataImports(role: UserRole): boolean {
    return role === 'admin' || role === 'analyst';
  }
  
  /**
   * Check if user can generate reports
   */
  static canGenerateReports(role: UserRole): boolean {
    return role === 'admin' || role === 'analyst';
  }
  
  /**
   * Check if user can use AI features
   */
  static canUseAI(role: UserRole): boolean {
    return hasPermission(role, 'ai:use');
  }
}