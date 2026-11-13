import { config } from '../../config';
import { prisma } from '../../infrastructure/database/prisma';
import { chatCompletion, structuredCompletion } from '../../infrastructure/openai/client';
import { ServiceUnavailableError } from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';
import { median } from '../../shared/utils/statistics';

import {
  buildMarketContext,
  renderContextForPrompt,
  summarizeGrounding,
  type BuildMarketContextInput,
} from './market-context.service';

export interface AskQuestionDto {
  question: string;
  neighborhoodSlug?: string;
  propertyId?: string;
  months?: number;
  listingType?: 'sale' | 'rent';
  propertyType?: string;
  maxPrice?: number;
}

export interface NLSearchDto {
  query: string;
}

interface ParsedPropertyFilter {
  propertyType?: string | null;
  maxPrice?: number | null;
  minPrice?: number | null;
  minBedrooms?: number | null;
  neighborhoodSlug?: string | null;
  minRentalYield?: number | null;
  minSize?: number | null;
  maxSize?: number | null;
}

const PROPERTY_TYPE_ENUM: Record<string, string> = {
  apartment: 'APARTMENT',
  house: 'VILLA',
  villa: 'VILLA',
  condominium: 'CONDOMINIUM',
  commercial: 'OFFICE',
  office: 'OFFICE',
  retail: 'RETAIL',
  land: 'LAND',
  warehouse: 'WAREHOUSE',
};

/** Which environment variable is missing for the configured provider. */
const REQUIRED_AI_ENV_VARS = ['OPENAI_API_KEY'] as const;

export interface AiStatus {
  provider: 'openai';
  model: string;
  configured: boolean;
  missingEnvironmentVariables: string[];
  message: string;
  /** Retrieval (database grounding) works without the provider. */
  groundingAvailable: boolean;
}

export function getAiStatus(): AiStatus {
  const configured = Boolean(config.OPENAI_API_KEY);
  const missing = configured ? [] : [...REQUIRED_AI_ENV_VARS];
  return {
    provider: 'openai',
    model: config.OPENAI_MODEL,
    configured,
    missingEnvironmentVariables: missing,
    message: configured
      ? `AI analysis is configured (${config.OPENAI_MODEL}). Answers are grounded in retrieved database records.`
      : `AI analysis is not configured. Set ${missing.join(', ')} in the backend environment to enable model-generated explanations. Market data on the pages does not depend on this.`,
    groundingAvailable: true,
  };
}

export function isAiConfigured(): boolean {
  return Boolean(config.OPENAI_API_KEY);
}

const SYSTEM_PROMPT = `You are the EstatePlus real estate analyst for Addis Ababa, Ethiopia.

You are answering from a RETRIEVAL CONTEXT built from rows in the EstatePlus database. Follow these rules exactly:

1. Ground every number, price, rent, statistic and trend in the context. Never invent, recall or approximate market data from memory.
2. Respect the context's fact classes:
   - VERIFIED FACTS / [verified_source] rows: state them as facts and mention the publisher/date when given.
   - [recorded_internal] rows: state them as "recorded in the EstatePlus database", not as an official statistic.
   - CALCULATED METRICS: you may report them, and label them as calculated by EstatePlus (e.g. median, price/m², gross yield).
   - ESTIMATES: only if present in the context. You may not create new estimates.
3. If something the user asks for is under "DATA THAT IS NOT AVAILABLE", say plainly that the database does not hold enough records to answer, and state the sample size or missing field. Do not substitute a plausible number.
4. Sale and rental figures are separate. Never combine or annualise them unless a calculated metric already did so.
5. Cite sources as [S1], [S2] only for links listed under SOURCE LINKS. Include the observation date when you use one.
6. End with one short "Limitations:" line naming the most relevant constraint from the context (sample size, unrecorded currency, missing coordinates, annual country-level data, or missing source link).
7. Keep the answer to 4-7 short sentences (or a tight bullet list). Be direct; no filler, no hedging beyond the data's actual limitations.
8. Never claim the market "will" move in a direction. Describe what the stored observations show, and say a forecast would require a model we have not run.`;

