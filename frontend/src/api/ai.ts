import { apiClient } from './client';

export interface AiStatus {
  provider: 'openai';
  model: string;
  configured: boolean;
  missingEnvironmentVariables: string[];
  message: string;
  groundingAvailable: boolean;
}

export interface AiCitation {
  id: string;
  label: string;
  url: string | null;
  asOf: string | null;
  publisher: string | null;
}

export interface AiGroundingSummary {
  scope: {
    question: string;
    neighborhood: { name: string; slug: string } | null;
    propertyId: string | null;
    months: number;
    listingType: 'sale' | 'rent' | null;
    propertyType: string | null;
    maxPrice: number | null;
  };
  counts: {
    listings: number;
    neighborhoods: number;
    indicatorSeries: number;
    macroSeries: number;
    exchangeRates: number;
    facts: number;
    calculations: number;
  };
  citations: AiCitation[];
  limitations: string[];
  unavailable: string[];
  generatedAt: string;
}

export interface AiAnswer {
  answer: string;
  grounding: AiGroundingSummary;
}

export interface AskQuestionOptions {
  neighborhoodSlug?: string;
  propertyId?: string;
  months?: number;
  listingType?: 'sale' | 'rent';
  propertyType?: string;
  maxPrice?: number;
}

export interface AiNotConfigured {
  code: 'AI_NOT_CONFIGURED';
  message: string;
  missingEnvironmentVariables: string[];
}

/**
 * Provider availability. Requires a session; callers on public pages must only
 * ask when a user is signed in, otherwise the 401 triggers a login redirect.
 */
export async function fetchAiStatus(): Promise<AiStatus> {
  const { data } = await apiClient.get<{ data: AiStatus }>('/ai/status');
  return data.data;
}

/** Grounded answer: the backend retrieves the relevant records, not the DB. */
export async function askQuestion(
  question: string,
  options: AskQuestionOptions = {},
): Promise<AiAnswer> {
  const { data } = await apiClient.post<{ data: AiAnswer }>('/ai/ask', { question, ...options });
  return data.data;
}

export async function getMarketSummary(neighborhoodSlug?: string): Promise<AiAnswer> {
  const { data } = await apiClient.get<{ data: AiAnswer }>('/ai/summary', {
    params: neighborhoodSlug ? { neighborhoodSlug } : {},
  });
  return data.data;
}

export async function naturalLanguageSearch(query: string): Promise<{
  parsedFilter: Record<string, unknown>;
  results: unknown[];
  total: number;
  medianPrice: number | null;
  note: string;
}> {
  const { data } = await apiClient.post<{
    data: {
      parsedFilter: Record<string, unknown>;
      results: unknown[];
      total: number;
      medianPrice: number | null;
      note: string;
    };
  }>('/ai/search', { query });
  return data.data;
}

/** True when the backend reported a missing AI provider (HTTP 503 + code). */
export function isAiNotConfigured(error: unknown): error is { response: { data: AiNotConfigured } } {
  const candidate = error as { response?: { data?: { code?: string } } } | undefined;
  return candidate?.response?.data?.code === 'AI_NOT_CONFIGURED';
}
