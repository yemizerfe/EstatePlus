import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';

import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { AuthenticatedRequest } from '../../shared/types';
import { notificationService } from './notifications.service';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: List user notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [SYSTEM, PROPERTY, ALERT, MARKET, ANALYSIS, FORECAST, NOTICE]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of notifications
 */
router.get(
  '/',
  [
    query('unreadOnly').optional().isBoolean(),
    query('type').optional().isIn(['SYSTEM', 'PROPERTY', 'ALERT', 'MARKET', 'ANALYSIS', 'FORECAST', 'NOTICE']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user.sub;
    const result = await notificationService.listNotifications(userId, {
      unreadOnly: req.query['unreadOnly'] === 'true',
      type: req.query['type'] as any,
      page: req.query['page'] ? Number(req.query['page']) : 1,
      limit: req.query['limit'] ? Number(req.query['limit']) : 20,
    });
    res.json({ success: true, ...result });
  }
);

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 */
router.get('/unread-count', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user.sub;
  const result = await notificationService.getUnreadCount(userId);
  res.json({ success: true, data: result });
});

/**
 * @swagger
 * /notifications/stats:
 *   get:
 *     summary: Get notification statistics
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user.sub;
  const stats = await notificationService.getNotificationStats(userId);
  res.json({ success: true, data: stats });
});

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.patch('/:id/read', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user.sub;
  const notification = await notificationService.markRead(userId, req.params['id']!);
  res.json({ success: true, data: notification });
});

/**
 * @swagger
 * /notifications/read-all:
 *   post:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.post('/read-all', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user.sub;
  const result = await notificationService.markAllRead(userId);
  res.json({ success: true, message: 'All notifications marked as read', data: result });
});

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification deleted
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user.sub;
  const result = await notificationService.dismiss(userId, req.params['id']!);
  res.json({ success: true, message: 'Notification deleted', data: result });
});

/**
 * @swagger
 * /notifications/bulk:
 *   post:
 *     summary: Send bulk notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               type:
 *                 type: string
 *                 enum: [SYSTEM, PROPERTY, ALERT, MARKET, ANALYSIS, FORECAST, NOTICE]
 *               title:
 *                 type: string
 *               body:
 *                 type: string
 *               link:
 *                 type: string
 *               channels:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Bulk notifications created
 */
router.post(
  '/bulk',
  [
    body('userIds').isArray({ min: 1 }),
    body('type').isIn(['SYSTEM', 'PROPERTY', 'ALERT', 'MARKET', 'ANALYSIS', 'FORECAST', 'NOTICE']),
    body('title').trim().isLength({ min: 1, max: 200 }),
    body('body').trim().isLength({ min: 1, max: 500 }),
    body('link').optional().isLength({ max: 255 }),
    body('channels').optional().isArray(),
    validate,
  ],
  async (req: Request, res: Response) => {
    const result = await notificationService.createBulkNotifications({
      userIds: req.body.userIds,
      type: req.body.type,
      title: req.body.title,
      body: req.body.body,
      link: req.body.link,
      channels: req.body.channels,
    });
    res.status(201).json({ success: true, message: 'Bulk notifications created', data: result });
  }
);

/**
 * @swagger
 * /notifications/template/{templateId}:
 *   post:
 *     summary: Send notification from template
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               variables:
 *                 type: object
 *     responses:
 *       201:
 *         description: Notification sent
 */
router.post(
  '/template/:templateId',
  [
    param('templateId').isIn([
      'property_saved',
      'property_price_alert',
      'market_update',
      'scenario_result',
      'forecast_update',
      'new_listing',
      'scheduled_status_change',
      'bulk_import_complete',
    ]),
    body('userId').isUUID(),
    body('variables').isObject(),
    validate,
  ],
  async (req: Request, res: Response) => {
    const notification = await notificationService.createFromTemplate(
      req.params['templateId']!,
      req.body.userId,
      req.body.variables
    );
    res.status(201).json({ success: true, message: 'Notification sent', data: notification });
  }
);

/**
 * @swagger
 * /notifications/settings:
 *   get:
 *     summary: Get notification settings
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification settings
 */
router.get('/settings', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user.sub;
  const settings = await notificationService.getSettings(userId);
  res.json({ success: true, data: settings });
});

/**
 * @swagger
 * /notifications/settings:
 *   patch:
 *     summary: Update notification settings
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: boolean
 *               inApp:
 *                 type: boolean
 *               push:
 *                 type: boolean
 *               sms:
 *                 type: boolean
 *               digest:
 *                 type: boolean
 *               digestFrequency:
 *                 type: string
 *                 enum: [daily, weekly]
 *     responses:
 *       200:
 *         description: Settings updated
 */
router.patch('/settings', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user.sub;
  const settings = await notificationService.updateSettings(userId, req.body);
  res.json({ success: true, message: 'Settings updated', data: settings });
});

/**
 * @swagger
 * /notifications/digest:
 *   post:
 *     summary: Send digest notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [daily, weekly]
 *     responses:
 *       200:
 *         description: Digest sent
 */
router.post(
  '/digest',
  [
    body('type').optional().isIn(['daily', 'weekly']),
    validate,
  ],
  async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user.sub;
    const result = await notificationService.sendDigest(userId, req.body.type || 'daily');
    res.json({ success: true, data: result });
  }
);

/**
 * @swagger
 * /notifications/scheduled:
 *   post:
 *     summary: Process scheduled notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Scheduled notifications processed
 */
router.post('/scheduled', async (_req: Request, res: Response) => {
  const result = await notificationService.processScheduledNotifications();
  res.json({ success: true, data: result });
});

export default router;