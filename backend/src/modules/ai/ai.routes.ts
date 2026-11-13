import { Router, Request, Response } from 'express';
import { body, query } from 'express-validator';

import { authenticate } from '../../middleware/authenticate';
import { aiRateLimiter } from '../../middleware/rateLimiter';
import { validate } from '../../middleware/validate';
import { sendSuccess } from '../../shared/utils/response';
import * as aiService from './ai.service';

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

/**
 * Everything below needs an authenticated session and is rate limited.
 * Retrieval still runs when no model is configured; only the model call is
 * unavailable, and that is reported explicitly instead of a fabricated answer.
 */
router.use(authenticate, aiRateLimiter);

// The UI uses this to decide whether to offer AI analysis at all.
router.get('/status', (_req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  sendSuccess(res, aiService.getAiStatus());
});

function rejectWhenNotConfigured(res: Response): boolean {
  if (aiService.isAiConfigured()) return false;
  const status = aiService.getAiStatus();
  res.status(503).json({
    success: false,
    code: 'AI_NOT_CONFIGURED',
    message: status.message,
    missingEnvironmentVariables: status.missingEnvironmentVariables,
    provider: status.provider,
    model: status.model,
  });
  return true;
}

router.post(
  '/ask',
  [
    body('question').trim().isLength({ min: 5, max: 500 }),
    body('neighborhoodSlug').optional().isString().trim().isLength({ max: 150 }),
    body('propertyId').optional().isUUID(),
    body('months').optional().isInt({ min: 3, max: 24 }),
    body('listingType').optional().isIn(['sale', 'rent']),
    body('propertyType').optional().isIn(PROPERTY_TYPES as unknown as string[]),
    body('maxPrice').optional().isFloat({ min: 0 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    if (rejectWhenNotConfigured(res)) return;

    const result = await aiService.askQuestion(req.body as aiService.AskQuestionDto);
    sendSuccess(res, result);
  },
);

router.get(
  '/summary',
  [
    query('neighborhoodSlug').optional().isString().isLength({ max: 150 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    if (rejectWhenNotConfigured(res)) return;

    const result = await aiService.generateMarketSummary(
      req.query['neighborhoodSlug'] as string | undefined,
    );
    sendSuccess(res, result);
  },
);

router.post(
  '/search',
  [body('query').trim().isLength({ min: 3, max: 300 }), validate],
  async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    if (rejectWhenNotConfigured(res)) return;

    const result = await aiService.naturalLanguageSearch(req.body as aiService.NLSearchDto);
    sendSuccess(res, result);
  },
);

export default router;
