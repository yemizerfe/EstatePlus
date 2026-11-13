import { PropertyType, PropertyStatus } from '@prisma/client';
import dayjs from 'dayjs';

import { prisma } from '../../infrastructure/database/prisma';
import { cacheGet, cacheSet } from '../../infrastructure/redis/client';
import { CACHE_KEYS, CACHE_TTL } from '../../shared/constants';
import { etbEligiblePropertyWhere } from '../../shared/utils/eligibility';
import { logger } from '../../shared/utils/logger';
import { mean, median, percentileChange, removeOutliers, standardDeviation } from '../../shared/utils/statistics';
import { auditLogger } from '../../middleware/auditLog';
import { publishEvent } from '../../infrastructure/kafka/client';
import { KAFKA_TOPICS } from '../../shared/constants';

export interface MarketDashboardQuery {
  neighborhoodId?: string;
  propertyType?: PropertyType;
  period?: string; // YYYY-MM
}

export interface MarketAnalysisQuery {
  neighborhoodIds?: string[];
  propertyTypes?: PropertyType[];
  startPeriod?: string; // YYYY-MM
  endPeriod?: string; // YYYY-MM
  includeComparisons?: boolean;
  includeForecasts?: boolean;
}

export interface MarketSegmentAnalysis {
  segment: {
    neighborhoodId?: string;
    propertyType?: PropertyType;
    neighborhoodName?: string;
  };
  metrics: {
    avgPrice: number;
    medianPrice: number;
    pricePerSqm: number;
    avgRentalPrice: number;
    rentalYield: number;
    priceGrowth: number;
    rentGrowth: number;
    volatility: number;
    liquidityScore: number;
  };
  inventory: {
    activeListings: number;
    totalVolume: number;
    avgDaysOnMarket: number | null;
  };
  trends: {
    momentum: 'bullish' | 'bearish' | 'neutral';
    strength: 'strong' | 'moderate' | 'weak';
    seasonality: number;
  };
}

export async function getDashboardStats(query: MarketDashboardQuery) {
  const cacheKey = CACHE_KEYS.MARKET_STATS(query.neighborhoodId, query.propertyType, query.period);
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const period = query.period ?? dayjs().format('YYYY-MM');
  const prevPeriod = dayjs(period + '-01').subtract(1, 'month').format('YYYY-MM');

  const propertyWhere = {
    // Approved inventory is what the public market pages publish; legacy rows
    // may still carry ACTIVE, so both statuses count as live supply.
    status: { in: ['APPROVED', 'ACTIVE'] as PropertyStatus[] },
    ...(query.neighborhoodId && { neighborhoodId: query.neighborhoodId }),
    ...(query.propertyType && { propertyType: query.propertyType }),
    neighborhood: { is: { city: { equals: 'Addis Ababa', mode: 'insensitive' as const } } },
    ...etbEligiblePropertyWhere(),
  };

  const properties = await prisma.property.findMany({
    where: propertyWhere,
    select: {
      askingPrice: true,
      rentalPrice: true,
      sizeSqm: true,
      listings: {
        where: { status: 'ACTIVE' },
        select: { listedAt: true, status: true },
      },
    },
  });

  const prices = removeOutliers(properties.map((p) => Number(p.askingPrice)));
  const rentals = removeOutliers(
    properties.filter((p) => p.rentalPrice).map((p) => Number(p.rentalPrice)),
  );

  const avgPrice = mean(prices);
  const medianPrice = median(prices);
  const avgRentalPrice = mean(rentals);
  const pricePerSqm = properties.length > 0
    ? mean(properties.map((p) => Number(p.askingPrice) / Number(p.sizeSqm)))
    : 0;

  const rentalYield = avgPrice > 0 && avgRentalPrice > 0
    ? ((avgRentalPrice * 12) / avgPrice) * 100
    : 0;

  // Calculate advanced metrics
  const priceVariance = standardDeviation(prices);
  const medianRental = median(rentals);
  const priceRange = prices.length
    ? { min: Math.min(...prices), max: Math.max(...prices) }
    : { min: 0, max: 0 };
  const rentRange = rentals.length
    ? { min: Math.min(...rentals), max: Math.max(...rentals) }
    : { min: 0, max: 0 };

  // Get growth from market_statistics table
  const [currentStat, prevStat] = await Promise.all([
    prisma.marketStatistic.findFirst({
      where: {
        period,
        neighborhoodId: query.neighborhoodId ?? null,
        propertyType: query.propertyType ?? null,
      },
    }),
    prisma.marketStatistic.findFirst({
      where: {
        period: prevPeriod,
        neighborhoodId: query.neighborhoodId ?? null,
        propertyType: query.propertyType ?? null,
      },
    }),
  ]);

  const priceGrowth = currentStat?.avgPrice && prevStat?.avgPrice
    ? percentileChange(Number(currentStat.avgPrice), Number(prevStat.avgPrice))
    : 0;

  const rentGrowth = currentStat?.avgRentalPrice && prevStat?.avgRentalPrice
    ? percentileChange(Number(currentStat.avgRentalPrice), Number(prevStat.avgRentalPrice))
    : 0;

  const stats = {
    period,
    avgPrice: Math.round(avgPrice),
    medianPrice: Math.round(medianPrice),
    pricePerSqm: Math.round(pricePerSqm),
    avgRentalPrice: Math.round(avgRentalPrice),
    medianRentalPrice: Math.round(medianRental),
    rentalYield: Number(rentalYield.toFixed(2)),
    priceGrowth: Number(priceGrowth.toFixed(2)),
    rentGrowth: Number(rentGrowth.toFixed(2)),
    activeListings: properties.length,
    priceVariance: Math.round(priceVariance),
    priceRange,
    rentRange,
    calculatedAt: new Date().toISOString(),
  };

  await cacheSet(cacheKey, stats, CACHE_TTL.MEDIUM);
  logger.info({ msg: 'market.analytics.completed', period, duration: '0ms' });
  return stats;
}

