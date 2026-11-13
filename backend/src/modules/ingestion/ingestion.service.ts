import { Readable } from 'stream';

import csvParser from 'csv-parser';

import { prisma } from '../../infrastructure/database/prisma';
import { jobQueueService } from '../../services/job-queue.service';
import { BadRequestError, NotFoundError } from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';

export async function initiateImport(
  fileBuffer: Buffer,
  fileName: string,
  userId: string,
  importType: 'properties' | 'economics',
) {
  // Create import job record
  const source = await prisma.dataSource.create({
    data: { name: fileName, sourceType: 'csv', createdBy: userId },
  });

  const job = await prisma.dataImportJob.create({
    data: {
      sourceId: source.id,
      jobType: importType === 'properties' ? 'IMPORT_CSV' : 'IMPORT_ECONOMICS_CSV',
      status: 'pending',
      fileName,
      createdBy: userId,
    },
  });

  // Parse CSV in-memory to get record count
  const rows: Record<string, string>[] = [];
  await new Promise<void>((resolve, reject) => {
    const stream = Readable.from(fileBuffer.toString('utf8'));
    stream
      .pipe(csvParser())
      .on('data', (row: Record<string, string>) => rows.push(row))
      .on('end', resolve)
      .on('error', reject);
  });

  await prisma.dataImportJob.update({
    where: { id: job.id },
    data: { recordsReceived: rows.length },
  });

  // Hand the parsed rows to the property importer. When RabbitMQ is down the
  // job queue runs the import in-process instead of dropping the work.
  if (importType === 'properties') {
    const scheduled = await jobQueueService.schedulePropertyImport({
      type: 'PROPERTY_IMPORT',
      sourceId: source.id,
      fileName,
      data: rows,
      userId,
      jobRecordId: job.id,
      options: { skipDuplicates: true },
    });

    if (!scheduled) {
      await prisma.dataImportJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorLog: { error: 'The import queue is unavailable, so the file was not processed.' },
        },
      });
      throw new BadRequestError('The import queue is unavailable right now. Please retry shortly.');
    }
  } else {
    await prisma.dataImportJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorLog: {
          error:
            'Economics rows use POST /external-sources/nbe/import-csv or /external-sources/ess/import-csv.',
        },
      },
    });
    throw new BadRequestError(
      'Economics CSV import is not wired to this endpoint. Use POST /external-sources/nbe/import-csv or POST /external-sources/ess/import-csv, which validate official figures.',
    );
  }

  logger.info({ msg: 'import.queued', jobId: job.id, fileName, records: rows.length });

  return { jobId: job.id, status: 'pending', recordsReceived: rows.length };
}

export async function getImportJob(jobId: string) {
  const job = await prisma.dataImportJob.findUnique({ where: { id: jobId } });
  // A missing job is a client-visible 404, not an internal error.
  if (!job) throw new NotFoundError('Import job');
  return job;
}

export async function listImportJobs(userId: string, role: string) {
  return prisma.dataImportJob.findMany({
    where: role === 'admin' ? {} : { createdBy: userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}
