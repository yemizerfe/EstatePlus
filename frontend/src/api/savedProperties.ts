import { apiClient } from './client';
import { propertyPhoto } from '../lib/propertyImages';

// API surface for the signed-in user's saved properties.
// Backed by: GET/POST/DELETE /users/saved-properties

export interface SavePropertyPayload {
  propertyId: string;
  title: string;
  neighborhood: string;
  image: string;
  price: number;
  size?: number | null;
  beds?: number;
  baths?: number;
}

export interface SavedProperty extends SavePropertyPayload {
  id: string; // DB row id
  savedAt: string; // created_at
}

interface SavedRecord {
  id: string;
  propertyId: string;
  title: string;
  neighborhood: string;
  image: string;
  price: string | number;
  size: string | number | null;
  beds: number;
  baths: number;
  createdAt: string;
}

function mapRecord(r: SavedRecord): SavedProperty {
  return {
    id: r.id,
    propertyId: r.propertyId,
    title: r.title,
    neighborhood: r.neighborhood,
    image: propertyPhoto({ id: r.propertyId, title: r.title, bedrooms: r.beds }),
    price: Number(r.price) || 0,
    size: r.size == null ? null : Number(r.size),
    beds: r.beds ?? 0,
    baths: r.baths ?? 0,
    savedAt: r.createdAt,
  };
}

export async function fetchSavedProperties(): Promise<SavedProperty[]> {
  const { data } = await apiClient.get<{ data: SavedRecord[] }>('/users/saved-properties');
  return (data.data ?? []).map(mapRecord);
}

export async function createSavedProperty(payload: SavePropertyPayload): Promise<SavedProperty> {
  const { data } = await apiClient.post<{ data: SavedRecord }>('/users/saved-properties', payload);
  return mapRecord(data.data);
}

export async function deleteSavedProperty(propertyId: string): Promise<void> {
  await apiClient.delete(`/users/saved-properties/${encodeURIComponent(propertyId)}`);
}