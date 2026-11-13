import type { Prisma } from '@prisma/client';

import { prisma } from '../../infrastructure/database/prisma';
import { cacheGet, cacheSet } from '../../infrastructure/redis/client';
import { publishEvent } from '../../infrastructure/kafka/client';
import { chatCompletion } from '../../infrastructure/openai/client';
import { NotFoundError, BadRequestError } from '../../shared/utils/errors';
import { CACHE_TTL, KAFKA_TOPICS } from '../../shared/constants';
import { logger } from '../../shared/utils/logger';
import { mean, standardDeviation } from '../../shared/utils/statistics';
// Economic elasticity coefficients - literature-informed estimates
export interface ElasticityCoefficients {
  price: number;
  rental: number;
}
export interface ScenarioElasticity {
  [indicator: string]: ElasticityCoefficients;
}
export const ELASTICITY: ScenarioElasticity = {
  inflation: { price: 0.6, rental: 0.5 },
  interest_rate: { price: -0.8, rental: 0.2 },
  exchange_rate: { price: 0.3, rental: 0.15 },
  construction_cost: { price: 0.4, rental: 0.1 },
  gdp_growth: { price: 0.5, rental: 0.3 },
  unemployment: { price: -0.4, rental: -0.2 },
  mortgage_rate: { price: -0.7, rental: 0.1 },
  foreign_investment: { price: 0.4, rental: 0.2 },
};
// Scenario types for different analysis approaches
export type ScenarioType = 
  | 'economic_shock'      // Macroeconomic changes
  | 'market_shift'        | 'policy_change'       // Regulatory changes
  | 'local_development'   | 'infrastructure'      // Infrastructure projects
  | 'demographic_change';
export interface ScenarioParameter {
  indicator: string;
  changePct: number;
  changeType: 'increase' | 'decrease';
  weight?: number; // Weight for multi-parameter scenarios
}
export interface CreateScenarioDto {
  name: string;
  description?: string;
  type?: ScenarioType;
  parameters: ScenarioParameter[];
  baseValue?: number; // For property-specific scenarios
}
export interface ScenarioResultWithAnalysis {
  id: string;
  scenarioId: string;
  neighborhoodId?: string;
  priceImpactPct: number | null;
  rentalImpactPct: number | null;
  demandImpact: string | null;
  supplyImpact: string | null;
  calculatedResults: any;
  assumptions: any;
  aiExplanation: string | null;
  sensitivityAnalysis: SensitivityAnalysis;
  riskAssessment: RiskAssessment;
  investmentImplications: InvestmentImplication[];
  marketConditions: MarketConditions;
}
export interface SensitivityAnalysis {
  high: { change: number; impact: number }[];
  medium: { change: number; impact: number }[];
  low: { change: number; impact: number }[];
}
export interface RiskAssessment {
  overall: 'low' | 'medium' | 'high';
  factors: string[];
  confidence: number;
}
export interface InvestmentImplication {
  action: 'buy' | 'sell' | 'hold' | 'delay';
  rationale: string;
  expectedReturn?: number;
  holdingPeriod: string;
}
export interface MarketConditions {
  current: string;
  projected: string;
  timeline: string;
}
// Advanced scenario types
export const SCENARIO_TYPES: Record<ScenarioType, { description: string; indicators: string[] }> = {
  economic_shock: {
    description: 'Macroeconomic shocks like inflation, interest rates, GDP',
    indicators: ['inflation', 'interest_rate', 'gdp_growth', 'unemployment', 'exchange_rate'],
  },
  market_shift: {
    description: 'Supply-demand shifts and market sentiment changes',
    indicators: ['construction_cost', 'foreign_investment', 'credit_growth'],
  },
  policy_change: {
    description: 'Government policies, tax changes, regulations',
    indicators: ['tax_policy', 'rental_regulation', 'foreign_ownership'],
  },
  local_development: {
    description: 'Neighborhood-specific development projects',
    indicators: ['infrastructure_investment', 'amenity_development'],
  },
  infrastructure: {
    description: 'Major infrastructure projects impact',
    indicators: ['transport', 'utilities', 'connectivity'],
  },
  demographic_change: {
    description: 'Population changes and migration patterns',
    indicators: ['migration', 'employment', 'income_growth'],
  },
};
// Cache timeout for scenario results
const SCENARIO_CACHE_TTL = CACHE_TTL.LONG;
/**
 * Create a new scenario
 */
