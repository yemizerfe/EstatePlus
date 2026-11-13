import { Router, Request, Response } from 'express';
import { body, query, param } from 'express-validator';

import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { AuthenticatedRequest } from '../../shared/types';
import { sendSuccess, sendCreated } from '../../shared/utils/response';
import * as propertiesService from './properties.service';

const router = Router();

router.use(authenticate);

// Search / list properties — all authenticated users
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('neighborhoodId').optional().isUUID(),
    query('propertyType').optional().isIn(['APARTMENT', 'VILLA', 'CONDOMINIUM', 'OFFICE', 'RETAIL', 'WAREHOUSE', 'LAND']),
    query('status').optional().isIn(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE', 'SOLD', 'RENTED', 'UNDER_CONTRACT', 'ARCHIVED']),
    query('minPrice').optional().isFloat({ min: 0 }),
    query('maxPrice').optional().isFloat({ min: 0 }),
    query('minSize').optional().isFloat({ min: 0 }),
    query('maxSize').optional().isFloat({ min: 0 }),
    query('bedrooms').optional().isInt({ min: 0 }),
    query('search').optional().isString().trim(),
    // `me` resolves to the authenticated user; a UUID targets a specific owner.
    query('ownedBy').optional().isString().trim(),
    query('createdAfter').optional().isISO8601(),
    query('createdBefore').optional().isISO8601(),
    query('sortBy').optional().isIn(['price', 'size', 'status', 'createdAt']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    validate,
  ],
  async (req: Request, res: Response) => {
    const result = await propertiesService.searchProperties({
      page: Number(req.query['page']) || 1,
      limit: Number(req.query['limit']) || 20,
      neighborhoodId: req.query['neighborhoodId'] as string | undefined,
      propertyType: req.query['propertyType'] as propertiesService.PropertySearchQuery['propertyType'],
      status: req.query['status'] as propertiesService.PropertySearchQuery['status'],
      minPrice: req.query['minPrice'] ? Number(req.query['minPrice']) : undefined,
      maxPrice: req.query['maxPrice'] ? Number(req.query['maxPrice']) : undefined,
      minSize: req.query['minSize'] ? Number(req.query['minSize']) : undefined,
      maxSize: req.query['maxSize'] ? Number(req.query['maxSize']) : undefined,
      bedrooms: req.query['bedrooms'] ? Number(req.query['bedrooms']) : undefined,
      search: req.query['search'] as string | undefined,
      ownedBy:
        req.query['ownedBy'] === 'me'
          ? (req as AuthenticatedRequest).user.id
          : (req.query['ownedBy'] as string | undefined),
      createdAfter: req.query['createdAfter'] ? new Date(req.query['createdAfter'] as string) : undefined,
      createdBefore: req.query['createdBefore'] ? new Date(req.query['createdBefore'] as string) : undefined,
      sortBy: req.query['sortBy'] as string | undefined,
      sortOrder: req.query['sortOrder'] as 'asc' | 'desc' | undefined,
    });
    sendSuccess(res, result.properties, 200, undefined, result.meta);
  },
);

// Get one property
router.get(
  '/:id',
  [param('id').isUUID(), validate],
  async (req: Request, res: Response) => {
    const property = await propertiesService.getPropertyById(req.params['id']!);
    sendSuccess(res, property);
  },
);

