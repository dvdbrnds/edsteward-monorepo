import { API_ENDPOINTS } from './constants';

// Helper for making API requests
const apiRequest = async (endpoint, options = {}) => {
  try {
    const response = await fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `API request failed with status ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
};

// Define API service methods
const api = {
  // Get list of recent validations
  getValidations: async () => {
    return apiRequest(API_ENDPOINTS.VALIDATIONS);
  },

  // Get a specific validation by ID
  getValidation: async (id) => {
    return apiRequest(API_ENDPOINTS.VALIDATION_BY_ID(id));
  },

  // Submit document for validation
  submitValidation: async (data) => {
    return apiRequest(API_ENDPOINTS.VALIDATE, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Get available regulations for validation
  getRegulations: async () => {
    return apiRequest(API_ENDPOINTS.REGULATIONS);
  },
  
  // Upload regulations from Excel file
  uploadRegulations: async (regulations) => {
    return apiRequest(API_ENDPOINTS.UPLOAD_REGULATIONS, {
      method: 'POST',
      body: JSON.stringify({ regulations })
    });
  },
  
  // Initiate data collection for a regulation
  collectData: async (regulationId, sources) => {
    return apiRequest(API_ENDPOINTS.COLLECT_DATA, {
      method: 'POST',
      body: JSON.stringify({
        regulationId,
        sources
      })
    });
  }
};

export default api; 