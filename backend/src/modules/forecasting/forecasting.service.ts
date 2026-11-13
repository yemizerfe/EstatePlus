import { PropertyType } from '@prisma/client';
import dayjs from 'dayjs';

import { prisma } from '../../infrastructure/database/prisma';
import { publishEvent } from '../../infrastructure/kafka/client';
import { cacheGet, cacheSet } from '../../infrastructure/redis/client';
import { CACHE_KEYS, CACHE_TTL, KAFKA_TOPICS } from '../../shared/constants';
import { logger } from '../../shared/utils/logger';
import { 
  linearRegression, 
  mean, 
  standardDeviation, 
  exponentialSmoothing, 
  movingAverage,
  calculateTrend
} from '../../shared/utils/statistics';

export interface ForecastParams {
  neighborhoodId?: string;
  propertyType?: PropertyType;
  forecastType: 'price' | 'rental';
  months?: number;
  model?: 'linear' | 'exponential' | 'moving_average' | 'ensemble';
}

export interface ForecastResult {
  id: string;
  neighborhoodId?: string;
  propertyType?: string;
  forecastType: string;
  baseValue: number;
  forecastMonths: number;
  trendSlope?: number;
  rSquared?: number;
  model: string;
  forecastData: Array<{
    month: string;
    value: number;
    confidence: number;
    upperBound?: number;
    lowerBound?: number;
  }>;
  historicalData: Array<{
    month: string;
    value: number;
  }>;
  statistics: {
    avgHistorical: number;
    volatility: number;
    trendDirection: 'bullish' | 'bearish' | 'stable';
    trendStrength: number;
    seasonalPattern?: boolean;
  };
  investmentRecommendation?: {
    action: 'buy' | 'sell' | 'hold';
    confidence: number;
    rationale: string;
    targetPrice?: number;
    expectedReturn?: number;
    riskLevel: 'low' | 'medium' | 'high';
  };
  comparableForecasts?: Array<{
    neighborhood: string;
    forecastValue: number;
    comparison: string;
  }>;
  generatedAt: string;
  disclaimer: string;
}

