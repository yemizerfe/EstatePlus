import { Router, Request, Response } from 'express';
import { body, query, param } from 'express-validator';

import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { sendSuccess, sendCreated } from '../../shared/utils/response';
import { AuthenticatedRequest } from '../../shared/types';
import * as neighborhoodsService from './neighborhoods.service';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/neighborhoods:
 *   get:
 *     summary: List all neighborhoods with optional filters
 *     tags: [Neighborhoods]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/',
  [
    query('city').optional().isString(),
    query('subcity').optional().isString(),
    query('isActive').optional().isBoolean(),
    query('search').optional().isString(),
    query('sortBy').optional().isIn(['name', 'population', 'areaSqkm', 'walkScore']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    validate
  ],
  async (req: Request, res: Response) => {
    const list = await neighborhoodsService.listNeighborhoods({
      city: req.query.city as string | undefined,
      subcity: req.query.subcity as string | undefined,
      isActive: req.query.isActive === undefined ? undefined : req.query.isActive === 'true',
      search: req.query.search as string | undefined,
      sortBy: req.query.sortBy as any,
      sortOrder: req.query.sortOrder as any
    });
    sendSuccess(res, list);
  }
);

/**
 * @swagger
 * /api/neighborhoods/rankings:
 *   get:
 *     summary: Get neighborhood rankings by investment score
 *     tags: [Neighborhoods]
 *     security:
 *       - bearerAuth: []
 */
router.get('/rankings', async (_req: Request, res: Response) => {
  const rankings = await neighborhoodsService.rankNeighborhoods();
  sendSuccess(res, rankings);
});

