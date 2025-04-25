import { API_ENDPOINTS } from './constants';

// Helper for making API requests
const apiRequest = async (endpoint, options = {}) => {
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
};

// Get list of recent validations
export const getRecentValidations = async () => {
  return apiRequest(API_ENDPOINTS.VALIDATIONS);
};

// Get a specific validation by ID
export const getValidationById = async (id) => {
  return apiRequest(API_ENDPOINTS.VALIDATION_BY_ID(id));
};

// Submit document for validation
export const submitValidation = async (documentData, options = {}) => {
  return apiRequest(API_ENDPOINTS.VALIDATE, {
    method: 'POST',
    body: JSON.stringify({
      document: documentData,
      options
    })
  });
};

// Get available regulations for validation
export const getRegulations = async () => {
  return apiRequest(API_ENDPOINTS.REGULATIONS);
}; 