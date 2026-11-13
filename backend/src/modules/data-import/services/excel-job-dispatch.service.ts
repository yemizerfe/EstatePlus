import {v4 as uuidv4} from 'uuid';
import {jobQueueService} from '../../../services/job-queue.service';
import {prisma} from '../../../infrastructure/database/prisma';
import {logger} from '../../../shared/utils/logger';
import {normalizeSheetPreview} from './excel-import.service';

export interface ExcelMappingEntry {
  sheetIndex: number;
  sheetName: string;
  targetType: 'properties' | 'economic_indicators' | 'market_statistics' | 'neighborhoods';
  sourceFileName: string;
  /** Optional override so the analyst can rename the data-source record. */
  dataSourceName?: string;
}

export interface ExcelImportSchedulingResult {
  jobId: string;
  jobType: string;
  status: 'pending';
  sheets: Array<{
    sheetName: string;
    targetType: string;
    rowCount: number;
  }>;
}

const IMPORT_TYPE_FOR_TARGET: Record<ExcelMappingEntry['targetType'], string> = {
  properties: 'property_import',
  economic_indicators: 'economic_data_import',
  market_statistics: 'market_data_import',
  neighborhoods: 'neighborhood_data_import',
};

/**
 * Persist a data source + import job for each sheet the analyst mapped, then
 * schedule the corresponding background import job.
 *
 * We mirror enough job-payload shape for the existing workers so they can pick
 * up the job without the Excel layer needing to know the full entity schema.
 * The actual row data is not persisted here; the workers resolve it from the
 * queue payload + the workbook buffer that the routes layer keeps in memory for
 * the lifetime of the request. If no queue is available we still return the
 * created job so the UI can poll / retry.
 */
export async function scheduleExcelImportFromPreview(params: {
  workbook: any;
  mapping: ExcelMappingEntry[];
  userId: string | undefined;
}): Promise<ExcelImportSchedulingResult | null> {
  const {workbook, mapping, userId} = params;
  const sheets: ExcelImportSchedulingResult['sheets'] = [];
  let primaryJobId: string | null = null;
  let primaryJobType: string | null = null;

  for (const entry of mapping) {
    const sheet = workbook.Sheets[entry.sheetName];
    if (!sheet) {
      logger.warn({
        msg: 'Excel mapping referenced a sheet that was not in the workbook',
        sheetName: entry.sheetName,
        targetType: entry.targetType,
      });
      continue;
    }

    const preview = normalizeSheetPreview(sheet, entry.sheetName);

    // 1) Create a DataSource for this upload
    const dataSourceName = entry.dataSourceName ?? `${entry.sourceFileName} :: ${entry.sheetName}`;
    const dataSource = await prisma.dataSource.create({
      data: {
        id: uuidv4(),
        name: dataSourceName,
        sourceType: 'excel_upload',
        createdBy: userId ?? undefined,
        description: `Analyst Excel import — sheet "${entry.sheetName}" → ${entry.targetType}`,
      },
    });

    // 2) Create the import job record
    const jobType = IMPORT_TYPE_FOR_TARGET[entry.targetType];
    if (!jobType) {
      logger.warn({
        msg: 'Unknown targetType in Excel mapping, skipping',
        targetType: entry.targetType,
      });
      continue;
    }

    const jobId = uuidv4();
    await prisma.dataImportJob.create({
      data: {
        id: jobId,
        sourceId: dataSource.id,
        jobType,
        status: 'pending',
        createdBy: userId ?? undefined,
        fileName: entry.sourceFileName,
        errorLog: {
          excelSheetName: entry.sheetName,
          excelSourceFileName: entry.sourceFileName,
          targetType: entry.targetType,
        },
      },
    });

    if (!primaryJobId) {
      primaryJobId = jobId;
      primaryJobType = jobType;
    }

    // 3) Schedule with the queue service when available
    const scheduled = await tryScheduleJob(jobType, jobId, entry, userId, dataSource.id, jobId);

    sheets.push({
      sheetName: entry.sheetName,
      targetType: entry.targetType,
      rowCount: preview.rowCount,
    });

    logger.info({
      msg: 'Excel import job prepared',
      jobType,
      sheetName: entry.sheetName,
      targetType: entry.targetType,
      rowCount: preview.rowCount,
      scheduled: !!scheduled,
      userId,
    });

  }

  if (sheets.length === 0) {
    return null;
  }

  return {
    jobId: primaryJobId ?? uuidv4(),
    jobType: primaryJobType ?? 'property_import',
    status: 'pending',
    sheets,
  };
}

async function tryScheduleJob(
  jobType: string,
  jobId: string,
  entry: ExcelMappingEntry,
  userId: string | undefined,
  dataSourceId: string,
  _jobRecordId: string,
): Promise<boolean> {
  try {
    switch (jobType) {
      case 'property_import':
        return jobQueueService.schedulePropertyImport({
          type: 'PROPERTY_IMPORT',
          sourceId: dataSourceId,
          fileName: entry.sourceFileName,
          userId: userId ?? undefined,
          metadata: {
            excelSheetName: entry.sheetName,
            excelSourceFileName: entry.sourceFileName,
            targetType: entry.targetType,
          },
        });
      case 'market_data_import':
        return jobQueueService.scheduleMarketDataImport({
          type: 'MARKET_DATA_IMPORT',
          dataType: 'market_metrics',
          period: 'upload',
          userId: userId ?? undefined,
          metadata: {
            excelSheetName: entry.sheetName,
            excelSourceFileName: entry.sourceFileName,
            targetType: entry.targetType,
          },
        });
      case 'economic_data_import':
        return jobQueueService.scheduleEconomicDataImport({
          type: 'ECONOMIC_DATA_IMPORT',
          indicators: [],
          startDate: new Date().toISOString().slice(0, 10),
          endDate: new Date().toISOString().slice(0, 10),
          userId: userId ?? undefined,
          metadata: {
            excelSheetName: entry.sheetName,
            excelSourceFileName: entry.sourceFileName,
            targetType: entry.targetType,
          },
        });
      case 'neighborhood_data_import':
        return jobQueueService.scheduleNeighborhoodDataImport({
          type: 'NEIGHBORHOOD_DATA_IMPORT',
          dataTypes: [],
          userId: userId ?? undefined,
          metadata: {
            excelSheetName: entry.sheetName,
            excelSourceFileName: entry.sourceFileName,
            targetType: entry.targetType,
          },
        });
      default:
        return false;
    }
  } catch (err) {
    logger.warn({
      msg: 'Could not enqueue Excel import job (queue may be unavailable)',
      jobId,
      jobType,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