export async function askQuestion(dto: AskQuestionDto) {
  const input: BuildMarketContextInput = {
    question: dto.question,
    neighborhoodSlug: dto.neighborhoodSlug,
    propertyId: dto.propertyId,
    months: dto.months,
    listingType: dto.listingType,
    propertyType: dto.propertyType,
    maxPrice: dto.maxPrice,
  };

  const bundle = await buildMarketContext(input);
  const grounding = summarizeGrounding(bundle);
  const contextText = renderContextForPrompt(bundle);

  if (!isAiConfigured()) {
    logger.warn({
      msg: 'ai.ask.not_configured',
      missing: [...REQUIRED_AI_ENV_VARS],
      retrievedFacts: bundle.counts.facts,
    });
    throw new ServiceUnavailableError(
      `AI analysis is not configured: set ${REQUIRED_AI_ENV_VARS.join(', ')}. Retrieved ${bundle.counts.facts} database fact(s) for this question, but no model is available to explain them.`,
    );
  }

  const answer = await chatCompletion(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `${contextText}\n\n### USER QUESTION\n${dto.question}\n\nAnswer strictly from the retrieval context above.`,
      },
    ],
    700,
  );

  if (!answer) {
    logger.error({ msg: 'ai.ask.provider_failed', retrievedFacts: bundle.counts.facts });
    throw new ServiceUnavailableError('AI assistant');
  }

  // Log the retrieval scope only — never the question text or the answer body.
  logger.info({
    msg: 'ai.question.answered',
    questionLength: dto.question.length,
    neighborhood: bundle.scope.neighborhood?.slug ?? null,
    propertyId: bundle.scope.propertyId,
    months: bundle.scope.months,
    listingsRetrieved: bundle.counts.listings,
    facts: bundle.counts.facts,
    calculations: bundle.counts.calculations,
    citations: bundle.citations.length,
  });

  return { answer, grounding };
}

export async function generateMarketSummary(neighborhoodSlug?: string) {
  const bundle = await buildMarketContext({
    question: `Summarise the current market${neighborhoodSlug ? ` in ${neighborhoodSlug}` : ' across Addis Ababa'}.`,
    neighborhoodSlug,
    months: 12,
  });

  if (!isAiConfigured()) {
    throw new ServiceUnavailableError(
      `AI analysis is not configured: set ${REQUIRED_AI_ENV_VARS.join(', ')}.`,
    );
  }

  const summary = await chatCompletion(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `${renderContextForPrompt(bundle)}\n\n### TASK\nWrite a 4-5 sentence market summary using only the retrieval context. Label calculated figures as calculated and cite source links where available.`,
      },
    ],
    500,
  );

  if (!summary) throw new ServiceUnavailableError('AI assistant');
  return { summary, grounding: summarizeGrounding(bundle) };
}

/**
 * Natural-language property search.
 *
 * The model only proposes filters. Every value is validated and clamped here,
 * then executed as a parameterised Prisma query — model output is never passed
 * to the database directly.
 */
