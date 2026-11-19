import {v4 as uuidv4} from 'uuid';
import * as XLSX from 'xlsx';
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
 * The uploaded sheet rows are persisted with their data source so workers can
 * process them without depending on the request process or local file storage.
 */
export async function scheduleExcelImportFromPreview(params: {
  workbook: XLSX.WorkBook;
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
    const uploadedRows = XLSX.utils.sheet_to_json<
      Record<string, string | number | boolean | null>
    >(sheet, {
      defval: null,
      raw: false,
    });

    // 1) Create a DataSource for this upload
    const dataSourceName = entry.dataSourceName ?? `${entry.sourceFileName} :: ${entry.sheetName}`;
    const dataSource = await prisma.dataSource.create({
      data: {
        id: uuidv4(),
        name: dataSourceName,
        sourceType: 'excel_upload',
        createdBy: userId ?? undefined,
        description: `Analyst Excel import — sheet "${entry.sheetName}" → ${entry.targetType}`,
        metadata: { uploadedRows, sheetName: entry.sheetName },
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
        recordsReceived: uploadedRows.length,
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
    if (!scheduled) {
      await prisma.dataImportJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorLog: { error: 'The import job could not be scheduled; the uploaded rows remain stored for retry.' },
        },
      });
    }

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
  jobRecordId: string,
): Promise<boolean> {
  try {
    switch (jobType) {
      case 'property_import':
        return jobQueueService.schedulePropertyImport({
          type: 'PROPERTY_IMPORT',
          sourceId: dataSourceId,
          jobRecordId,
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
          sourceId: dataSourceId,
          jobRecordId,
          period: new Date().toISOString().slice(0, 7),
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
          sourceId: dataSourceId,
          jobRecordId,
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
          sourceId: dataSourceId,
          jobRecordId,
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
