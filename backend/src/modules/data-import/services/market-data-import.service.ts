import { ListingType, Prisma, PropertyType } from '@prisma/client';

import { prisma } from '../../../infrastructure/database/prisma';
import { logger } from '../../../shared/utils/logger';
import { MarketDataImportJobPayload } from '../../../services/job-queue.service';
import { ProcessingError, ValidationError, getErrorMessage } from '../../../shared/utils/errors';

/**
 * Market statistics are derived from listings that are actually stored in the
 * database. Nothing is generated: a period with no listings produces no row,
 * and a field with no observations stays empty rather than being filled with
 * a placeholder.
 */

interface MarketDataRecord {
  neighborhoodId: string;
  propertyType: PropertyType;
  period: string; // YYYY-MM
  avgPrice: number | null;
  medianPrice: number | null;
  pricePerSqm: number | null;
  avgRentalPrice: number | null;
  rentalYield: number | null;
  priceGrowth: number | null;
  rentGrowth: number | null;
  activeListings: number;
  sampleSize: number;
}

interface ImportResult {
  recordsReceived: number;
  recordsValid: number;
  recordsRejected: number;
  errors: Array<Record<string, unknown>>;
  warnings: Array<Record<string, unknown>>;
  updatedPeriods: string[];
}

export class MarketDataImportService {
  async importMarketData(payload: MarketDataImportJobPayload): Promise<ImportResult> {
    const result: ImportResult = {
      recordsReceived: 0,
      recordsValid: 0,
      recordsRejected: 0,
      errors: [],
      warnings: [],
      updatedPeriods: [],
    };

    if (!/^\d{4}-\d{2}$/.test(payload.period)) {
      throw new ValidationError('period must be formatted YYYY-MM');
    }
    if (!['price_trends', 'sales_volume', 'market_metrics'].includes(payload.dataType)) {
      throw new ValidationError(`Unsupported data type: ${payload.dataType}`);
    }

    logger.info({
      msg: 'Aggregating market statistics from stored listings',
      jobId: payload.id,
      dataType: payload.dataType,
      period: payload.period,
    });

    const records = await this.aggregatePeriod(payload.neighborhoods, payload.period);

    if (records.length === 0) {
      result.warnings.push({
        warning: `No stored listings fall inside ${payload.period}; no market statistics were written.`,
      });
    }

    result.recordsReceived = records.length;

    for (let i = 0; i < records.length; i++) {
      const record = records[i]!;
      try {
        const validation = this.validateRecord(record, i + 1);
        if (!validation.isValid) {
          result.recordsRejected++;
          result.errors.push({ record: i + 1, errors: validation.errors });
          continue;
        }
        if (validation.warnings.length > 0) {
          result.warnings.push({ record: i + 1, warnings: validation.warnings });
        }

        await this.upsertMarketStatistic(record);
        result.recordsValid++;
        if (!result.updatedPeriods.includes(record.period)) {
          result.updatedPeriods.push(record.period);
        }
      } catch (error) {
        result.recordsRejected++;
        result.errors.push({ record: i + 1, errors: [getErrorMessage(error)] });
      }
    }

    logger.info({ msg: 'Market data aggregation completed', jobId: payload.id, result });
    return result;
  }

