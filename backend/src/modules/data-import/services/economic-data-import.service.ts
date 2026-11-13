import { EconomicIndicatorType } from '@prisma/client';

import { prisma } from '../../../infrastructure/database/prisma';
import { logger } from '../../../shared/utils/logger';
import { EconomicDataImportJobPayload } from '../../../services/job-queue.service';
import { ProcessingError, ValidationError, getErrorMessage } from '../../../shared/utils/errors';
import { worldBankAdapter } from '../../external-sources/adapters/world-bank.adapter';
import { cbeExchangeAdapter } from '../../external-sources/adapters/cbe-exchange.adapter';

/**
 * Economic indicator import.
 *
 * Every record written by this service comes from a real source or from an
 * arithmetic calculation over rows already stored in the database:
 *   • World Bank Open Data  — annual Ethiopia series (no key required)
 *   • CBE daily exchange rates — USD/ETB reference rate
 *   • EstatePlus market_statistics — real-estate indices computed from stored
 *     observations, and only for periods that actually have data.
 *
 * Sources that publish only HTML/PDF (NBE interest rates and monetary
 * aggregates, ESS monthly CPI, construction cost indices) are reported as
 * unsupported here instead of being filled with generated numbers.
 */

interface EconomicDataRecord {
  indicatorType: EconomicIndicatorType;
  value: number;
  date: Date;
  unit: string;
  source: string;
  sourceUrl?: string;
  notes?: string;
}

interface ImportResult {
  recordsReceived: number;
  recordsValid: number;
  recordsRejected: number;
  errors: Array<Record<string, unknown>>;
  warnings: Array<Record<string, unknown>>;
  indicatorsUpdated: string[];
}

/** World Bank indicator codes used for the Ethiopia macro series. */
const WORLD_BANK_BY_INDICATOR: Partial<Record<EconomicIndicatorType, string>> = {
  [EconomicIndicatorType.INFLATION_RATE]: 'FP.CPI.TOTL.ZG',
  [EconomicIndicatorType.CONSUMER_PRICE_INDEX]: 'FP.CPI.TOTL',
  [EconomicIndicatorType.GDP_GROWTH]: 'NY.GDP.MKTP.KD.ZG',
  [EconomicIndicatorType.UNEMPLOYMENT_RATE]: 'SL.UEM.TOTL.ZS',
  [EconomicIndicatorType.FOREIGN_INVESTMENT]: 'BX.KLT.DINV.CD.WD',
};

/** Indicators computed from stored market statistics (never invented). */
const MARKET_DERIVED = new Set<EconomicIndicatorType>([
  EconomicIndicatorType.REAL_ESTATE_PRICE_INDEX,
  EconomicIndicatorType.RENTAL_YIELD_INDEX,
]);

/** Indicators whose only published form is an HTML/PDF report. */
const REPORT_ONLY: Partial<Record<EconomicIndicatorType, string>> = {
  [EconomicIndicatorType.INTEREST_RATE]: 'NBE publishes policy/lending rates as HTML pages and PDFs — no machine-readable feed.',
  [EconomicIndicatorType.BANK_LENDING_RATE]: 'NBE lending rates are published as HTML/PDF only.',
  [EconomicIndicatorType.MONEY_SUPPLY]: 'NBE monetary aggregates are published as HTML/PDF only.',
  [EconomicIndicatorType.MORTGAGE_RATE]: 'No Ethiopian mortgage-rate API is published.',
  [EconomicIndicatorType.GOVERNMENT_DEBT]: 'NBE/ Ministry of Finance debt figures are published as reports only.',
  [EconomicIndicatorType.TAX_REVENUE]: 'Ministry of Revenues figures are published as reports only.',
  [EconomicIndicatorType.CREDIT_GROWTH]: 'NBE credit growth is published as HTML/PDF only.',
  [EconomicIndicatorType.IMPORT_PRICE_INDEX]: 'No published Ethiopian import price index feed is available.',
  [EconomicIndicatorType.EXPORT_PRICE_INDEX]: 'No published Ethiopian export price index feed is available.',
  [EconomicIndicatorType.CONSTRUCTION_COST_INDEX]: 'No official construction cost index feed is published.',
  [EconomicIndicatorType.HOUSING_AFFORDABILITY]: 'Requires an official household income series, which is not published as data.',
  [EconomicIndicatorType.OTHER]: 'Indicator has no configured source.',
};

