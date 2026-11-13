import { prisma } from '../../../infrastructure/database/prisma';
import { logger } from '../../../shared/utils/logger';
import { BulkOperationJobPayload } from '../../../services/job-queue.service';
import { ProcessingError, ValidationError, getErrorMessage } from '../../../shared/utils/errors';

export class BulkOperationService {
  async executeBulkOperation(payload: BulkOperationJobPayload): Promise<any> {
    try {
      logger.info({ msg: 'Starting bulk operation', jobId: payload.id });

      const results = {
        operation: payload.operation,
        resourceType: payload.resourceType,
        resourcesProcessed: payload.resourceIds.length,
        successful: 0,
        failed: 0,
        errors: [],
      };

      switch (payload.operation) {
        case 'bulk_update_status':
          return await this.bulkUpdateStatus(payload, results);
        case 'bulk_delete':
          return await this.bulkDelete(payload, results);
        case 'bulk_export':
          return await this.bulkExport(payload, results);
        default:
          throw new ValidationError(`Unsupported operation: ${payload.operation}`);
      }

    } catch (error) {
      logger.error({ msg: 'Bulk operation failed', jobId: payload.id, error });
      throw new ProcessingError(`Bulk operation failed: ${getErrorMessage(error)}`);
    }
  }

  private async bulkUpdateStatus(payload: BulkOperationJobPayload, results: any): Promise<any> {
    const newStatus = payload.parameters.status;
    
    switch (payload.resourceType) {
      case 'properties':
        await prisma.property.updateMany({
          where: { id: { in: payload.resourceIds } },
          data: { status: newStatus },
        });
        results.successful = payload.resourceIds.length;
        break;
        
      case 'listings':
        await prisma.listing.updateMany({
          where: { id: { in: payload.resourceIds } },
          data: { status: newStatus },
        });
        results.successful = payload.resourceIds.length;
        break;
        
      default:
        throw new ValidationError(`Bulk status update not supported for: ${payload.resourceType}`);
    }

    logger.info({ msg: 'Bulk status update completed', results });
    return results;
  }

  private async bulkDelete(payload: BulkOperationJobPayload, results: any): Promise<any> {
    // Implement soft delete for safety
    const deletedAt = new Date();
    
    switch (payload.resourceType) {
      case 'properties':
        await prisma.property.updateMany({
          where: { id: { in: payload.resourceIds } },
          data: { 
            status: 'ARCHIVED' as any,
            updatedAt: deletedAt,
          },
        });
        results.successful = payload.resourceIds.length;
        break;
        
      default:
        throw new ValidationError(`Bulk delete not supported for: ${payload.resourceType}`);
    }

    logger.info({ msg: 'Bulk delete completed', results });
    return results;
  }

  private async bulkExport(payload: BulkOperationJobPayload, results: any): Promise<any> {
    // Generate export data
    const exportData = await this.generateExportData(payload.resourceType, payload.resourceIds);
    
    results.exportFile = `export_${payload.resourceType}_${Date.now()}.json`;
    results.recordCount = exportData.length;
    results.successful = exportData.length;

    logger.info({ msg: 'Bulk export completed', results });
    return results;
  }

  private async generateExportData(resourceType: string, resourceIds: string[]): Promise<any[]> {
    switch (resourceType) {
      case 'properties':
        return await prisma.property.findMany({
          where: { id: { in: resourceIds } },
          include: {
            location: true,
            listings: true,
            images: true,
          },
        });
      default:
        return [];
    }
  }
}