// Create property — property owners and admins
router.post(
  '/',
  requirePermission('properties:create'),
  [
    body('title').trim().isLength({ min: 3, max: 255 }),
    body('propertyType').isIn(['APARTMENT', 'VILLA', 'CONDOMINIUM', 'OFFICE', 'RETAIL', 'WAREHOUSE', 'LAND']),
    body('condition').isIn(['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'NEEDS_RENOVATION']),
    body('neighborhoodId').isUUID(),
    body('sizeSqm').isFloat({ min: 1 }),
    body('bedrooms').isInt({ min: 0 }),
    body('bathrooms').isInt({ min: 0 }),
    body('askingPrice').isFloat({ min: 1 }),
    body('rentalPrice').optional().isFloat({ min: 0 }),
    body('listingDate').isISO8601(),
    validate,
  ],
  async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user.id;
    const property = await propertiesService.createProperty(
      req.body as propertiesService.CreatePropertyDto,
      userId,
    );
    sendCreated(res, property, 'Property created');
  },
);

// Update property
router.patch(
  '/:id',
  requirePermission('properties:update'),
  [
    param('id').isUUID(),
    body('title').optional().trim().isLength({ min: 3, max: 255 }),
    body('condition').optional().isIn(['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'NEEDS_RENOVATION']),
    body('sizeSqm').optional().isFloat({ min: 1 }),
    body('bedrooms').optional().isInt({ min: 0 }),
    body('bathrooms').optional().isInt({ min: 0 }),
    body('askingPrice').optional().isFloat({ min: 1 }),
    body('rentalPrice').optional().isFloat({ min: 0 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const property = await propertiesService.updateProperty(
      req.params['id']!,
      req.body as propertiesService.UpdatePropertyDto,
      authReq.user.id,
      authReq.user.role,
    );
    sendSuccess(res, property, 200, 'Property updated');
  },
);

// Delete property (soft delete - marks as inactive)
router.delete(
  '/:id',
  requirePermission('properties:delete'),
  [param('id').isUUID(), validate],
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    await propertiesService.deleteProperty(req.params['id']!, authReq.user.id, authReq.user.role);
    sendSuccess(res, null, 200, 'Property removed');
  },
);

// ─── Property Lifecycle Management ───────────────────────────────────────

// Change property status
router.patch(
  '/:id/status',
  requirePermission('properties:manage_status'),
  [
    param('id').isUUID(),
    body('fromStatus').isIn(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE', 'SOLD', 'RENTED', 'UNDER_CONTRACT', 'ARCHIVED']),
    body('toStatus').isIn(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE', 'SOLD', 'RENTED', 'UNDER_CONTRACT', 'ARCHIVED']),
    body('reason').optional().isString().isLength({ max: 500 }),
    body('scheduledDate').optional().isISO8601(),
    validate,
  ],
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const transition: propertiesService.PropertyStatusTransition = {
      fromStatus: req.body.fromStatus,
      toStatus: req.body.toStatus,
      reason: req.body.reason,
      scheduledDate: req.body.scheduledDate ? new Date(req.body.scheduledDate) : undefined,
    };
    
    const property = await propertiesService.changePropertyStatus(
      req.params['id']!,
      transition,
      authReq.user.id,
      authReq.user.role,
    );
    sendSuccess(res, property, 200, 'Property status updated');
  },
);

// Bulk status update
router.patch(
  '/bulk/status',
  requirePermission('properties:bulk_manage'),
  [
    body('propertyIds').isArray({ min: 1 }).withMessage('Property IDs array is required'),
    body('propertyIds.*').isUUID().withMessage('Each property ID must be a valid UUID'),
    body('fromStatus').isIn(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE', 'SOLD', 'RENTED', 'UNDER_CONTRACT', 'ARCHIVED']),
    body('toStatus').isIn(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE', 'SOLD', 'RENTED', 'UNDER_CONTRACT', 'ARCHIVED']),
    body('reason').optional().isString().isLength({ max: 500 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const transition: propertiesService.PropertyStatusTransition = {
      fromStatus: req.body.fromStatus,
      toStatus: req.body.toStatus,
      reason: req.body.reason,
    };
    
    const result = await propertiesService.bulkUpdatePropertyStatus(
      req.body.propertyIds,
      transition,
      authReq.user.id,
      authReq.user.role,
    );
    sendSuccess(res, result, 200, 'Bulk status update completed');
  },
);

// Get property lifecycle history
router.get(
  '/:id/history',
  requirePermission('properties:view_history'),
  [param('id').isUUID(), validate],
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const history = await propertiesService.getPropertyLifecycleHistory(
      req.params['id']!,
      authReq.user.id,
    );
    sendSuccess(res, history);
  },
);

// Schedule status change
router.post(
  '/:id/schedule-status',
  requirePermission('properties:schedule_changes'),
  [
    param('id').isUUID(),
    body('fromStatus').isIn(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE', 'SOLD', 'RENTED', 'UNDER_CONTRACT', 'ARCHIVED']),
    body('toStatus').isIn(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE', 'SOLD', 'RENTED', 'UNDER_CONTRACT', 'ARCHIVED']),
    body('scheduledDate').isISO8601(),
    body('reason').optional().isString().isLength({ max: 500 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const transition: propertiesService.PropertyStatusTransition = {
      fromStatus: req.body.fromStatus,
      toStatus: req.body.toStatus,
      reason: req.body.reason,
    };
    
    const result = await propertiesService.schedulePropertyStatusChange(
      req.params['id']!,
      transition,
      new Date(req.body.scheduledDate),
      authReq.user.id,
      authReq.user.role,
    );
    sendSuccess(res, result, 200, 'Status change scheduled');
  },
);

// Transfer property ownership
router.patch(
  '/:id/transfer-ownership',
  requirePermission('properties:transfer_ownership'),
  [
    param('id').isUUID(),
    body('newOwnerId').isUUID(),
    body('reason').optional().isString().isLength({ max: 500 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const result = await propertiesService.transferPropertyOwnership(
      req.params['id']!,
      req.body.newOwnerId,
      authReq.user.id,
      authReq.user.role,
      req.body.reason,
    );
    sendSuccess(res, result, 200, 'Property ownership transferred');
  },
);

// Get property statistics
router.get(
  '/statistics',
  requirePermission('properties:view_statistics'),
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const stats = await propertiesService.getPropertyStatistics(
      authReq.user.id,
      authReq.user.role,
    );
    sendSuccess(res, stats);
  },
);

export default router;