/**
 * @swagger
 * /api/neighborhoods:
 *   post:
 *     summary: Create a new neighborhood (Admin/Analyst only)
 *     tags: [Neighborhoods]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/',
  requirePermission('neighborhoods:create'),
  [
    body('name').isString().isLength({ min: 2, max: 150 }),
    body('slug').isString().isLength({ min: 2, max: 150 }).matches(/^[a-z0-9-]+$/),
    body('city').isString().isLength({ max: 150 }),
    body('subcity').optional().isString().isLength({ max: 150 }),
    body('description').optional().isString(),
    body('areaSqkm').optional().isFloat({ min: 0 }),
    body('population').optional().isInt({ min: 0 }),
    body('establishedYear').optional().isInt({ min: 1800, max: 2100 }),
    body('averageIncome').optional().isFloat({ min: 0 }),
    body('centerLat').optional().isFloat({ min: -90, max: 90 }),
    body('centerLng').optional().isFloat({ min: -180, max: 180 }),
    body('walkScore').optional().isInt({ min: 0, max: 100 }),
    body('safetyRating').optional().isFloat({ min: 0, max: 5 }),
    validate
  ],
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const neighborhood = await neighborhoodsService.createNeighborhood(req.body, authReq.user.id);
    sendCreated(res, neighborhood, 'Neighborhood created successfully');
  }
);

/**
 * @swagger
 * /api/neighborhoods/{slug}:
 *   get:
 *     summary: Get neighborhood details by slug
 *     tags: [Neighborhoods]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:slug', async (req: Request, res: Response) => {
  const neighborhood = await neighborhoodsService.getNeighborhoodBySlug(req.params.slug);
  sendSuccess(res, neighborhood);
});

/**
 * @swagger
 * /api/neighborhoods/{slug}:
 *   patch:
 *     summary: Update neighborhood (Admin/Analyst only)
 *     tags: [Neighborhoods]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  '/:slug',
  requirePermission('neighborhoods:update'),
  [
    param('slug').isString(),
    body('name').optional().isString().isLength({ min: 2, max: 150 }),
    body('description').optional().isString(),
    body('areaSqkm').optional().isFloat({ min: 0 }),
    body('population').optional().isInt({ min: 0 }),
    body('averageIncome').optional().isFloat({ min: 0 }),
    body('walkScore').optional().isInt({ min: 0, max: 100 }),
    body('safetyRating').optional().isFloat({ min: 0, max: 5 }),
    body('isActive').optional().isBoolean(),
    validate
  ],
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const neighborhood = await neighborhoodsService.updateNeighborhood(
      req.params.slug,
      req.body,
      authReq.user.id
    );
    sendSuccess(res, neighborhood, 200, 'Neighborhood updated successfully');
  }
);

/**
 * @swagger
 * /api/neighborhoods/{slug}:
 *   delete:
 *     summary: Delete neighborhood (Admin only)
 *     tags: [Neighborhoods]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/:slug',
  requirePermission('neighborhoods:delete'),
  [param('slug').isString(), validate],
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const result = await neighborhoodsService.deleteNeighborhood(req.params.slug, authReq.user.id);
    sendSuccess(res, result);
  }
);

/**
 * @swagger
 * /api/neighborhoods/{slug}/stats:
 *   get:
 *     summary: Get neighborhood statistics
 *     tags: [Neighborhoods]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:slug/stats', async (req: Request, res: Response) => {
  const stats = await neighborhoodsService.getNeighborhoodStats(req.params.slug);
  sendSuccess(res, stats);
});

/**
 * @swagger
 * /api/neighborhoods/{slug}/analysis:
 *   get:
 *     summary: Get comprehensive neighborhood analysis
 *     tags: [Neighborhoods]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:slug/analysis', async (req: Request, res: Response) => {
  const analysis = await neighborhoodsService.getComprehensiveNeighborhoodAnalysis(req.params.slug);
  sendSuccess(res, analysis);
});

// ─── Amenity Management ──────────────────────────────────────

/**
 * @swagger
 * /api/neighborhoods/{slug}/amenities:
 *   get:
 *     summary: Get neighborhood amenities
 *     tags: [Neighborhoods]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/:slug/amenities',
  [
    param('slug').isString(),
    query('amenityType').optional().isString(),
    validate
  ],
  async (req: Request, res: Response) => {
    const amenities = await neighborhoodsService.getNeighborhoodAmenities(
      req.params.slug,
      req.query.amenityType as any
    );
    sendSuccess(res, amenities);
  }
);

/**
 * @swagger
 * /api/neighborhoods/{slug}/amenities:
 *   post:
 *     summary: Add amenity to neighborhood
 *     tags: [Neighborhoods]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:slug/amenities',
  requirePermission('neighborhoods:manage_amenities'),
  [
    param('slug').isString(),
    body('amenityType').isString(),
    body('name').isString().isLength({ min: 2, max: 200 }),
    body('description').optional().isString(),
    body('address').optional().isString().isLength({ max: 300 }),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('distance').optional().isInt({ min: 0 }),
    body('rating').optional().isFloat({ min: 0, max: 5 }),
    body('verified').optional().isBoolean(),
    validate
  ],
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const amenity = await neighborhoodsService.addNeighborhoodAmenity(
      req.params.slug,
      req.body,
      authReq.user.id
    );
    sendCreated(res, amenity, 'Amenity added successfully');
  }
);

/**
 * @swagger
 * /api/neighborhoods/amenities/{amenityId}:
 *   patch:
 *     summary: Update neighborhood amenity
 *     tags: [Neighborhoods]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  '/amenities/:amenityId',
  requirePermission('neighborhoods:manage_amenities'),
  [
    param('amenityId').isUUID(),
    body('name').optional().isString().isLength({ min: 2, max: 200 }),
    body('description').optional().isString(),
    body('address').optional().isString().isLength({ max: 300 }),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('distance').optional().isInt({ min: 0 }),
    body('rating').optional().isFloat({ min: 0, max: 5 }),
    body('verified').optional().isBoolean(),
    validate
  ],
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const amenity = await neighborhoodsService.updateNeighborhoodAmenity(
      req.params.amenityId,
      req.body,
      authReq.user.id
    );
    sendSuccess(res, amenity, 200, 'Amenity updated successfully');
  }
);

/**
 * @swagger
 * /api/neighborhoods/amenities/{amenityId}:
 *   delete:
 *     summary: Delete neighborhood amenity
 *     tags: [Neighborhoods]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/amenities/:amenityId',
  requirePermission('neighborhoods:manage_amenities'),
  [param('amenityId').isUUID(), validate],
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const result = await neighborhoodsService.deleteNeighborhoodAmenity(
      req.params.amenityId,
      authReq.user.id
    );
    sendSuccess(res, result);
  }
);

// ─── Statistics Management ───────────────────────────────────

/**
 * @swagger
 * /api/neighborhoods/{slug}/statistics:
 *   get:
 *     summary: Get neighborhood statistics history
 *     tags: [Neighborhoods]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/:slug/statistics',
  [
    param('slug').isString(),
    query('statisticType').optional().isString(),
    query('startPeriod').optional().matches(/^\d{4}-\d{2}$/),
    query('endPeriod').optional().matches(/^\d{4}-\d{2}$/),
    validate
  ],
  async (req: Request, res: Response) => {
    const statistics = await neighborhoodsService.getNeighborhoodStatistics(
      req.params.slug,
      req.query.statisticType as any,
      req.query.startPeriod as string | undefined,
      req.query.endPeriod as string | undefined
    );
    sendSuccess(res, statistics);
  }
);

/**
 * @swagger
 * /api/neighborhoods/{slug}/statistics:
 *   post:
 *     summary: Record neighborhood statistic
 *     tags: [Neighborhoods]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:slug/statistics',
  requirePermission('neighborhoods:record_statistics'),
  [
    param('slug').isString(),
    body('period').matches(/^\d{4}-\d{2}$/),
    body('statisticType').isString(),
    body('value').isNumeric(),
    body('unit').optional().isString().isLength({ max: 50 }),
    body('source').optional().isString().isLength({ max: 200 }),
    validate
  ],
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const statistic = await neighborhoodsService.recordNeighborhoodStatistic(
      req.params.slug,
      req.body,
      authReq.user.id
    );
    sendCreated(res, statistic, 'Statistic recorded successfully');
  }
);

export default router;
