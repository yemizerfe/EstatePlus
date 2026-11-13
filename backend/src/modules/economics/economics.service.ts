import { EconomicIndicatorType } from '@prisma/client';
import dayjs from 'dayjs';

import { prisma } from '../../infrastructure/database/prisma';
import { publishEvent } from '../../infrastructure/kafka/client';
import { cacheGet, cacheSet, cacheDelPattern } from '../../infrastructure/redis/client';
import { CACHE_KEYS, CACHE_TTL, KAFKA_TOPICS } from '../../shared/constants';
import { auditLogger } from '../../middleware/auditLog';
import { BadRequestError, NotFoundError } from '../../shared/utils/errors';
import { mean, standardDeviation, percentileChange, correlation } from '../../shared/utils/statistics';

// ─── Interfaces ──────────────────────────────────────────────

export interface EconomicIndicatorDto {
  indicatorType: EconomicIndicatorType;
  value: number;
  unit: string;
  recordedAt: string;
  source?: string;
  sourceUrl?: string;
  notes?: string;
}

export interface IndicatorAnalysisQuery {
  indicators: EconomicIndicatorType[];
  startDate?: Date;
  endDate?: Date;
  aggregation?: 'monthly' | 'quarterly' | 'yearly';
  includeCorrelation?: boolean;
  includeForecasting?: boolean;
}

export interface IndicatorTrendAnalysis {
  indicator: EconomicIndicatorType;
  currentValue: number;
  previousValue: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  volatility: number;
  seasonality?: number;
  correlation?: Record<string, number>;
}

// ─── Core Functions ──────────────────────────────────────────

export async function getIndicators(type?: EconomicIndicatorType, months = 24) {
  const cacheKey = CACHE_KEYS.ECONOMIC_INDICATORS(type);
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const since = dayjs().subtract(months, 'months').toDate();

  const indicators = await prisma.economicIndicator.findMany({
    where: {
      ...(type && { indicatorType: type }),
      recordedAt: { gte: since },
    },
    include: {
      creator: {
        select: { firstName: true, lastName: true, email: true }
      }
    },
    orderBy: { recordedAt: 'asc' },
  });

  const result = indicators.map((i) => ({ 
    ...i, 
    value: Number(i.value),
    creator: i.creator ? {
      name: `${i.creator.firstName} ${i.creator.lastName}`,
      email: i.creator.email
    } : null
  }));

  await cacheSet(cacheKey, result, CACHE_TTL.LONG);
  return result;
}

export async function getLatestIndicators() {
  const cacheKey = 'economics:latest';
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const types = Object.values(EconomicIndicatorType);
  const latest = await Promise.all(
    types.map(async (type) => {
      const indicator = await prisma.economicIndicator.findFirst({
        where: { indicatorType: type },
        orderBy: { recordedAt: 'desc' },
        include: {
          creator: {
            select: { firstName: true, lastName: true }
          }
        }
      });
      
      return indicator ? {
        ...indicator,
        value: Number(indicator.value),
        creator: indicator.creator ? `${indicator.creator.firstName} ${indicator.creator.lastName}` : null
      } : null;
    })
  );

  const result = latest.filter(Boolean);
  await cacheSet(cacheKey, result, CACHE_TTL.MEDIUM);
  return result;
}