export class EconomicDataImportService {
  async importEconomicData(payload: EconomicDataImportJobPayload): Promise<ImportResult> {
    const result: ImportResult = {
      recordsReceived: 0,
      recordsValid: 0,
      recordsRejected: 0,
      errors: [],
      warnings: [],
      indicatorsUpdated: [],
    };

    const startDate = new Date(payload.startDate);
    const endDate = new Date(payload.endDate);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new ValidationError('startDate and endDate must be valid ISO dates');
    }

    logger.info({
      msg: 'Starting economic data import from real sources',
      jobId: payload.id,
      indicators: payload.indicators,
      range: `${payload.startDate}..${payload.endDate}`,
    });

    const records: EconomicDataRecord[] = [];

    for (const indicatorName of payload.indicators) {
      const indicator = indicatorName as EconomicIndicatorType;
      if (!(indicator in EconomicIndicatorType)) {
        result.errors.push({ indicator: indicatorName, error: 'Unknown indicator type' });
        continue;
      }
      try {
        const fetched = await this.fetchIndicatorData(indicator, startDate, endDate);
        if (fetched.length === 0) {
          result.warnings.push({
            indicator,
            warning: 'Source returned no observations for the requested range — nothing was written.',
          });
        }
        records.push(...fetched);
      } catch (error) {
        result.errors.push({ indicator, error: getErrorMessage(error) });
      }
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

        await this.upsertEconomicIndicator(record, payload.userId);
        result.recordsValid++;

        const key = record.indicatorType.toString();
        if (!result.indicatorsUpdated.includes(key)) result.indicatorsUpdated.push(key);
      } catch (error) {
        result.recordsRejected++;
        result.errors.push({ record: i + 1, errors: [getErrorMessage(error)] });
      }
    }

    logger.info({ msg: 'Economic data import completed', jobId: payload.id, result });
    return result;
  }

  // ── Source dispatch ────────────────────────────────────────────────────

  private async fetchIndicatorData(
    indicator: EconomicIndicatorType,
    startDate: Date,
    endDate: Date,
  ): Promise<EconomicDataRecord[]> {
    const worldBankCode = WORLD_BANK_BY_INDICATOR[indicator];
    if (worldBankCode) {
      return this.fetchFromWorldBank(indicator, worldBankCode, startDate, endDate);
    }

    if (indicator === EconomicIndicatorType.EXCHANGE_RATE) {
      return this.fetchFromCbe(indicator, endDate);
    }

    if (MARKET_DERIVED.has(indicator)) {
      return this.computeFromMarketStatistics(indicator, startDate, endDate);
    }

    const reportOnly = REPORT_ONLY[indicator];
    throw new ProcessingError(
      `${indicator}: no automated source is available. ${reportOnly ?? ''} Use the manual CSV import endpoints for these series.`.trim(),
    );
  }

  private async fetchFromWorldBank(
    indicator: EconomicIndicatorType,
    code: string,
    startDate: Date,
    endDate: Date,
  ): Promise<EconomicDataRecord[]> {
    const range = `${startDate.getFullYear()}:${endDate.getFullYear()}`;
    const observations = await worldBankAdapter.fetchIndicator(code, range);

    return observations
      .filter((obs) => {
        const yearDate = new Date(Date.UTC(obs.year, 0, 1));
        return yearDate >= new Date(Date.UTC(startDate.getFullYear(), 0, 1)) &&
          yearDate <= new Date(Date.UTC(endDate.getFullYear(), 0, 1));
      })
      .map((obs) => ({
        indicatorType: indicator,
        value: obs.value,
        // World Bank series are annual; the observation year is recorded as
        // 1 January of that year so it stays comparable in the same column.
        date: new Date(Date.UTC(obs.year, 0, 1)),
        unit: this.getIndicatorUnit(indicator),
        source: 'World Bank Open Data',
        sourceUrl: obs.sourceUrl,
        notes: `${obs.indicatorName} (annual, ${obs.year})`,
      }));
  }

  private async fetchFromCbe(
    indicator: EconomicIndicatorType,
    date: Date,
  ): Promise<EconomicDataRecord[]> {
    const isoDate = date.toISOString().slice(0, 10);
    const rates = await cbeExchangeAdapter.fetchDailyRates(isoDate);
    const usd = rates.find((rate) => rate.currency.toUpperCase() === 'USD');
    if (!usd) return [];

    const value = usd.transactionalSelling ?? usd.cashSelling ?? usd.cashBuying;
    if (value == null) return [];

    return [
      {
        indicatorType: indicator,
        value: Number(value),
        date: usd.rateDate,
        unit: 'ETB per USD',
        source: 'CBE',
        sourceUrl: usd.sourceUrl,
        notes: 'CBE daily USD reference rate (transactional selling where published).',
      },
    ];
  }

  /**
   * Real-estate indices are computed only from stored market_statistics rows.
   * Periods without observations are skipped so the series never contains
   * invented points.
   */
  private async computeFromMarketStatistics(
    indicator: EconomicIndicatorType,
    startDate: Date,
    endDate: Date,
  ): Promise<EconomicDataRecord[]> {
    const stats = await prisma.marketStatistic.findMany({
      where: {
        period: {
          gte: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`,
          lte: `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`,
        },
      },
      orderBy: { period: 'asc' },
    });

    const byPeriod = new Map<string, typeof stats>();
    for (const stat of stats) {
      const bucket = byPeriod.get(stat.period) ?? [];
      bucket.push(stat);
      byPeriod.set(stat.period, bucket);
    }

    const periods = [...byPeriod.keys()].sort();

    if (indicator === EconomicIndicatorType.RENTAL_YIELD_INDEX) {
      const out: EconomicDataRecord[] = [];
      for (const period of periods) {
        const yields = (byPeriod.get(period) ?? [])
          .filter((s) => s.avgPrice && s.avgRentalPrice && Number(s.avgPrice) > 0)
          .map((s) => (Number(s.avgRentalPrice) * 12 * 100) / Number(s.avgPrice));
        if (yields.length === 0) continue;
        out.push({
          indicatorType: indicator,
          value: yields.reduce((a, b) => a + b, 0) / yields.length,
          date: this.periodToDate(period),
          unit: 'percentage',
          source: 'EstatePlus market statistics',
          notes: `Median gross rental yield computed from ${yields.length} stored market statistic row(s) for ${period}.`,
        });
      }
      return out;
    }

    // REAL_ESTATE_PRICE_INDEX — rebased to the first period that has data.
    const periodAverages: Array<{ period: string; avg: number; sample: number }> = [];
    for (const period of periods) {
      const prices = (byPeriod.get(period) ?? [])
        .map((s) => (s.avgPrice != null ? Number(s.avgPrice) : null))
        .filter((v): v is number => v != null && v > 0);
      if (prices.length === 0) continue;
      periodAverages.push({
        period,
        avg: prices.reduce((a, b) => a + b, 0) / prices.length,
        sample: prices.length,
      });
    }

    if (periodAverages.length === 0) return [];

    const base = periodAverages[0]!;
    return periodAverages.map((entry) => ({
      indicatorType: indicator,
      value: (entry.avg / base.avg) * 100,
      date: this.periodToDate(entry.period),
      unit: 'index',
      source: 'EstatePlus market statistics',
      notes: `Index rebased to ${base.period} (=100) from ${entry.sample} stored market statistic row(s).`,
    }));
  }

  // ── Validation / persistence ───────────────────────────────────────────

  private validateRecord(
    record: EconomicDataRecord,
    recordIndex: number,
  ): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!record.indicatorType) errors.push(`record ${recordIndex}: indicator type is required`);
    if (record.value === undefined || record.value === null) {
      errors.push(`record ${recordIndex}: value is required`);
    } else if (typeof record.value !== 'number' || !Number.isFinite(record.value)) {
      errors.push(`record ${recordIndex}: value must be a finite number`);
    }
    if (!record.date || isNaN(record.date.getTime())) {
      errors.push(`record ${recordIndex}: a valid date is required`);
    } else {
      if (record.date > new Date()) errors.push(`record ${recordIndex}: date cannot be in the future`);
      if (record.date < new Date('1900-01-01')) errors.push(`record ${recordIndex}: date cannot be before 1900`);
    }

    if (record.value < 0 && !this.canBeNegative(record.indicatorType)) {
      warnings.push(`record ${recordIndex}: value is negative but this indicator is normally positive`);
    }
    if (record.value > 1_000_000 && record.indicatorType !== EconomicIndicatorType.MONEY_SUPPLY) {
      warnings.push(`record ${recordIndex}: value looks unusually high`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private canBeNegative(indicator: EconomicIndicatorType): boolean {
    const canBeNegativeIndicators: EconomicIndicatorType[] = [
      EconomicIndicatorType.GDP_GROWTH,
      EconomicIndicatorType.CREDIT_GROWTH,
      EconomicIndicatorType.FOREIGN_INVESTMENT,
    ];
    return canBeNegativeIndicators.includes(indicator);
  }

  private async upsertEconomicIndicator(record: EconomicDataRecord, userId?: string): Promise<void> {
    try {
      await prisma.economicIndicator.upsert({
        where: {
          indicatorType_recordedAt: {
            indicatorType: record.indicatorType,
            recordedAt: record.date,
          },
        },
        update: {
          value: record.value,
          unit: record.unit,
          source: record.source,
          sourceUrl: record.sourceUrl,
          notes: record.notes,
        },
        create: {
          indicatorType: record.indicatorType,
          value: record.value,
          recordedAt: record.date,
          unit: record.unit,
          source: record.source,
          sourceUrl: record.sourceUrl,
          notes: record.notes,
          createdBy: userId,
        },
      });
    } catch (error) {
      logger.error({ msg: 'Failed to upsert economic indicator', record, error });
      throw new ProcessingError(`Failed to save economic indicator: ${getErrorMessage(error)}`);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private periodToDate(period: string): Date {
    const [year, month] = period.split('-').map((part) => parseInt(part, 10));
    return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1));
  }

  private getIndicatorUnit(indicator: EconomicIndicatorType): string {
    const units: Record<EconomicIndicatorType, string> = {
      INFLATION_RATE: 'percentage',
      INTEREST_RATE: 'percentage',
      EXCHANGE_RATE: 'ETB per USD',
      CONSTRUCTION_COST_INDEX: 'index',
      GDP_GROWTH: 'percentage',
      UNEMPLOYMENT_RATE: 'percentage',
      CONSUMER_PRICE_INDEX: 'index',
      MONEY_SUPPLY: 'millions ETB',
      BANK_LENDING_RATE: 'percentage',
      GOVERNMENT_DEBT: 'millions ETB',
      IMPORT_PRICE_INDEX: 'index',
      EXPORT_PRICE_INDEX: 'index',
      REAL_ESTATE_PRICE_INDEX: 'index',
      RENTAL_YIELD_INDEX: 'percentage',
      HOUSING_AFFORDABILITY: 'index',
      MORTGAGE_RATE: 'percentage',
      CREDIT_GROWTH: 'percentage',
      FOREIGN_INVESTMENT: 'millions USD',
      TAX_REVENUE: 'millions ETB',
      OTHER: 'units',
    };
    return units[indicator] ?? 'units';
  }
}
