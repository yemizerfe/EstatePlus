import { Router, Request, Response } from 'express';
import { query } from 'express-validator';

import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as forecastingService from './forecasting.service';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /forecasts:
 *   get:
 *     summary: Generate property price or rental forecast
 *     tags: [Forecasting]
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
 *         name: forecastType
 *         schema:
 *           type: string
 *           enum: [price, rental]
 *         required: true
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 24
 *           default: 6
 *       - in: query
 *         name: model
 *         schema:
 *           type: string
 *           enum: [linear, exponential, moving_average, ensemble]
 *           default: ensemble
 *     responses:
 *       200:
 *         description: Forecast generated successfully
 */
router.get(
  '/',
  [
    query('neighborhoodId').optional().isUUID(),
    query('propertyType').optional().isIn(['APARTMENT', 'VILLA', 'CONDOMINIUM', 'OFFICE', 'RETAIL', 'WAREHOUSE', 'LAND']),
    query('forecastType').isIn(['price', 'rental']),
    query('months').optional().isInt({ min: 1, max: 24 }),
    query('model').optional().isIn(['linear', 'exponential', 'moving_average', 'ensemble']),
    validate,
  ],
  async (req: Request, res: Response) => {
    const result = await forecastingService.getForecast({
      neighborhoodId: req.query['neighborhoodId'] as string | undefined,
      propertyType: req.query['propertyType'] as any,
      forecastType: (req.query['forecastType'] as 'price' | 'rental') ?? 'price',
      months: req.query['months'] ? Number(req.query['months']) : 6,
      model: req.query['model'] as any,
    });
    res.json({ success: true, data: result });
  },
);

/**
 * @swagger
 * /forecasts/summary:
 *   get:
 *     summary: Get market forecast summary for all neighborhoods
 *     tags: [Forecasting]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Market forecast summary
 */
router.get(
  '/summary',
  async (_req: Request, res: Response) => {
    const result = await forecastingService.getMarketForecastSummary();
    res.json({ success: true, data: result });
  },
);

/**
 * @swagger
 * /forecasts/compare:
 *   get:
 *     summary: Compare forecasts across property types
 *     tags: [Forecasting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: neighborhoodId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *       - in: query
 *         name: propertyTypes
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [APARTMENT, VILLA, CONDOMINIUM, OFFICE, RETAIL, WAREHOUSE, LAND]
 *       - in: query
 *         name: forecastType
 *         schema:
 *           type: string
 *           enum: [price, rental]
 *           default: price
 *     responses:
 *       200:
 *         description: Forecast comparison
 */
router.get(
  '/compare',
  [
    query('neighborhoodId').isUUID(),
    query('propertyTypes').isArray({ min: 1 }),
    query('forecastType').optional().isIn(['price', 'rental']),
    validate,
  ],
  async (req: Request, res: Response) => {
    const result = await forecastingService.getForecastComparison({
      neighborhoodId: req.query['neighborhoodId'] as string,
      propertyTypes: req.query['propertyTypes'] as any,
      forecastType: (req.query['forecastType'] as 'price' | 'rental') ?? 'price',
    });
    res.json({ success: true, data: result });
  },
);

/**
 * @swagger
 * /forecasts/{id}:
 *   get:
 *     summary: Get a specific forecast by ID
 *     tags: [Forecasting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Forecast details
 */router.get(
  '/:id',
  async (req: Request, res: Response) => {
    const { prisma } = await import('../../infrastructure/database/prisma');
    const forecast = await prisma.forecast.findUnique({
      where: { id: req.params.id },
    });
    
    if (!forecast) {
      return res.status(404).json({ 
        success: false, 
        message: 'Forecast not found' 
      });
    }

    return res.json({ success: true, data: forecast });
  },
);

export default router;