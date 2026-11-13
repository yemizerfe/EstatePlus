import { apiClient } from './client';
import type { Scenario, ScenarioAnalysis, ScenarioParameter, ScenarioQuery, ScenarioType } from '../types';

interface RawScenario {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  parameters: ScenarioParameter[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface RawScenarioResult {
  id: string;
  scenarioId: string;
  neighborhoodId: string | null;
  priceImpactPct: number | string | null;
  rentalImpactPct: number | string | null;
  demandImpact: string;
  supplyImpact: string;
  calculatedResults?: {
    breakdown?: Array<{ indicator: string; changePct: number; priceImpact: number; rentalImpact: number }>;
  } | null;
  assumptions?: { model?: string; disclaimer?: string } | null;
  aiExplanation: string | null;
  createdAt?: string;
}

/** Backend stores lowercase scenario types; the UI enum is uppercase. */
const SCENARIO_TYPES: ScenarioType[] = [
  'ECONOMIC_SHOCK',
  'MARKET_SHIFT',
  'POLICY_CHANGE',
  'LOCAL_DEVELOPMENT',
  'INFRASTRUCTURE',
  'DEMOGRAPHIC_CHANGE',
];

const mapScenario = (raw: RawScenario): Scenario => {
  const upper = raw.type?.toUpperCase();
  const type = upper && SCENARIO_TYPES.includes(upper as ScenarioType)
    ? (upper as ScenarioType)
    : 'ECONOMIC_SHOCK';
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    scenarioType: type,
    parameters: raw.parameters ?? [],
    createdBy: raw.createdBy ?? '',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
};

export async function getScenarios(query: ScenarioQuery = {}): Promise<Scenario[]> {
  const { data } = await apiClient.get<{ data: RawScenario[] }>('/scenarios', {
    params: {
      page: query.page,
      limit: query.limit,
      type: query.scenarioType,
    },
  });
  return (data.data ?? []).map(mapScenario);
}

export async function getScenario(id: string): Promise<Scenario> {
  const { data } = await apiClient.get<{ data: RawScenario }>(`/scenarios/${id}`);
  return mapScenario(data.data);
}

export async function createScenario(input: {
  name: string;
  description?: string;
  type?: ScenarioType;
  parameters: ScenarioParameter[];
}): Promise<Scenario> {
  const { data } = await apiClient.post<{ data: RawScenario }>('/scenarios', {
    ...input,
    type: input.type?.toLowerCase(),
  });
  return mapScenario(data.data);
}

export async function deleteScenario(id: string): Promise<void> {
  await apiClient.delete(`/scenarios/${id}`);
}

/** POST /scenarios/:id/run — server-side elasticity model, persisted result. */
export async function runScenario(id: string, neighborhoodId?: string): Promise<ScenarioAnalysis> {
  // No request body: the backend rejects a JSON `null` payload, and the run
  // only needs the id plus optional query parameters.
  const { data } = await apiClient.post<{ data: RawScenarioResult }>(`/scenarios/${id}/run`, undefined, {
    params: neighborhoodId ? { neighborhoodId } : {},
  });
  const raw = data.data;
  return {
    scenarioId: raw.scenarioId,
    priceImpactPct: Number(raw.priceImpactPct ?? 0),
    rentalImpactPct: Number(raw.rentalImpactPct ?? 0),
    demandImpact: raw.demandImpact,
    supplyImpact: raw.supplyImpact,
    breakdown: (raw.calculatedResults?.breakdown ?? []).map((item) => ({
      indicator: item.indicator as ScenarioAnalysis['breakdown'][number]['indicator'],
      changePct: Number(item.changePct),
      priceImpact: Number(item.priceImpact),
      rentalImpact: Number(item.rentalImpact),
    })),
    assumptions: {
      model: raw.assumptions?.model ?? 'elasticity_coefficients',
      disclaimer: raw.assumptions?.disclaimer ?? 'Scenario results are estimates.',
    },
    aiExplanation: raw.aiExplanation,
    calculatedAt: raw.createdAt ?? new Date().toISOString(),
  };
}

export async function compareScenarios(ids: string[]): Promise<unknown[]> {
  const { data } = await apiClient.get<{ data: unknown[] }>('/scenarios/compare', {
    params: { ids },
  });
  return data.data;
}

// Parameter builder helpers used by the scenarios UI to avoid direct mutation of tuples
export function addScenarioParameter(
  params: ScenarioParameter[],
  next?: Partial<ScenarioParameter>,
): ScenarioParameter[] {
  return [...params, { indicator: 'inflation', changePct: 0, changeType: 'increase', ...next }];
}

export function updateScenarioParameter(
  params: ScenarioParameter[],
  idx: number,
  patch: Partial<ScenarioParameter>,
): ScenarioParameter[] {
  const next = [...params];
  next[idx] = { ...next[idx]!, ...patch };
  return next;
}
