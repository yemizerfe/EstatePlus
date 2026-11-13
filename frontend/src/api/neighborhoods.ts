import { apiClient } from './client';
import type {
  Neighborhood,
  NeighborhoodSearchQuery,
  NeighborhoodSearchResponse,
  NeighborhoodStatistics,
  Amenity
} from '../types';

// Search neighborhoods
export async function searchNeighborhoods(query: NeighborhoodSearchQuery): Promise<NeighborhoodSearchResponse> {
  const { data } = await apiClient.get<{ data: Neighborhood[]; meta: any }>('/neighborhoods', { params: query });
  return {
    neighborhoods: data.data!,
    meta: data.meta || {
      page: 1,
      limit: 20,
      total: data.data!.length,
      totalPages: 1
    }
  };
}

// Get neighborhood by ID
export async function getNeighborhood(id: string): Promise<Neighborhood> {
  const { data } = await apiClient.get<{ data: Neighborhood }>(`/neighborhoods/${id}`);
  return data.data!;
}

// Create neighborhood (analysts and admins)
export async function createNeighborhood(neighborhoodData: any): Promise<Neighborhood> {
  const { data } = await apiClient.post<{ data: Neighborhood }>('/neighborhoods', neighborhoodData);
  return data.data!;
}

// Update neighborhood (analysts and admins)
export async function updateNeighborhood(id: string, neighborhoodData: any): Promise<Neighborhood> {
  const { data } = await apiClient.patch<{ data: Neighborhood }>(`/neighborhoods/${id}`, neighborhoodData);
  return data.data!;
}

// Delete neighborhood (analysts and admins)
export async function deleteNeighborhood(id: string): Promise<void> {
  await apiClient.delete(`/neighborhoods/${id}`);
}

// Get neighborhood statistics
export async function getNeighborhoodStatistics(id: string): Promise<NeighborhoodStatistics> {
  const { data } = await apiClient.get<{ data: NeighborhoodStatistics }>(`/neighborhoods/${id}/statistics`);
  return data.data!;
}

export interface NeighborhoodAmenityRecord {
  id: string;
  amenityType: string;
  name: string;
  description: string | null;
  address: string | null;
  distance: number | null;
  rating: number | null;
  verified: boolean;
}

export interface NeighborhoodAmenityResponse {
  neighborhood: { id: string; name: string; slug: string };
  amenities: NeighborhoodAmenityRecord[];
  summary: { total: number; verified: number; avgRating: number };
}

// Get neighborhood amenities (slug-based)
export async function getNeighborhoodAmenities(
  slug: string,
  amenityType?: string,
): Promise<NeighborhoodAmenityResponse> {
  const { data } = await apiClient.get<{ data: NeighborhoodAmenityResponse }>(
    `/neighborhoods/${encodeURIComponent(slug)}/amenities`,
    { params: amenityType ? { amenityType } : undefined },
  );
  return data.data;
}

// Add amenity to neighborhood (analysts and admins)
export async function addNeighborhoodAmenity(id: string, amenityData: any): Promise<Amenity> {
  const { data } = await apiClient.post<{ data: Amenity }>(`/neighborhoods/${id}/amenities`, amenityData);
  return data.data!;
}

// Remove amenity from neighborhood (analysts and admins)
export async function removeNeighborhoodAmenity(neighborhoodId: string, amenityId: string): Promise<void> {
  await apiClient.delete(`/neighborhoods/${neighborhoodId}/amenities/${amenityId}`);
}

// Get neighborhood investment score
export async function getNeighborhoodInvestmentScore(id: string): Promise<any> {
  const { data } = await apiClient.get<{ data: any }>(`/neighborhoods/${id}/investment-score`);
  return data.data!;
}

// Get neighborhood market insights
export async function getNeighborhoodMarketInsights(id: string): Promise<any> {
  const { data } = await apiClient.get<{ data: any }>(`/neighborhoods/${id}/market-insights`);
  return data.data!;
}

// Get public neighborhoods (no auth required)
export async function getPublicNeighborhoods(query?: Partial<NeighborhoodSearchQuery>): Promise<NeighborhoodSearchResponse> {
  const { data } = await apiClient.get<{ data: Neighborhood[]; meta: any }>('/public/neighborhoods', { params: query });
  return {
    neighborhoods: data.data!,
    meta: data.meta || {
      page: 1,
      limit: 20,
      total: data.data!.length,
      totalPages: 1
    }
  };
}

// Get public neighborhood details (no auth required)
export async function getPublicNeighborhood(id: string): Promise<Neighborhood> {
  const { data } = await apiClient.get<{ data: Neighborhood }>(`/public/neighborhoods/${id}`);
  return data.data!;
}