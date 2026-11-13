import { Router, Request, Response } from 'express';
import { param, query } from 'express-validator';

import { validate } from '../../middleware/validate';
import { sendSuccess } from '../../shared/utils/response';
import { getEconomicContext } from './economic-context.service';
import * as publicService from './public.service';
import { INTEGRATION_REGISTRY } from '../integrations/source-registry';

/**
 * Unauthenticated, read-only endpoints for the public marketing pages.
 *
 * These expose only approved/active records and never fabricate figures: any
 * statistic without an adequate sample is returned with `status:
 * "insufficient_sample"` and a null value.
 */
const router = Router();

const PROPERTY_TYPES = [
  'APARTMENT',
  'VILLA',
  'CONDOMINIUM',
  'OFFICE',
  'RETAIL',
  'WAREHOUSE',
  'LAND',
] as const;

router.get(
  '/market-summary',
  [
    query('months')
      .optional()
      .isInt({ min: 1, max: 60 })
      .withMessage('months must be an integer between 1 and 60'),
    validate,
  ],
  async (req: Request, res: Response) => {
    const months = req.query['months'] ? Number(req.query['months']) : undefined;
    const summary = await publicService.getMarketSummary(months);
    sendSuccess(res, summary);
  },
);

router.get(
  '/market-trends',
  [
    query('months')
      .optional()
      .isInt({ min: 1, max: 60 })
      .withMessage('months must be an integer between 1 and 60'),
    validate,
  ],
  async (req: Request, res: Response) => {
    const months = req.query['months'] ? Number(req.query['months']) : 12;
    const trends = await publicService.getMarketTrends(months);
    sendSuccess(res, trends);
  },
);

router.get(
  '/economic-context',
  [
    query('months')
      .optional()
      .isInt({ min: 1, max: 120 })
      .withMessage('months must be an integer between 1 and 120'),
    validate,
  ],
  async (req: Request, res: Response) => {
    const months = req.query['months'] ? Number(req.query['months']) : 36;
    const context = await getEconomicContext(months);
    sendSuccess(res, context);
  },
);

router.get('/neighborhoods', async (_req: Request, res: Response) => {
  const neighborhoods = await publicService.listPublicNeighborhoods();
  sendSuccess(res, neighborhoods);
});

router.get(
  '/neighborhoods/:slug',
  [param('slug').isString().trim().notEmpty(), validate],
  async (req: Request, res: Response) => {
    const neighborhood = await publicService.getPublicNeighborhood(req.params['slug']!);
    if (!neighborhood) {
      res.status(404).json({ success: false, message: 'Neighborhood not found' });
      return;
    }
    sendSuccess(res, neighborhood);
  },
);

router.get(
  '/properties/:id',
  [param('id').isUUID(), validate],
  async (req: Request, res: Response) => {
    const property = await publicService.getPublicProperty(req.params['id']!);
    if (!property) {
      res.status(404).json({ success: false, message: 'Property not found' });
      return;
    }
    sendSuccess(res, property);
  },
);

router.get(
  '/listings',
  [
    query('neighborhood').optional().isString().trim(),
    query('propertyType').optional().isIn(PROPERTY_TYPES as unknown as string[]),
    query('listingType').optional().isIn(['sale', 'rent']),
    query('minPrice').optional().isFloat({ min: 0 }),
    query('maxPrice').optional().isFloat({ min: 0 }),
    query('minBedrooms').optional().isInt({ min: 0, max: 20 }),
    query('limit').optional().isInt({ min: 1, max: 60 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const result = await publicService.listPublicListings({
      neighborhood: req.query['neighborhood'] as string | undefined,
      propertyType: req.query['propertyType'] as string | undefined,
      listingType: req.query['listingType'] as 'sale' | 'rent' | undefined,
      minPrice: req.query['minPrice'] ? Number(req.query['minPrice']) : undefined,
      maxPrice: req.query['maxPrice'] ? Number(req.query['maxPrice']) : undefined,
      minBedrooms: req.query['minBedrooms'] ? Number(req.query['minBedrooms']) : undefined,
      limit: req.query['limit'] ? Number(req.query['limit']) : undefined,
    });
    sendSuccess(res, result);
  },
);

/** BinaSmart (binasmart) listings + stats computed from the integrated source. */
router.get(
  '/bina/listings',
  async (_req: Request, res: Response) => {
    const result = await publicService.listBinaListings();
    sendSuccess(res, result);
  },
);

router.get(
  '/bina/stats',
  async (_req: Request, res: Response) => {
    const result = await publicService.getBinaStats();
    sendSuccess(res, result);
  },
);

/** Publicly-visible source-registry status (integration health overview). */
router.get(
  '/integrations/status',
  async (_req: Request, res: Response) => {
    const status: Array<{
      id: string;
      name: string;
      category: string;
      status: string;
      accessMethod: string;
      capabilities: Record<string, unknown>;
      lastSuccessfulSync?: string;
      notes: string;
    }> = INTEGRATION_REGISTRY.map((entry) => ({
      id: entry.id,
      name: entry.name,
      category: entry.category,
      status: entry.status,
      accessMethod: entry.accessMethod,
      capabilities: entry.capabilities as unknown as Record<string, unknown>,
      lastSuccessfulSync: entry.lastSuccessfulSync,
      notes: entry.notes,
    }));
    sendSuccess(res, status);
  },
);

export default router;
