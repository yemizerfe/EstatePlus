import express from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { auditLog } from '../../middleware/auditLog';
import { prisma } from '../../infrastructure/database/prisma';
import { logger } from '../../shared/utils/logger';
import { ValidationError } from '../../shared/utils/errors';
import { sendCreated } from '../../shared/utils/response';
import { AuthenticatedRequest } from '../../shared/types';
import { jobQueueService } from '../../services/job-queue.service';

import { parseExcelWorkbook, ExcelSheetPreview, detectImportProfile, ProfileMatch } from './services/excel-import.service';
import { scheduleExcelImportFromPreview } from './services/excel-job-dispatch.service';

const router = express.Router();

// ----- Excel upload fetch/config (no auth) -----

router.get('/excel/upload-config', (_req, res) => {
  res.json({
    maxSizeMB: 10,
    acceptedMimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
    acceptedExtensions: ['.xlsx', '.xls'],
    profileHints: [
      { key: 'properties', label: 'Properties / listings', description: 'One row per property, columns like title, propertyType, price, neighborhood, sizeSqm...' },
      { key: 'economic_indicators', label: 'Economic indicators', description: 'One row per observation, columns like indicatorType, value, date/period, source...' },
      { key: 'market_statistics', label: 'Market statistics', description: 'One row per neighborhood+propertyType+period, columns like neighborhood, propertyType, period, averagePrice...' },
      { key: 'neighborhoods', label: 'Neighborhoods / amenities', description: 'One row per neighborhood or amenity, columns like neighborhoodName, dataType, amenityType...' },
    ],
  });
});

