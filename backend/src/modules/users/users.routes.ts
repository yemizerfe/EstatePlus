import { Router, Request, Response } from 'express';
import { body, query } from 'express-validator';
import multer from 'multer';

import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { AuthenticatedRequest } from '../../shared/types';
import { ValidationError } from '../../shared/utils/errors';
import { sendSuccess } from '../../shared/utils/response';
import * as usersService from './users.service';

const router = Router();

router.use(authenticate);

// ─── Own account ────────────────────────────────────────────────────────────
// NOTE: declared before the admin '/:id' routes below so "me" is never
// captured as an :id parameter.

// Get own profile
router.get('/me', async (req: Request, res: Response) => {
  const user = await usersService.getMe((req as AuthenticatedRequest).user.sub);
  sendSuccess(res, user);
});

// Update own profile
router.patch(
  '/me',
  [
    body('firstName').optional().trim().isLength({ min: 1, max: 100 }),
    body('lastName').optional().trim().isLength({ min: 1, max: 100 }),
    body('profilePicture')
      .optional({ nullable: true })
      .custom(
        (v) => v === null || (typeof v === 'string' && v.startsWith('data:image/') && v.length <= 3_000_000),
      )
      .withMessage('profilePicture must be a data:image URL up to ~3MB, or null'),
    validate,
  ],
  async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user.sub;
    const user = await usersService.updateMe(userId, req.body as Parameters<typeof usersService.updateMe>[1]);
    sendSuccess(res, user, 200, 'Profile updated');
  },
);

// Upload own avatar — stored inline as a data URL, no external storage needed
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

router.post(
  '/me/avatar',
  avatarUpload.single('avatar'),
  async (req: Request, res: Response) => {
    if (!req.file) throw new ValidationError('No image uploaded');
    const userId = (req as AuthenticatedRequest).user.sub;
    const result = await usersService.setAvatar(userId, req.file);
    sendSuccess(res, result, 200, 'Avatar updated');
  },
);

// ─── Saved properties (own) ───────────────────────────────────────
// NOTE: declared before the admin '/:id' routes below so
// "saved-properties" is never captured as an :id parameter.

// List the signed-in user's saved properties
router.get('/saved-properties', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user.sub;
  const saved = await usersService.listSavedProperties(userId);
  sendSuccess(res, saved);
});

// Save a property for the signed-in user (creates or updates the snapshot)
router.post(
  '/saved-properties',
  [
    body('propertyId').isString().trim().notEmpty().withMessage('propertyId is required'),
    body('title').trim().isLength({ min: 1, max: 255 }),
    body('neighborhood').trim().isLength({ min: 1, max: 150 }),
    body('image').optional().isString(),
    body('price').isFloat({ min: 0 }),
    body('size').optional({ nullable: true }).isFloat({ min: 0 }),
    body('beds').optional().isInt({ min: 0 }),
    body('baths').optional().isInt({ min: 0 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user.sub;
    const saved = await usersService.saveProperty(userId, req.body as usersService.SavePropertyDto);
    sendSuccess(res, saved, 201, 'Property saved');
  },
);

// Remove a property from the signed-in user's saved list
router.delete('/saved-properties/:propertyId', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user.sub;
  await usersService.removeSavedProperty(userId, req.params['propertyId']!);
  sendSuccess(res, null, 200, 'Property removed from saved');
});

// Admin: list all users
router.get(
  '/',
  authorize('admin'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('role').optional().isIn(['admin', 'analyst', 'user']),
    query('search').optional().isString(),
    validate,
  ],
  async (req: Request, res: Response) => {
    const result = await usersService.listUsers({
      page: Number(req.query['page']) || 1,
      limit: Number(req.query['limit']) || 20,
      role: req.query['role'] as 'admin' | 'analyst' | 'user' | undefined,
      search: req.query['search'] as string | undefined,
    });
    sendSuccess(res, result.users, 200, undefined, result.meta);
  },
);

// Admin: get user by ID
router.get('/:id', authorize('admin'), async (req: Request, res: Response) => {
  const user = await usersService.getUserById(req.params['id']!);
  sendSuccess(res, user);
});

// Admin: update user role/status
router.patch(
  '/:id',
  authorize('admin'),
  [
    body('role').optional().isIn(['admin', 'analyst', 'user']),
    body('isActive').optional().isBoolean(),
    body('firstName').optional().trim().isLength({ min: 1, max: 100 }),
    body('lastName').optional().trim().isLength({ min: 1, max: 100 }),
    validate,
  ],
  async (req: Request, res: Response) => {
    const user = await usersService.updateUser(req.params['id']!, req.body as Parameters<typeof usersService.updateUser>[1]);
    sendSuccess(res, user, 200, 'User updated');
  },
);

// Email changes are disabled in the app.
router.patch(
  '/me/email',
  [body('email').isEmail().normalizeEmail(), body('currentPassword').notEmpty(), validate],
  async (_req: Request, _res: Response) => {
    throw new Error('Email changes are disabled.');
  },
);

// Change own password
router.post(
  '/me/change-password',
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
    validate,
  ],
  async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user.sub;
    await usersService.changePassword(userId, req.body.currentPassword as string, req.body.newPassword as string);
    sendSuccess(res, null, 200, 'Password changed successfully');
  },
);

// Admin: deactivate user
router.delete('/:id', authorize('admin'), async (req: Request, res: Response) => {
  await usersService.deleteUser(req.params['id']!);
  sendSuccess(res, null, 200, 'User deactivated');
});

export default router;