export async function createScenario(dto: CreateScenarioDto, userId: string) {
  return prisma.scenario.create({
    data: { 
      name: dto.name, 
      description: dto.description ?? null, 
      parameters: dto.parameters as any, 
      createdBy: userId,
    },
  });
}
/**
 * List scenarios with pagination and filtering
 */
export async function listScenarios(userId: string, role: string, filters?: {
  type?: ScenarioType;
  page?: number;
  limit?: number;
}) {
  const { page = 1, limit = 20 } = filters || {};
  const offset = (page - 1) * limit;
  // Admins see every scenario (optionally filtered by type); analysts only see
  // the ones they created; any other role sees the public set.
  const where: Record<string, unknown> =
    role === 'admin'
      ? filters?.type
        ? { type: filters.type }
        : {}
      : role === 'analyst'
        ? { createdBy: userId }
        : {};
  return prisma.$transaction([
    prisma.scenario.findMany({
      where,
      include: { _count: { select: { results: true } },
        results: {
          take: 1,
          orderBy: { calculatedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }) as any,
    prisma.scenario.count({ where }),
  ]);
}

/**
 * Get scenario with results
 */
export async function getScenario(id: string) {
  const scenario = await prisma.scenario.findUnique({
    where: { id },
    include: { 
      results: { 
        orderBy: { calculatedAt: 'desc' }, 
        take: 10,
        include: { neighborhood: { select: { name: true } } },
      },
      creator: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  if (!scenario) throw new NotFoundError('Scenario');
  return scenario;
}
/**
 * Delete a scenario
 */
export async function deleteScenario(id: string, userId: string, role: string) {
  const scenario = await prisma.scenario.findUnique({
    where: { id },
    select: { createdBy: true },
  });
  if (!scenario) throw new NotFoundError('Scenario');
  if (role !== 'admin' && scenario.createdBy !== userId) {
    throw new BadRequestError('Not authorized to delete this scenario');
  }
  return prisma.scenario.delete({ where: { id } });
}
/**
 * Run a scenario with advanced analysis
 */
export async function runScenario(scenarioId: string, neighborhoodId?: string): Promise<ScenarioResultWithAnalysis> {
  const cacheKey = `scenario_result:${scenarioId}:${neighborhoodId || 'all'}`;
  const cached = (await cacheGet(cacheKey)) as ScenarioResultWithAnalysis | null;
  if (cached) return cached;
  // performance tracking removed
  const scenario = await prisma.scenario.findUnique({ 
    where: { id: scenarioId },
    include: { creator: { select: { id: true, role: true } } },
  }) as any;
  if (!scenario) throw new NotFoundError('Scenario');
  const parameters = scenario.parameters as ScenarioParameter[];
  // Normalize parameters with defaults
  const normalizedParams = parameters.map(p => ({
    ...p,
    weight: p.weight ?? 1,
  }));
  // Calculate base impacts using elasticity
  let totalPriceImpactPct = 0;
  let totalRentalImpactPct = 0;
  const breakdown: { indicator: string; changePct: number; priceImpact: number; rentalImpact: number; weight: number }[] = [];
  for (const param of normalizedParams) {
    const direction = param.changeType === 'increase' ? 1 : -1;
    const elasticity = ELASTICITY[param.indicator] || { price: 0.3, rental: 0.15 };
    const priceImpact = elasticity.price * param.changePct * direction * param.weight;
    const rentalImpact = elasticity.rental * param.changePct * direction * param.weight;
    totalPriceImpactPct += priceImpact;
    totalRentalImpactPct += rentalImpact;
    breakdown.push({
      indicator: param.indicator,
      changePct: param.changePct * direction,
      priceImpact: Number(priceImpact.toFixed(2)),
      rentalImpact: Number(rentalImpact.toFixed(2)),
      weight: param.weight,
    });
  }
  // Calculate weighted average for comprehensive analysis
  const totalWeight = normalizedParams.reduce((sum, p) => sum + p.weight, 0);
  const avgPriceImpact = totalPriceImpactPct / totalWeight;
  const avgRentalImpact = totalRentalImpactPct / totalWeight;
  // Determine demand and supply impacts
  const demandImpact = calculateDemandImpact(totalPriceImpactPct);
  const supplyImpact = calculateSupplyImpact(totalPriceImpactPct);
  // Perform sensitivity analysis
  const sensitivityAnalysis = performSensitivityAnalysis(breakdown);
  // Assess risk and confidence
  const riskAssessment = assessRisk(scenario, normalizedParams, sensitivityAnalysis);
  // Generate investment implications
  const investmentImplications =    generateInvestmentImplications(
    (scenario as any).type,
    totalPriceImpactPct,
    totalRentalImpactPct,
    riskAssessment
  );
  // Assess market conditions
  const marketConditions = assessMarketConditions((scenario as any).type, totalPriceImpactPct);
  const calculatedResults = {
    priceImpactPct: Number(totalPriceImpactPct.toFixed(2)),
    rentalImpactPct: Number(totalRentalImpactPct.toFixed(2)),
    breakdown,
    sensitivityAnalysis,
    riskAssessment,
    investmentImplications,
  } as unknown as Prisma.InputJsonValue;
  const assumptions = {
    model: 'elasticity_coefficients',
    scenarioType: (scenario as any).type,
    disclaimer: 'Results are estimates based on historical elasticity relationships. Actual market outcomes may differ significantly.',
    coefficientsSource: 'Literature-informed: World Bank, IMF, local market studies',
    calculatedItems: breakdown,
    totalWeight,
    avgPriceImpact: Number(avgPriceImpact.toFixed(2)),
    avgRentalImpact: Number(avgRentalImpact.toFixed(2)),
  };
  // Get AI explanation
  let aiExplanation: string | null = null;
  try {
    aiExplanation = await generateAIExplanation(scenario, totalPriceImpactPct, totalRentalImpactPct);
  } catch (err) {
    logger.warn({ msg: 'AI explanation failed for scenario', err });
  }
  // Create result in database
  const result = await prisma.scenarioResult.create({
    data: {
      scenarioId,
      neighborhoodId: neighborhoodId ?? null,
      priceImpactPct: totalPriceImpactPct,
      rentalImpactPct: totalRentalImpactPct,
      demandImpact,
      supplyImpact,
      calculatedResults,
      assumptions,
      aiExplanation,
    },
  });
  // Cache the result
  const cacheResult = {
    ...result,
    priceImpactPct: result.priceImpactPct ? Number(result.priceImpactPct) : null,
    rentalImpactPct: result.rentalImpactPct ? Number(result.rentalImpactPct) : null,
    sensitivityAnalysis,
    riskAssessment,
    investmentImplications,
    marketConditions,
    assumptions,
    aiExplanation,
  } as any;
  await cacheSet(cacheKey, cacheResult, SCENARIO_CACHE_TTL);
  await publishEvent({
    eventType: 'SCENARIO_COMPLETED',
    aggregateId: result.id,
    payload: { 
      scenarioId: scenario.id, 
      resultId: result.id,
      priceImpactPct: Number(totalPriceImpactPct.toFixed(2)),
    },
    occurredAt: new Date().toISOString(),
  }, KAFKA_TOPICS.MARKET_EVENTS);
  const duration = 0;
  logger.info({ 
    msg: 'scenario.executed', 
    scenarioId, 
    duration: `${duration}ms`,
    priceImpactPct: Number(totalPriceImpactPct.toFixed(2)),
  });
  return cacheResult;
}
/**
 * Get scenario comparisons
 */
export async function compareScenarios(scenarioIds: string[]): Promise<any[]> {
  const scenarios = await prisma.scenario.findMany({
    where: { id: { in: scenarioIds } },
    include: {
      results: {
        orderBy: { calculatedAt: 'desc' },
        take: 1,
      },
    },
  });
  return scenarios.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    type: undefined,
    priceImpactPct: s.results[0]?.priceImpactPct ?? null,
    rentalImpactPct: s.results[0]?.rentalImpactPct ?? null,
    calculatedAt: s.results[0]?.calculatedAt,
    investmentAction:
      (s.results[0]?.calculatedResults as any)?.investmentImplications?.[0]?.action ?? 'unknown',
  }));
}
/**
 * Get scenario by type
 */
export async function getScenariosByType(_type: ScenarioType, userId: string, role: string) {
  return prisma.scenario.findMany({
    where: role === 'admin'
      ? { createdBy: userId }
      : role === 'analyst'
        ? { createdBy: userId }
        : {},
    include: { _count: { select: { results: true } } },
    orderBy: { createdAt: 'desc' },
  });
}
/**
 * Calculate demand impact based on price changes
 */
function calculateDemandImpact(priceImpact: number): 'strong_decrease' | 'decrease' | 'stable' | 'increase' | 'strong_increase' {
  if (priceImpact > 15) return 'strong_decrease';
  if (priceImpact > 5) return 'decrease';
  if (priceImpact > -5) return 'stable';
  if (priceImpact > -15) return 'increase';
  return 'strong_increase';
}
/**
 * Calculate supply impact based on price changes
 */
function calculateSupplyImpact(priceImpact: number): 'decrease' | 'stable' | 'increase' | 'strong_increase' {
  if (priceImpact > 20) return 'strong_increase';
  if (priceImpact > 10) return 'increase';
  if (priceImpact > -10) return 'stable';
  return 'decrease';
}
/**
 * Perform sensitivity analysis on scenario parameters
 */
function performSensitivityAnalysis(breakdown: any[]): SensitivityAnalysis {
  const high: any[] = [];
  const medium: any[] = [];
  const low: any[] = [];
  const maxImpact = Math.max(...breakdown.map(b => Math.abs(b.priceImpact)));
  const highThreshold = maxImpact * 0.3;
  const mediumThreshold = maxImpact * 0.15;
  for (const item of breakdown) {
    if (Math.abs(item.priceImpact) >= highThreshold) {
      high.push(item);
    } else if (Math.abs(item.priceImpact) >= mediumThreshold) {
      medium.push(item);
    } else {
      low.push(item);
    }
  }
  return { high, medium, low };
}
/**
 * Assess risk for the scenario
 */
function assessRisk(scenario: any, parameters: any[], sensitivity: SensitivityAnalysis): RiskAssessment {
  const factors: string[] = [];
  let confidence = 0.7;
  // Factor analysis
  if (parameters.length > 5) {
    factors.push('Multiple parameters increase uncertainty');
    confidence -= 0.1;
  }
  if (parameters.some((p: any) => p.changePct > 20)) {
    factors.push('Large parameter changes reduce accuracy');
    confidence -= 0.15;
  }
  if (sensitivity.high.length > 2) {
    factors.push('High sensitivity to multiple parameters');
    confidence -= 0.1;
  }
  // Base confidence on scenario type
  if ((scenario as any).type === 'economic_shock') {
    confidence -= 0.1;
    factors.push('Macroeconomic scenarios have higher uncertainty');
  }
  confidence = Math.max(0.3, Math.min(0.95, confidence));
  // Determine overall risk
  let overall: 'low' | 'medium' | 'high' = 'medium';
  if (confidence > 0.7) overall = 'low';
  else if (confidence < 0.5) overall = 'high';
  return { overall, factors, confidence: Number(confidence.toFixed(2)) };
}
/**
 * Generate investment implications
 */
function generateInvestmentImplications(
  _type: string | null,
  priceImpact: number,
  rentalImpact: number,
  risk: RiskAssessment
): InvestmentImplication[] {
  const implications: InvestmentImplication[] = [];
  const riskNote =
    risk.confidence < 0.5
      ? ' Confidence in this estimate is low; treat it as indicative only.'
      : '';
  if (priceImpact > 10) {
    implications.push({
      action: 'sell',
      rationale: 'Significant price increase may indicate market peak. Consider taking profits.',
      holdingPeriod: 'short_term',
    });
  } else if (priceImpact < -10) {
    implications.push({
      action: 'buy',
      rationale: `Significant price decrease may present buying opportunity.${riskNote}`,
      expectedReturn: Math.abs(priceImpact) * 1.2,
      holdingPeriod: 'medium_term',
    });
  } else if (priceImpact > 5) {
    implications.push({
      action: 'hold',
      rationale: 'Moderate price increase suggests stable market conditions.',
      holdingPeriod: 'medium_term',
    });
  } else if (priceImpact < -5) {
    implications.push({
      action: 'hold',
      rationale: 'Moderate price decrease suggests market correction.',
      holdingPeriod: 'short_term',
    });
  } else {
    implications.push({
      action: 'hold',
      rationale: 'Minimal impact suggests current market conditions are expected to continue.',
      holdingPeriod: 'medium_term',
    });
  }
  if (rentalImpact > 5) {
    implications.push({
      action: 'buy',
      rationale: 'Rental income increase improves cash flow potential.',
      expectedReturn: rentalImpact,
      holdingPeriod: 'medium_term',
    });
  } else if (rentalImpact < -5) {
    implications.push({
      action: 'sell',
      rationale: 'Rental income decrease reduces property attractiveness.',
      holdingPeriod: 'short_term',
    });
  }
  return implications;
}
/**
 * Assess current and projected market conditions
 */
function assessMarketConditions(
  _type: string | null,
  priceImpact: number
): MarketConditions {
  let current = 'stable';
  let projected = 'stable';
  if (priceImpact > 10) {
    current = 'heating_up';
    projected = 'hot_market';
  } else if (priceImpact > 5) {
    current = 'moderate_growth';
    projected = 'steady_growth';
  } else if (priceImpact < -10) {
    current = 'cooling_down';
    projected = 'market_correction';
  } else if (priceImpact < -5) {
    current = 'softening';
    projected = 'moderate_decline';
  }
  const timeline = priceImpact > 5 ? 'short_term' : priceImpact < -5 ? 'medium_term' : 'long_term';
  return { current, projected, timeline };
}
/**
 * Generate AI explanation for scenario results
 */
async function generateAIExplanation(
  scenario: any,
  priceImpact: number,
  rentalImpact: number
): Promise<string | null> {
  const prompt = `You are an expert real estate market analyst. Explain this scenario result in plain language for an investor.
Scenario: "${scenario.name}"
${scenario.description ? `Description: ${scenario.description}` : ''}
Type: ${(scenario as any).type || 'General' }
Parameters applied:
${scenario.parameters.map((p: any) => `- ${p.indicator}: ${p.changeType} by ${p.changePct}%${p.weight ? ` (weight: ${p.weight})` : ''}`).join('\n')}
Calculated market impact:
- Property price impact: ${priceImpact.toFixed(1)}%
- Rental price impact: ${rentalImpact.toFixed(1)}%
Explain:
1. What this scenario means for the Addis Ababa real estate market
2. How different property types might be affected
3. What investors should consider doing
4. Potential risks and opportunities
Keep it concise (3-4 paragraphs), use plain language, and focus on practical implications.`;
  return await chatCompletion([{ role: 'user', content: prompt }], 500);
}
/**
 * Get market impact summary for a neighborhood
 */
export async function getNeighborhoodImpact(neighborhoodId: string): Promise<any> {
  const results = await prisma.scenarioResult.findMany({
    where: { neighborhoodId },
    include: {
      scenario: { select: { name: true, parameters: true } },
    },
    orderBy: { calculatedAt: 'desc' },
    take: 10,
  });
  if (results.length === 0) {
    return { 
      neighborhoodId, 
      scenarioCount: 0, 
      recentImpacts: [], 
      summary: 'No scenarios executed for this neighborhood yet.' 
    };
  }
  const priceImpacts = results
    .map(r => r.priceImpactPct)
    .filter(p => p !== null)
    .map(p => Number(p))
    .filter(n => Number.isFinite(n));
  const avgImpact = mean(priceImpacts);
  const volatility = standardDeviation(priceImpacts);
  return {
    neighborhoodId,
    scenarioCount: results.length, recentImpacts: results.map(r => ({
      scenarioId: r.scenarioId,
      scenarioName: r.scenario.name,
      priceImpactPct: r.priceImpactPct,
      rentalImpactPct: r.rentalImpactPct,
      calculatedAt: r.calculatedAt,
    })),
    summary: {
      avgPriceImpact: Number(avgImpact.toFixed(2)),
      volatility: Number(volatility.toFixed(2)),
      highestImpact: Math.max(...priceImpacts),
      lowestImpact: Math.min(...priceImpacts),
    },
  };
}

