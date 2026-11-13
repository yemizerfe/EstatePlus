import { apiClient } from './client';
import type {
  EconomicIndicator,
  EconomicIndicatorType,
  EconomicIndicatorTrend,
  EconomicImpactAnalysis,
  EconomicCorrelation,
  EconomicIndicatorQuery
} from '../types';

// Get economic indicators
export async function getEconomicIndicators(query?: EconomicIndicatorQuery): Promise<EconomicIndicator[]> {
  const { data } = await apiClient.get<{ data: EconomicIndicator[] }>('/economics', { params: query });
  return data.data!;
}

/** Alias so `/market` imports of getEconomicIndicators resolve (page clients sometimes import from market.ts). */
export { getEconomicIndicators as getEconomicIndicatorsFromEconomics };

// Get economic indicator by ID
export async function getEconomicIndicator(id: string): Promise<EconomicIndicator> {
  const { data } = await apiClient.get<{ data: EconomicIndicator }>(`/economics/${id}`);
  return data.data!;
}

// Create economic indicator (analysts and admins)
export async function createEconomicIndicator(indicatorData: any): Promise<EconomicIndicator> {
  const { data } = await apiClient.post<{ data: EconomicIndicator }>('/economics', indicatorData);
  return data.data!;
}

// Update economic indicator (analysts and admins)
export async function updateEconomicIndicator(id: string, indicatorData: any): Promise<EconomicIndicator> {
  const { data } = await apiClient.patch<{ data: EconomicIndicator }>(`/economics/${id}`, indicatorData);
  return data.data!;
}

// Delete economic indicator (analysts and admins)
export async function deleteEconomicIndicator(id: string): Promise<void> {
  await apiClient.delete(`/economics/${id}`);
}

// Get economic indicator trends
export async function getEconomicTrends(params?: {
  indicatorType?: EconomicIndicatorType;
  startDate?: string;
  endDate?: string;
  aggregation?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
}): Promise<EconomicIndicatorTrend[]> {
  const { data } = await apiClient.get<{ data: EconomicIndicatorTrend[] }>('/economics/trends', { params });
  return data.data!;
}

// Get economic impact analysis
export async function getEconomicImpactAnalysis(params: {
  propertyType?: string;
  city?: string;
  indicatorTypes?: EconomicIndicatorType[];
}): Promise<EconomicImpactAnalysis> {
  const { data } = await apiClient.get<{ data: EconomicImpactAnalysis }>('/economics/impact-analysis', { params });
  return data.data!;
}

// Get economic correlations
export async function getEconomicCorrelations(params?: {
  indicatorType1?: EconomicIndicatorType;
  indicatorType2?: EconomicIndicatorType;
  propertyType?: string;
}): Promise<EconomicCorrelation[]> {
  const { data } = await apiClient.get<{ data: EconomicCorrelation[] }>('/economics/correlations', { params });
  return data.data!;
}

// Get volatility calculations
export async function getVolatilityCalculations(params: {
  indicatorType: EconomicIndicatorType;
  timeframe?: '30d' | '90d' | '180d' | '1y';
}): Promise<any> {
  const { data } = await apiClient.get<{ data: any }>('/economics/volatility', { params });
  return data.data!;
}

// Get seasonality detection
export async function getEconomicSeasonality(params: {
  indicatorType: EconomicIndicatorType;
  years?: number;
}): Promise<any> {
  const { data } = await apiClient.get<{ data: any }>('/economics/seasonality', { params });
  return data.data!;
}

// Get economic dashboard
export async function getEconomicDashboard(): Promise<any> {
  const { data } = await apiClient.get<{ data: any }>('/economics/dashboard');
  return data.data!;
}

// Bulk import economic data (analysts and admins)
export async function bulkImportEconomicData(importData: any): Promise<any> {
  const { data } = await apiClient.post<{ data: any }>('/economics/bulk-import', importData);
  return data.data!;
}

// Get indicator statistics
export async function getIndicatorStatistics(): Promise<any> {
  const { data } = await apiClient.get<{ data: any }>('/economics/statistics');
  return data.data!;
}

// Get indicator types
export async function getIndicatorTypes(): Promise<EconomicIndicatorType[]> {
  const { data } = await apiClient.get<{ data: EconomicIndicatorType[] }>('/economics/indicator-types');
  return data.data!;
}

// Get public economic indicators (no auth required)
export async function getPublicEconomicIndicators(params?: {
  indicatorType?: EconomicIndicatorType;
  limit?: number;
}): Promise<EconomicIndicator[]> {
  const { data } = await apiClient.get<{ data: EconomicIndicator[] }>('/public/economics', { params });
  return data.data!;
}

// Get public economic trends (no auth required)
export async function getPublicEconomicTrends(params?: {
  indicatorType?: EconomicIndicatorType;
  timeframe?: '30d' | '90d' | '1y';
}): Promise<EconomicIndicatorTrend[]> {
  const { data } = await apiClient.get<{ data: EconomicIndicatorTrend[] }>('/public/economics/trends', { params });
  return data.data!;
}