import { Router, Request, Response } from 'express';
import { query, body } from 'express-validator';

import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { sendSuccess } from '../../shared/utils/response';
import * as marketService from './market.service';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/market/dashboard:
 *   get:
 *     summary: Get basic market dashboard statistics
 *     tags: [Market Statistics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: neighborhoodId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: propertyType
 *         schema:
 *           type: string
 *           enum: [APARTMENT, VILLA, CONDOMINIUM, OFFICE, RETAIL, WAREHOUSE, LAND]
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}$'
 *           description: YYYY-MM format
 *     responses:
 *       200:
 *         description: Market dashboard statistics
 */
router.get(
  '/dashboard',
  [
    query('neighborhoodId').optional().isUUID(),
    query('propertyType').optional().isIn(['APARTMENT', 'VILLA', 'CONDOMINIUM', 'OFFICE', 'RETAIL', 'WAREHOUSE', 'LAND']),
    query('period').optional().matches(/^\d{4}-\d{2}$/),
    validate,
  ],
  async (req: Request, res: Response) => {
    const stats = await marketService.getDashboardStats({
      neighborhoodId: req.query['neighborhoodId'] as string | undefined,
      propertyType: req.query['propertyType'] as marketService.MarketDashboardQuery['propertyType'],
      period: req.query['period'] as string | undefined,
    });
    sendSuccess(res, stats);
  },
);

/**
 * @swagger
 * /api/market/trends:
 *   get:
 *     summary: Get market price trends over time
 *     tags: [Market Statistics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: neighborhoodId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: propertyType
 *         schema:
 *           type: string
 *           enum: [APARTMENT, VILLA, CONDOMINIUM, OFFICE, RETAIL, WAREHOUSE, LAND]
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 60
 *           default: 12
 *     responses:
 *       200:
 *         description: Market price trends
 */
router.get(
  '/trends',
  [
    query('neighborhoodId').optional().isUUID(),
    query('propertyType').optional().isIn(['APARTMENT', 'VILLA', 'CONDOMINIUM', 'OFFICE', 'RETAIL', 'WAREHOUSE', 'LAND']),
    query('months').optional().isInt({ min: 1, max: 60 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const trends = await marketService.getPriceTrend({
      neighborhoodId: req.query['neighborhoodId'] as string | undefined,
      propertyType: req.query['propertyType'] as marketService.MarketDashboardQuery['propertyType'],
      months: req.query['months'] ? Number(req.query['months']) : undefined,
    });
    sendSuccess(res, trends);
  },
);

/**
 * @swagger
 * /api/market/analysis:
 *   get:
 *     summary: Get comprehensive market analysis with segments and comparisons
 *     tags: [Market Statistics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: neighborhoodIds
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *       - in: query
 *         name: propertyTypes
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [APARTMENT, VILLA, CONDOMINIUM, OFFICE, RETAIL, WAREHOUSE, LAND]
 *       - in: query
 *         name: startPeriod
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}$'
 *       - in: query
 *         name: endPeriod
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}$'
 *       - in: query
 *         name: includeComparisons
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: includeForecasts
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Comprehensive market analysis
 */
router.get(
  '/analysis',
  requirePermission('market:view_analysis'),
  [
    query('neighborhoodIds').optional().toArray(),
    query('propertyTypes').optional().toArray(),
    query('startPeriod').optional().matches(/^\d{4}-\d{2}$/),
    query('endPeriod').optional().matches(/^\d{4}-\d{2}$/),
    query('includeComparisons').optional().isBoolean(),
    query('includeForecasts').optional().isBoolean(),
    validate,
  ],
  async (req: Request, res: Response) => {
    const analysis = await marketService.getComprehensiveMarketAnalysis({
      neighborhoodIds: Array.isArray(req.query.neighborhoodIds) ? req.query.neighborhoodIds as string[] : 
                       req.query.neighborhoodIds ? [req.query.neighborhoodIds as string] : undefined,
      propertyTypes: Array.isArray(req.query.propertyTypes) ? req.query.propertyTypes as any[] : 
                     req.query.propertyTypes ? [req.query.propertyTypes as any] : undefined,
      startPeriod: req.query.startPeriod as string | undefined,
      endPeriod: req.query.endPeriod as string | undefined,
      includeComparisons: req.query.includeComparisons === 'true',
      includeForecasts: req.query.includeForecasts === 'true',
    });
    sendSuccess(res, analysis);
  },
);

/**
 * @swagger
 * /api/market/statistics/calculate:
 *   post:
 *     summary: Trigger market statistics calculation (Admin/Analyst only)
 *     tags: [Market Statistics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               force:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Statistics calculation triggered successfully
 */
router.post(
  '/statistics/calculate',
  requirePermission('market:calculate_statistics'),
  [
    body('force').optional().isBoolean(),
    validate,
  ],
  async (req: Request, res: Response) => {
    const result = await marketService.runMarketStatisticsCalculation(req.body.force || false);
    sendSuccess(res, result, 200, 'Market statistics calculation completed');
  },
);

export default router;
