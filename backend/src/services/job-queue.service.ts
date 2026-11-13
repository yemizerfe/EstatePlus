import { prisma } from '../infrastructure/database/prisma';
import { publishJob, consumeQueue, getRabbitChannel } from '../infrastructure/rabbitmq/client';
import { logger } from '../shared/utils/logger';
import { RABBITMQ_QUEUES } from '../shared/constants';
import { PropertyImportService } from '../modules/data-import/services/property-import.service';
import { MarketDataImportService } from '../modules/data-import/services/market-data-import.service';
import { EconomicDataImportService } from '../modules/data-import/services/economic-data-import.service';
import { NeighborhoodDataImportService } from '../modules/data-import/services/neighborhood-data-import.service';
import { ImageProcessingService } from '../modules/data-import/services/image-processing.service';
import { EmailService } from '../modules/notifications/email.service';
import { DataValidationService } from '../modules/data-import/services/data-validation.service';
import { BulkOperationService } from '../modules/data-import/services/bulk-operation.service';
import { getErrorMessage } from '../shared/utils/errors';

export interface BaseJobPayload {
  id: string;
  type: string;
  priority?: number;
  userId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface PropertyImportJobPayload extends BaseJobPayload {
  type: 'PROPERTY_IMPORT';
  sourceId: string;
  fileName?: string;
  /** Row in `data_import_jobs` this queue job reports its status to. */
  jobRecordId?: string;
  data?: any[];
  options?: {
    skipDuplicates?: boolean;
    validateOnly?: boolean;
    batchSize?: number;
  };
}

export interface MarketDataImportJobPayload extends BaseJobPayload {
  type: 'MARKET_DATA_IMPORT';
  dataType: 'price_trends' | 'sales_volume' | 'market_metrics';
  period: string;
  neighborhoods?: string[];
}

export interface EconomicDataImportJobPayload extends BaseJobPayload {
  type: 'ECONOMIC_DATA_IMPORT';
  indicators: string[];
  startDate: string;
  endDate: string;
  sourceUrl?: string;
}

export interface NeighborhoodDataImportJobPayload extends BaseJobPayload {
  type: 'NEIGHBORHOOD_DATA_IMPORT';
  dataTypes: string[];
  neighborhoods?: string[];
  includeAmenities?: boolean;
  includeStatistics?: boolean;
}

export interface ImageProcessingJobPayload extends BaseJobPayload {
  type: 'IMAGE_PROCESSING';
  propertyId: string;
  imageUrls: string[];
  operations: {
    resize?: { width: number; height: number }[];
    watermark?: boolean;
    optimize?: boolean;
    extractMetadata?: boolean;
  };
}

export interface EmailNotificationJobPayload extends BaseJobPayload {
  type: 'EMAIL_NOTIFICATION';
  recipients: string[];
  template: string;
  data: Record<string, any>;
  scheduledFor?: string;
}

export interface DataValidationJobPayload extends BaseJobPayload {
  type: 'DATA_VALIDATION';
  dataType: string;
  recordIds: string[];
  rules: string[];
}

export interface BulkOperationJobPayload extends BaseJobPayload {
  type: 'BULK_OPERATION';
  operation: string;
  resourceType: string;
  resourceIds: string[];
  parameters: Record<string, any>;
}

export type JobPayload = 
  | PropertyImportJobPayload
  | MarketDataImportJobPayload
  | EconomicDataImportJobPayload
  | NeighborhoodDataImportJobPayload
  | ImageProcessingJobPayload
  | EmailNotificationJobPayload
  | DataValidationJobPayload
  | BulkOperationJobPayload;

export class JobQueueService {
  private static instance: JobQueueService;
  private isInitialized = false;
  /** True when the last publish attempt fell back to in-process execution. */
  private inlineFallbackActive = false;

  /** Whether job execution is currently running inside the API process. */
  isRunningInline(): boolean {
    return this.inlineFallbackActive;
  }

