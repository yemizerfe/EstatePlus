import { Router, Request, Response } from 'express';
import { param, body, query } from 'express-validator';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { sendSuccess, sendCreated } from '../../shared/utils/response';
import { AuthenticatedRequest } from '../../shared/types';
import * as dataSourceService from './data-sources.service';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/data-sources:
 *   get:
 *     summary: Get data sources with optional filtering and pagination
 *     tags: [Data Sources]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/',
  requirePermission('data-sources:read'),
  [
    query('sourceType').optional(),
    query('createdBy').optional(),
    query('page').optional().isInt({ min: 1 }).default('1'),
    query('limit').optional().isInt({ min: 1, max: 100 }).default('20'),
    query('sortBy').optional(),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    validate,
  ],
  async (req: Request, res: Response) => {
    const filters = {
  sourceType: req.query.sourceType as string,
  createdBy: req.query.createdBy as string,
  // Number(undefined) is NaN, which the validator's defaults never see because
  // the route builds the object itself; fall back before converting.
  page: Number(req.query.page ?? 1),
  limit: Number(req.query.limit ?? 20),
  sortBy: req.query.sortBy as string,
  sortOrder: req.query.sortOrder as 'asc' | 'desc',
} as any;
    const result = await dataSourceService.getDataSources(filters);
    sendSuccess(res, result);
  },
);

/**
 * @swagger
 * /api/data-sources/stats:
 *   get:
 *     summary: Get data source statistics
 *     tags: [Data Sources]
 *     security:
 *       - bearerAuth: []
 */
// Declared before `/:id`, otherwise Express matches `/stats` as an id and the
// UUID validator rejects it with a 400.
router.get('/stats', requirePermission('data-sources:read'), async (_req: Request, res: Response) => {
  const stats = await dataSourceService.getDataSourceStats();
  sendSuccess(res, stats);
});

/**
 * @swagger
 * /api/data-sources/creator/{creatorId}:
 *   get:
 *     summary: Get data sources owned by a specific creator
 *     tags: [Data Sources]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/creator/:creatorId',
  requirePermission('data-sources:read'),
  [param('creatorId').isUUID(), validate],
  async (req: Request, res: Response) => {
    const { creatorId } = req.params;
    const filters: {
      sourceType?: string;
      page?: number;
      limit?: number;
    } = {
      sourceType: req.query.sourceType as string,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
    };
    const result = await dataSourceService.getDataSourcesByCreator(creatorId, filters);
    sendSuccess(res, result);
  },
);

/**
 * @swagger
 * /api/data-sources/{id}:
 *   get:
 *     summary: Get a specific data source by ID
 *     tags: [Data Sources]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/:id',
  requirePermission('data-sources:read'),
  [param('id').isUUID(), validate],
  async (req: Request, res: Response) => {
    const dataSource = await dataSourceService.getDataSourceById(req.params.id);
    sendSuccess(res, dataSource);
  },
);

/**
 * @swagger
 * /api/data-sources:
 *   post:
 *     summary: Create a new data source
 *     tags: [Data Sources]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/',
  requirePermission('data-sources:create'),
  [
    body('name').notEmpty().isString().isLength({ max: 255 }),
    body('sourceType').notEmpty().isString(),
    body('description').optional().isString().isLength({ max: 1000 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const dataSource = await dataSourceService.createDataSource(
      req.body,
      authReq.user.id,
    );
    sendCreated(res, dataSource, 'Data source created successfully');
  },
);

/**
 * @swagger
 * /api/data-sources/{id}:
 *   patch:
 *     summary: Update a data source
 *     tags: [Data Sources]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  '/:id',
  requirePermission('data-sources:update'),
  [
    param('id').isUUID(),
    body('name').optional().isString().isLength({ max: 255 }),
    body('sourceType').optional().isString(),
    body('description').optional().isString().isLength({ max: 1000 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const dataSource = await dataSourceService.updateDataSource(
      req.params.id,
      req.body,
      authReq.user.id,
    );
    sendSuccess(res, dataSource, 'Data source updated successfully');
  },
);

/**
 * @swagger
 * /api/data-sources/{id}:
 *   delete:
 *     summary: Delete a data source (if no import jobs exist)
 *     tags: [Data Sources]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/:id',
  requirePermission('data-sources:delete'),
  [param('id').isUUID(), validate],
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    await dataSourceService.deleteDataSource(req.params.id, authReq.user.id);
    sendSuccess(res, null, 'Data source deleted successfully');
  },
);

export default router;