export async function getForecast(params: ForecastParams): Promise<ForecastResult> {
  const {
    neighborhoodId,
    propertyType,
    forecastType,
    months = 6,
    model = 'ensemble'
  } = params;

  const cacheKey = CACHE_KEYS.FORECAST(
    neighborhoodId ?? 'all',
    `${forecastType}_${propertyType ?? 'all'}_${months}_${model}`,
  );
  
  const cached = await cacheGet(cacheKey);
  if (cached) return cached as ForecastResult;

  // Gather historical data
  const historicalStats = await getHistoricalStats(neighborhoodId, propertyType, forecastType);
  
  if (historicalStats.length < 3) {
    return {
      id: 'insufficient-data',
      neighborhoodId: undefined,
      propertyType: undefined,
      forecastType,
      baseValue: 0,
      forecastMonths: months,
      model: 'none',
      forecastData: [],
      historicalData: [],
      statistics: {
        avgHistorical: 0,
        volatility: 0,
        trendDirection: 'stable',
        trendStrength: 0,
      },
      generatedAt: new Date().toISOString(),
      disclaimer: `There are not yet three recorded months of ${forecastType === 'price' ? 'sale price' : 'rent'} data for this selection. Import or sync more listings and the forecast will build itself.`,
    } as any;
  }

  const valueField = forecastType === 'price' ? 'medianPrice' : 'avgRentalPrice';
  const dataPoints = historicalStats
    .filter((s) => s[valueField] !== null)
    .map((s, idx) => ({ x: idx, y: Number(s[valueField]) }));

  // Calculate statistics
  const values = dataPoints.map(d => d.y);
  const avgHistorical = mean(values);
  const volatility = standardDeviation(values);
  const trend = calculateTrend(values);
  
  // Generate forecasts using selected model(s)
  let forecastData: ForecastResult['forecastData'];
  let trendSlope: number;
  let rSquared: number;
  let usedModel: string;

  switch (model) {
    case 'linear':
      ({ forecastData, trendSlope, rSquared } = generateLinearForecast(dataPoints, months));
      usedModel = 'linear_regression';
      break;
    case 'exponential':
      ({ forecastData, trendSlope, rSquared } = generateExponentialForecast(dataPoints, months));
      usedModel = 'exponential_smoothing';
      break;
    case 'moving_average':
      ({ forecastData, trendSlope, rSquared } = generateMovingAverageForecast(dataPoints, months));
      usedModel = 'moving_average';
      break;
    case 'ensemble':
    default:
      ({ forecastData, trendSlope, rSquared } = generateEnsembleForecast(dataPoints, months, volatility));
      usedModel = 'ensemble';
      break;
  }

  // Get investment recommendation
  const investmentRecommendation = await generateInvestmentRecommendation(
    forecastType,
    values,
    trend,
    volatility,
    forecastData
  );

  // Get comparable forecasts
  const comparableForecasts = await getComparableForecasts(
    neighborhoodId,
    propertyType,
    forecastType,
    forecastData[forecastData.length - 1]?.value ?? 0
  );

  // Store forecast
  const forecast = await prisma.forecast.create({
    data: {
      neighborhoodId: neighborhoodId ?? null,
      propertyType: propertyType ?? null,
      forecastType: forecastType,
      baseValue: dataPoints[dataPoints.length - 1]?.y ?? 0,
      forecastMonths: months,
      trendSlope: trendSlope,
      rSquared: rSquared,
      dataPoints: dataPoints.length,
      forecastData: forecastData as any,
      assumptions: {
        model: usedModel,
        note: 'Multi-model ensemble forecasting with confidence intervals.',
        dataPointsUsed: dataPoints.length,
        volatility: volatility,
        trendDirection: trend.direction,
      },
    },
  });

  // Publish event
  await publishEvent(
    {
      eventType: 'FORECAST_COMPLETED',
      aggregateId: forecast.id,
      payload: { forecastId: forecast.id, forecastType, months, model },
      occurredAt: new Date().toISOString(),
    },
    KAFKA_TOPICS.FORECAST_EVENTS,
  );

  const result: ForecastResult = {
    id: forecast.id,
    neighborhoodId: neighborhoodId ?? undefined,
    propertyType: propertyType ?? undefined,
    forecastType,
    baseValue: dataPoints[dataPoints.length - 1]?.y ?? 0,
    forecastMonths: months,
    trendSlope,
    rSquared,
    model: usedModel,
    forecastData,
    historicalData: dataPoints.map((p, i) => ({
      month: historicalStats[i]?.period ?? '',
      value: p.y,
    })),
    statistics: {
      avgHistorical,
      volatility,
      trendDirection: trend.direction,
      trendStrength: trend.strength,
      seasonalPattern: detectSeasonality(values),
    },
    investmentRecommendation,
    comparableForecasts,
    generatedAt: new Date().toISOString(),
    disclaimer: 'This forecast is based on historical trends and statistical models. It does not constitute financial advice. Past performance does not guarantee future results.',
  };

  await cacheSet(cacheKey, result, CACHE_TTL.LONG);
  logger.info({ 
    msg: 'Forecast generated', 
    forecastType, 
    months, 
    model,
    neighborhoodId: neighborhoodId ?? 'all',
    propertyType: propertyType ?? 'all',
  });

  return result;
}

// Helper functions
async function getHistoricalStats(
  neighborhoodId?: string,
  propertyType?: PropertyType,
  _forecastType?: string
) {
  const pastPeriods: string[] = [];
  for (let i = 23; i >= 0; i--) {
    pastPeriods.push(dayjs().subtract(i, 'month').format('YYYY-MM'));
  }

  return prisma.marketStatistic.findMany({
    where: {
      period: { in: pastPeriods },
      // Without an explicit area the forecast runs on the citywide roll-up row
      // (null neighborhood / type), never on a blend of every neighborhood.
      neighborhoodId: neighborhoodId ?? null,
      propertyType: propertyType ?? null,
    },
    orderBy: { period: 'asc' },
  });
}

