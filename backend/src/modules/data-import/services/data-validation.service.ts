import { prisma } from '../../../infrastructure/database/prisma';
import { logger } from '../../../shared/utils/logger';
import { DataValidationJobPayload } from '../../../services/job-queue.service';
import { ValidationError, ProcessingError, getErrorMessage } from '../../../shared/utils/errors';

interface ValidationRule {
  id: string;
  name: string;
  description: string;
  validator: (data: any) => ValidationResult;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score?: number;
}

interface RecordIssues {
  recordId: string;
  errors: string[];
}

interface RecordWarnings {
  recordId: string;
  warnings: string[];
}

interface ValidationRunResults {
  recordsProcessed: number;
  recordsValid: number;
  recordsInvalid: number;
  errors: RecordIssues[];
  warnings: RecordWarnings[];
  validationSummary: Record<string, unknown>;
}

export class DataValidationService {
  private validationRules: Map<string, ValidationRule> = new Map();

  constructor() {
    this.initializeValidationRules();
  }

  async validateData(payload: DataValidationJobPayload): Promise<any> {
    try {
      logger.info({ msg: 'Starting data validation', jobId: payload.id });

      const results: ValidationRunResults = {
        recordsProcessed: 0,
        recordsValid: 0,
        recordsInvalid: 0,
        errors: [],
        warnings: [],
        validationSummary: {},
      };

      // Get records to validate
      const records = await this.getRecordsToValidate(payload.dataType, payload.recordIds);
      results.recordsProcessed = records.length;

      // Apply validation rules
      for (const record of records) {
        const validationResult = await this.validateRecord(record, payload.rules);
        
        if (validationResult.isValid) {
          results.recordsValid++;
        } else {
          results.recordsInvalid++;
          results.errors.push({
            recordId: record.id,
            errors: validationResult.errors,
          });
        }

        if (validationResult.warnings.length > 0) {
          results.warnings.push({
            recordId: record.id,
            warnings: validationResult.warnings,
          });
        }
      }

      // Generate validation summary
      results.validationSummary = this.generateValidationSummary(results);

      logger.info({ msg: 'Data validation completed', jobId: payload.id, results });
      return results;

    } catch (error) {
      logger.error({ msg: 'Data validation failed', jobId: payload.id, error });
      throw new ProcessingError(`Data validation failed: ${getErrorMessage(error)}`);
    }
  }

  private initializeValidationRules(): void {
    // Property validation rules
    this.validationRules.set('property_required_fields', {
      id: 'property_required_fields',
      name: 'Property Required Fields',
      description: 'Validates that all required property fields are present',
      validator: (property) => ({
        isValid: !!(property.title && property.address && property.price && property.propertyType),
        errors: [
          ...(property.title ? [] : ['Title is required']),
          ...(property.address ? [] : ['Address is required']),
          ...(property.price ? [] : ['Price is required']),
          ...(property.propertyType ? [] : ['Property type is required']),
        ],
        warnings: [],
      }),
    });

    this.validationRules.set('property_price_range', {
      id: 'property_price_range',
      name: 'Property Price Range',
      description: 'Validates property price is within reasonable range',
      validator: (property) => {
        const minPrice = 100000; // 100K ETB
        const maxPrice = 100000000; // 100M ETB
        const warnings = [];
        
        if (property.price < minPrice) {
          warnings.push('Price seems unusually low');
        } else if (property.price > maxPrice) {
          warnings.push('Price seems unusually high');
        }

        return {
          isValid: property.price > 0,
          errors: property.price <= 0 ? ['Price must be positive'] : [],
          warnings,
        };
      },
    });

    // Add more validation rules...
  }

  private async getRecordsToValidate(dataType: string, recordIds: string[]): Promise<any[]> {
    switch (dataType) {
      case 'properties':
        return await prisma.property.findMany({
          where: recordIds.length > 0 ? { id: { in: recordIds } } : {},
          include: { location: true },
        });
      case 'listings':
        return await prisma.listing.findMany({
          where: recordIds.length > 0 ? { id: { in: recordIds } } : {},
        });
      case 'neighborhoods':
        return await prisma.neighborhood.findMany({
          where: recordIds.length > 0 ? { id: { in: recordIds } } : {},
        });
      default:
        throw new ValidationError(`Unsupported data type: ${dataType}`);
    }
  }

  private async validateRecord(record: any, ruleIds: string[]): Promise<ValidationResult> {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    let isValid = true;

    for (const ruleId of ruleIds) {
      const rule = this.validationRules.get(ruleId);
      if (!rule) {
        allWarnings.push(`Unknown validation rule: ${ruleId}`);
        continue;
      }

      try {
        const result = rule.validator(record);
        if (!result.isValid) {
          isValid = false;
        }
        allErrors.push(...result.errors);
        allWarnings.push(...result.warnings);
      } catch (error) {
        allErrors.push(`Validation rule '${ruleId}' failed: ${getErrorMessage(error)}`);
        isValid = false;
      }
    }

    return {
      isValid,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  private generateValidationSummary(results: ValidationRunResults): Record<string, unknown> {
    return {
      validationRate: results.recordsProcessed > 0 
        ? (results.recordsValid / results.recordsProcessed * 100).toFixed(2) + '%'
        : '0%',
      totalErrors: results.errors.length,
      totalWarnings: results.warnings.length,
      commonErrors: this.getCommonIssues(results.errors.map(e => e.errors).flat()),
      commonWarnings: this.getCommonIssues(results.warnings.map(w => w.warnings).flat()),
    };
  }

  private getCommonIssues(issues: string[]): Array<{ issue: string; count: number }> {
    const counts = issues.reduce((acc, issue) => {
      acc[issue] = (acc[issue] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 common issues
  }
}