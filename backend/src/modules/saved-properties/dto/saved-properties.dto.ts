import { PropertyType } from '@prisma/client';

export interface SavedPropertyCreateDto {
  propertyId: string;
  notes?: string;
  tags?: string[];
}

export interface SavedPropertyUpdateDto {
  notes?: string;
  tags?: string[];
}

export interface SavedPropertyQueryDto {
  page?: number;
  limit?: number;
  sortBy?: 'savedAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  tags?: string[];
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  propertyType?: PropertyType;
  city?: string;
  subcity?: string;
}

export interface BulkRemoveDto {
  savedPropertyIds: string[];
}

export interface BulkTagsDto {
  savedPropertyIds: string[];
  tags: string[];
}