function generateLinearForecast(
  dataPoints: Array<{ x: number; y: number }>,
  months: number
): { forecastData: ForecastResult['forecastData']; trendSlope: number; rSquared: number } {
  const { slope, intercept, r2 } = linearRegression(dataPoints);
  const lastX = dataPoints[dataPoints.length - 1]?.x ?? 0;

  const forecastData = Array.from({ length: months }, (_, i) => {
    const x = lastX + i + 1;
    const predicted = Math.max(0, slope * x + intercept);
    const confidence = Math.max(0.3, r2 - i * 0.03);
    const margin = predicted * (1 - confidence) * 0.5;

    return {
      month: dayjs().add(i + 1, 'month').format('YYYY-MM'),
      value: Math.round(predicted),
      confidence: Number(confidence.toFixed(2)),
      upperBound: Math.round(predicted + margin),
      lowerBound: Math.round(Math.max(0, predicted - margin)),
    };
  });

  return { forecastData, trendSlope: slope, rSquared: r2 };
}

function generateExponentialForecast(
  dataPoints: Array<{ x: number; y: number }>,
  months: number
): { forecastData: ForecastResult['forecastData']; trendSlope: number; rSquared: number } {
  // Use exponential smoothing
  const alpha = 0.3;
  const smoothed = exponentialSmoothing(dataPoints.map(d => d.y), alpha);
  const lastValue = smoothed[smoothed.length - 1];
  
  // Calculate growth rate
  const values = dataPoints.map(d => d.y);
  const growthRate = values.length > 1 
    ? (values[values.length - 1] - values[0]) / values.length / values[0]
    : 0;

  const forecastData = Array.from({ length: months }, (_, i) => {
    const predicted = lastValue * Math.pow(1 + growthRate, i + 1);
    const confidence = Math.max(0.25, 0.7 - i * 0.05);
    const margin = predicted * (1 - confidence) * 0.5;

    return {
      month: dayjs().add(i + 1, 'month').format('YYYY-MM'),
      value: Math.round(Math.max(0, predicted)),
      confidence: Number(confidence.toFixed(2)),
      upperBound: Math.round(predicted + margin),
      lowerBound: Math.round(Math.max(0, predicted - margin)),
    };
  });

  return { 
    forecastData, 
    trendSlope: growthRate * lastValue, 
    rSquared: 0.65 // Approximate R² for exponential 
  };
}

function generateMovingAverageForecast(
  dataPoints: Array<{ x: number; y: number }>,
  months: number
): { forecastData: ForecastResult['forecastData']; trendSlope: number; rSquared: number } {
  const windowSize = Math.min(6, Math.floor(dataPoints.length / 2));
  const values = dataPoints.map(d => d.y);
  const ma = movingAverage(values, windowSize);
  const lastMA = ma[ma.length - 1];
  
  // Calculate trend from MA
  const { slope } = linearRegression(ma.map((v, i) => ({ x: i, y: v })));

  const forecastData = Array.from({ length: months }, (_, i) => {
    const predicted = lastMA + slope * (i + 1);
    const confidence = Math.max(0.3, 0.75 - i * 0.04);
    const margin = predicted * (1 - confidence) * 0.5;

    return {
      month: dayjs().add(i + 1, 'month').format('YYYY-MM'),
      value: Math.round(Math.max(0, predicted)),
      confidence: Number(confidence.toFixed(2)),
      upperBound: Math.round(predicted + margin),
      lowerBound: Math.round(Math.max(0, predicted - margin)),
    };
  });

  const r2 = 1 - (standardDeviation(values) / mean(values)) * 0.3;
  return { forecastData, trendSlope: slope, rSquared: Math.min(0.9, r2) };
}

