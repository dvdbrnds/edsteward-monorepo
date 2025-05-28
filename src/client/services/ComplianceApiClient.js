/**
 * Compliance API Client - Phase 3
 * Modern API client for the refactored backend service layer
 */

const API_BASE_URL = 'http://localhost:3002/api/llm';

/**
 * Modern API Client for Compliance Services
 * Integrates with the Phase 2 refactored backend service layer
 */
export class ComplianceApiClient {
  constructor() {
    this.baseUrl = API_BASE_URL;
    this.requestTimeout = 30000; // 30 seconds
  }

  /**
   * Make HTTP request with proper error handling
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: this.requestTimeout,
      ...options
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Health Check - Get service status
   */
  async getHealth() {
    return this.makeRequest('/health');
  }

  /**
   * Get all regulations with pagination
   */
  async getRegulations(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page);
    if (params.limit) searchParams.set('limit', params.limit);
    if (params.category) searchParams.set('category', params.category);
    if (params.search) searchParams.set('search', params.search);

    const queryString = searchParams.toString();
    const endpoint = `/regulations${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest(endpoint);
  }

  /**
   * Get regulations by category
   */
  async getRegulationsByCategory(category) {
    return this.makeRequest(`/regulations/category/${encodeURIComponent(category)}`);
  }

  /**
   * Get regulation categories
   */
  async getRegulationCategories() {
    return this.makeRequest('/regulations/categories');
  }

  /**
   * Get single regulation by ID
   */
  async getRegulationById(id) {
    return this.makeRequest(`/regulations/${id}`);
  }

  /**
   * Process compliance query (main functionality)
   */
  async processComplianceQuery(query, options = {}) {
    return this.makeRequest('/query', {
      method: 'POST',
      body: JSON.stringify({ query, options })
    });
  }

  /**
   * Validate content against regulations
   */
  async validateContent(content, regulationIds = [], options = {}) {
    return this.makeRequest('/validate', {
      method: 'POST',
      body: JSON.stringify({ content, regulationIds, options })
    });
  }

  /**
   * Detect changes between content versions
   */
  async detectChanges(previousContent, currentContent, categories = [], options = {}) {
    return this.makeRequest('/detect-changes', {
      method: 'POST',
      body: JSON.stringify({ previousContent, currentContent, categories, options })
    });
  }

  /**
   * Get compliance summary for content
   */
  async getComplianceSummary(content, options = {}) {
    return this.makeRequest('/summary', {
      method: 'POST',
      body: JSON.stringify({ content, options })
    });
  }

  /**
   * Get regulation statistics
   */
  async getStats() {
    return this.makeRequest('/stats');
  }
}

// Export singleton instance
export const complianceApi = new ComplianceApiClient();

// Export default for convenience
export default complianceApi; 