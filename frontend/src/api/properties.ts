import { apiClient } from './client';
import type {
  Property,
  PropertySearchQuery,
  PropertySearchResponse,
  PropertyStatusTransition,
  PropertyStatistics,
  PropertyLifecycleHistory,
  PropertyCreationData,
  PropertyUpdateData
} from '../types';
import { propertyGallery } from '../lib/propertyImages';

/**
 * Every listing card in the app renders through this: a record keeps its own
 * photo, and a record without a genuine photo gets one that matches its type
 * and bedroom count instead of a broken or unrelated image.
 */
function withPhotos(property: Property): Property {
  const images = propertyGallery(
    {
      id: property.id,
      propertyType: property.propertyType,
      bedrooms: property.bedrooms,
      title: property.title,
    },
    (property.images ?? []).map((image) => ({ imageUrl: image.imageUrl })),
  ).map((image, index) => ({
    ...image,
    id: `${property.id}-photo-${index}`,
    propertyId: property.id,
    isPrimary: index === 0,
    sortOrder: index,
  }));

  return { ...property, images } as Property;
}

// Search properties
export async function searchProperties(query: PropertySearchQuery): Promise<PropertySearchResponse> {
  const { data } = await apiClient.get<{ data: Property[]; meta: any }>('/properties', { params: query });
  return {
    properties: (data.data ?? []).map(withPhotos),
    meta: data.meta || {
      page: 1,
      limit: 20,
      total: data.data!.length,
      totalPages: 1
    }
  };
}

// Get property by ID
export async function getProperty(id: string): Promise<Property> {
  const { data } = await apiClient.get<{ data: Property }>(`/properties/${id}`);
  return withPhotos(data.data!);
}

// Create property
export async function createProperty(propertyData: PropertyCreationData): Promise<Property> {
  const { data } = await apiClient.post<{ data: Property }>('/properties', propertyData);
  return data.data!;
}

// Update property
export async function updateProperty(id: string, propertyData: PropertyUpdateData): Promise<Property> {
  const { data } = await apiClient.patch<{ data: Property }>(`/properties/${id}`, propertyData);
  return data.data!;
}

// Delete property (soft delete)
export async function deleteProperty(id: string): Promise<void> {
  await apiClient.delete(`/properties/${id}`);
}

// Change property status
export async function changePropertyStatus(
  id: string, 
  transition: PropertyStatusTransition
): Promise<Property> {
  const { data } = await apiClient.patch<{ data: Property }>(
    `/properties/${id}/status`, 
    transition
  );
  return data.data!;
}

// Bulk update property status
export async function bulkUpdatePropertyStatus(
  propertyIds: string[],
  transition: Pick<PropertyStatusTransition, 'fromStatus' | 'toStatus' | 'reason'>
): Promise<any> {
  const { data } = await apiClient.patch<{ data: any }>('/properties/bulk/status', {
    propertyIds,
    ...transition
  });
  return data.data!;
}

// Get property lifecycle history
export async function getPropertyLifecycleHistory(id: string): Promise<PropertyLifecycleHistory[]> {
  const { data } = await apiClient.get<{ data: PropertyLifecycleHistory[] }>(`/properties/${id}/history`);
  return data.data!;
}

// Schedule status change
export async function schedulePropertyStatusChange(
  id: string,
  transition: PropertyStatusTransition & { scheduledDate: string }
): Promise<any> {
  const { data } = await apiClient.post<{ data: any }>(
    `/properties/${id}/schedule-status`,
    transition
  );
  return data.data!;
}

// Transfer property ownership
export async function transferPropertyOwnership(
  id: string,
  newOwnerId: string,
  reason?: string
): Promise<any> {
  const { data } = await apiClient.patch<{ data: any }>(
    `/properties/${id}/transfer-ownership`,
    { newOwnerId, reason }
  );
  return data.data!;
}

// Get property statistics
export async function getPropertyStatistics(): Promise<PropertyStatistics> {
  const { data } = await apiClient.get<{ data: PropertyStatistics }>('/properties/statistics');
  return data.data!;
}

// Get my properties (for property owners)
export async function getMyProperties(query?: Partial<PropertySearchQuery>): Promise<PropertySearchResponse> {
  const { data } = await apiClient.get<{ data: Property[]; meta: any }>('/properties', { 
    params: { ownedBy: 'me', ...query } 
  });
  return {
    properties: (data.data ?? []).map(withPhotos),
    meta: data.meta || {
      page: 1,
      limit: 20,
      total: data.data!.length,
      totalPages: 1
    }
  };
}

// Compute a comparable-based valuation for a property
export async function valuateProperty(id: string): Promise<any> {
  const { data } = await apiClient.post<{ data: any }>(`/properties/${id}/valuate`);
  return data.data!;
}

// Get public properties (no auth required)
export async function getPublicProperties(query?: Partial<PropertySearchQuery>): Promise<PropertySearchResponse> {
  const { data } = await apiClient.get<{ data: Property[]; meta: any }>('/public/properties', { params: query });
  return {
    properties: (data.data ?? []).map(withPhotos),
    meta: data.meta || {
      page: 1,
      limit: 20,
      total: data.data!.length,
      totalPages: 1
    }
  };
}