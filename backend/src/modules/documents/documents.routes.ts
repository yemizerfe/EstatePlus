import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import multer from 'multer';

import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { AuthenticatedRequest } from '../../shared/types';
import { ValidationError } from '../../shared/utils/errors';
import { sendSuccess } from '../../shared/utils/response';
import { documentService } from './documents.service';

const router = Router();
router.use(authenticate);

/** Enforced in-process; nothing is written to disk. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.get('/', async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  sendSuccess(res, await documentService.listForUser(user.sub, user.role));
});

router.post(
  '/',
  upload.single('file'),
  [
    body('category').optional().trim().isLength({ max: 60 }),
    body('name').optional().trim().isLength({ max: 255 }),
    body('propertyId').optional({ nullable: true }).isUUID(),
    validate,
  ],
  async (req: Request, res: Response) => {
    if (!req.file) throw new ValidationError('Attach a file to upload');
    const user = (req as AuthenticatedRequest).user;
    const document = await documentService.upload(user.sub, user.role, {
      file: req.file,
      category: typeof req.body.category === 'string' ? req.body.category : 'Other',
      name: typeof req.body.name === 'string' ? req.body.name : undefined,
      propertyId: typeof req.body.propertyId === 'string' && req.body.propertyId ? req.body.propertyId : undefined,
    });
    sendSuccess(res, document, 201, 'Document uploaded');
  },
);

/** `?inline=1` renders in the browser instead of downloading. */
router.get('/:id/download', async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const file = await documentService.readFile(user.sub, user.role, req.params['id']!);
  const disposition = req.query['inline'] === '1' ? 'inline' : 'attachment';
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Length', String(file.data.length));
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${encodeURIComponent(file.name)}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
  );
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(file.data);
});

router.delete('/:id', async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const result = await documentService.remove(user.sub, user.role, req.params['id']!);
  sendSuccess(res, result, 200, 'Document deleted');
});

export default router;