  /** Aggregate stored listings for one period, grouped by neighborhood + type. */
  private async aggregatePeriod(
    neighborhoodIds: string[] | undefined,
    period: string,
  ): Promise<MarketDataRecord[]> {
    const [year, month] = period.split('-').map(Number);
    if (!year || !month) return [];

    const start = new Date(Date.UTC(year, month - 1, 1));
    const endExclusive = new Date(Date.UTC(year, month, 1));

    const where: Prisma.ListingWhereInput = {
      listedAt: { gte: start, lt: endExclusive },
      status: { in: ['ACTIVE', 'SOLD', 'RENTED', 'EXPIRED', 'WITHDRAWN', 'INACTIVE'] },
      ...(neighborhoodIds && neighborhoodIds.length > 0
        ? { property: { neighborhoodId: { in: neighborhoodIds } } }
        : {}),
    };

    const listings = await prisma.listing.findMany({
      where,
      select: {
        listingType: true,
        currentPrice: true,
        rentalPrice: true,
        property: {
          select: {
            neighborhoodId: true,
            propertyType: true,
            sizeSqm: true,
            askingPrice: true,
            rentalPrice: true,
          },
        },
      },
    });

    const groups = new Map<string, typeof listings>();
    for (const listing of listings) {
      const key = `${listing.property.neighborhoodId}|${listing.property.propertyType}`;
      const bucket = groups.get(key) ?? [];
      bucket.push(listing);
      groups.set(key, bucket);
    }

    const records: MarketDataRecord[] = [];

    for (const [key, group] of groups) {
      const [neighborhoodId, propertyType] = key.split('|') as [string, PropertyType];

      const salePrices: number[] = [];
      const rentPrices: number[] = [];
      const perSqm: number[] = [];

      for (const listing of group) {
        const size = Number(listing.property.sizeSqm);
        const salePrice =
          listing.listingType === ListingType.RENT
            ? null
            : Number(listing.currentPrice) || Number(listing.property.askingPrice);
        const rentPrice =
          listing.listingType === ListingType.SALE
            ? null
            : Number(listing.rentalPrice ?? listing.property.rentalPrice ?? 0);

        if (salePrice && salePrice > 0) {
          salePrices.push(salePrice);
          if (size > 0) perSqm.push(salePrice / size);
        }
        if (rentPrice && rentPrice > 0) rentPrices.push(rentPrice);
      }

      const avgPrice = this.mean(salePrices);
      const avgRentalPrice = this.mean(rentPrices);

      const previous = await prisma.marketStatistic.findFirst({
        where: {
          neighborhoodId,
          propertyType,
          period: this.previousPeriod(period),
        },
      });

      const priceGrowth =
        avgPrice != null && previous?.avgPrice != null && Number(previous.avgPrice) > 0
          ? ((avgPrice - Number(previous.avgPrice)) / Number(previous.avgPrice)) * 100
          : null;
      const rentGrowth =
        avgRentalPrice != null && previous?.avgRentalPrice != null && Number(previous.avgRentalPrice) > 0
          ? ((avgRentalPrice - Number(previous.avgRentalPrice)) / Number(previous.avgRentalPrice)) * 100
          : null;

      records.push({
        neighborhoodId,
        propertyType,
        period,
        avgPrice,
        medianPrice: this.median(salePrices),
        pricePerSqm: this.mean(perSqm),
        avgRentalPrice,
        rentalYield:
          avgPrice != null && avgRentalPrice != null && avgPrice > 0
            ? (avgRentalPrice * 12 * 100) / avgPrice
            : null,
        priceGrowth,
        rentGrowth,
        activeListings: group.length,
        sampleSize: salePrices.length,
      });
    }

    return records;
  }

  private validateRecord(
    record: MarketDataRecord,
    recordIndex: number,
  ): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!record.neighborhoodId) errors.push(`record ${recordIndex}: neighborhood is required`);
    if (!record.propertyType) errors.push(`record ${recordIndex}: property type is required`);
    if (!record.period || !/^\d{4}-\d{2}$/.test(record.period)) {
      errors.push(`record ${recordIndex}: a valid YYYY-MM period is required`);
    }
    if (record.sampleSize === 0 && record.activeListings === 0) {
      errors.push(`record ${recordIndex}: no observations to aggregate`);
    }
    if (record.priceGrowth != null && Math.abs(record.priceGrowth) > 50) {
      warnings.push(`record ${recordIndex}: price growth ${record.priceGrowth.toFixed(1)}% is unusually large (thin sample?)`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private async upsertMarketStatistic(record: MarketDataRecord): Promise<void> {
    const data = {
      avgPrice: record.avgPrice,
      medianPrice: record.medianPrice,
      pricePerSqm: record.pricePerSqm,
      avgRentalPrice: record.avgRentalPrice,
      rentalYield: record.rentalYield,
      priceGrowth: record.priceGrowth,
      rentGrowth: record.rentGrowth,
      activeListings: record.activeListings,
      sampleSize: record.sampleSize,
    };

    try {
      await prisma.marketStatistic.upsert({
        where: {
          neighborhoodId_propertyType_period: {
            neighborhoodId: record.neighborhoodId,
            propertyType: record.propertyType,
            period: record.period,
          },
        },
        update: { ...data, calculatedAt: new Date() },
        create: {
          neighborhoodId: record.neighborhoodId,
          propertyType: record.propertyType,
          period: record.period,
          ...data,
        },
      });
    } catch (error) {
      logger.error({ msg: 'Failed to upsert market statistic', record, error });
      throw new ProcessingError(`Failed to save market statistic: ${getErrorMessage(error)}`);
    }
  }

  private previousPeriod(period: string): string {
    const [year, month] = period.split('-').map(Number);
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  }

  private mean(values: number[]): number | null {
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private median(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? ((sorted[mid - 1]! + sorted[mid]!) / 2) : sorted[mid]!;
  }
}
