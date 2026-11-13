import { prisma } from '../../infrastructure/database/prisma';
import { etbEligiblePropertyWhere } from '../../shared/utils/eligibility';
import { BadRequestError } from '../../shared/utils/errors';
import { standardDeviation } from '../../shared/utils/statistics';

export interface ValuationInput {
  propertyId: string;
  comparableIds?: string[];
  requestedBy?: string;
}

export interface ValuationResult {
  propertyId: string;
  estimatedValue: number;
  confidence: number;
  factorCount: number;
  notes: string[];
}

export async function computePropertyValuation(input: ValuationInput): Promise<ValuationResult> {
  const property = await prisma.property.findUnique({
    where: { id: input.propertyId },
    include: { neighborhood: true },
  });

  if (!property) {
    throw new BadRequestError('Property not found');
  }

  const compIds = input.comparableIds && input.comparableIds.length > 0
    ? input.comparableIds
    : await findComparableIds(property.neighborhoodId, property.propertyType, Number(property.sizeSqm));

  if (compIds.length === 0) {
    return {
      propertyId: input.propertyId,
      estimatedValue: Number(property.askingPrice),
      confidence: 0,
      factorCount: 0,
      notes: ['No comparable properties available for valuation'],
    };
  }

  const comparables = await prisma.property.findMany({
    where: { id: { in: compIds }, ...etbEligiblePropertyWhere() },
    select: {
      askingPrice: true,
      sizeSqm: true,
      bedrooms: true,
      bathrooms: true,
    },
  }) as any;

  const prices = comparables.map((c: any) => Number(c.askingPrice));
  const priceStdDev = standardDeviation(prices);
  const avgPrice = prices.reduce((s: number, p: number) => s + p, 0) / prices.length;

  const sizeAdjustments = comparables.map((c: any) => {
    if (!c.sizeSqm || c.sizeSqm === 0) return 1;
    return property.sizeSqm ? Number(c.sizeSqm) / Number(property.sizeSqm) : 1;
  });

  const adjustedPrices = comparables.map((c: any, idx: number) => {
    const sizeFactor = sizeAdjustments[idx] ?? 1;
    return Number(c.askingPrice) * sizeFactor;
  });

  const avgAdjusted = adjustedPrices.reduce((s: number, p: number) => s + p, 0) / adjustedPrices.length;
  const confidence = Math.min(1, 1 - (priceStdDev / (avgPrice || 1)));

  return {
    propertyId: input.propertyId,      estimatedValue: Math.round(avgAdjusted),
      confidence: Math.max(0, Math.min(1, confidence)),
    factorCount: comparables.length,
    notes: [
      'Valuation based on comparable properties',
      `Used ${comparables.length} comparables`,
      `Price standard deviation: ${priceStdDev.toFixed(2)}`,
    ],
  };
}

async function findComparableIds(
  neighborhoodId: string | null,
  propertyType: string,
  sizeSqm: number | null
): Promise<string[]> {
  const where: any = {
    id: { not: null },
    status: 'APPROVED',
  };

  if (neighborhoodId) {
    where.neighborhoodId = neighborhoodId;
  }

  if (propertyType) {
    where.propertyType = propertyType;
  }

  if (sizeSqm) {
    where.sizeSqm = { gte: sizeSqm * 0.7, lte: sizeSqm * 1.3 };
  }

  const properties = await prisma.property.findMany({
    where,
    select: { id: true },
    take: 5,
  });

  return properties.map((p) => p.id);
}

export async function getValuationHistory(propertyId: string) {
  return prisma.valuation.findMany({
    where: { propertyId },
    orderBy: { calculatedAt: 'desc' },
    take: 10,
  });
}
