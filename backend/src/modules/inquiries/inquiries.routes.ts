import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';

import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { AuthenticatedRequest } from '../../shared/types';
import { sendSuccess } from '../../shared/utils/response';
import { inquiryService, type ListInquiriesOptions, type UpdateInquiryInput } from './inquiries.service';

const router = Router();
router.use(authenticate);

const STATUS_VALUES = ['new', 'responded', 'closed'] as const;
type StatusValue = (typeof STATUS_VALUES)[number];

const toStatus = (value: unknown): ListInquiriesOptions['status'] | undefined => {
  if (typeof value !== 'string') return undefined;
  const upper = value.toUpperCase();
  return upper === 'NEW' || upper === 'RESPONDED' || upper === 'CLOSED' ? upper : undefined;
};

/**
 * @swagger
 * /inquiries:
 *   get:
 *     summary: Inquiries received on the signed-in owner's listings
 *     tags: [Inquiries]
 *     security:
 *       - bearerAuth: []
 */
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
    const result = await inquiryService.listForUser(user.sub, user.role, {
      status: toStatus(req.query['status']),
      search: typeof req.query['search'] === 'string' ? req.query['search'] : undefined,
      page: req.query['page'] ? Number(req.query['page']) : 1,
      limit: req.query['limit'] ? Number(req.query['limit']) : 50,
    });
    res.json({
      success: true,
      data: result.data,
      meta: {
        page: result.meta.page,
        limit: result.meta.limit,
        total: result.meta.total,
        totalPages: result.meta.totalPages,
        hasNext: result.meta.page < result.meta.totalPages,
        hasPrev: result.meta.page > 1,
      },
    });
  },
);

/**
 * @swagger
 * /inquiries/stats:
 *   get:
 *     summary: Inquiry counters for the owner workspace
 *     tags: [Inquiries]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const stats = await inquiryService.stats(user.sub, user.role);
  sendSuccess(res, stats);
});

/**
 * @swagger
 * /inquiries:
 *   post:
 *     summary: Send an inquiry about a listing to its owner
 *     tags: [Inquiries]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/',
  [
    body('propertyId').isUUID().withMessage('propertyId must be a property id'),
    body('message').trim().isLength({ min: 5, max: 2000 }).withMessage('Message must be 5-2000 characters'),
    body('name').optional({ nullable: true }).trim().isLength({ min: 1, max: 150 }),
    body('email').optional({ nullable: true }).isEmail().withMessage('A valid email is required'),
    body('phone').optional({ nullable: true }).trim().isLength({ max: 40 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const inquiry = await inquiryService.create(user.sub, {
      propertyId: req.body.propertyId,
      message: req.body.message,
      name: req.body.name ?? undefined,
      email: req.body.email ?? undefined,
      phone: req.body.phone ?? undefined,
    });
    sendSuccess(res, inquiry, 201, 'Inquiry sent');
  },
);

/**
 * @swagger
 * /inquiries/{id}:
 *   patch:
 *     summary: Reply to an inquiry or change its status
 *     tags: [Inquiries]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  '/:id',
  [
    param('id').isUUID(),
    body('status').optional().isIn(STATUS_VALUES),
    body('response').optional({ nullable: true }).trim().isLength({ max: 2000 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const input: UpdateInquiryInput = {};
    const status = toStatus(req.body.status);
    if (status) input.status = status;
    if (typeof req.body.response === 'string' && req.body.response.trim()) {
      input.response = req.body.response;
    }
    const inquiry = await inquiryService.update(user.sub, user.role, req.params['id']!, input);
    sendSuccess(res, inquiry, 200, 'Inquiry updated');
  },
);

export default router;

export type { StatusValue };
