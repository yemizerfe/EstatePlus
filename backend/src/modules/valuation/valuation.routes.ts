import { Router, Request, Response } from 'express';
import { param } from 'express-validator';

import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { AuthenticatedRequest } from '../../shared/types';
import { sendSuccess } from '../../shared/utils/response';
import * as valuationService from './valuation.service';

const router = Router();
router.use(authenticate);

router.post(
  '/:id/valuate',
  [param('id').isUUID(), validate],
  async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user.sub;
    const result = await valuationService.computePropertyValuation({ propertyId: req.params['id']!, requestedBy: userId });
    sendSuccess(res, result);
  },
);

export default router;