// Data import and job management endpoints.
router.post('/jobs', authenticate, requirePermission('IMPORT_DATA'), auditLog('CREATE', 'data_import_job'), async (req, res) => {
  const reqWithUser = req as AuthenticatedRequest & { user?: { id?: string } };
  try {
    const { type, payload } = req.body;
    const userId = reqWithUser.user?.id;

    let jobScheduled = false;

    const schedule = async () => {
      switch (type) {
        case 'property_import':
          return jobQueueService.schedulePropertyImport({ ...payload, userId });
        case 'market_data_import':
          return jobQueueService.scheduleMarketDataImport({ ...payload, userId });
        case 'economic_data_import':
          return jobQueueService.scheduleEconomicDataImport({ ...payload, userId });
        case 'neighborhood_data_import':
          return jobQueueService.scheduleNeighborhoodDataImport({ ...payload, userId });
        case 'image_processing':
          return jobQueueService.scheduleImageProcessing({ ...payload, userId });
        case 'data_validation':
          return jobQueueService.scheduleDataValidation({ ...payload, userId });
        case 'bulk_operation':
          return jobQueueService.scheduleBulkOperation({ ...payload, userId });
        default:
          throw new ValidationError(`Unsupported job type: ${type}`);
      }
    };

    jobScheduled = await schedule();

    if (!jobScheduled) {
      return res.status(503).json({ success: false, message: 'Queue service unavailable' });
    }

    return res.status(201).json({ success: true, message: 'Job scheduled successfully', data: { type, scheduled: true } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to schedule job';
    logger.error({ msg: 'Failed to schedule job', error });
    return res.status(400).json({ success: false, message });
  }
});router.get('/jobs', authenticate, requirePermission('VIEW_IMPORT_JOBS'), async (req, res) => {
  try {
    const reqWithUser = req as AuthenticatedRequest & { query?: { status?: string; type?: string; page?: string; limit?: string } };
    const status = reqWithUser.query?.status;
    const type = reqWithUser.query?.type;
    const page = Number(reqWithUser.query?.page ?? 1);
    const limit = Number(reqWithUser.query?.limit ?? 20);
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.jobType = type;

    const [jobs, total] = await Promise.all([
      prisma.dataImportJob.findMany({
        where,
        include: {
          creator: { select: { id: true, firstName: true, lastName: true, email: true } },
          source: { select: { id: true, name: true, sourceType: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.dataImportJob.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        jobs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error({ msg: 'Failed to get job history', error });
    res.status(500).json({ success: false, message: 'Failed to retrieve job history' });
  }});
router.get('/jobs/:jobId', authenticate, requirePermission('VIEW_IMPORT_JOBS'), async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.dataImportJob.findUnique({
      where: { id: jobId },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true, email: true } },
        source: { select: { id: true, name: true, sourceType: true } },
      },
    });

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    return res.json({ success: true, data: job });
  } catch (error) {
    logger.error({ msg: 'Failed to get job details', jobId: req.params.jobId, error });
    return res.status(500).json({ success: false, message: 'Failed to retrieve job details' });
  }
});


router.get('/queue-health', authenticate, requirePermission('VIEW_SYSTEM_STATUS'), async (_req, res) => {
  try {
    const health = await jobQueueService.getQueueHealth();
    res.json({ success: true, data: health });
  } catch (error) {
    logger.error({ msg: 'Failed to get queue health', error });
    res.status(500).json({ success: false, message: 'Failed to retrieve queue health' });    }
});

router.get('/statistics', authenticate, requirePermission('VIEW_IMPORT_JOBS'), async (_req, res) => {
  try {
    const statistics = await jobQueueService.getJobStatistics();
    res.json({ success: true, data: statistics });
  } catch (error) {
    logger.error({ msg: 'Failed to get job statistics', error });
    res.status(500).json({ success: false, message: 'Failed to retrieve job statistics' });    }
});

router.post('/validate', authenticate, requirePermission('VALIDATE_DATA'), auditLog('CREATE', 'data_validation'), async (req, res) => {
  const reqWithUser = req as AuthenticatedRequest & { user?: { id?: string } };
  try {
    const { dataType, recordIds = [], rules = [] } = req.body;
    const userId = reqWithUser.user?.id;

    const jobScheduled = await jobQueueService.scheduleDataValidation({
      type: 'DATA_VALIDATION',
      dataType,
      recordIds,
      rules,
      userId,
    });

    if (!jobScheduled) {
      return res.status(503).json({ success: false, message: 'Queue service unavailable' });
    }

    return res.json({
      success: true,
      message: 'Validation job scheduled successfully',
      data: { dataType, recordCount: recordIds.length, rules },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to schedule validation job';
    return res.status(400).json({ success: false, message });
    }
  });

// ----- Excel upload + preview + import dispatch -----

const EXCEL_UPLOAD = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ].includes(file.mimetype);
    cb(null, ok);
  },
});

router.post('/excel/upload', authenticate, requirePermission('IMPORT_EXCEL'), auditLog('CREATE', 'excel_upload_preview'), EXCEL_UPLOAD.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const file = req.file;
    if (!file.mimetype.startsWith('application/vnd.openxmlformats-officedocument') &&
        !file.mimetype.startsWith('application/vnd.ms-excel')) {
      throw new ValidationError('File must be an Excel workbook (.xlsx/.xls)');
    }

    const workbook = await parseExcelWorkbook(file.buffer);
    const sheets: ExcelSheetPreview[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const preview = normalizeSheetPreview(sheet, sheetName);
      sheets.push(preview);
    }

    const profileMatches: ProfileMatch[] = detectImportProfile(sheets);

    return res.json({
      success: true,
      data: {
        fileName: file.originalname,
        fileSize: file.size,
        sheetCount: workbook.SheetNames.length,
        sheets,
        profileMatches: profileMatches.map((m) => ({
          ...m,
          recommendedSheet: m.recommendedSheet ?? null,
        })),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Excel preview failed';
    logger.error({ msg: 'Excel upload preview failed', error });
    return res.status(400).json({ success: false, message });
  }
});




router.post('/excel/import', authenticate, requirePermission('IMPORT_EXCEL'), auditLog('CREATE', 'excel_import'), EXCEL_UPLOAD.single('file'), async (req, res) => {
  const reqWithUser = req as AuthenticatedRequest & { user?: { id?: string } };
  try {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const body = (req.body as Record<string, unknown>) ?? {};
    const mapping = body.mapping;
    if (!Array.isArray(mapping) || mapping.length === 0) {
      throw new ValidationError('mapping is required (from the preview step)');
    }

    const workbook = await parseExcelWorkbook(req.file.buffer);

    const scheduled = await scheduleExcelImportFromPreview({
      workbook,
      mapping,
      userId: reqWithUser.user?.id,
    });

    if (!scheduled) {
      return res.status(503).json({ success: false, message: 'Could not schedule the Excel import job' });
    }

    return sendCreated(res, {
      jobId: scheduled.jobId,
      jobType: scheduled.jobType,
      status: scheduled.status,
      sheets: scheduled.sheets,
    }, 'Excel import job scheduled');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Excel import scheduling failed';
    logger.error({ msg: 'Excel import scheduling failed', error });
    return res.status(400).json({ success: false, message });
  }
});



router.get('/excel/templates', authenticate, requirePermission('IMPORT_EXCEL'), async (_req, res) => {
  try {
    res.json({
    success: true,
    data: [
      {
        key: 'properties',
        label: 'Properties / Listings template',
        description: 'One row per property. Required columns: title, propertyType, price, neighborhood.',
        exampleColumns: ['title', 'description', 'propertyType', 'condition', 'price', 'sizeSqm', 'bedrooms', 'bathrooms', 'address', 'neighborhood', 'ownerId', 'images', 'amenities', 'lat', 'lng', 'yearBuilt', 'parkingSpaces', 'hasGarden', 'hasSecurity', 'hasElevator', 'floorNumber', 'totalFloors'],
      },
      {
        key: 'economic_indicators',
        label: 'Economic indicators template',
        description: 'One row per observation. Columns: indicatorType, value, dateOrPeriod, source, notes.',
        exampleColumns: ['indicatorType', 'value', 'dateOrPeriod', 'source', 'unit', 'notes'],
      },
      {
        key: 'market_statistics',
        label: 'Market statistics template',
        description: 'One row per neighborhood+propertyType+period. Columns: neighborhood, propertyType, period, averagePrice, medianPrice, pricePerSqm, salesVolume, averageDaysOnMarket.',
        exampleColumns: ['neighborhood', 'propertyType', 'period', 'averagePrice', 'medianPrice', 'pricePerSqm', 'salesVolume', 'averageDaysOnMarket', 'priceGrowthRate', 'liquidityScore', 'demandScore', 'investmentScore'],
      },
      {
        key: 'neighborhoods',
        label: 'Neighborhoods / amenities template',
        description: 'One row per neighborhood or amenity. Columns: neighborhoodName, dataType, amenityType, amenityName, amenityDistance, amenityRating, statisticType, statisticValue, statisticUnit.',
        exampleColumns: ['neighborhoodName', 'dataType', 'amenityType', 'amenityName', 'amenityDistance', 'amenityRating', 'statisticType', 'statisticValue', 'statisticUnit'],
      },
    ],
  });
  } catch (error: unknown) {
    logger.error({ msg: 'Failed to get excel templates', error });
    res.status(500).json({ success: false, message: 'Failed to retrieve excel templates' });
  }
});

// ----- Helpers -----

function normalizeSheetPreview(sheet: unknown, sheetName: string): ExcelSheetPreview {
  const rawRows = (Array.isArray(sheet) ? sheet : [])
    .map((row: unknown) => (Array.isArray(row) ? row : []));

  const headerCandidates = rawRows.length > 0 ? rawRows[0] : [];
  const headerLabels = (headerCandidates as unknown[]).map((cell: unknown) => (cell == null ? '' : String(cell).trim()))
    .map((label: string) => (label.length > 0 ? label : null))
    .filter((label: string | null): label is string => label != null);

  const dataRows = rawRows.slice(1).filter((row: unknown[]) => row.some((cell: unknown) => cell != null));

  return {
    sheetName,
    rowCount: rawRows.length,
    headerLabels,
    sampleRows: dataRows.slice(0, 5) as unknown[][],
    columnCount: headerLabels.length,
    detectedDateColumns: detectDateColumns(dataRows, headerLabels),
    detectedNumericColumns: detectNumericColumns(dataRows, headerLabels),
  };
}

function detectDateColumns(rows: unknown[][], labels: string[]): string[] {
  const out: string[] = [];
  for (let c = 0; c < labels.length; c++) {
    const samples = rows.slice(0, 200).map((r) => r[c] ?? null).filter((v) => v != null);
    if (samples.length === 0) continue;
    const hit = samples.some((v: unknown) => {
      if (v instanceof Date) return true;
      if (typeof v === 'number') {
        const d = new Date(v);
        return !isNaN(d.getTime()) && d.getFullYear() >= 1900 && d.getFullYear() <= 2100;
      }
      if (typeof v === 'string') {
        const trimmed = v.trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return true;
        if (/^\d{4}-\d{2}$/.test(trimmed)) return true;
        const ts = Date.parse(v);
        if (!isNaN(ts)) {
          const d = new Date(ts);
          return d.getFullYear() >= 1900 && d.getFullYear() <= 2100;
        }
      }
      return false;
    });
    if (hit) out.push(labels[c]);
  }
  return out;
}

function detectNumericColumns(rows: unknown[][], labels: string[]): string[] {
  const out: string[] = [];
  for (let c = 0; c < labels.length; c++) {
    const samples = rows.slice(0, 200).map((r) => r[c] ?? null).filter((v) => v != null);
    if (samples.length === 0) continue;
    const hit = samples.some((v: unknown): boolean => {
      if (typeof v === 'number') return Number.isFinite(v);
      if (typeof v === 'string') {
        const cleaned = v.replace(/[,\s]/g, '');
        if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
          const n = parseFloat(cleaned);
          return Number.isFinite(n);
        }
      }
      return false;
    });
    if (hit) out.push(labels[c]);
  }
  return out;
}

export default router;
