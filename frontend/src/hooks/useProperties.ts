import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { searchProperties, getProperty, createProperty, updateProperty, deleteProperty, changePropertyStatus, getPropertyStatistics, getMyProperties } from '../api/properties';
import type { PropertySearchQuery, PropertyUpdateData, PropertyStatusTransition } from '../types';

// Query keys
export const propertyKeys = {
  all: ['properties'] as const,
  lists: () => [...propertyKeys.all, 'list'] as const,
  list: (query: PropertySearchQuery) => [...propertyKeys.lists(), query] as const,
  details: () => [...propertyKeys.all, 'detail'] as const,
  detail: (id: string) => [...propertyKeys.details(), id] as const,
  statistics: () => [...propertyKeys.all, 'statistics'] as const,
  myProperties: (query?: PropertySearchQuery) => [...propertyKeys.all, 'my', query] as const,
};

// Queries
export function useProperties(query: PropertySearchQuery) {
  return useQuery({
    queryKey: propertyKeys.list(query),
    queryFn: () => searchProperties(query),
    placeholderData: (previous) => previous,
  });
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: propertyKeys.detail(id),
    queryFn: () => getProperty(id),
    enabled: !!id,
  });
}

export function usePropertyStatistics() {
  return useQuery({
    queryKey: propertyKeys.statistics(),
    queryFn: getPropertyStatistics,
  });
}

export function useMyProperties(query?: PropertySearchQuery) {
  return useQuery({
    queryKey: propertyKeys.myProperties(query),
    queryFn: () => getMyProperties(query),
  });
}

// Mutations
export function useCreateProperty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createProperty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      queryClient.invalidateQueries({ queryKey: propertyKeys.statistics() });
    },
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PropertyUpdateData }) => updateProperty(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      queryClient.invalidateQueries({ queryKey: propertyKeys.detail(variables.id) });
    },
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteProperty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      queryClient.invalidateQueries({ queryKey: propertyKeys.statistics() });
    },
  });
}

export function useChangePropertyStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, transition }: { id: string; transition: PropertyStatusTransition }) => 
      changePropertyStatus(id, transition),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      queryClient.invalidateQueries({ queryKey: propertyKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: propertyKeys.statistics() });
    },
  });
}