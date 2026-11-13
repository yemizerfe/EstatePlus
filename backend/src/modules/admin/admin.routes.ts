import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';

import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { AuthenticatedRequest } from '../../shared/types';
import { sendSuccess } from '../../shared/utils/response';
import * as adminService from './admin.service';

const router = Router();

// Apply authentication and admin authorization to all routes
router.use(authenticate);
router.use(authorize('admin'));

/**
 * Dashboard endpoints
 */
router.get('/dashboard/stats', async (_req: Request, res: Response) => {
  const stats = await adminService.getDashboardStats();
  sendSuccess(res, stats);
});

router.get('/dashboard/system-health', async (_req: Request, res: Response) => {
  const health = await adminService.getSystemHealth();
  sendSuccess(res, health);
});

router.get('/dashboard/recent-activity', async (_req: Request, res: Response) => {
  const activity = await adminService.getRecentActivity();
  sendSuccess(res, activity);
});

router.get('/dashboard/alerts', async (_req: Request, res: Response) => {
  const alerts = await adminService.getSystemAlerts();
  sendSuccess(res, alerts);
});

/**
 * User management endpoints
 */
router.get('/users', [
  query('search').optional().isString(),
  query('role').optional().isString(),
  query('status').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validate
], async (req: Request, res: Response): Promise<void> => {
  const filters = {
    search: req.query.search as string,
    role: req.query.role as string,
    status: req.query.status as string,
    page: parseInt(req.query.page as string) || 1,
    limit: parseInt(req.query.limit as string) || 10
  };
  
  const users = await adminService.getUsers(filters);
  sendSuccess(res, users);
});

router.get('/users/:id', async (req: Request, res: Response): Promise<void> => {
  const user = await adminService.getUserById(req.params.id);
  sendSuccess(res, user);
});

router.put('/users/:id', [
  body('firstName').optional().isString().trim(),
  body('lastName').optional().isString().trim(),
  body('email').optional().isEmail(),
  body('role').optional().isIn(['user', 'property_owner', 'analyst', 'admin']),
  body('isActive').optional().isBoolean(),
  validate
], async (req: Request, res: Response): Promise<void> => {
  const user = await adminService.updateUser(req.params.id, req.body);
  sendSuccess(res, user, 200, 'User updated successfully');
});

/**
 * Property moderation endpoints
 *
 * Listings submitted for review land in PENDING; admins approve or reject them
 * here. Declared before `/users/:id` is irrelevant, but they intentionally live
 * next to the other platform-management routes.
 */
router.get('/properties', [
  query('status').optional().isIn(['PENDING', 'APPROVED', 'REJECTED', 'ALL']),
  query('search').optional().isString().trim(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validate
], async (req: Request, res: Response): Promise<void> => {
  const status = req.query.status as string | undefined;
  const queue = await adminService.getPropertyApprovalQueue({
    status: status && status !== 'ALL' ? status : undefined,
    search: req.query.search as string | undefined,
    page: parseInt(req.query.page as string) || 1,
    limit: parseInt(req.query.limit as string) || 20,
  });
  sendSuccess(res, queue);
});

router.patch('/properties/:id/review', [
  param('id').isUUID(),
  body('decision').isIn(['approve', 'reject']),
  body('reason').optional().isString().trim().isLength({ max: 500 }),
  validate
], async (req: Request, res: Response): Promise<void> => {
  const adminId = (req as AuthenticatedRequest).user.id;
  const result = await adminService.reviewProperty(
    req.params.id,
    {
      decision: req.body.decision,
      reason: req.body.reason,
    },
    adminId,
  );
  sendSuccess(
    res,
    result,
    200,
    result.status === 'APPROVED' ? 'Listing approved' : 'Listing rejected',
  );
});

/**
 * Roles endpoints
 */
router.get('/roles', async (_req: Request, res: Response): Promise<void> => {
  const roles = await adminService.getRoles();
  sendSuccess(res, roles);
});

/**
 * Organizations endpoints
 */
router.get('/organizations', async (_req: Request, res: Response): Promise<void> => {
  const organizations = await adminService.getOrganizations();
  sendSuccess(res, organizations);
});

/**
 * Audit logs endpoints
 */
router.get('/audit-logs', [
  query('search').optional().isString(),
  query('action').optional().isString(),
  query('resource').optional().isString(),
  query('userId').optional().isUUID(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validate
], async (req: Request, res: Response): Promise<void> => {
  const filters = {
    search: req.query.search as string,
    action: req.query.action as string,
    resource: req.query.resource as string,
    userId: req.query.userId as string,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    page: parseInt(req.query.page as string) || 1,
    limit: parseInt(req.query.limit as string) || 20
  };
  
  const logs = await adminService.getAuditLogs(filters);
  sendSuccess(res, logs);
});

/**
 * Data sources endpoints
 */
router.get('/data-sources', async (_req: Request, res: Response): Promise<void> => {
  const dataSources = await adminService.getDataSources();
  sendSuccess(res, dataSources);
});

/**
 * Notifications endpoints
 */
router.get('/notifications', [
  query('type').optional().isString(),
  query('priority').optional().isString(),
  query('status').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validate
], async (req: Request, res: Response): Promise<void> => {
  const filters = {
    type: req.query.type as string,
    priority: req.query.priority as string,
    status: req.query.status as string,
    page: parseInt(req.query.page as string) || 1,
    limit: parseInt(req.query.limit as string) || 20
  };
  
  const notifications = await adminService.getAdminNotifications(filters);
  sendSuccess(res, notifications);
});

/**
 * Platform-wide notification management (admin scope).
 * Declared before the `/:id` variants so `read-all` is never treated as an id.
 */
router.post('/notifications/read-all', async (_req: Request, res: Response): Promise<void> => {
  const result = await adminService.markAllNotificationsRead();
  sendSuccess(res, result, `${result.updated} notification(s) marked as read`);
});

router.patch('/notifications/:id/read', async (req: Request, res: Response): Promise<void> => {
  const notification = await adminService.markNotificationRead(req.params.id);
  sendSuccess(res, notification, 'Notification marked as read');
});

router.delete('/notifications/:id', async (req: Request, res: Response): Promise<void> => {
  await adminService.deleteNotification(req.params.id);
  sendSuccess(res, null, 'Notification deleted');
});

export default router;