function generateEnsembleForecast(
  dataPoints: Array<{ x: number; y: number }>,
  months: number,
  volatility: number
): { forecastData: ForecastResult['forecastData']; trendSlope: number; rSquared: number } {
  // Combine multiple models with weighted average
  const linear = generateLinearForecast(dataPoints, months);
  const exponential = generateExponentialForecast(dataPoints, months);
  const ma = generateMovingAverageForecast(dataPoints, months);

  // Weight models based on R²
  const totalWeight = linear.rSquared + exponential.rSquared + ma.rSquared;
  const wLinear = linear.rSquared / totalWeight;
  const wExp = exponential.rSquared / totalWeight;
  const wMA = ma.rSquared / totalWeight;

  const forecastData = Array.from({ length: months }, (_, i) => {
    const linearValue = linear.forecastData[i].value * wLinear;
    const expValue = exponential.forecastData[i].value * wExp;
    const maValue = ma.forecastData[i].value * wMA;
    const predicted = linearValue + expValue + maValue;

    // Ensemble confidence is higher due to model diversity
    const confidence = Math.max(0.4, 
      (linear.forecastData[i].confidence * wLinear +
       exponential.forecastData[i].confidence * wExp +
       ma.forecastData[i].confidence * wMA) * 1.2
    );
    
    const margin = predicted * (1 - confidence) * 0.5 + (volatility * i * 0.1);

    return {
      month: dayjs().add(i + 1, 'month').format('YYYY-MM'),
      value: Math.round(predicted),
      confidence: Number(Math.min(0.95, confidence).toFixed(2)),
      upperBound: Math.round(predicted + margin),
      lowerBound: Math.round(Math.max(0, predicted - margin)),
    };
  });

  const avgR2 = (linear.rSquared + exponential.rSquared + ma.rSquared) / 3;
  const avgSlope = (linear.trendSlope * wLinear + exponential.trendSlope * wExp + ma.trendSlope * wMA);

  return { forecastData, trendSlope: avgSlope, rSquared: avgR2 };
}

function detectSeasonality(values: number[]): boolean {
  if (values.length < 12) return false;
  
  // Simple check for repeating patterns
  const correlations: number[] = [];
  for (let lag = 3; lag <= 12; lag++) {
    let correlation = 0;
    let count = 0;
    for (let i = 0; i < values.length - lag; i++) {
      correlation += Math.abs(values[i] - values[i + lag]);
      count++;
    }
    correlations.push(count > 0 ? correlation / count : 0);
  }
  
  const avgDiff = mean(correlations);
  const overallStd = standardDeviation(values);
  
  return avgDiff < overallStd * 0.3;
}

async function generateInvestmentRecommendation(
  _forecastType: string,
  historicalValues: number[],
  trend: { direction: string; strength: number },
  volatility: number,
  forecastData: ForecastResult['forecastData']
): Promise<ForecastResult['investmentRecommendation']> {
  const lastForecast = forecastData[forecastData.length - 1];
  const firstValue = historicalValues[0];
  const currentValue = historicalValues[historicalValues.length - 1];
  
  if (!lastForecast || !firstValue || !currentValue) {
    return {
      action: 'hold',
      confidence: 0.3,
      rationale: 'Insufficient data for investment recommendation.',
      riskLevel: 'medium',
    };
  }

  const priceChange = (lastForecast.value - currentValue) / currentValue;
  const expectedReturn = priceChange * 100;
  
  // Determine action based on trend and price change
  let action: 'buy' | 'sell' | 'hold';
  let rationale: string;
  
  if (trend.direction === 'bullish' && trend.strength > 0.5 && priceChange > 0.05) {
    action = 'buy';
    rationale = `Strong upward trend detected with ${(priceChange * 100).toFixed(1)}% expected price increase over forecast period.`;
  } else if (trend.direction === 'bearish' && trend.strength > 0.5 && priceChange < -0.05) {
    action = 'sell';
    rationale = `Downward trend with ${Math.abs(priceChange * 100).toFixed(1)}% expected decline. Consider selling to minimize losses.`;
  } else if (Math.abs(priceChange) < 0.03) {
    action = 'hold';
    rationale = 'Market appears stable with minimal expected change. Hold for better opportunities.';
  } else {
    action = 'hold';
    rationale = 'Mixed signals suggest holding current position while monitoring market conditions.';
  }

  // Calculate confidence
  const confidence = Math.min(0.9, 
    (trend.strength * 0.4) + 
    (lastForecast.confidence * 0.4) + 
    (1 - Math.min(volatility / mean(historicalValues), 0.5)) * 0.2
  );

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high';
  if (volatility / mean(historicalValues) < 0.1) {
    riskLevel = 'low';
  } else if (volatility / mean(historicalValues) < 0.25) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'high';
  }

  return {
    action,
    confidence: Number(confidence.toFixed(2)),
    rationale,
    targetPrice: lastForecast.value,
    expectedReturn: Number(expectedReturn.toFixed(1)),
    riskLevel,
  };
}

