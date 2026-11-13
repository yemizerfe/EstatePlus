import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';

import { authenticate } from '../../middleware/authenticate';
import { authorize, requirePermission } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { auditLog, AuditActions } from '../../middleware/auditLog';
import { AuthenticatedRequest } from '../../shared/types';
import { sendSuccess, sendCreated } from '../../shared/utils/response';
import * as listingsService from './listings.service';

const router = Router();

/**
 * Get all listings with filters
 * GET /api/v1/listings
 */
router.get('/', [
  query('propertyType').optional().isString(),
  query('neighborhood').optional().isString(),
  query('minPrice').optional().isFloat({ min: 0 }),
  query('maxPrice').optional().isFloat({ min: 0 }),
  query('minSize').optional().isFloat({ min: 0 }),
  query('maxSize').optional().isFloat({ min: 0 }),
  query('bedrooms').optional().isInt({ min: 0 }),
  query('bathrooms').optional().isInt({ min: 0 }),
  query('listingType').optional().isIn(['SALE', 'RENT', 'BOTH']),
  query('status').optional().isIn(['ACTIVE', 'INACTIVE', 'EXPIRED', 'SOLD', 'RENTED', 'WITHDRAWN']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sortBy').optional().isIn(['listedAt', 'currentPrice', 'viewCount']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
  validate
], async (req: Request, res: Response): Promise<void> => {
  const filters = {
    propertyType: req.query.propertyType as string,
    neighborhood: req.query.neighborhood as string,
    minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
    maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
    minSize: req.query.minSize ? parseFloat(req.query.minSize as string) : undefined,
    maxSize: req.query.maxSize ? parseFloat(req.query.maxSize as string) : undefined,
    bedrooms: req.query.bedrooms ? parseInt(req.query.bedrooms as string) : undefined,
    bathrooms: req.query.bathrooms ? parseInt(req.query.bathrooms as string) : undefined,
    listingType: req.query.listingType as any,
    status: req.query.status as any,
    page: req.query.page ? parseInt(req.query.page as string) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    sortBy: req.query.sortBy as string,
    sortOrder: req.query.sortOrder as 'asc' | 'desc'
  };

  const result = await listingsService.getListings(filters);
  sendSuccess(res, result);
});

/**
 * Create a new listing
 * POST /api/v1/listings
 */
router.post('/', [
  authenticate,
  requirePermission('listings:create'),
  body('propertyId').isUUID(),
  body('listingType').isIn(['SALE', 'RENT', 'BOTH']),
  body('currentPrice').isFloat({ min: 0 }),
  body('rentalPrice').optional().isFloat({ min: 0 }),
  body('expiresAt').optional().isISO8601(),
  validate,
  auditLog(AuditActions.LISTING_CREATED, 'listing')
], async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthenticatedRequest).user.sub;
  const listing = await listingsService.createListing(req.body, userId);
  sendCreated(res, listing, 'Listing created successfully');
});

/**
 * Get specific listing by ID
 * GET /api/v1/listings/:id
 */
router.get('/:id', [
  param('id').isUUID(),
  validate
], async (req: Request, res: Response): Promise<void> => {
  const listing = await listingsService.getListingById(req.params.id);
  sendSuccess(res, listing);
});

/**
 * Update a listing
 * PUT /api/v1/listings/:id
 */
router.put('/:id', [
  authenticate,
  requirePermission('listings:update_own'),
  body('currentPrice').optional().isFloat({ min: 0 }),
  body('rentalPrice').optional().isFloat({ min: 0 }),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'EXPIRED', 'SOLD', 'RENTED', 'WITHDRAWN']),
  body('expiresAt').optional().isISO8601(),
  validate,
  auditLog(AuditActions.LISTING_UPDATED, 'listing')
], async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthenticatedRequest).user.sub;
  const listing = await listingsService.updateListing(req.params.id, req.body, userId);
  sendSuccess(res, listing, 200, 'Listing updated successfully');
});

/**
 * Delete/deactivate a listing
 * DELETE /api/v1/listings/:id
 */
router.delete('/:id', [
  authenticate,
  requirePermission('listings:update_own'),
  auditLog('LISTING_DELETED', 'listing')
], async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthenticatedRequest).user.sub;
  await listingsService.deleteListing(req.params.id, userId);
  sendSuccess(res, null, 200, 'Listing deleted successfully');
});

/**
 * Get listings by owner
 * GET /api/v1/listings/owner/:ownerId
 */
router.get('/owner/:ownerId', [
  authenticate,
  authorize('property_owner', 'analyst', 'admin'),
  query('status').optional().isIn(['ACTIVE', 'INACTIVE', 'EXPIRED', 'SOLD', 'RENTED', 'WITHDRAWN']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validate
], async (req: Request, res: Response): Promise<void> => {
  const ownerId = req.params.ownerId;
  const currentUserId = (req as AuthenticatedRequest).user.sub;
  const userRole = (req as AuthenticatedRequest).user.role;
  
  // Property owners can only see their own listings
  if (userRole === 'property_owner' && ownerId !== currentUserId) {
    res.status(403).json({ success: false, message: 'Access denied' });
    return;
  }

  const filters = {
    status: req.query.status as any,
    page: req.query.page ? parseInt(req.query.page as string) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 20
  };

  const result = await listingsService.getListingsByOwner(ownerId, filters);
  sendSuccess(res, result);
});

/**
 * Get price history for a listing
 * GET /api/v1/listings/:id/price-history
 */
router.get('/:id/price-history', [
  authenticate,
  authorize('property_owner', 'analyst', 'admin'),
  validate
], async (req: Request, res: Response): Promise<void> => {
  const history = await listingsService.getListingPriceHistory(req.params.id);
  sendSuccess(res, history);
});

/**
 * Record a listing inquiry
 * POST /api/v1/listings/:id/inquiry
 */
router.post('/:id/inquiry', async (req: Request, res: Response): Promise<void> => {
  await listingsService.recordListingInquiry(req.params.id);
  sendSuccess(res, null, 200, 'Inquiry recorded');
});

export default router;