export async function addIndicator(data: EconomicIndicatorDto, userId: string) {
  // Validate date format and ensure it's not in the future
  const recordedDate = dayjs(data.recordedAt);
  if (!recordedDate.isValid()) {
    throw new BadRequestError('Invalid date format');
  }

  if (recordedDate.isAfter(dayjs())) {
    throw new BadRequestError('Cannot record indicators for future dates');
  }

  const indicator = await prisma.economicIndicator.upsert({
    where: {
      indicatorType_recordedAt: {
        indicatorType: data.indicatorType,
        recordedAt: recordedDate.toDate(),
      },
    },
    update: { 
      value: data.value, 
      unit: data.unit, 
      source: data.source, 
      sourceUrl: data.sourceUrl,
      notes: data.notes,
      createdBy: userId
    },
    create: { 
      ...data, 
      recordedAt: recordedDate.toDate(),
      createdBy: userId
    },
    include: {
      creator: {
        select: { firstName: true, lastName: true, email: true }
      }
    }
  });

  // Clear related caches
  await cacheDelPattern('economics:*');

  // Publish event
  await publishEvent(
    {
      eventType: 'ECONOMIC_INDICATOR_UPDATED',
      aggregateId: indicator.id,
      payload: { 
        indicatorType: indicator.indicatorType, 
        value: Number(indicator.value),
        recordedAt: indicator.recordedAt.toISOString(),
        userId
      },
      occurredAt: new Date().toISOString(),
    },
    KAFKA_TOPICS.ECONOMIC_EVENTS,
  );

  auditLogger.info('Economic indicator added/updated', {
    indicatorId: indicator.id,
    indicatorType: data.indicatorType,
    value: data.value,
    recordedAt: data.recordedAt,
    userId
  });

  return { 
    ...indicator, 
    value: Number(indicator.value),
    creator: indicator.creator ? {
      name: `${indicator.creator.firstName} ${indicator.creator.lastName}`,
      email: indicator.creator.email
    } : null
  };
}

export async function deleteIndicator(indicatorId: string, userId: string) {
  const indicator = await prisma.economicIndicator.findUnique({
    where: { id: indicatorId }
  });

  if (!indicator) {
    throw new NotFoundError('Economic indicator not found');
  }

  await prisma.economicIndicator.delete({
    where: { id: indicatorId }
  });

  // Clear caches
  await cacheDelPattern('economics:*');

  auditLogger.info('Economic indicator deleted', {
    indicatorId,
    indicatorType: indicator.indicatorType,
    userId
  });

  return { message: 'Economic indicator deleted successfully' };
}

// ─── Advanced Analytics ──────────────────────────────────────

export async function getIndicatorTrendAnalysis(
  indicatorType: EconomicIndicatorType,
  months: number = 12
): Promise<IndicatorTrendAnalysis> {
  const since = dayjs().subtract(months, 'months').toDate();
  
  const indicators = await prisma.economicIndicator.findMany({
    where: {
      indicatorType,
      recordedAt: { gte: since }
    },
    orderBy: { recordedAt: 'asc' }
  });

  if (indicators.length < 2) {
    throw new BadRequestError('Not enough data points for trend analysis');
  }

  const values = indicators.map(i => Number(i.value));
  const currentValue = values[values.length - 1];
  const previousValue = values[values.length - 2];
  
  const changePercent = percentileChange(currentValue, previousValue);
  const volatility = standardDeviation(values);
  
  // Determine trend
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (Math.abs(changePercent) > 0.5) {
    trend = changePercent > 0 ? 'up' : 'down';
  }

  // Calculate seasonality (simplified)
  const seasonality = calculateSeasonality(indicators);

  return {
    indicator: indicatorType,
    currentValue,
    previousValue,
    changePercent: Number(changePercent.toFixed(2)),
    trend,
    volatility: Number(volatility.toFixed(4)),
    seasonality: Number(seasonality.toFixed(2))
  };
}