  /**
   * Publish a job to RabbitMQ. When the broker is unavailable the job is
   * executed in-process instead of being silently dropped, so imports keep
   * working on a single-node/dev deployment without RabbitMQ.
   */
  private async dispatch(
    queue: string,
    job: BaseJobPayload,
    processor: (payload: BaseJobPayload) => Promise<void>,
  ): Promise<boolean> {
    const published = await publishJob(queue, job);
    if (published) {
      this.inlineFallbackActive = false;
      return true;
    }

    this.inlineFallbackActive = true;
    logger.warn({
      msg: 'RabbitMQ unavailable — running job in-process',
      queue,
      jobId: job.id,
      jobType: job.type,
    });

    // Fire-and-forget: the job persists its own status row, so callers do not
    // need to hold the HTTP request open while an import runs.
    void processor(job).catch((error: unknown) => {
      logger.error({ msg: 'Inline job execution failed', queue, jobId: job.id, error: getErrorMessage(error) });
    });
    return true;
  }

  public static getInstance(): JobQueueService {
    if (!JobQueueService.instance) {
      JobQueueService.instance = new JobQueueService();
    }
    return JobQueueService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Start consumers for all queues. Without a broker, consumeQueue logs and
      // returns; jobs published from this process then run inline instead.
      await this.startConsumers();
      this.isInitialized = true;
      const connected = await getRabbitChannel();
      this.inlineFallbackActive = connected === null;
      logger.info({
        msg: 'Job Queue Service initialized',
        mode: this.inlineFallbackActive ? 'in-process (RabbitMQ unavailable)' : 'rabbitmq',
      });
    } catch (error) {
      logger.error({ msg: 'Failed to initialize Job Queue Service', error });
      throw error;
    }
  }

  private async startConsumers(): Promise<void> {
    // Property Import Consumer
    await consumeQueue(RABBITMQ_QUEUES.PROPERTY_IMPORT, async (msg) => {
      const payload = JSON.parse(msg.content.toString()) as PropertyImportJobPayload;
      await this.processPropertyImportJob(payload);
    });

    // Market Data Import Consumer
    await consumeQueue(RABBITMQ_QUEUES.MARKET_DATA_IMPORT, async (msg) => {
      const payload = JSON.parse(msg.content.toString()) as MarketDataImportJobPayload;
      await this.processMarketDataImportJob(payload);
    });

    // Economic Data Import Consumer
    await consumeQueue(RABBITMQ_QUEUES.ECONOMIC_DATA_IMPORT, async (msg) => {
      const payload = JSON.parse(msg.content.toString()) as EconomicDataImportJobPayload;
      await this.processEconomicDataImportJob(payload);
    });

    // Neighborhood Data Import Consumer
    await consumeQueue(RABBITMQ_QUEUES.NEIGHBORHOOD_DATA_IMPORT, async (msg) => {
      const payload = JSON.parse(msg.content.toString()) as NeighborhoodDataImportJobPayload;
      await this.processNeighborhoodDataImportJob(payload);
    });

    // Image Processing Consumer
    await consumeQueue(RABBITMQ_QUEUES.IMAGE_PROCESSING, async (msg) => {
      const payload = JSON.parse(msg.content.toString()) as ImageProcessingJobPayload;
      await this.processImageProcessingJob(payload);
    });

    // Email Notification Consumer
    await consumeQueue(RABBITMQ_QUEUES.EMAIL_NOTIFICATIONS, async (msg) => {
      const payload = JSON.parse(msg.content.toString()) as EmailNotificationJobPayload;
      await this.processEmailNotificationJob(payload);
    });

    // Data Validation Consumer
    await consumeQueue(RABBITMQ_QUEUES.DATA_VALIDATION, async (msg) => {
      const payload = JSON.parse(msg.content.toString()) as DataValidationJobPayload;
      await this.processDataValidationJob(payload);
    });

    // Bulk Operations Consumer
    await consumeQueue(RABBITMQ_QUEUES.BULK_OPERATIONS, async (msg) => {
      const payload = JSON.parse(msg.content.toString()) as BulkOperationJobPayload;
      await this.processBulkOperationJob(payload);
    });
  }

  // Job Publishing Methods
  async schedulePropertyImport(payload: Omit<PropertyImportJobPayload, 'id' | 'createdAt'>): Promise<boolean> {
    const job: PropertyImportJobPayload = {
      ...payload,
      id: this.generateJobId(),
      createdAt: new Date().toISOString(),
    };

    return this.dispatch(RABBITMQ_QUEUES.PROPERTY_IMPORT, job, (payload) =>
      this.processPropertyImportJob(payload as PropertyImportJobPayload),
    );
  }

