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

export interface PublicRegulation {
  id: number;
  itemId: string;
  name: string;
  topic: string;
  statute: string;
  statuteIds?: string;
  summary?: string;
  requirements?: string;
  category: string;
  jurisdiction: string;
  isApplicable: boolean;
  effectiveDate?: Date;
  lastUpdated?: Date;
  lastVerified?: Date;
  nextReviewDate?: Date;
  agency_name?: string;
  agency_department?: string;
  agency_url?: string;
  regulationUrl?: string;
  requirementsUrl?: string;
  submissionGuidelines?: string;
}

class RegulationsApi {
  // Get all regulations with filtering
  async getRegulations(filters?: RegulationFilters): Promise<Regulation[]> {
    const params = filters ? this.buildFilterParams(filters) : undefined;
    return apiClient.get<Regulation[]>('/public/regulations', { params });
  }

  // Get regulation by ID
  async getRegulation(id: string): Promise<Regulation> {
    return apiClient.get<Regulation>(`/public/regulations/${id}`);
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

  // Get public regulations (no auth required)
  async getPublicRegulations(): Promise<PublicRegulation[]> {
    return apiClient.get<PublicRegulation[]>('/public/regulations');
  }

  // Get public regulation by ID (no auth required)
  async getPublicRegulation(id: string): Promise<PublicRegulation> {
    return apiClient.get<PublicRegulation>(`/public/regulations/${id}`);
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