export async function getMultiIndicatorAnalysis(query: IndicatorAnalysisQuery) {
  const startTime = performance.now();
  
  const startDate = query.startDate || dayjs().subtract(24, 'months').toDate();
  const endDate = query.endDate || new Date();

  const indicatorData = await Promise.all(
    query.indicators.map(async (type) => {
      const data = await prisma.economicIndicator.findMany({
        where: {
          indicatorType: type,
          recordedAt: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { recordedAt: 'asc' }
      });

      return {
        type,
        data: data.map(d => ({
          date: d.recordedAt,
          value: Number(d.value),
          unit: d.unit
        }))
      };
    })
  );

  // Calculate correlations if requested
  let correlations: Record<string, Record<string, number>> = {};
  if (query.includeCorrelation && query.indicators.length > 1) {
    correlations = calculateIndicatorCorrelations(indicatorData);
  }

  // Aggregate data if requested
  let aggregatedData = indicatorData;
  if (query.aggregation && query.aggregation !== 'monthly') {
    aggregatedData = aggregateIndicatorData(indicatorData, query.aggregation);
  }

  const calculationTime = Math.round(performance.now() - startTime);

  return {
    metadata: {
      calculationTime,
      period: { start: startDate, end: endDate },
      aggregation: query.aggregation || 'monthly'
    },
    indicators: aggregatedData,
    correlations,
    summary: {
      totalIndicators: query.indicators.length,
      totalDataPoints: indicatorData.reduce((sum, ind) => sum + ind.data.length, 0),
      dateRange: {
        earliest: Math.min(...indicatorData.flatMap(ind => ind.data.map(d => d.date.getTime()))),
        latest: Math.max(...indicatorData.flatMap(ind => ind.data.map(d => d.date.getTime())))
      }
    }
  };
}

export async function getIndicatorImpactAnalysis(indicatorType: EconomicIndicatorType) {
  const cacheKey = `economics:impact:${indicatorType}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  // Get property market data correlation
  const [indicatorData, marketData] = await Promise.all([
    prisma.economicIndicator.findMany({
      where: { indicatorType },
      orderBy: { recordedAt: 'desc' },
      take: 24
    }),
    prisma.marketStatistic.findMany({
      orderBy: { period: 'desc' },
      take: 24
    })
  ]);

  if (indicatorData.length < 5 || marketData.length < 5) {
    return {
      indicator: indicatorType,
      impact: 'insufficient_data',
      correlation: 0,
      description: 'Not enough data for meaningful impact analysis'
    };
  }

  // Calculate correlation with property prices
  const indicatorValues = indicatorData.map(d => Number(d.value)).reverse();
  const propertyPrices = marketData.map(d => Number(d.avgPrice)).reverse().slice(0, indicatorValues.length);

  const priceCorrelation = correlation(indicatorValues, propertyPrices);
  
  // Determine impact level
  const impactLevel = Math.abs(priceCorrelation) > 0.7 ? 'high' : 
                     Math.abs(priceCorrelation) > 0.4 ? 'moderate' : 'low';

  const impact = {
    indicator: indicatorType,
    impact: impactLevel,
    correlation: Number(priceCorrelation.toFixed(3)),
    description: generateImpactDescription(indicatorType, priceCorrelation, impactLevel),
    lastUpdated: indicatorData[0]?.recordedAt,
    dataPoints: indicatorData.length
  };

  await cacheSet(cacheKey, impact, CACHE_TTL.LONG);
  return impact;
}

// ─── Helper Functions ────────────────────────────────────────

function calculateSeasonality(indicators: any[]): number {
  // Group by month and calculate average variation
  const monthlyValues: Record<number, number[]> = {};
  
  indicators.forEach(indicator => {
    const month = new Date(indicator.recordedAt).getMonth();
    if (!monthlyValues[month]) monthlyValues[month] = [];
    monthlyValues[month].push(Number(indicator.value));
  });

  const monthlyAverages = Object.values(monthlyValues)
    .map(values => mean(values));

  if (monthlyAverages.length < 3) return 0;

  const overallMean = mean(monthlyAverages);
  const variations = monthlyAverages.map(avg => Math.abs(avg - overallMean) / overallMean * 100);
  
  return mean(variations);
}

function calculateIndicatorCorrelations(indicatorData: any[]): Record<string, Record<string, number>> {
  const correlations: Record<string, Record<string, number>> = {};

  for (let i = 0; i < indicatorData.length; i++) {
    correlations[indicatorData[i].type] = {};
    
    for (let j = 0; j < indicatorData.length; j++) {
      if (i === j) {
        correlations[indicatorData[i].type][indicatorData[j].type] = 1;
        continue;
      }

      const values1 = indicatorData[i].data.map((d: any) => d.value);
      const values2 = indicatorData[j].data.map((d: any) => d.value);
      
      // Align data points by date (simplified)
      const minLength = Math.min(values1.length, values2.length);
      const alignedValues1 = values1.slice(-minLength);
      const alignedValues2 = values2.slice(-minLength);

      const corr = correlation(alignedValues1, alignedValues2);
      correlations[indicatorData[i].type][indicatorData[j].type] = Number(corr.toFixed(3));
    }
  }

  return correlations;
}

function aggregateIndicatorData(indicatorData: any[], aggregation: 'quarterly' | 'yearly') {
  return indicatorData.map(indicator => ({
    ...indicator,
    data: aggregateTimeSeriesData(indicator.data, aggregation)
  }));
}

function aggregateTimeSeriesData(data: any[], aggregation: 'quarterly' | 'yearly') {
  const grouped: Record<string, any[]> = {};

  data.forEach(point => {
    const date = dayjs(point.date);
    let key: string;

    if (aggregation === 'quarterly') {
      const quarter = Math.ceil((date.month() + 1) / 3);
      key = `${date.year()}-Q${quarter}`;
    } else {
      key = date.year().toString();
    }

    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(point);
  });

  return Object.entries(grouped).map(([period, points]) => ({
    period,
    value: mean(points.map(p => p.value)),
    count: points.length,
    date: points[Math.floor(points.length / 2)].date // Use middle date as representative
  }));
}

function generateImpactDescription(
  indicator: EconomicIndicatorType, 
  correlation: number, 
  impact: string
): string {
  const direction = correlation > 0 ? 'positive' : 'negative';
  const strength = impact === 'high' ? 'strong' : impact === 'moderate' ? 'moderate' : 'weak';
  
  const descriptions: Record<EconomicIndicatorType, string> = {
    INFLATION_RATE: `Inflation shows ${strength} ${direction} correlation with property prices`,
    INTEREST_RATE: `Interest rates have ${strength} ${direction} impact on property affordability`,
    CONSTRUCTION_COST_INDEX: `Construction costs show ${strength} ${direction} correlation with property values`,
    GDP_GROWTH: `Economic growth has ${strength} ${direction} influence on real estate demand`,
    UNEMPLOYMENT_RATE: `Employment levels show ${strength} ${direction} correlation with property market activity`,
    EXCHANGE_RATE: `Currency fluctuations have ${strength} ${direction} impact on foreign property investment`,
    MORTGAGE_RATE: `Mortgage rates demonstrate ${strength} ${direction} correlation with property affordability`,
    CONSUMER_PRICE_INDEX: `Consumer prices show ${strength} ${direction} correlation with housing costs`,
    MONEY_SUPPLY: `Money supply growth has ${strength} ${direction} impact on asset prices including real estate`,
    BANK_LENDING_RATE: `Bank lending rates show ${strength} ${direction} correlation with property financing costs`,
    GOVERNMENT_DEBT: `Government debt levels have ${strength} ${direction} influence on economic stability and property markets`,
    IMPORT_PRICE_INDEX: `Import prices show ${strength} ${direction} correlation with construction material costs`,
    EXPORT_PRICE_INDEX: `Export prices have ${strength} ${direction} impact on foreign exchange and property investment`,
    REAL_ESTATE_PRICE_INDEX: `Real estate index shows ${strength} ${direction} correlation with local property values`,
    RENTAL_YIELD_INDEX: `Rental yields demonstrate ${strength} ${direction} correlation with investment property returns`,
    HOUSING_AFFORDABILITY: `Housing affordability has ${strength} ${direction} impact on property market accessibility`,
    CREDIT_GROWTH: `Credit growth shows ${strength} ${direction} correlation with property market liquidity`,
    FOREIGN_INVESTMENT: `Foreign investment demonstrates ${strength} ${direction} impact on property demand`,
    TAX_REVENUE: `Tax revenue levels show ${strength} ${direction} correlation with economic health and property markets`,
    OTHER: `This indicator shows ${strength} ${direction} correlation with property market trends`
  };

  return descriptions[indicator];
}