export async function getPriceTrend(query: { neighborhoodId?: string; propertyType?: PropertyType; months?: number }) {
  const months = query.months ?? 12;
  const periods: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    periods.push(dayjs().subtract(i, 'month').format('YYYY-MM'));
  }

  const stats = await prisma.marketStatistic.findMany({
    where: {
      period: { in: periods },
      // The citywide roll-up is the row with no neighborhood/property filter;
      // picking it explicitly avoids mixing per-area rows into one series.
      neighborhoodId: query.neighborhoodId ?? null,
      propertyType: query.propertyType ?? null,
    },
    orderBy: { period: 'asc' },
  });

  // Months without recorded listings carry no median; plotting them would draw
  // the series through invented zero points, so they are omitted entirely.
  return periods
    .map((period) => {
      const s = stats.find((x) => x.period === period);
      return {
        period,
        avgPrice: s?.avgPrice ? Number(s.avgPrice) : null,
        medianPrice: s?.medianPrice ? Number(s.medianPrice) : null,
        avgRentalPrice: s?.avgRentalPrice ? Number(s.avgRentalPrice) : null,
        priceGrowth: s?.priceGrowth !== null && s?.priceGrowth !== undefined ? Number(s.priceGrowth) : null,
        activeListings: s?.activeListings ?? null,
      };
    })
    .filter((point) => point.activeListings !== null);
}

