import { Router, Request, Response } from 'express';
import { query, body, param } from 'express-validator';
import { EconomicIndicatorType } from '@prisma/client';

import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { sendSuccess, sendCreated } from '../../shared/utils/response';
import { AuthenticatedRequest } from '../../shared/types';
import * as economicsService from './economics.service';

const router = Router();
router.use(authenticate);

// Get list of all available indicator types
const INDICATOR_TYPES = [
  'INFLATION_RATE',
  'INTEREST_RATE', 
  'EXCHANGE_RATE',
  'CONSTRUCTION_COST_INDEX',
  'GDP_GROWTH',
  'UNEMPLOYMENT_RATE',
  'CONSUMER_PRICE_INDEX',
  'MONEY_SUPPLY',
  'BANK_LENDING_RATE',
  'GOVERNMENT_DEBT',
  'IMPORT_PRICE_INDEX',
  'EXPORT_PRICE_INDEX',
  'REAL_ESTATE_PRICE_INDEX',
  'RENTAL_YIELD_INDEX',
  'HOUSING_AFFORDABILITY',
  'MORTGAGE_RATE',
  'CREDIT_GROWTH',
  'FOREIGN_INVESTMENT',
  'TAX_REVENUE',
  'OTHER'
];

/**
 * @swagger
 * /api/economics:
 *   get:
 *     summary: Get economic indicators with optional filtering
 *     tags: [Economic Indicators]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/',
  [
    query('type').optional().isIn(INDICATOR_TYPES),
    query('months').optional().isInt({ min: 1, max: 120 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const indicators = await economicsService.getIndicators(
      req.query['type'] as EconomicIndicatorType | undefined,
      req.query['months'] ? Number(req.query['months']) : 24,
    );
    sendSuccess(res, indicators);
  },
);

/**
 * @swagger
 * /api/economics/latest:
 *   get:
 *     summary: Get latest values for all economic indicators
 *     tags: [Economic Indicators]
 *     security:
 *       - bearerAuth: []
 */
router.get('/latest', async (_req: Request, res: Response) => {
  const latest = await economicsService.getLatestIndicators();
  sendSuccess(res, latest);
});

/**
 * @swagger
 * /api/economics/types:
 *   get:
 *     summary: Get available economic indicator types
 *     tags: [Economic Indicators]
 *     security:
 *       - bearerAuth: []
 */
router.get('/types', async (_req: Request, res: Response) => {
  const types = INDICATOR_TYPES.map(type => ({
    type,
    displayName: type.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    description: getIndicatorDescription(type as EconomicIndicatorType)
  }));
  sendSuccess(res, types);
});

/**
 * @swagger
 * /api/economics:
 *   post:
 *     summary: Add or update economic indicator (Admin/Analyst only)
 *     tags: [Economic Indicators]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/',
  requirePermission('economics:create'),
  [
    body('indicatorType').isIn(INDICATOR_TYPES),
    body('value').isFloat(),
    body('unit').notEmpty().isString().isLength({ max: 50 }),
    body('recordedAt').isISO8601(),
    body('source').optional().isString().isLength({ max: 255 }),
    body('sourceUrl').optional().isURL(),
    body('notes').optional().isString(),
    validate,
  ],
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const indicator = await economicsService.addIndicator(req.body, authReq.user.id);
    sendCreated(res, indicator, 'Economic indicator added successfully');
  },
);

/**
 * @swagger
 * /api/economics/{id}:
 *   delete:
 *     summary: Delete economic indicator (Admin only)
 *     tags: [Economic Indicators]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/:id',
  requirePermission('economics:delete'),
  [param('id').isUUID(), validate],
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const result = await economicsService.deleteIndicator(req.params.id, authReq.user.id);
    sendSuccess(res, result);
  },
);

/**
 * @swagger
 * /api/economics/trend/{type}:
 *   get:
 *     summary: Get trend analysis for specific indicator
 *     tags: [Economic Indicators]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/trend/:type',
  requirePermission('economics:view_analysis'),
  [
    param('type').isIn(INDICATOR_TYPES),
    query('months').optional().isInt({ min: 6, max: 60 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const analysis = await economicsService.getIndicatorTrendAnalysis(
      req.params.type as EconomicIndicatorType,
      req.query.months ? Number(req.query.months) : 12
    );
    sendSuccess(res, analysis);
  },
);

/**
 * @swagger
 * /api/economics/analysis:
 *   post:
 *     summary: Get multi-indicator analysis with correlations
 *     tags: [Economic Indicators]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/analysis',
  requirePermission('economics:view_analysis'),
  [
    body('indicators').isArray({ min: 1 }).custom((value) => {
      return value.every((item: string) => INDICATOR_TYPES.includes(item));
    }),
    body('startDate').optional().isISO8601(),
    body('endDate').optional().isISO8601(),
    body('aggregation').optional().isIn(['monthly', 'quarterly', 'yearly']),
    body('includeCorrelation').optional().isBoolean(),
    body('includeForecasting').optional().isBoolean(),
    validate,
  ],
  async (req: Request, res: Response) => {
    const analysis = await economicsService.getMultiIndicatorAnalysis({
      indicators: req.body.indicators,
      startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
      endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      aggregation: req.body.aggregation,
      includeCorrelation: req.body.includeCorrelation,
      includeForecasting: req.body.includeForecasting,
    });
    sendSuccess(res, analysis);
  },
);

/**
 * @swagger
 * /api/economics/impact/{type}:
 *   get:
 *     summary: Get property market impact analysis for indicator
 *     tags: [Economic Indicators]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/impact/:type',
  requirePermission('economics:view_analysis'),
  [param('type').isIn(INDICATOR_TYPES), validate],
  async (req: Request, res: Response) => {
    const impact = await economicsService.getIndicatorImpactAnalysis(
      req.params.type as EconomicIndicatorType
    );
    sendSuccess(res, impact);
  },
);

function getIndicatorDescription(type: EconomicIndicatorType): string {
  const descriptions: Record<EconomicIndicatorType, string> = {
    INFLATION_RATE: 'Annual percentage change in consumer prices',
    INTEREST_RATE: 'Central bank policy interest rate',
    EXCHANGE_RATE: 'Currency exchange rate against major currencies',
    CONSTRUCTION_COST_INDEX: 'Index measuring construction material and labor costs',
    GDP_GROWTH: 'Quarterly or annual gross domestic product growth rate',
    UNEMPLOYMENT_RATE: 'Percentage of unemployed in the labor force',
    CONSUMER_PRICE_INDEX: 'Index measuring changes in consumer goods prices',
    MONEY_SUPPLY: 'Total amount of money in circulation in the economy',
    BANK_LENDING_RATE: 'Average interest rate charged by banks on loans',
    GOVERNMENT_DEBT: 'Total government debt as percentage of GDP',
    IMPORT_PRICE_INDEX: 'Index measuring changes in import prices',
    EXPORT_PRICE_INDEX: 'Index measuring changes in export prices', 
    REAL_ESTATE_PRICE_INDEX: 'Index tracking real estate price changes',
    RENTAL_YIELD_INDEX: 'Index measuring rental income yields',
    HOUSING_AFFORDABILITY: 'Index measuring housing affordability for median income',
    MORTGAGE_RATE: 'Average mortgage interest rate for home loans',
    CREDIT_GROWTH: 'Growth rate of total credit in the economy',
    FOREIGN_INVESTMENT: 'Foreign direct investment flows',
    TAX_REVENUE: 'Government tax revenue collections',
    OTHER: 'Custom or specialized economic indicator'
  };

  return descriptions[type];
}

export default router;
