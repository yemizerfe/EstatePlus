import { Router, Request, Response } from 'express';
import { query, param } from 'express-validator';

import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { auditService } from '../../services/audit.service';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /audit:
 *   get:
 *     summary: Query audit logs
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: resource
 *         schema:
 *           type: string
 *       - in: query
 *         name: resourceId
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
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
 *         description: List of audit logs
 */
router.get(
  '/',
  requirePermission('VIEW_AUDIT_LOGS'),
  [
    query('userId').optional().isUUID(),
    query('action').optional().isString(),
    query('resource').optional().isString(),
    query('resourceId').optional().isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const result = await auditService.queryAuditLogs({
      userId: req.query['userId'] as string,
      action: req.query['action'] as string,
      resource: req.query['resource'] as string,
      resourceId: req.query['resourceId'] as string,
      startDate: req.query['startDate'] ? new Date(req.query['startDate'] as string) : undefined,
      endDate: req.query['endDate'] ? new Date(req.query['endDate'] as string) : undefined,
      page: req.query['page'] ? Number(req.query['page']) : 1,
      limit: req.query['limit'] ? Number(req.query['limit']) : 20,
    });

    res.json({ success: true, data: result });
  }
);

/**
 * @swagger
 * /audit/{id}:
 *   get:
 *     summary: Get audit log by ID
 *     tags: [Audit]
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
 *         description: Audit log details
 */
router.get(
  '/:id',
  requirePermission('VIEW_AUDIT_LOGS'),
  [param('id').isUUID(), validate],
  async (req: Request, res: Response) => {
    const log = await auditService.getAuditLogById(req.params['id']!);
    res.json({ success: true, data: log });
  }
);

/**
 * @swagger
 * /audit/stats:
 *   get:
 *     summary: Get audit statistics
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Audit statistics
 */
router.get(
  '/stats/summary',
  requirePermission('VIEW_AUDIT_LOGS'),
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    validate,
  ],
  async (req: Request, res: Response) => {
    const stats = await auditService.getAuditStats({
      startDate: req.query['startDate'] ? new Date(req.query['startDate'] as string) : undefined,
      endDate: req.query['endDate'] ? new Date(req.query['endDate'] as string) : undefined,
    });

    res.json({ success: true, data: stats });
  }
);

/**
 * @swagger
 * /audit/trail/{resource}/{resourceId}:
 *   get:
 *     summary: Get audit trail for a resource
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: resource
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: resourceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Resource audit trail
 */
router.get(
  '/trail/:resource/:resourceId',
  requirePermission('VIEW_AUDIT_LOGS'),
  [
    param('resource').isString(),
    param('resourceId').isString(),
    validate,
  ],
  async (req: Request, res: Response) => {
    const trail = await auditService.getResourceAuditTrail(
      req.params['resource']!,
      req.params['resourceId']!
    );

    res.json({ success: true, data: trail });
  }
);

/**
 * @swagger
 * /audit/user/{userId}/activity:
 *   get:
 *     summary: Get user activity summary
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: User activity summary
 */
router.get(
  '/user/:userId/activity',
  requirePermission('VIEW_AUDIT_LOGS'),
  [
    param('userId').isUUID(),
    query('days').optional().isInt({ min: 1, max: 365 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const summary = await auditService.getUserActivitySummary(
      req.params['userId']!,
      req.query['days'] ? Number(req.query['days']) : 30
    );

    res.json({ success: true, data: summary });
  }
);

/**
 * @swagger
 * /audit/export:
 *   get:
 *     summary: Export audit logs to CSV
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: resource
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get(
  '/export',
  requirePermission('EXPORT_AUDIT_LOGS'),
  [
    query('userId').optional().isUUID(),
    query('action').optional().isString(),
    query('resource').optional().isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    validate,
  ],
  async (req: Request, res: Response) => {
    const csv = await auditService.exportAuditLogs({
      userId: req.query['userId'] as string,
      action: req.query['action'] as string,
      resource: req.query['resource'] as string,
      startDate: req.query['startDate'] ? new Date(req.query['startDate'] as string) : undefined,
      endDate: req.query['endDate'] ? new Date(req.query['endDate'] as string) : undefined,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);
    res.send(csv);
  }
);

/**
 * @swagger
 * /audit/security/suspicious:
 *   get:
 *     summary: Detect suspicious activity
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: threshold
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: timeWindowMinutes
 *         schema:
 *           type: integer
 *           default: 5
 *     responses:
 *       200:
 *         description: Suspicious activity report
 */
router.get(
  '/security/suspicious',
  requirePermission('VIEW_SECURITY_LOGS'),
  [
    query('threshold').optional().isInt({ min: 1 }),
    query('timeWindowMinutes').optional().isInt({ min: 1 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const result = await auditService.detectSuspiciousActivity({
      threshold: req.query['threshold'] ? Number(req.query['threshold']) : undefined,
      timeWindowMinutes: req.query['timeWindowMinutes'] ? Number(req.query['timeWindowMinutes']) : undefined,
    });

    res.json({ success: true, data: result });
  }
);

/**
 * @swagger
 * /audit/compliance/report:
 *   get:
 *     summary: Get compliance report
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Compliance report
 */
router.get(
  '/compliance/report',
  requirePermission('VIEW_COMPLIANCE_REPORTS'),
  [
    query('startDate').isISO8601(),
    query('endDate').isISO8601(),
    validate,
  ],
  async (req: Request, res: Response) => {
    const report = await auditService.getComplianceReport({
      startDate: new Date(req.query['startDate'] as string),
      endDate: new Date(req.query['endDate'] as string),
    });

    res.json({ success: true, data: report });
  }
);

/**
 * @swagger
 * /audit/cleanup:
 *   post:
 *     summary: Clean up old audit logs
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               retentionDays:
 *                 type: integer
 *                 default: 365
 *     responses:
 *       200:
 *         description: Cleanup completed
 */
router.post(
  '/cleanup',
  requirePermission('MANAGE_AUDIT_LOGS'),
  async (req: Request, res: Response) => {
    const result = await auditService.cleanupOldLogs(
      req.body.retentionDays ?? 365
    );

    res.json({ 
      success: true, 
      message: 'Old audit logs cleaned up', 
      data: result 
    });
  }
);

export default router;