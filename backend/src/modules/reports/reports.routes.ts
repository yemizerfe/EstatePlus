import { Router, Request, Response } from 'express';
import { body, query } from 'express-validator';

import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { auditLog, AuditActions } from '../../middleware/auditLog';
import { AuthenticatedRequest } from '../../shared/types';
import { sendSuccess, sendCreated } from '../../shared/utils/response';
import * as reportsService from './reports.service';

const router = Router();

/**
 * Get all reports with filters
 * GET /api/v1/reports
 */
router.get('/', [
  authenticate,
  requirePermission('reports:read'),
  query('authorId').optional().isUUID(),
  query('period').optional().isString(),
  query('neighborhood').optional().isUUID(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sortBy').optional().isIn(['generatedAt', 'updatedAt', 'title']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
  validate
], async (req: Request, res: Response): Promise<void> => {
  const filters = {
    authorId: req.query.authorId as string,
    period: req.query.period as string,
    neighborhood: req.query.neighborhood as string,
    page: req.query.page ? Number(req.query.page as string) : 1,
    limit: req.query.limit ? Number(req.query.limit as string) : 20,
    sortBy: req.query.sortBy as string,
    sortOrder: req.query.sortOrder as 'asc' | 'desc'
  };

  const result = await reportsService.getReports(filters);
  sendSuccess(res, result);
});

/**
 * Create a new report
 * POST /api/v1/reports
 */
router.post('/', [
  authenticate,
  requirePermission('reports:create'),
  body('title').notEmpty().isLength({ max: 255 }),
  body('description').optional().isLength({ max: 1000 }),
  body('period').optional().matches(/^\d{4}-\d{2}$/),
  body('neighborhoodIds').optional().isArray(),
  body('neighborhoodIds.*').optional().isUUID(),
  body('analysis').optional().isLength({ max: 10000 }),
  body('conclusions').optional().isLength({ max: 5000 }),
  validate,
  auditLog(AuditActions.REPORT_GENERATED, 'report')
], async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthenticatedRequest).user.sub;
  const report = await reportsService.createReport(req.body, userId);
  sendCreated(res, report, 'Report created successfully');
});

/**
 * Get specific report by ID
 * GET /api/v1/reports/:id
 */
router.get('/:id', [
  authenticate,
  requirePermission('reports:read'),
  validate
], async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthenticatedRequest).user.sub;
  const report = await reportsService.getReportById(req.params.id, userId);
  sendSuccess(res, report);
});

/**
 * Update a report
 * PUT /api/v1/reports/:id
 */
router.put('/:id', [
  authenticate,
  requirePermission('reports:update'),
  body('title').optional().notEmpty().isLength({ max: 255 }),
  body('description').optional().isLength({ max: 1000 }),
  body('analysis').optional().isLength({ max: 10000 }),
  body('conclusions').optional().isLength({ max: 5000 }),
  validate,
  auditLog('REPORT_UPDATED', 'report')
], async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthenticatedRequest).user.sub;
  const report = await reportsService.updateReport(req.params.id, req.body, userId);
  sendSuccess(res, report, 'Report updated successfully');
});

/**
 * Delete a report
 * DELETE /api/v1/reports/:id
 */
router.delete('/:id', [
  authenticate,
  requirePermission('reports:update'),
  auditLog('REPORT_DELETED', 'report')
], async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthenticatedRequest).user.sub;
  await reportsService.deleteReport(req.params.id, userId);
  sendSuccess(res, null, 'Report deleted successfully');
});

/**
 * Get reports by author
 * GET /api/v1/reports/author/:authorId
 */
router.get('/author/:authorId', [
  authenticate,
  requirePermission('reports:read'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validate
], async (req: Request, res: Response): Promise<void> => {
  const authorId = req.params.authorId;
  const currentUserId = (req as AuthenticatedRequest).user.sub;
  const userRole = (req as AuthenticatedRequest).user.role;
  
  // Analysts can only see their own reports (unless admin)
  if (userRole === 'analyst' && authorId !== currentUserId) {
    res.status(403).json({ success: false, message: 'Access denied' });
    return;
  }

  const filters = {
    page: req.query.page ? Number(req.query.page as string) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 20
  };

  const result = await reportsService.getReportsByAuthor(authorId, filters);
  sendSuccess(res, result);
});

export default router;