export async function calculateAndStoreMarketStats(
  period: string,
  neighborhoodId?: string,
  propertyType?: PropertyType,
): Promise<void> {
  const properties = await prisma.property.findMany({
    where: {
      status: 'ACTIVE',
      ...(neighborhoodId && { neighborhoodId }),
      ...(propertyType && { propertyType }),
      neighborhood: { is: { city: { equals: 'Addis Ababa', mode: 'insensitive' as const } } },
      listingDate: {
        gte: new Date(period + '-01'),
        lte: new Date(dayjs(period + '-01').endOf('month').toDate()),
      },
      ...etbEligiblePropertyWhere(),
    },
    select: { askingPrice: true, rentalPrice: true, sizeSqm: true },
  });

  if (properties.length === 0) return;

  const prices = removeOutliers(properties.map((p) => Number(p.askingPrice)));
  const rentals = removeOutliers(
    properties.filter((p) => p.rentalPrice).map((p) => Number(p.rentalPrice)),
  );

  const avgPrice = mean(prices);
  const medianPrice_ = median(prices);
  const avgRentalPrice = mean(rentals);
  const pricePerSqm = mean(properties.map((p) => Number(p.askingPrice) / Number(p.sizeSqm)));
  const rentalYield = avgPrice > 0 && avgRentalPrice > 0 ? (avgRentalPrice * 12) / avgPrice : 0;

  await prisma.marketStatistic.upsert({
    where: {
      neighborhoodId_propertyType_period: {
        neighborhoodId: (neighborhoodId ?? null) as any,
        propertyType: (propertyType ?? null) as any,
        period,
      },
    },
    update: {
      avgPrice,
      medianPrice: medianPrice_,
      pricePerSqm,
      avgRentalPrice,
      rentalYield,
      activeListings: properties.length,
      sampleSize: properties.length,
    },
    create: {
      period,
      neighborhoodId,
      propertyType,
      avgPrice,
      medianPrice: medianPrice_,
      pricePerSqm,
      avgRentalPrice,
      rentalYield,
      activeListings: properties.length,
      sampleSize: properties.length,
    },
  });

  logger.info({ msg: 'market.statistics.stored', period, neighborhoodId, propertyType, duration: '0ms' });
}
export async function getComprehensiveMarketAnalysis(query: MarketAnalysisQuery) {
  const cacheKey = `market:analysis:${JSON.stringify(query)}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const startTime = performance.now();
  
  const [
    segmentAnalysis,
    marketComparison,
    trendAnalysis,
    volumeAnalysis,
    performanceMetrics
  ] = await Promise.all([
    getMarketSegmentAnalysis(query),
    query.includeComparisons ? getMarketComparison(query) : null,
    getDetailedTrendAnalysis(query),
    getMarketVolumeAnalysis(query),
    getMarketPerformanceMetrics(query)
  ]);

  const analysis = {
    metadata: {
      generatedAt: new Date().toISOString(),
      period: {
        start: query.startPeriod || dayjs().subtract(12, 'months').format('YYYY-MM'),
        end: query.endPeriod || dayjs().format('YYYY-MM')
      },
      filters: query,
      calculationTime: Math.round(performance.now() - startTime)
    },
    segments: segmentAnalysis,
    comparison: marketComparison,
    trends: trendAnalysis,
    volume: volumeAnalysis,
    performance: performanceMetrics
  };

  await cacheSet(cacheKey, analysis, CACHE_TTL.LONG);
  
  auditLogger.info('Comprehensive market analysis generated', {
    query,
    segmentCount: segmentAnalysis.length,
    calculationTime: analysis.metadata.calculationTime
  });

  return analysis;
}

async function getMarketSegmentAnalysis(query: MarketAnalysisQuery): Promise<MarketSegmentAnalysis[]> {
  const segments: MarketSegmentAnalysis[] = [];
  
  // Get all combinations of neighborhoods and property types
  const neighborhoods: Array<{ id: string; name: string }> = await prisma.neighborhood.findMany({
    where: {
      city: { equals: 'Addis Ababa', mode: 'insensitive' },
      ...(query.neighborhoodIds ? { id: { in: query.neighborhoodIds } } : {}),
    },
    select: { id: true, name: true },
  });
    
  const propertyTypes = query.propertyTypes || 
    ['APARTMENT', 'VILLA', 'CONDOMINIUM', 'OFFICE', 'RETAIL', 'WAREHOUSE', 'LAND'];

  for (const neighborhood of neighborhoods) {
    for (const propertyType of propertyTypes) {
      const segment = await calculateSegmentMetrics(
        neighborhood.id, 
        propertyType as PropertyType,
        query.startPeriod,
        query.endPeriod
      );
      
      if (segment) {
        segments.push({
          ...segment,
          segment: {
            neighborhoodId: neighborhood.id,
            propertyType: propertyType as PropertyType,
            neighborhoodName: neighborhood.name
          }
        });
      }
    }
  }

  return segments;
}

async function calculateSegmentMetrics(
  neighborhoodId: string,
  propertyType: PropertyType,
  startPeriod?: string,
  endPeriod?: string
): Promise<Omit<MarketSegmentAnalysis, 'segment'> | null> {
  const currentPeriod = endPeriod || dayjs().format('YYYY-MM');
  const previousPeriod = dayjs(currentPeriod + '-01').subtract(1, 'month').format('YYYY-MM');
  
  // Get current period stats
  const [currentStats, previousStats, historicalData] = await Promise.all([
    prisma.marketStatistic.findFirst({
      where: { neighborhoodId, propertyType, period: currentPeriod }
    }),
    prisma.marketStatistic.findFirst({
      where: { neighborhoodId, propertyType, period: previousPeriod }
    }),
    prisma.marketStatistic.findMany({
      where: {
        neighborhoodId,
        propertyType,
        period: {
          gte: startPeriod || dayjs().subtract(12, 'months').format('YYYY-MM'),
          lte: currentPeriod
        }
      },
      orderBy: { period: 'asc' }
    })
  ]);

  if (!currentStats || historicalData.length < 3) return null;

  // Calculate metrics
  const prices = historicalData.map(d => Number(d.avgPrice)).filter(Boolean);
  const priceGrowth = currentStats.avgPrice && previousStats?.avgPrice
    ? percentileChange(Number(currentStats.avgPrice), Number(previousStats.avgPrice))
    : 0;
  
  const rentGrowth = currentStats.avgRentalPrice && previousStats?.avgRentalPrice
    ? percentileChange(Number(currentStats.avgRentalPrice), Number(previousStats.avgRentalPrice))
    : 0;

  const volatility = standardDeviation(prices) / mean(prices) * 100;
  
  // Calculate liquidity score (based on active listings and historical volume)
  const avgListings = mean(historicalData.map(d => d.activeListings || 0));
  const liquidityScore = Math.min(100, Math.max(0, (avgListings / 10) * 100));

  // Determine market momentum and strength
  const recentPrices = prices.slice(-3);
  const momentum = determineMomentum(recentPrices);
  const strength = determineStrength(Math.abs(priceGrowth), volatility);
  
  // Calculate seasonality (simplified)
  const seasonality = calculateSeasonality(historicalData);

  return {
    metrics: {
      avgPrice: Math.round(Number(currentStats.avgPrice)),
      medianPrice: Math.round(Number(currentStats.medianPrice)),
      pricePerSqm: Math.round(Number(currentStats.pricePerSqm)),
      avgRentalPrice: Math.round(Number(currentStats.avgRentalPrice || 0)),
      rentalYield: Number((Number(currentStats.rentalYield || 0) * 100).toFixed(2)),
      priceGrowth: Number(priceGrowth.toFixed(2)),
      rentGrowth: Number(rentGrowth.toFixed(2)),
      volatility: Number(volatility.toFixed(2)),
      liquidityScore: Math.round(liquidityScore)
    },
    inventory: {
      activeListings: currentStats.activeListings || 0,
      totalVolume: historicalData.reduce((sum, d) => sum + (d.activeListings || 0), 0),
      avgDaysOnMarket: null
    },
    trends: {
      momentum,
      strength,
      seasonality: Number(seasonality.toFixed(2))
    }
  };
}

function determineMomentum(recentPrices: number[]): 'bullish' | 'bearish' | 'neutral' {
  if (recentPrices.length < 2) return 'neutral';
  
  const trend = recentPrices[recentPrices.length - 1] - recentPrices[0];
  if (trend > recentPrices[0] * 0.02) return 'bullish';
  if (trend < -recentPrices[0] * 0.02) return 'bearish';
  return 'neutral';
}

function determineStrength(growthRate: number, volatility: number): 'strong' | 'moderate' | 'weak' {
  const adjustedGrowth = growthRate / (1 + volatility / 100);
  if (adjustedGrowth > 5) return 'strong';
  if (adjustedGrowth > 2) return 'moderate';
  return 'weak';
}

function calculateSeasonality(historicalData: any[]): number {
  // Simplified seasonality calculation based on month-to-month variation
  const monthlyVariations = [];
  for (let i = 1; i < historicalData.length; i++) {
    const variation = percentileChange(
      Number(historicalData[i].avgPrice), 
      Number(historicalData[i-1].avgPrice)
    );
    monthlyVariations.push(variation);
  }
  
  return standardDeviation(monthlyVariations);
}

async function getMarketComparison(query: MarketAnalysisQuery) {
  const currentPeriod = query.endPeriod || dayjs().format('YYYY-MM');
  
  // Compare different segments
  const [cityStats, neighborhoodStats, typeStats] = await Promise.all([
    // City-wide average
    prisma.marketStatistic.aggregate({
      where: { period: currentPeriod },
      _avg: {
        avgPrice: true,
        pricePerSqm: true,
        rentalYield: true,
        priceGrowth: true
      }
    }),
    
    // By neighborhood
    prisma.marketStatistic.findMany({
      where: {
        period: currentPeriod,
        neighborhoodId: query.neighborhoodIds ? { in: query.neighborhoodIds } : undefined
      },
      include: {
        neighborhood: { select: { name: true } }
      }
    }),
    
    // By property type
    prisma.marketStatistic.groupBy({
      by: ['propertyType'],
      where: {
        period: currentPeriod,
        propertyType: query.propertyTypes ? { in: query.propertyTypes } : undefined
      },
      _avg: {
        avgPrice: true,
        pricePerSqm: true,
        rentalYield: true,
        priceGrowth: true
      }
    })
  ]);

  return {
    cityAverage: {
      avgPrice: Number(cityStats._avg.avgPrice || 0),
      pricePerSqm: Number(cityStats._avg.pricePerSqm || 0),
      rentalYield: Number((Number(cityStats._avg.rentalYield || 0) * 100).toFixed(2)),
      priceGrowth: Number((Number(cityStats._avg.priceGrowth || 0) * 100).toFixed(2))
    },
    byNeighborhood: neighborhoodStats.map(stat => ({
      neighborhoodId: stat.neighborhoodId,
      neighborhoodName: stat.neighborhood?.name,
      avgPrice: Number(stat.avgPrice),
      pricePerSqm: Number(stat.pricePerSqm),
      rentalYield: Number((Number(stat.rentalYield || 0) * 100).toFixed(2)),
      priceGrowth: Number((Number(stat.priceGrowth || 0) * 100).toFixed(2))
    })),
    byPropertyType: typeStats.map(stat => ({
      propertyType: stat.propertyType,
      avgPrice: Number(stat._avg.avgPrice || 0),
      pricePerSqm: Number(stat._avg.pricePerSqm || 0),
      rentalYield: Number((Number(stat._avg.rentalYield || 0) * 100).toFixed(2)),
      priceGrowth: Number((Number(stat._avg.priceGrowth || 0) * 100).toFixed(2))
    }))
  };
}

async function getDetailedTrendAnalysis(query: MarketAnalysisQuery) {
  const endPeriod = query.endPeriod || dayjs().format('YYYY-MM');
  const startPeriod = query.startPeriod || dayjs().subtract(24, 'months').format('YYYY-MM');
  
  const periods = [];
  let currentDate = dayjs(startPeriod + '-01');
  const endDate = dayjs(endPeriod + '-01');
  
  // Plain comparison: the isSameOrBefore extension of dayjs is not loaded here.
  while (currentDate.valueOf() <= endDate.valueOf()) {
    periods.push(currentDate.format('YYYY-MM'));
    currentDate = currentDate.add(1, 'month');
  }

  const trendData = await prisma.marketStatistic.findMany({
    where: {
      period: { in: periods },
      ...(query.neighborhoodIds && { neighborhoodId: { in: query.neighborhoodIds } }),
      ...(query.propertyTypes && { propertyType: { in: query.propertyTypes } })
    },
    orderBy: { period: 'asc' },
    include: {
      neighborhood: { select: { name: true } }
    }
  });

  // Aggregate by period
  const periodAggregates = periods.map(period => {
    const periodData = trendData.filter(d => d.period === period);
    if (periodData.length === 0) return null;

    return {
      period,
      avgPrice: mean(periodData.map(d => Number(d.avgPrice))),
      medianPrice: mean(periodData.map(d => Number(d.medianPrice))),
      pricePerSqm: mean(periodData.map(d => Number(d.pricePerSqm))),
      avgRentalPrice: mean(periodData.map(d => Number(d.avgRentalPrice || 0))),
      activeListings: periodData.reduce((sum, d) => sum + (d.activeListings || 0), 0),
      sampleSize: periodData.length
    };
  }).filter(Boolean);

  // Calculate trend indicators
  const prices = periodAggregates.map(p => p!.avgPrice);
  const linearTrend = calculateLinearTrend(prices);
  const seasonalPattern = calculateSeasonalPattern(periodAggregates);
  
  return {
    timeSeries: periodAggregates,
    indicators: {
      linearTrend: {
        slope: Number(linearTrend.slope.toFixed(2)),
        r_squared: Number(linearTrend.r_squared.toFixed(3)),
        direction: linearTrend.slope > 0 ? 'upward' : linearTrend.slope < 0 ? 'downward' : 'flat'
      },
      seasonality: seasonalPattern,
      volatility: Number(standardDeviation(prices).toFixed(2)),
      momentum: {
        short_term: calculateMomentum(prices.slice(-3)),
        medium_term: calculateMomentum(prices.slice(-6)),
        long_term: calculateMomentum(prices.slice(-12))
      }
    }
  };
}

async function getMarketVolumeAnalysis(query: MarketAnalysisQuery) {
  const endPeriod = query.endPeriod || dayjs().format('YYYY-MM');
  const startPeriod = query.startPeriod || dayjs().subtract(12, 'months').format('YYYY-MM');
  
  const volumeData = await prisma.marketStatistic.findMany({
    where: {
      period: { gte: startPeriod, lte: endPeriod },
      ...(query.neighborhoodIds && { neighborhoodId: { in: query.neighborhoodIds } }),
      ...(query.propertyTypes && { propertyType: { in: query.propertyTypes } })
    },
    include: {
      neighborhood: { select: { name: true } }
    }
  });

  const totalVolume = volumeData.reduce((sum, d) => sum + (d.activeListings || 0), 0);
  const avgMonthlyVolume = Math.round(totalVolume / Math.max(1, volumeData.length));
  
  // Volume by segment
  const volumeByNeighborhood = volumeData.reduce((acc, d) => {
    const key = d.neighborhood?.name || 'Unknown';
    acc[key] = (acc[key] || 0) + (d.activeListings || 0);
    return acc;
  }, {} as Record<string, number>);

  const volumeByType = volumeData.reduce((acc, d) => {
    const key = d.propertyType || 'Unknown';
    acc[key] = (acc[key] || 0) + (d.activeListings || 0);
    return acc;
  }, {} as Record<string, number>);

  return {
    total: totalVolume,
    avgMonthlyVolume,
    byNeighborhood: Object.entries(volumeByNeighborhood).map(([name, volume]) => ({
      name, volume
    })),
    byPropertyType: Object.entries(volumeByType).map(([type, volume]) => ({
      type, volume
    })),
    trends: {
      growth: volumeData.length > 1 ? 
        percentileChange(
          volumeData[volumeData.length - 1].activeListings || 0,
          volumeData[0].activeListings || 1
        ) : 0
    }
  };
}

async function getMarketPerformanceMetrics(query: MarketAnalysisQuery) {
  const endPeriod = query.endPeriod || dayjs().format('YYYY-MM');
  const startPeriod = query.startPeriod || dayjs().subtract(12, 'months').format('YYYY-MM');
  
  const performanceData = await prisma.marketStatistic.findMany({
    where: {
      period: { gte: startPeriod, lte: endPeriod },
      ...(query.neighborhoodIds && { neighborhoodId: { in: query.neighborhoodIds } }),
      ...(query.propertyTypes && { propertyType: { in: query.propertyTypes } })
    },
    orderBy: { period: 'asc' }
  });

  if (performanceData.length === 0) return null;

  const prices = performanceData.map(d => Number(d.avgPrice)).filter(Boolean);
  const yields = performanceData.map(d => Number(d.rentalYield || 0)).filter(Boolean);
  
  // Calculate performance metrics
  const totalReturn = performanceData.length > 1 ?
    percentileChange(prices[prices.length - 1], prices[0]) : 0;
    
  const annualizedReturn = totalReturn * (12 / Math.max(1, performanceData.length - 1));
  const volatility = standardDeviation(prices.map((price, i) => 
    i > 0 ? percentileChange(price, prices[i-1]) : 0
  ).slice(1));
  
  const sharpeRatio = volatility > 0 ? annualizedReturn / volatility : 0;
  const avgYield = mean(yields);
  
  return {
    returns: {
      total: Number(totalReturn.toFixed(2)),
      annualized: Number(annualizedReturn.toFixed(2)),
      best_month: Math.max(...prices.map((price, i) => 
        i > 0 ? percentileChange(price, prices[i-1]) : 0
      )),
      worst_month: Math.min(...prices.map((price, i) => 
        i > 0 ? percentileChange(price, prices[i-1]) : 0
      ))
    },
    risk: {
      volatility: Number(volatility.toFixed(2)),
      sharpe_ratio: Number(sharpeRatio.toFixed(3)),
      max_drawdown: calculateMaxDrawdown(prices)
    },
    yield: {
      average: Number(avgYield.toFixed(2)),
      current: Number((Number(performanceData[performanceData.length - 1]?.rentalYield || 0) * 100).toFixed(2))
    }
  };
}

// Helper functions
function calculateLinearTrend(data: number[]) {
  const n = data.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = data.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * data[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Calculate R-squared
  const yMean = sumY / n;
  const ssRes = data.reduce((sum, yi, i) => {
    const predicted = slope * x[i] + intercept;
    return sum + Math.pow(yi - predicted, 2);
  }, 0);
  const ssTot = data.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  const r_squared = 1 - (ssRes / ssTot);
  
  return { slope, intercept, r_squared };
}

function calculateSeasonalPattern(data: any[]) {
  const monthlyData: Record<string, number[]> = {};
  
  data.forEach(d => {
    if (!d) return;
    const month = dayjs(d.period + '-01').format('MMM');
    if (!monthlyData[month]) monthlyData[month] = [];
    monthlyData[month].push(d.avgPrice);
  });
  
  return Object.entries(monthlyData).map(([month, prices]) => ({
    month,
    avgPrice: mean(prices),
    count: prices.length
  }));
}

function calculateMomentum(prices: number[]): number {
  if (prices.length < 2) return 0;
  return percentileChange(prices[prices.length - 1], prices[0]);
}

function calculateMaxDrawdown(prices: number[]): number {
  let maxDrawdown = 0;
  let peak = prices[0];
  
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > peak) {
      peak = prices[i];
    } else {
      const drawdown = (peak - prices[i]) / peak * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
  }
  
  return Number(maxDrawdown.toFixed(2));
}

export async function runMarketStatisticsCalculation(force: boolean = false) {
  const startTime = performance.now();
  const currentPeriod = dayjs().format('YYYY-MM');
  
  auditLogger.info('Starting market statistics calculation', { period: currentPeriod, force });
  
  try {
    // Get all neighborhoods and property types
    const [neighborhoods, propertyTypes] = await Promise.all([
      prisma.neighborhood.findMany({ select: { id: true } }),
      Promise.resolve(['APARTMENT', 'VILLA', 'CONDOMINIUM', 'OFFICE', 'RETAIL', 'WAREHOUSE', 'LAND'] as PropertyType[])
    ]);

    const calculations = [];
    
    // Calculate city-wide stats
    calculations.push(calculateAndStoreMarketStats(currentPeriod));
    
    // Calculate neighborhood stats
    for (const neighborhood of neighborhoods) {
      calculations.push(calculateAndStoreMarketStats(currentPeriod, neighborhood.id));
      
      // Calculate neighborhood + property type stats
      for (const propertyType of propertyTypes) {
        calculations.push(calculateAndStoreMarketStats(currentPeriod, neighborhood.id, propertyType));
      }
    }
    
    // Calculate property type stats (city-wide)
    for (const propertyType of propertyTypes) {
      calculations.push(calculateAndStoreMarketStats(currentPeriod, undefined, propertyType));
    }
    
    await Promise.all(calculations);
    
    // Publish market update event
    await publishEvent({
      eventType: 'MARKET_STATISTICS_UPDATED',
      aggregateId: currentPeriod,
      payload: {
        period: currentPeriod,
        calculationCount: calculations.length,
        duration: Math.round(performance.now() - startTime)
      },
      occurredAt: new Date().toISOString()
    }, KAFKA_TOPICS.MARKET_EVENTS);
    
    const duration = Math.round(performance.now() - startTime);
    auditLogger.info('Market statistics calculation completed', {
      period: currentPeriod,
      calculationCount: calculations.length,
      duration
    });
    
    return {
      success: true,
      period: currentPeriod,
      calculationsRun: calculations.length,
      duration
    };
    
  } catch (error) {
    auditLogger.error('Market statistics calculation failed', {
      period: currentPeriod,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    throw error;
  }
}