export async function naturalLanguageSearch(dto: NLSearchDto) {
  const schema = `{
    "propertyType": "apartment|villa|condominium|office|retail|warehouse|land|null",
    "maxPrice": "number|null",
    "minPrice": "number|null",
    "minBedrooms": "number|null",
    "neighborhoodSlug": "string|null",
    "minRentalYield": "number|null (percentage)",
    "minSize": "number|null",
    "maxSize": "number|null"
  }`;

  const neighborhoods = await prisma.neighborhood.findMany({
    where: { isActive: true },
    select: { name: true, slug: true },
    orderBy: { name: 'asc' },
  });

  const filter = await structuredCompletion<ParsedPropertyFilter>(
    [
      {
        role: 'user',
        content: `Parse this property search query into filters: "${dto.query}"\n\nAvailable neighborhoods (slug): ${neighborhoods.map((n) => n.slug).join(', ')}`,
      },
    ],
    schema,
  );

  if (!filter) {
    throw new ServiceUnavailableError('AI search');
  }

  // Validate and clamp every model-proposed value.
  const safeFilter: {
    propertyType?: string;
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: { gte: number };
    neighborhoodSlug?: string;
    minRentalYield?: number;
  } = {};

  const type = filter.propertyType ? PROPERTY_TYPE_ENUM[filter.propertyType.toLowerCase()] : undefined;
  if (type) safeFilter.propertyType = type;

  if (typeof filter.maxPrice === 'number' && filter.maxPrice > 0) {
    safeFilter.maxPrice = Math.min(filter.maxPrice, 1e10);
  }
  if (typeof filter.minPrice === 'number' && filter.minPrice > 0) {
    safeFilter.minPrice = Math.min(filter.minPrice, 1e10);
  }
  if (typeof filter.minBedrooms === 'number' && filter.minBedrooms > 0) {
    safeFilter.bedrooms = { gte: Math.min(Math.floor(filter.minBedrooms), 20) };
  }
  if (
    filter.neighborhoodSlug &&
    neighborhoods.some((n) => n.slug === filter.neighborhoodSlug)
  ) {
    safeFilter.neighborhoodSlug = filter.neighborhoodSlug;
  }
  if (typeof filter.minRentalYield === 'number' && filter.minRentalYield > 0) {
    safeFilter.minRentalYield = Math.min(filter.minRentalYield, 100);
  }

  const rows = await prisma.listing.findMany({
    where: {
      status: 'ACTIVE',
      property: {
        status: 'APPROVED',
        ...(safeFilter.propertyType ? { propertyType: safeFilter.propertyType as never } : {}),
        ...(safeFilter.bedrooms ? { bedrooms: safeFilter.bedrooms } : {}),
        ...(safeFilter.neighborhoodSlug
          ? { neighborhood: { slug: safeFilter.neighborhoodSlug } }
          : {}),
      },
      ...(safeFilter.minPrice !== undefined || safeFilter.maxPrice !== undefined
        ? {
            currentPrice: {
              ...(safeFilter.minPrice !== undefined ? { gte: safeFilter.minPrice } : {}),
              ...(safeFilter.maxPrice !== undefined ? { lte: safeFilter.maxPrice } : {}),
            },
          }
        : {}),
    },
    select: {
      id: true,
      listingType: true,
      currentPrice: true,
      rentalPrice: true,
      listedAt: true,
      property: {
        select: {
          id: true,
          title: true,
          propertyType: true,
          sizeSqm: true,
          bedrooms: true,
          bathrooms: true,
          address: true,
          neighborhood: { select: { name: true, slug: true } },
        },
      },
    },
    take: 20,
    orderBy: { listedAt: 'desc' },
  });

  let results = rows.map((row) => {
    const price = Number(row.currentPrice);
    const rent = row.rentalPrice === null ? 0 : Number(row.rentalPrice);
    const rentalYield =
      price > 0 && rent > 0 ? Number(((rent * 12 * 100) / price).toFixed(2)) : null;
    return {
      listingId: row.id,
      propertyId: row.property.id,
      title: row.property.title,
      propertyType: row.property.propertyType,
      listingType: row.listingType,
      price,
      monthlyRent: row.rentalPrice === null ? null : rent,
      sizeSqm: Number(row.property.sizeSqm),
      bedrooms: row.property.bedrooms,
      bathrooms: row.property.bathrooms,
      address: row.property.address,
      neighborhood: row.property.neighborhood?.name ?? null,
      neighborhoodSlug: row.property.neighborhood?.slug ?? null,
      listedAt: row.listedAt.toISOString(),
      rentalYield,
    };
  });

  if (safeFilter.minRentalYield !== undefined) {
    results = results.filter(
      (row) => row.rentalYield !== null && row.rentalYield >= safeFilter.minRentalYield!,
    );
  }

  const prices = results.map((row) => row.price).filter((value) => Number.isFinite(value));

  return {
    parsedFilter: safeFilter,
    results,
    total: results.length,
    medianPrice: prices.length > 0 ? median(prices) : null,
    note:
      'Filters were proposed by the model and validated server-side; records come only from approved properties with active listings.',
  };
}
