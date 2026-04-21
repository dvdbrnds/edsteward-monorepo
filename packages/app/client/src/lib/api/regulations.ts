import { apiClient } from './client';
import type { Regulation, InsertRegulation } from '@shared/schema';

export interface RegulationFilters {
  category?: string;
  jurisdiction?: string;
  isApplicable?: boolean;
  search?: string;
}

export interface RegulationListResponse {
  regulations: Regulation[];
  total: number;
  page: number;
  limit: number;
}

export type PublicRegulation = Pick<Regulation, 'id' | 'name' | 'category' | 'summary' | 'statute' | 'jurisdictionSource'>;

class RegulationsApi {
  // Get all regulations with filtering (authenticated)
  async getRegulations(filters?: RegulationFilters): Promise<Regulation[]> {
    const params = filters ? this.buildFilterParams(filters) : undefined;
    return apiClient.get<Regulation[]>('/regulations', { params });
  }

  // Get regulation by ID (authenticated)
  async getRegulation(id: string): Promise<Regulation> {
    return apiClient.get<Regulation>(`/regulations/${id}`);
  }

  // Create new regulation
  async createRegulation(regulation: InsertRegulation): Promise<Regulation> {
    return apiClient.post<Regulation>('/regulations', regulation);
  }

  // Update existing regulation
  async updateRegulation(id: string, regulation: Partial<Regulation>): Promise<Regulation> {
    return apiClient.put<Regulation>(`/regulations/${id}`, regulation);
  }

  // Delete regulation
  async deleteRegulation(id: string): Promise<void> {
    return apiClient.delete<void>(`/regulations/${id}`);
  }

  // Upload regulation file
  async uploadFile(regulationId: string, file: File, description?: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (description) {
      formData.append('description', description);
    }
    
    return apiClient.upload(`/regulations/${regulationId}/files`, formData);
  }

  // Validate regulation data
  async validateRegulation(regulation: InsertRegulation): Promise<{ valid: boolean; errors: string[] }> {
    return apiClient.post<{ valid: boolean; errors: string[] }>('/regulations/validate', regulation);
  }

  // Search regulations
  async searchRegulations(query: string, filters?: RegulationFilters): Promise<Regulation[]> {
    const params = {
      q: query,
      ...this.buildFilterParams(filters || {})
    };
    return apiClient.get<Regulation[]>('/regulations/search', { params });
  }

  private buildFilterParams(filters: RegulationFilters): Record<string, string> {
    const params: Record<string, string> = {};
    
    if (filters.category) params.category = filters.category;
    if (filters.jurisdiction) params.jurisdiction = filters.jurisdiction;
    if (filters.isApplicable !== undefined) params.isApplicable = filters.isApplicable.toString();
    if (filters.search) params.search = filters.search;
    
    return params;
  }
}

export const regulationsApi = new RegulationsApi(); 