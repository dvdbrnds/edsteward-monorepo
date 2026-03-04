import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { regulationsApi, type RegulationFilters } from '../../lib/api/regulations';
import type { Regulation, InsertRegulation } from '@shared/schema';

// Query keys for React Query
export const regulationKeys = {
  all: ['regulations'] as const,
  lists: () => [...regulationKeys.all, 'list'] as const,
  list: (filters?: RegulationFilters) => [...regulationKeys.lists(), { filters }] as const,
  details: () => [...regulationKeys.all, 'detail'] as const,
  detail: (id: string) => [...regulationKeys.details(), id] as const,
};

// Hook for fetching regulations list (authenticated)
export function useRegulations(filters?: RegulationFilters) {
  return useQuery({
    queryKey: regulationKeys.list(filters),
    queryFn: () => regulationsApi.getRegulations(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook for fetching a single regulation (authenticated)
export function useRegulation(id: string, enabled = true) {
  return useQuery({
    queryKey: regulationKeys.detail(id),
    queryFn: () => regulationsApi.getRegulation(id),
    enabled: enabled && !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook for creating a regulation
export function useCreateRegulation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (regulation: InsertRegulation) => regulationsApi.createRegulation(regulation),
    onSuccess: () => {
      // Invalidate and refetch regulations list
      queryClient.invalidateQueries({ queryKey: regulationKeys.lists() });
    },
  });
}

// Hook for updating a regulation
export function useUpdateRegulation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Regulation> }) => 
      regulationsApi.updateRegulation(id, data),
    onSuccess: (_, { id }) => {
      // Invalidate and refetch specific regulation and lists
      queryClient.invalidateQueries({ queryKey: regulationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: regulationKeys.lists() });
    },
  });
}

// Hook for deleting a regulation
export function useDeleteRegulation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => regulationsApi.deleteRegulation(id),
    onSuccess: (_, id) => {
      // Remove specific regulation from cache and invalidate lists
      queryClient.removeQueries({ queryKey: regulationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: regulationKeys.lists() });
    },
  });
}

// Hook for regulation search
export function useRegulationSearch(query: string, filters?: RegulationFilters, enabled = true) {
  return useQuery({
    queryKey: ['regulations', 'search', { query, filters }],
    queryFn: () => regulationsApi.searchRegulations(query, filters),
    enabled: enabled && query.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Hook for uploading regulation files
export function useUploadRegulationFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ regulationId, file, description }: { 
      regulationId: string; 
      file: File; 
      description?: string 
    }) => regulationsApi.uploadFile(regulationId, file, description),
    onSuccess: (_, { regulationId }) => {
      // Invalidate regulation details to refetch with new file
      queryClient.invalidateQueries({ queryKey: regulationKeys.detail(regulationId) });
    },
  });
} 