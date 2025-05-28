/**
 * useComplianceApi Hook - Phase 3
 * Modern React hook for compliance API operations with state management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { complianceApi } from '../services/ComplianceApiClient.js';

/**
 * Custom hook for API state management
 */
export function useApiState(initialData = null) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (apiCall) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiCall();
      setData(result);
      return result;
    } catch (err) {
      setError(err.message || 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(initialData);
    setError(null);
    setLoading(false);
  }, [initialData]);

  return { data, loading, error, execute, reset };
}

/**
 * Hook for service health monitoring
 */
export function useServiceHealth() {
  const { data: health, loading, error, execute } = useApiState();
  
  const checkHealth = useCallback(() => {
    return execute(() => complianceApi.getHealth());
  }, [execute]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return { health, loading, error, checkHealth };
}

/**
 * Hook for regulations with pagination and filtering
 */
export function useRegulations(initialParams = {}) {
  const { data, loading, error, execute } = useApiState();
  const [params, setParams] = useState(initialParams);
  
  const fetchRegulations = useCallback((newParams = {}) => {
    const finalParams = { ...params, ...newParams };
    setParams(finalParams);
    return execute(() => complianceApi.getRegulations(finalParams));
  }, [params, execute]);

  useEffect(() => {
    fetchRegulations();
  }, []);

  return { 
    regulations: data?.regulations || [], 
    pagination: data?.pagination || {}, 
    filters: data?.filters || {},
    loading, 
    error, 
    fetchRegulations,
    params
  };
}

/**
 * Hook for regulation categories
 */
export function useRegulationCategories() {
  const { data: categories, loading, error, execute } = useApiState();
  
  const fetchCategories = useCallback(() => {
    return execute(() => complianceApi.getRegulationCategories());
  }, [execute]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { categories, loading, error, fetchCategories };
}

/**
 * Hook for compliance queries with caching
 */
export function useComplianceQuery() {
  const { data: result, loading, error, execute } = useApiState();
  const cache = useRef(new Map());

  const processQuery = useCallback(async (query, options = {}) => {
    // Simple caching based on query string
    const cacheKey = JSON.stringify({ query, options });
    
    if (cache.current.has(cacheKey) && !options.ignoreCache) {
      const cached = cache.current.get(cacheKey);
      return cached;
    }

    const result = await execute(() => complianceApi.processComplianceQuery(query, options));
    
    // Cache successful results
    if (result) {
      cache.current.set(cacheKey, result);
      
      // Limit cache size
      if (cache.current.size > 50) {
        const firstKey = cache.current.keys().next().value;
        cache.current.delete(firstKey);
      }
    }
    
    return result;
  }, [execute]);

  const clearCache = useCallback(() => {
    cache.current.clear();
  }, []);

  return { result, loading, error, processQuery, clearCache };
}

/**
 * Hook for content validation
 */
export function useContentValidation() {
  const { data: validation, loading, error, execute } = useApiState();
  
  const validateContent = useCallback((content, regulationIds = [], options = {}) => {
    return execute(() => complianceApi.validateContent(content, regulationIds, options));
  }, [execute]);

  return { validation, loading, error, validateContent };
}

/**
 * Hook for change detection
 */
export function useChangeDetection() {
  const { data: changes, loading, error, execute } = useApiState();
  
  const detectChanges = useCallback((previousContent, currentContent, categories = [], options = {}) => {
    return execute(() => complianceApi.detectChanges(previousContent, currentContent, categories, options));
  }, [execute]);

  return { changes, loading, error, detectChanges };
}

/**
 * Hook for compliance summaries
 */
export function useComplianceSummary() {
  const { data: summary, loading, error, execute } = useApiState();
  
  const generateSummary = useCallback((content, options = {}) => {
    return execute(() => complianceApi.getComplianceSummary(content, options));
  }, [execute]);

  return { summary, loading, error, generateSummary };
}

/**
 * Hook for regulation statistics
 */
export function useRegulationStats() {
  const { data: stats, loading, error, execute } = useApiState();
  
  const fetchStats = useCallback(() => {
    return execute(() => complianceApi.getStats());
  }, [execute]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, fetchStats };
} 