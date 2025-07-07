// Single-tenant compatibility stub - replaces multi-tenant functionality
import { getDatabaseStorage } from './database';

// Compatibility exports for files that still import multi-tenant functions
export function getTenantStorage(tenantId?: string) {
  // In single-tenant mode, always return the main database storage
  return getDatabaseStorage();
}

export class MultiTenantDatabaseService {
  static async initializeAllTenants() {
    // Single-tenant mode - no additional initialization needed
    console.log('✅ Single-tenant mode: No tenant initialization required');
    return true;
  }
}

// Export the main function for backward compatibility
export default {
  getTenantStorage,
  MultiTenantDatabaseService
}; 