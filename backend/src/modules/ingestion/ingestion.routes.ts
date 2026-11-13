import { Router, Request, Response } from 'express';
import multer from 'multer';

import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { AuthenticatedRequest } from '../../shared/types';
import { ValidationError } from '../../shared/utils/errors';
import { sendSuccess, sendCreated } from '../../shared/utils/response';
import * as ingestionService from './ingestion.service';

const router = Router();
router.use(authenticate, authorize('admin', 'analyst'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.match(/\.(csv|json)$/i)) {
      cb(new ValidationError('Only CSV and JSON files are accepted'));
      return;
    }
    cb(null, true);
  },
});

const handleUpload = async (req: Request, res: Response) => {
  if (!req.file) throw new ValidationError('No file uploaded');
  const auth = req as AuthenticatedRequest;
  const importType = (req.body.importType as 'properties' | 'economics') ?? 'properties';

  const result = await ingestionService.initiateImport(
    req.file.buffer,
    req.file.originalname,
    auth.user.sub,
    importType,
  );
  sendCreated(res, result, 'Import job queued');
};

router.post('/upload', upload.single('file'), handleUpload);
// `/import` is the path the upload screens have always posted to.
router.post('/import', upload.single('file'), handleUpload);

router.get('/', async (req: Request, res: Response) => {
  const auth = req as AuthenticatedRequest;
  const jobs = await ingestionService.listImportJobs(auth.user.sub, auth.user.role);
  sendSuccess(res, jobs);
});

router.get('/:id', async (req: Request, res: Response) => {
  const job = await ingestionService.getImportJob(req.params['id']!);
  sendSuccess(res, job);
});

export default router;
