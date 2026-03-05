/**
 * Compliance Context - Phase 3
 * Global state management for compliance application
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { complianceApi } from '../services/ComplianceApiClient.js';

// Action types
const ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_HEALTH: 'SET_HEALTH',
  SET_REGULATIONS: 'SET_REGULATIONS',
  SET_CATEGORIES: 'SET_CATEGORIES',
  SET_STATS: 'SET_STATS',
  SET_QUERY_RESULT: 'SET_QUERY_RESULT',
  CLEAR_ERROR: 'CLEAR_ERROR',
  RESET_STATE: 'RESET_STATE'
};

// Initial state
const initialState = {
  loading: {
    health: false,
    regulations: false,
    categories: false,
    stats: false,
    query: false
  },
  error: null,
  health: null,
  regulations: {
    data: [],
    pagination: {},
    filters: {}
  },
  categories: {
    categories: [],
    categoryBreakdown: {},
    total: 0
  },
  stats: {
    success: false,
    data: {}
  },
  queryResult: null
};

// Reducer function
function complianceReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_LOADING:
      return {
        ...state,
        loading: {
          ...state.loading,
          [action.payload.operation]: action.payload.loading
        }
      };

    case ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        loading: Object.keys(state.loading).reduce((acc, key) => {
          acc[key] = false;
          return acc;
        }, {})
      };

    case ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    case ACTIONS.SET_HEALTH:
      return {
        ...state,
        health: action.payload,
        loading: { ...state.loading, health: false }
      };

    case ACTIONS.SET_REGULATIONS:
      return {
        ...state,
        regulations: action.payload,
        loading: { ...state.loading, regulations: false }
      };

    case ACTIONS.SET_CATEGORIES:
      return {
        ...state,
        categories: action.payload,
        loading: { ...state.loading, categories: false }
      };

    case ACTIONS.SET_STATS:
      return {
        ...state,
        stats: action.payload,
        loading: { ...state.loading, stats: false }
      };

    case ACTIONS.SET_QUERY_RESULT:
      return {
        ...state,
        queryResult: action.payload,
        loading: { ...state.loading, query: false }
      };

    case ACTIONS.RESET_STATE:
      return initialState;

    default:
      return state;
  }
}

// Create context
const ComplianceContext = createContext();

// Context provider component
export function ComplianceProvider({ children }) {
  const [state, dispatch] = useReducer(complianceReducer, initialState);

  // Helper function to handle async operations
  const handleAsyncOperation = useCallback(async (operation, apiCall) => {
    dispatch({ type: ACTIONS.SET_LOADING, payload: { operation, loading: true } });
    dispatch({ type: ACTIONS.CLEAR_ERROR });

    try {
      const result = await apiCall();
      return result;
    } catch (error) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message || 'An error occurred' });
      throw error;
    }
  }, []);

  // Health check
  const checkHealth = useCallback(async () => {
    try {
      const health = await handleAsyncOperation('health', () => complianceApi.getHealth());
      dispatch({ type: ACTIONS.SET_HEALTH, payload: health });
      return health;
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }, [handleAsyncOperation]);

  // Fetch regulations
  const fetchRegulations = useCallback(async (params = {}) => {
    try {
      const regulations = await handleAsyncOperation('regulations', () => complianceApi.getRegulations(params));
      dispatch({ type: ACTIONS.SET_REGULATIONS, payload: regulations });
      return regulations;
    } catch (error) {
      console.error('Failed to fetch regulations:', error);
    }
  }, [handleAsyncOperation]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const categories = await handleAsyncOperation('categories', () => complianceApi.getRegulationCategories());
      dispatch({ type: ACTIONS.SET_CATEGORIES, payload: categories });
      return categories;
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  }, [handleAsyncOperation]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const stats = await handleAsyncOperation('stats', () => complianceApi.getStats());
      dispatch({ type: ACTIONS.SET_STATS, payload: stats });
      return stats;
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, [handleAsyncOperation]);

  // Process compliance query
  const processQuery = useCallback(async (query, options = {}) => {
    try {
      const result = await handleAsyncOperation('query', () => complianceApi.processComplianceQuery(query, options));
      dispatch({ type: ACTIONS.SET_QUERY_RESULT, payload: result });
      return result;
    } catch (error) {
      console.error('Failed to process query:', error);
    }
  }, [handleAsyncOperation]);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR_ERROR });
  }, []);

  // Reset state
  const resetState = useCallback(() => {
    dispatch({ type: ACTIONS.RESET_STATE });
  }, []);

  // Initialize data on mount
  useEffect(() => {
    const initializeData = async () => {
      try {
        await Promise.allSettled([
          checkHealth(),
          fetchStats(),
          fetchCategories()
        ]);
      } catch (error) {
        console.error('Failed to initialize data:', error);
      }
    };

    initializeData();
  }, [checkHealth, fetchStats, fetchCategories]);

  // Context value
  const contextValue = {
    // State
    ...state,
    
    // Actions
    checkHealth,
    fetchRegulations,
    fetchCategories,
    fetchStats,
    processQuery,
    clearError,
    resetState,

    // Computed values
    isHealthy: state.health?.overallHealth === 'healthy',
    hasRegulations: state.regulations.data.length > 0,
    totalRegulations: state.regulations.pagination?.total || 0,
    isInitialized: state.health !== null
  };

  return (
    <ComplianceContext.Provider value={contextValue}>
      {children}
    </ComplianceContext.Provider>
  );
}

// Custom hook to use compliance context
export function useCompliance() {
  const context = useContext(ComplianceContext);
  
  if (!context) {
    throw new Error('useCompliance must be used within a ComplianceProvider');
  }
  
  return context;
}

// Export context for advanced usage
export { ComplianceContext };
export default ComplianceContext; 