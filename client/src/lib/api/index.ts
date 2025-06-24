// Export the main API client
export { apiClient, ApiError } from './client';
export type { ApiOptions } from './client';

// Export domain-specific APIs
export { regulationsApi } from './regulations';
export type { 
  RegulationFilters, 
  RegulationListResponse, 
  PublicRegulation 
} from './regulations';

export { authApi } from './auth';
export type {
  LoginCredentials,
  RegisterData,
  AuthResponse
} from './auth';

// Re-export common types from shared schema
export type { 
  Regulation, 
  InsertRegulation,
  User,
  InsertUser,
  Note,
  InsertNote
} from '@shared/schema'; 