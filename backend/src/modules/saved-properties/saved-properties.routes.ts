import { Router, Request, Response, NextFunction } from 'express';
import { SavedPropertiesService } from './saved-properties.service';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { SavedPropertyQueryDto } from './dto/saved-properties.dto';
import { AuthenticatedRequest } from '../../shared/types';
import { body, query, param } from 'express-validator';

const router = Router();
const savedPropertiesService = new SavedPropertiesService();

// Validation schemas
const savePropertyValidation = [
  body('propertyId').isUUID().withMessage('Property ID must be a valid UUID'),
  body('notes').optional().isString().isLength({ max: 1000 }).withMessage('Notes must be a string with max 1000 characters'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('tags.*').optional().isString().isLength({ max: 50 }).withMessage('Each tag must be a string with max 50 characters')
];

const updateSavedPropertyValidation = [
  param('id').isUUID().withMessage('Saved property ID must be a valid UUID'),
  body('notes').optional().isString().isLength({ max: 1000 }).withMessage('Notes must be a string with max 1000 characters'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('tags.*').optional().isString().isLength({ max: 50 }).withMessage('Each tag must be a string with max 50 characters')
];

const queryValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('sortBy').optional().isIn(['savedAt', 'updatedAt']).withMessage('Sort by must be savedAt or updatedAt'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('Min price must be a positive number'),
  query('maxPrice').optional().isFloat({ min: 0 }).withMessage('Max price must be a positive number'),
  query('propertyType').optional().isIn(['APARTMENT', 'VILLA', 'CONDOMINIUM', 'OFFICE', 'RETAIL', 'WAREHOUSE', 'LAND']).withMessage('Invalid property type'),
  query('city').optional().isString().isLength({ max: 100 }).withMessage('City must be a string with max 100 characters'),
  query('subcity').optional().isString().isLength({ max: 100 }).withMessage('Subcity must be a string with max 100 characters'),
  query('search').optional().isString().isLength({ max: 200 }).withMessage('Search must be a string with max 200 characters')
];

const bulkRemoveValidation = [
  body('savedPropertyIds').isArray({ min: 1 }).withMessage('savedPropertyIds must be a non-empty array'),
  body('savedPropertyIds.*').isUUID().withMessage('Each saved property ID must be a valid UUID')
];

const bulkTagsValidation = [
  body('savedPropertyIds').isArray({ min: 1 }).withMessage('savedPropertyIds must be a non-empty array'),
  body('savedPropertyIds.*').isUUID().withMessage('Each saved property ID must be a valid UUID'),
  body('tags').isArray({ min: 1 }).withMessage('tags must be a non-empty array'),
  body('tags.*').isString().isLength({ max: 50 }).withMessage('Each tag must be a string with max 50 characters')
];

/**
 * @swagger
 * /api/saved-properties:
 *   post:
 *     summary: Save a property to user's favorites
 *     tags: [Saved Properties]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - propertyId
 *             properties:
 *               propertyId:
 *                 type: string
 *                 format: uuid
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                   maxLength: 50
 *     responses:
 *       201:
 *         description: Property saved successfully
 *       400:
 *         description: Property already saved or invalid data
 *       404:
 *         description: Property not found
 */
router.post('/', authenticate, savePropertyValidation, validate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await savedPropertiesService.saveProperty((req as AuthenticatedRequest).user.id, req.body);
    res.status(201).json({
      success: true,
      data: result,
      message: 'Property saved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/saved-properties:
 *   get:
 *     summary: Get user's saved properties
 *     tags: [Saved Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [savedAt, updatedAt]
 *           default: savedAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 200
 *       - in: query
 *         name: tags
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *       - in: query
 *         name: propertyType
 *         schema:
 *           type: string
 *           enum: [APARTMENT, VILLA, CONDOMINIUM, OFFICE, RETAIL, WAREHOUSE, LAND]
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *       - in: query
 *         name: subcity
 *         schema:
 *           type: string
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *           minimum: 0
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *           minimum: 0
 *     responses:
 *       200:
 *         description: Saved properties retrieved successfully
 */
router.get('/', authenticate, queryValidation, validate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Parse tags from query string
    const query = {
      ...req.query,
      tags: req.query.tags ? (Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags]) : undefined
    };
    
    const result = await savedPropertiesService.getSavedProperties((req as AuthenticatedRequest).user.id, query as SavedPropertyQueryDto);
    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/saved-properties/summary:
 *   get:
 *     summary: Get saved properties summary and statistics
 *     tags: [Saved Properties]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Summary retrieved successfully
 */
router.get('/summary', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await savedPropertiesService.getSavedPropertiesSummary((req as AuthenticatedRequest).user.id);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/saved-properties/check/{propertyId}:
 *   get:
 *     summary: Check if property is saved by user
 *     tags: [Saved Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Check result returned
 */
router.get('/check/:propertyId', authenticate, [
  param('propertyId').isUUID().withMessage('Property ID must be a valid UUID')
], validate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await savedPropertiesService.isPropertySaved((req as AuthenticatedRequest).user.id, req.params.propertyId);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/saved-properties/{id}:
 *   put:
 *     summary: Update saved property notes and tags
 *     tags: [Saved Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                   maxLength: 50
 *     responses:
 *       200:
 *         description: Saved property updated successfully
 *       404:
 *         description: Saved property not found
 */
router.put('/:id', authenticate, updateSavedPropertyValidation, validate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await savedPropertiesService.updateSavedProperty((req as AuthenticatedRequest).user.id, req.params.id, req.body);
    res.json({
      success: true,
      data: result,
      message: 'Saved property updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/saved-properties/{id}:
 *   delete:
 *     summary: Remove property from saved list
 *     tags: [Saved Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Property removed from saved list
 *       404:
 *         description: Saved property not found
 */
router.delete('/:id', authenticate, [
  param('id').isUUID().withMessage('Saved property ID must be a valid UUID')
], validate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await savedPropertiesService.removeSavedProperty((req as AuthenticatedRequest).user.id, req.params.id);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/saved-properties/bulk/remove:
 *   delete:
 *     summary: Bulk remove saved properties
 *     tags: [Saved Properties]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - savedPropertyIds
 *             properties:
 *               savedPropertyIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 minItems: 1
 *     responses:
 *       200:
 *         description: Properties removed successfully
 */
router.delete('/bulk/remove', authenticate, bulkRemoveValidation, validate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await savedPropertiesService.bulkRemoveSavedProperties((req as AuthenticatedRequest).user.id, req.body.savedPropertyIds);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/saved-properties/bulk/tags:
 *   put:
 *     summary: Bulk add tags to saved properties
 *     tags: [Saved Properties]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - savedPropertyIds
 *               - tags
 *             properties:
 *               savedPropertyIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 minItems: 1
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                   maxLength: 50
 *                 minItems: 1
 *     responses:
 *       200:
 *         description: Tags added successfully
 */
router.put('/bulk/tags', authenticate, bulkTagsValidation, validate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await savedPropertiesService.bulkUpdateTags((req as AuthenticatedRequest).user.id, req.body.savedPropertyIds, req.body.tags);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

export default router;