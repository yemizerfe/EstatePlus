import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';

import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { AuthenticatedRequest } from '../../shared/types';
import * as scenariosService from './scenarios.service';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /scenarios:
 *   get:
 *     summary: List scenarios
 *     tags: [Scenarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [economic_shock, market_shift, policy_change, local_development, infrastructure, demographic_change]
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
 *         description: List of scenarios
 */
router.get(
  '/',
  [
    query('type').optional().isIn(['economic_shock', 'market_shift', 'policy_change', 'local_development', 'infrastructure', 'demographic_change']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const auth = req as AuthenticatedRequest;
    const [scenarios, total] = await scenariosService.listScenarios(
      auth.user.sub,
      auth.user.role,
      {
        type: req.query['type'] as any,
        page: req.query['page'] ? Number(req.query['page']) : 1,
        limit: req.query['limit'] ? Number(req.query['limit']) : 20,
      }
    );
    res.json({
      success: true,
      data: scenarios,
      pagination: { page: req.query['page'] ? Number(req.query['page']) : 1, limit: req.query['limit'] ? Number(req.query['limit']) : 20, total },
    });
  }
);

/**
 * @swagger
 * /scenarios:
 *   post:
 *     summary: Create a new scenario
 *     tags: [Scenarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [economic_shock, market_shift, policy_change, local_development, infrastructure, demographic_change]
 *               parameters:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     indicator:
 *                       type: string
 *                     changePct:
 *                       type: number
 *                     changeType:
 *                       type: string
 *                       enum: [increase, decrease]
 *                     weight:
 *                       type: number
 *             required:
 *               - name
 *               - parameters
 *     responses:
 *       201:
 *         description: Scenario created
 */
router.post(
  '/',
  [
    body('name').trim().isLength({ min: 1, max: 255 }),
    body('description').optional().isString(),
    body('type').optional().isIn(['economic_shock', 'market_shift', 'policy_change', 'local_development', 'infrastructure', 'demographic_change']),
    body('parameters').isArray({ min: 1, max: 10 }),
    body('parameters.*.indicator').isString(),
    body('parameters.*.changePct').isFloat({ min: 0, max: 100 }),
    body('parameters.*.changeType').isIn(['increase', 'decrease']),
    body('parameters.*.weight').optional().isFloat({ min: 0.1, max: 5 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const auth = req as AuthenticatedRequest;
    const scenario = await scenariosService.createScenario(
      req.body as any,
      auth.user.sub,
    );
    res.status(201).json({ success: true, data: scenario, message: 'Scenario created' });
  }
);

/**
 * @swagger
 * /scenarios/{id}:
 *   get:
 *     summary: Get scenario details with results
 *     tags: [Scenarios]
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
 *         description: Scenario details
 */
router.get(
  '/:id',
  [param('id').isUUID(), validate],
  async (req: Request, res: Response) => {
    const scenario = await scenariosService.getScenario(req.params['id']!);
    res.json({ success: true, data: scenario });
  }
);

/**
 * @swagger
 * /scenarios/{id}:
 *   delete:
 *     summary: Delete a scenario
 *     tags: [Scenarios]
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
 *         description: Scenario deleted
 */
router.delete(
  '/:id',
  [param('id').isUUID(), validate],
  async (req: Request, res: Response) => {
    const auth = req as AuthenticatedRequest;
    await scenariosService.deleteScenario(
      req.params['id']!,
      auth.user.sub,
      auth.user.role
    );
    res.json({ success: true, message: 'Scenario deleted' });
  }
);

/**
 * @swagger
 * /scenarios/{id}/run:
 *   post:
 *     summary: Run a scenario analysis
 *     tags: [Scenarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: neighborhoodId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Scenario results with advanced analysis
 */
router.post(
  '/:id/run',
  [param('id').isUUID(), query('neighborhoodId').optional().isUUID(), validate],
  async (req: Request, res: Response) => {
    const result = await scenariosService.runScenario(
      req.params['id']!,
      req.query['neighborhoodId'] as string | undefined,
    );
    res.json({ success: true, data: result });
  }
);

/**
 * @swagger
 * /scenarios/compare:
 *   get:
 *     summary: Compare multiple scenarios
 *     tags: [Scenarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: ids
 *         required: true
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *     responses:
 *       200:
 *         description: Scenario comparison
 */
router.get(
  '/compare',
  [query('ids').isArray({ min: 2 }), validate],
  async (req: Request, res: Response) => {
    const results = await scenariosService.compareScenarios(
      req.query['ids'] as string[]
    );
    res.json({ success: true, data: results });
  }
);

/**
 * @swagger
 * /scenarios/type/{type}:
 *   get:
 *     summary: Get scenarios by type
 *     tags: [Scenarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [economic_shock, market_shift, policy_change, local_development, infrastructure, demographic_change]
 *     responses:
 *       200:
 *         description: Scenarios of specified type
 */
router.get(
  '/type/:type',
  [param('type').isIn(['economic_shock', 'market_shift', 'policy_change', 'local_development', 'infrastructure', 'demographic_change']), validate],
  async (req: Request, res: Response) => {
    const auth = req as AuthenticatedRequest;
    const scenarios = await scenariosService.getScenariosByType(
      req.params['type'] as any,
      auth.user.sub,
      auth.user.role
    );
    res.json({ success: true, data: scenarios });
  }
);

/**
 * @swagger
 * /scenarios/neighborhood/{neighborhoodId}/impact:
 *   get:
 *     summary: Get neighborhood impact summary
 *     tags: [Scenarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: neighborhoodId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Neighborhood impact summary
 */
router.get(
  '/neighborhood/:neighborhoodId/impact',
  [param('neighborhoodId').isUUID(), validate],
  async (req: Request, res: Response) => {
    const impact = await scenariosService.getNeighborhoodImpact(
      req.params['neighborhoodId']!
    );
    res.json({ success: true, data: impact });
  }
);

export default router;