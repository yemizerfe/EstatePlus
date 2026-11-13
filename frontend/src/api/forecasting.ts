import { apiClient } from './client';
import type {
  Forecast,
  ForecastQuery,
  ForecastResponse,
  InvestmentRecommendation,
  ForecastComparison,
  MarketOutlook
} from '../types';

// Generate property price forecast
export async function generatePropertyForecast(query: ForecastQuery): Promise<ForecastResponse> {
  const { data } = await apiClient.post<{ data: ForecastResponse }>('/forecasts/property', query);
  return data.data!;
}

// Generate rental forecast
export async function generateRentalForecast(query: ForecastQuery): Promise<ForecastResponse> {
  const { data } = await apiClient.post<{ data: ForecastResponse }>('/forecasts/rental', query);
  return data.data!;
}

// Generate market forecast
export async function generateMarketForecast(params: {
  city: string;
  propertyType: string;
  forecastPeriod?: 30 | 90 | 180 | 365;
}): Promise<ForecastResponse> {
  const { data } = await apiClient.post<{ data: ForecastResponse }>('/forecasts/market', params);
  return data.data!;
}

// Get investment recommendations
export async function getInvestmentRecommendations(params: {
  propertyId?: string;
  neighborhoodId?: string;
  propertyType?: string;
  investmentAmount?: number;
  timeframe?: 'short' | 'medium' | 'long';
}): Promise<InvestmentRecommendation[]> {
  const { data } = await apiClient.get<{ data: InvestmentRecommendation[] }>('/forecasts/investment-recommendations', { params });
  return data.data!;
}

// Compare forecasts
export async function compareForecasts(params: {
  propertyType: string;
  models?: string[];
  timeframe: number;
}): Promise<ForecastComparison[]> {
  const { data } = await apiClient.post<{ data: ForecastComparison[] }>('/forecasts/compare', params);
  return data.data!;
}

// Get forecast by ID
export async function getForecast(id: string): Promise<Forecast> {
  const { data } = await apiClient.get<{ data: Forecast }>(`/forecasts/${id}`);
  return data.data!;
}

// Get my forecasts
export async function getMyForecasts(params?: {
  propertyId?: string;
  forecastType?: 'property' | 'rental' | 'market';
  limit?: number;
  offset?: number;
}): Promise<Forecast[]> {
  const { data } = await apiClient.get<{ data: Forecast[] }>('/forecasts/my', { params });
  return data.data!;
}

// Delete forecast
export async function deleteForecast(id: string): Promise<void> {
  await apiClient.delete(`/forecasts/${id}`);
}

// Get market outlook
export async function getMarketOutlook(params: {
  city: string;
  propertyType?: string;
  includeNeighborhoods?: boolean;
}): Promise<MarketOutlook> {
  const { data } = await apiClient.get<{ data: MarketOutlook }>('/forecasts/market-outlook', { params });
  return data.data!;
}

// Get forecast statistics
export async function getForecastStatistics(): Promise<any> {
  const { data } = await apiClient.get<{ data: any }>('/forecasts/statistics');
  return data.data!;
}

// Get trend analysis
export async function getTrendAnalysis(params: {
  propertyId?: string;
  neighborhoodId?: string;
  propertyType?: string;
  timeframe?: '30d' | '90d' | '1y' | 'all';
}): Promise<any> {
  const { data } = await apiClient.get<{ data: any }>('/forecasts/trend-analysis', { params });
  return data.data!;
}

// Get seasonality detection
export async function getSeasonalityDetection(params: {
  city: string;
  propertyType: string;
}): Promise<any> {
  const { data } = await apiClient.get<{ data: any }>('/forecasts/seasonality', { params });
  return data.data!;
}