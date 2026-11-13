import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';

import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { AuthenticatedRequest } from '../../shared/types';
import { sendSuccess } from '../../shared/utils/response';
import { viewingService, viewingStatusFromView, type UpdateViewingInput } from './viewings.service';

const router = Router();
router.use(authenticate);

const STATUS_VALUES = ['scheduled', 'completed', 'cancelled', 'no-show'] as const;

/** `GET /viewings` — visits booked on the signed-in owner's listings. */
router.get(
  '/',
  [
    query('status').optional().isIn(STATUS_VALUES),
    query('search').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const page = req.query['page'] ? Number(req.query['page']) : 1;
    const limit = req.query['limit'] ? Number(req.query['limit']) : 100;
    const result = await viewingService.listForUser(user.sub, user.role, {
      status: viewingStatusFromView(req.query['status']),
      search: typeof req.query['search'] === 'string' ? req.query['search'] : undefined,
      page,
      limit,
    });
    res.json({
      success: true,
      data: result.data,
      meta: {
        page,
        limit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / limit)),
        hasNext: page * limit < result.total,
        hasPrev: page > 1,
      },
    });
  },
);

router.get('/stats', async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  sendSuccess(res, await viewingService.stats(user.sub, user.role));
});

router.post(
  '/',
  [
    body('propertyId').isUUID().withMessage('propertyId must be a property id'),
    body('clientName').trim().isLength({ min: 1, max: 150 }),
    body('clientEmail').isEmail().withMessage('A valid client email is required'),
    body('clientPhone').optional({ nullable: true }).trim().isLength({ max: 40 }),
    body('scheduledAt').isISO8601().withMessage('scheduledAt must be an ISO date-time'),
    body('notes').optional({ nullable: true }).trim().isLength({ max: 2000 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const viewing = await viewingService.create(user.sub, user.role, {
      propertyId: req.body.propertyId,
      clientName: req.body.clientName,
      clientEmail: req.body.clientEmail,
      clientPhone: req.body.clientPhone ?? undefined,
      scheduledAt: req.body.scheduledAt,
      notes: req.body.notes ?? undefined,
    });
    sendSuccess(res, viewing, 201, 'Viewing scheduled');
  },
);

router.patch(
  '/:id',
  [
    param('id').isUUID(),
    body('status').optional().isIn(STATUS_VALUES),
    body('scheduledAt').optional().isISO8601(),
    body('notes').optional({ nullable: true }).trim().isLength({ max: 2000 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const input: UpdateViewingInput = {};
    const status = viewingStatusFromView(req.body.status);
    if (status) input.status = status;
    if (typeof req.body.scheduledAt === 'string') input.scheduledAt = req.body.scheduledAt;
    if (typeof req.body.notes === 'string') input.notes = req.body.notes;
    const viewing = await viewingService.update(user.sub, user.role, req.params['id']!, input);
    sendSuccess(res, viewing, 200, 'Viewing updated');
  },
);

export default router;