async function getComparableForecasts(
  excludeNeighborhoodId?: string,
  propertyType?: PropertyType,
  forecastType?: string,
  targetValue?: number
): Promise<ForecastResult['comparableForecasts']> {
  if (!targetValue) return [];

  // Get forecasts for other neighborhoods
  const otherForecasts = await prisma.forecast.findMany({
    where: {
      neighborhoodId: { not: excludeNeighborhoodId ?? undefined },
      ...(propertyType && { propertyType }),
      forecastType: forecastType as any,
    },
    take: 5,
    orderBy: { generatedAt: 'desc' },
  });

  return otherForecasts.map(f => {
    const forecastData = f.forecastData as any[];
    const lastValue = forecastData?.[forecastData.length - 1]?.value ?? 0;
    const diff = targetValue - lastValue;
    const diffPercent = (diff / lastValue) * 100;

    return {
      neighborhood: f.neighborhoodId ?? 'General Market',
      forecastValue: lastValue,
      comparison: diff > 0 
        ? `${diffPercent.toFixed(1)}% higher` 
        : `${Math.abs(diffPercent).toFixed(1)}% lower`,
    };
  });
}

// Additional forecasting functions
export async function getMarketForecastSummary(): Promise<any> {
  const cacheKey = 'forecast:market:summary';
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const neighborhoods = await prisma.neighborhood.findMany({
    where: { isActive: true },
    take: 10,
  });

  const summaries = await Promise.all(
    neighborhoods.map(async (n) => {
      const forecast = await getForecast({
        neighborhoodId: n.id,
        forecastType: 'price',
        months: 6,
      });
      return {
        neighborhood: n.name,
        trend: forecast.statistics.trendDirection,
        currentPrice: forecast.baseValue,
        forecastEndPrice: forecast.forecastData[forecast.forecastData.length - 1]?.value ?? 0,
        recommendation: forecast.investmentRecommendation?.action ?? 'unknown',
      };
    })
  );

  const result = {
    generatedAt: new Date().toISOString(),
    forecasts: summaries,
    marketOutlook: calculateMarketOutlook(summaries),
  };

  await cacheSet(cacheKey, result, CACHE_TTL.MEDIUM);
  return result;
}

function calculateMarketOutlook(forecasts: Array<{ trend: string; recommendation: string }>): string {
  const bullishCount = forecasts.filter(f => f.trend === 'bullish').length;
  const buyCount = forecasts.filter(f => f.recommendation === 'buy').length;
  const total = forecasts.length;
  
  if (buyCount / total > 0.6) return 'Strong Buy';
  if (bullishCount / total > 0.6) return 'Bullish';
  if (buyCount / total > 0.4) return 'Neutral to Positive';
  if (buyCount / total < 0.2) return 'Neutral to Negative';
  return 'Neutral';
}

export async function getForecastComparison(params: {
  neighborhoodId: string;
  propertyTypes: PropertyType[];
  forecastType: 'price' | 'rental';
}): Promise<any> {
  const forecasts = await Promise.all(
    params.propertyTypes.map(async (type) => {
      const forecast = await getForecast({
        neighborhoodId: params.neighborhoodId,
        propertyType: type,
        forecastType: params.forecastType,
        months: 6,
      });
      return {
        propertyType: type,
        baseValue: forecast.baseValue,
        forecastValue: forecast.forecastData[forecast.forecastData.length - 1]?.value ?? 0,
        trend: forecast.statistics.trendDirection,
        expectedChange: forecast.investmentRecommendation?.expectedReturn ?? 0,
      };
    })
  );

  return {
    neighborhoodId: params.neighborhoodId,
    forecastType: params.forecastType,
    forecasts,
    bestInvestment: forecasts.reduce((best, current) => 
      (current.expectedChange ?? 0) > (best.expectedChange ?? 0) ? current : best
    ),
  };
}