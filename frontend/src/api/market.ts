import { apiClient } from './client';
import { searchProperties } from './properties';
import { fetchPublicNeighborhoods } from './publicData';
import type { PublicNeighborhood } from './publicData';
import type { PropertySearchQuery, PropertySearchResponse } from '../types';
import type {
  MarketStatistics,
  MarketTrend,
  MarketSegment,
  MarketComparison,
  MarketVolumeAnalysis,
  MarketPerformanceMetrics
} from '../types';

// Get overall market statistics
export async function getMarketStatistics(params?: {
  city?: string;
  propertyType?: string;
  startDate?: string;
  endDate?: string;
}): Promise<MarketStatistics> {
  const { data } = await apiClient.get<{ data: MarketStatistics }>('/market/statistics', { params });
  return data.data!;
}

// Get market trends
export async function getMarketTrends(params?: {
  city?: string;
  propertyType?: string;
  timeframe?: '7d' | '30d' | '90d' | '1y' | 'all';
}): Promise<MarketTrend[]> {
  const { data } = await apiClient.get<{ data: MarketTrend[] }>('/market/trends', { params });
  return data.data!;
}

// Get market segments
export async function getMarketSegments(params?: {
  city?: string;
  neighborhoodId?: string;
  propertyType?: string;
}): Promise<MarketSegment[]> {
  const { data } = await apiClient.get<{ data: MarketSegment[] }>('/market/segments', { params });
  return data.data!;
}

// Compare markets
export async function compareMarkets(params: {
  compareWith: string[]; // Array of city or neighborhood IDs to compare
  propertyType?: string;
  metric?: 'price' | 'volume' | 'days_on_market' | 'price_per_sqm';
}): Promise<MarketComparison[]> {
  const { data } = await apiClient.get<{ data: MarketComparison[] }>('/market/compare', { params });
  return data.data!;
}

// Get market volume analysis
export async function getMarketVolumeAnalysis(params?: {
  city?: string;
  propertyType?: string;
  timeframe?: '30d' | '90d' | '180d' | '1y';
}): Promise<MarketVolumeAnalysis> {
  const { data } = await apiClient.get<{ data: MarketVolumeAnalysis }>('/market/volume', { params });
  return data.data!;
}

// Get market performance metrics
export async function getMarketPerformanceMetrics(params?: {
  city?: string;
  propertyType?: string;
}): Promise<MarketPerformanceMetrics> {
  const { data } = await apiClient.get<{ data: MarketPerformanceMetrics }>('/market/performance', { params });
  return data.data!;
}

// Get market seasonality patterns
export async function getMarketSeasonality(params: {
  city: string;
  propertyType: string;
  years?: number;
}): Promise<any> {
  const { data } = await apiClient.get<{ data: any }>('/market/seasonality', { params });
  return data.data!;
}

// Get market strength indicators
export async function getMarketStrengthIndicators(params?: {
  city?: string;
  neighborhoodId?: string;
}): Promise<any> {
  const { data } = await apiClient.get<{ data: any }>('/market/strength', { params });
  return data.data!;
}

// Get market liquidity scoring
export async function getMarketLiquidityScoring(params?: {
  city?: string;
  propertyType?: string;
}): Promise<any> {
  const { data } = await apiClient.get<{ data: any }>('/market/liquidity', { params });
  return data.data!;
}

// Get market volatility calculations
export async function getMarketVolatility(params: {
  city: string;
  propertyType: string;
  timeframe?: '30d' | '90d' | '180d' | '1y';
}): Promise<any> {
  const { data } = await apiClient.get<{ data: any }>('/market/volatility', { params });
  return data.data!;
}

// Get market momentum indicators
export async function getMarketMomentum(params: {
  city: string;
  propertyType: string;
}): Promise<any> {
  const { data } = await apiClient.get<{ data: any }>('/market/momentum', { params });
  return data.data!;
}

// Get public market data (no auth required)
export async function getPublicMarketStatistics(city?: string): Promise<MarketStatistics> {
  const { data } = await apiClient.get<{ data: MarketStatistics }>('/public/market/statistics', { 
    params: { city } 
  });
  return data.data!;
}

// Get public market trends (no auth required)
export async function getPublicMarketTrends(params?: {
  city?: string;
  timeframe?: '7d' | '30d' | '90d';
}): Promise<MarketTrend[]> {
  const { data } = await apiClient.get<{ data: MarketTrend[] }>('/public/market/trends', { params });
  return data.data!;
}

/** Neighborhood list used by pickers and filters (public, no auth). */
export async function getNeighborhoods(params?: {
  limit?: number;
  search?: string;
}): Promise<PublicNeighborhood[]> {
  const list = await fetchPublicNeighborhoods();
  const search = params?.search?.trim().toLowerCase();
  const filtered = search
    ? list.filter((n) => n.name.toLowerCase().includes(search))
    : list;
  return params?.limit ? filtered.slice(0, params.limit) : filtered;
}

/** Authenticated property search, aliased for pages that import from market.ts. */
export async function getProperties(query?: PropertySearchQuery): Promise<PropertySearchResponse> {
  return searchProperties(query ?? {});
}

/** Neighborhood price/rent forecast series from the forecasting module. */
export async function getMarketForecast(params?: {
  forecastType?: 'price' | 'rental';
  neighborhoodId?: string;
  months?: number;
}): Promise<any> {
  const { data } = await apiClient.get<{ data: any }>('/forecasts', { params });
  return data.data ?? data;
}

export async function getValuation(params: { propertyId: string }): Promise<any> {
  const { data } = await apiClient.get<{ data: any }>(`/properties/${params.propertyId}/valuation`);
  return data.data ?? data;
}

export { getEconomicIndicators } from './economics';