  async scheduleMarketDataImport(payload: Omit<MarketDataImportJobPayload, 'id' | 'createdAt'>): Promise<boolean> {
    const job: MarketDataImportJobPayload = {
      ...payload,
      id: this.generateJobId(),
      createdAt: new Date().toISOString(),
    };

    return this.dispatch(RABBITMQ_QUEUES.MARKET_DATA_IMPORT, job, (payload) =>
      this.processMarketDataImportJob(payload as MarketDataImportJobPayload),
    );
  }

  async scheduleEconomicDataImport(payload: Omit<EconomicDataImportJobPayload, 'id' | 'createdAt'>): Promise<boolean> {
    const job: EconomicDataImportJobPayload = {
      ...payload,
      id: this.generateJobId(),
      createdAt: new Date().toISOString(),
    };

    return this.dispatch(RABBITMQ_QUEUES.ECONOMIC_DATA_IMPORT, job, (payload) =>
      this.processEconomicDataImportJob(payload as EconomicDataImportJobPayload),
    );
  }

  async scheduleNeighborhoodDataImport(payload: Omit<NeighborhoodDataImportJobPayload, 'id' | 'createdAt'>): Promise<boolean> {
    const job: NeighborhoodDataImportJobPayload = {
      ...payload,
      id: this.generateJobId(),
      createdAt: new Date().toISOString(),
    };

    return this.dispatch(RABBITMQ_QUEUES.NEIGHBORHOOD_DATA_IMPORT, job, (payload) =>
      this.processNeighborhoodDataImportJob(payload as NeighborhoodDataImportJobPayload),
    );
  }

  async scheduleImageProcessing(payload: Omit<ImageProcessingJobPayload, 'id' | 'createdAt'>): Promise<boolean> {
    const job: ImageProcessingJobPayload = {
      ...payload,
      id: this.generateJobId(),
      createdAt: new Date().toISOString(),
    };

    return this.dispatch(RABBITMQ_QUEUES.IMAGE_PROCESSING, job, (payload) =>
      this.processImageProcessingJob(payload as ImageProcessingJobPayload),
    );
  }

  async scheduleEmailNotification(payload: Omit<EmailNotificationJobPayload, 'id' | 'createdAt'>): Promise<boolean> {
    const job: EmailNotificationJobPayload = {
      ...payload,
      id: this.generateJobId(),
      createdAt: new Date().toISOString(),
    };

    return this.dispatch(RABBITMQ_QUEUES.EMAIL_NOTIFICATIONS, job, (payload) =>
      this.processEmailNotificationJob(payload as EmailNotificationJobPayload),
    );
  }

  async scheduleDataValidation(payload: Omit<DataValidationJobPayload, 'id' | 'createdAt'>): Promise<boolean> {
    const job: DataValidationJobPayload = {
      ...payload,
      id: this.generateJobId(),
      createdAt: new Date().toISOString(),
    };

    return this.dispatch(RABBITMQ_QUEUES.DATA_VALIDATION, job, (payload) =>
      this.processDataValidationJob(payload as DataValidationJobPayload),
    );
  }

  async scheduleBulkOperation(payload: Omit<BulkOperationJobPayload, 'id' | 'createdAt'>): Promise<boolean> {
    const job: BulkOperationJobPayload = {
      ...payload,
      id: this.generateJobId(),
      createdAt: new Date().toISOString(),
    };

    return this.dispatch(RABBITMQ_QUEUES.BULK_OPERATIONS, job, (payload) =>
      this.processBulkOperationJob(payload as BulkOperationJobPayload),
    );
  }

  // Job Processing Methods
  private async processPropertyImportJob(payload: PropertyImportJobPayload): Promise<void> {
    try {
      const recordId = payload.jobRecordId ?? payload.id;
      logger.info({ msg: 'Processing property import job', jobId: payload.id, recordId });
      
      await this.updateJobStatus(recordId, 'processing');
      
      const service = new PropertyImportService();
      const result = await service.importProperties(payload);
      
      await this.updateJobStatus(recordId, 'completed', result);

      // Imported listings must show up on every market page immediately.
      try {
        const { deriveMarketStatistics } = await import(
          '../modules/market/market-stats-derivation.service'
        );
        await deriveMarketStatistics({ months: 24 });
      } catch (error) {
        logger.warn({ msg: 'Could not refresh market statistics after import', error });
      }
      
      logger.info({ msg: 'Property import job completed', jobId: payload.id, result });
    } catch (error) {
      logger.error({ msg: 'Property import job failed', jobId: payload.id, error });
      await this.updateJobStatus(payload.jobRecordId ?? payload.id, 'failed', {
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  private async processMarketDataImportJob(payload: MarketDataImportJobPayload): Promise<void> {
    try {
      logger.info({ msg: 'Processing market data import job', jobId: payload.id });
      
      await this.updateJobStatus(payload.id, 'processing');
      
      const service = new MarketDataImportService();
      const result = await service.importMarketData(payload);
      
      await this.updateJobStatus(payload.id, 'completed', result);
      
      logger.info({ msg: 'Market data import job completed', jobId: payload.id, result });
    } catch (error) {
      logger.error({ msg: 'Market data import job failed', jobId: payload.id, error });
      await this.updateJobStatus(payload.id, 'failed', { error: getErrorMessage(error) });
      throw error;
    }
  }

  private async processEconomicDataImportJob(payload: EconomicDataImportJobPayload): Promise<void> {
    try {
      logger.info({ msg: 'Processing economic data import job', jobId: payload.id });
      
      await this.updateJobStatus(payload.id, 'processing');
      
      const service = new EconomicDataImportService();
      const result = await service.importEconomicData(payload);
      
      await this.updateJobStatus(payload.id, 'completed', result);
      
      logger.info({ msg: 'Economic data import job completed', jobId: payload.id, result });
    } catch (error) {
      logger.error({ msg: 'Economic data import job failed', jobId: payload.id, error });
      await this.updateJobStatus(payload.id, 'failed', { error: getErrorMessage(error) });
      throw error;
    }
  }

  private async processNeighborhoodDataImportJob(payload: NeighborhoodDataImportJobPayload): Promise<void> {
    try {
      logger.info({ msg: 'Processing neighborhood data import job', jobId: payload.id });
      
      await this.updateJobStatus(payload.id, 'processing');
      
      const service = new NeighborhoodDataImportService();
      const result = await service.importNeighborhoodData(payload);
      
      await this.updateJobStatus(payload.id, 'completed', result);
      
      logger.info({ msg: 'Neighborhood data import job completed', jobId: payload.id, result });
    } catch (error) {
      logger.error({ msg: 'Neighborhood data import job failed', jobId: payload.id, error });
      await this.updateJobStatus(payload.id, 'failed', { error: getErrorMessage(error) });
      throw error;
    }
  }

  private async processImageProcessingJob(payload: ImageProcessingJobPayload): Promise<void> {
    try {
      logger.info({ msg: 'Processing image processing job', jobId: payload.id });
      
      await this.updateJobStatus(payload.id, 'processing');
      
      const service = new ImageProcessingService();
      const result = await service.processImages(payload);
      
      await this.updateJobStatus(payload.id, 'completed', result);
      
      logger.info({ msg: 'Image processing job completed', jobId: payload.id, result });
    } catch (error) {
      logger.error({ msg: 'Image processing job failed', jobId: payload.id, error });
      await this.updateJobStatus(payload.id, 'failed', { error: getErrorMessage(error) });
      throw error;
    }
  }

  private async processEmailNotificationJob(payload: EmailNotificationJobPayload): Promise<void> {
    try {
      logger.info({ msg: 'Processing email notification job', jobId: payload.id });
      
      await this.updateJobStatus(payload.id, 'processing');
      
      const service = new EmailService();
      const result = await service.sendTemplatedEmail(payload);
      
      await this.updateJobStatus(payload.id, 'completed', result);
      
      logger.info({ msg: 'Email notification job completed', jobId: payload.id, result });
    } catch (error) {
      logger.error({ msg: 'Email notification job failed', jobId: payload.id, error });
      await this.updateJobStatus(payload.id, 'failed', { error: getErrorMessage(error) });
      throw error;
    }
  }

  private async processDataValidationJob(payload: DataValidationJobPayload): Promise<void> {
    try {
      logger.info({ msg: 'Processing data validation job', jobId: payload.id });
      
      await this.updateJobStatus(payload.id, 'processing');
      
      const service = new DataValidationService();
      const result = await service.validateData(payload);
      
      await this.updateJobStatus(payload.id, 'completed', result);
      
      logger.info({ msg: 'Data validation job completed', jobId: payload.id, result });
    } catch (error) {
      logger.error({ msg: 'Data validation job failed', jobId: payload.id, error });
      await this.updateJobStatus(payload.id, 'failed', { error: getErrorMessage(error) });
      throw error;
    }
  }

  private async processBulkOperationJob(payload: BulkOperationJobPayload): Promise<void> {
    try {
      logger.info({ msg: 'Processing bulk operation job', jobId: payload.id });
      
      await this.updateJobStatus(payload.id, 'processing');
      
      const service = new BulkOperationService();
      const result = await service.executeBulkOperation(payload);
      
      await this.updateJobStatus(payload.id, 'completed', result);
      
      logger.info({ msg: 'Bulk operation job completed', jobId: payload.id, result });
    } catch (error) {
      logger.error({ msg: 'Bulk operation job failed', jobId: payload.id, error });
      await this.updateJobStatus(payload.id, 'failed', { error: getErrorMessage(error) });
      throw error;
    }
  }

  // Utility Methods
  private async updateJobStatus(jobId: string, status: string, result?: any): Promise<void> {
    try {
      const updateData: any = {
        status: status as any,
      };

      if (status === 'processing') {
        updateData.startedAt = new Date();
      } else if (status === 'completed' || status === 'failed') {
        updateData.completedAt = new Date();
        if (result) {
          updateData.errorLog = result;
          if (result.recordsReceived) updateData.recordsReceived = result.recordsReceived;
          if (result.recordsValid) updateData.recordsValid = result.recordsValid;
          if (result.recordsRejected) updateData.recordsRejected = result.recordsRejected;
        }
      }

      await prisma.dataImportJob.update({
        where: { id: jobId },
        data: updateData,
      });
    } catch (error) {
      logger.error({ msg: 'Failed to update job status', jobId, status, error });
    }
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Queue Health and Monitoring
  async getQueueHealth(): Promise<Record<string, any>> {
    try {
      const channel = await getRabbitChannel();
      if (!channel) {
        return { healthy: false, error: 'RabbitMQ not connected' };
      }

      const queues = Object.values(RABBITMQ_QUEUES);
      const queueInfo: Record<string, any> = {};

      for (const queueName of queues) {
        try {
          const info = await channel.checkQueue(queueName);
          queueInfo[queueName] = {
            messageCount: info.messageCount,
            consumerCount: info.consumerCount,
          };
        } catch (err: unknown) {
          queueInfo[queueName] = { error: err instanceof Error ? err.message : String(err) };
        }
      }

      return {
        healthy: true,
        queues: queueInfo,
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      return { healthy: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async getJobStatistics(): Promise<any> {
    try {
      const stats = await prisma.dataImportJob.groupBy({
        by: ['status'],
        _count: {
          id: true,
        },
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      });

      const recentJobs = await prisma.dataImportJob.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          jobType: true,
          status: true,
          recordsReceived: true,
          recordsValid: true,
          recordsRejected: true,
          createdAt: true,
          completedAt: true,
        },
      });

      return {
        statusCounts: stats.reduce((acc, stat) => {
          acc[stat.status] = stat._count.id;
          return acc;
        }, {} as Record<string, number>),
        recentJobs,
        totalJobsLast24h: stats.reduce((sum, stat) => sum + stat._count.id, 0),
      };      } catch (err: unknown) {
      logger.error({ msg: 'Failed to get job statistics', error: err instanceof Error ? err.message : String(err) });
      throw err instanceof Error ? err : new Error(String(err));
    }
  }
}

export const jobQueueService = JobQueueService.getInstance();
