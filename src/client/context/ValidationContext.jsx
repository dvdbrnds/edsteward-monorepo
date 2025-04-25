import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { ValidationStrategy } from '../api/constants';
import api from '../api/api';

const ValidationContext = createContext();

const ValidationProvider = ({ children }) => {
  const [validations, setValidations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentValidation, setCurrentValidation] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Load recent validations on mount
    fetchRecentValidations();
  }, []);

  const fetchRecentValidations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // We'll mock this data for now
      const mockValidations = [
        {
          id: 'recent1',
          regulationId: 'FERPA-2023-01',
          status: 'PASS',
          confidence: 0.96,
          timestamp: new Date('2023-08-10T14:30:00').toISOString(),
          levels: ['level1', 'level2', 'level3', 'level4'],
          findings: []
        },
        {
          id: 'recent2',
          regulationId: 'HIPAA-2023-02',
          status: 'FAIL',
          confidence: 0.72,
          timestamp: new Date('2023-08-15T09:15:00').toISOString(),
          levels: ['level1', 'level2', 'level3'],
          findings: [
            {
              id: 'FINDING-001',
              path: 'data.policyInfo.encryption',
              severity: 'ERROR',
              message: 'Missing required encryption specification'
            },
            {
              id: 'FINDING-002',
              path: 'data.accessControls',
              severity: 'WARNING',
              message: 'Access control policy incomplete'
            }
          ]
        }
      ];
      
      setValidations(mockValidations);
    } catch (err) {
      console.error('Error fetching validations:', err);
      setError('Failed to load recent validations');
      toast.error('Failed to load recent validations');
    } finally {
      setLoading(false);
    }
  };

  const fetchValidationById = async (id) => {
    try {
      setLoading(true);
      setError(null);
      
      // In a real app, we'd call the API
      // const response = await api.getValidation(id);
      
      // For now, mock the response
      const mockValidation = validations.find(v => v.id === id) || {
        id,
        regulationId: `REG-${id}`,
        status: Math.random() > 0.5 ? 'PASS' : 'FAIL',
        confidence: Math.random(),
        timestamp: new Date().toISOString(),
        levels: ['level1', 'level2', 'level3'],
        findings: []
      };
      
      setCurrentValidation(mockValidation);
      return mockValidation;
    } catch (err) {
      console.error(`Error fetching validation ${id}:`, err);
      setError(`Failed to load validation ${id}`);
      toast.error(`Failed to load validation ${id}`);
    } finally {
      setLoading(false);
    }
  };

  const submitValidation = async (data, options = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      const request = {
        regulation: {
          id: data.regulationId,
          version: data.regulationVersion
        },
        data: data.content,
        strategy: options.strategy || ValidationStrategy.ADAPTIVE,
        levels: options.levels || ['level1', 'level2', 'level3', 'level4'],
        skipCache: options.skipCache || false
      };
      
      // In a real app, we'd call the API
      // const response = await api.submitValidation(request);
      
      // For now, mock the response
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay
      
      const mockResult = {
        id: `val-${Date.now()}`,
        regulationId: data.regulationId,
        status: Math.random() > 0.3 ? 'PASS' : 'FAIL',
        confidence: 0.7 + (Math.random() * 0.3),
        timestamp: new Date().toISOString(),
        levels: request.levels,
        strategy: request.strategy,
        findings: []
      };
      
      // If status is FAIL, add some mock findings
      if (mockResult.status === 'FAIL') {
        mockResult.findings = [
          {
            id: `FINDING-${Date.now()}-1`,
            path: 'data.section1.compliance',
            severity: 'ERROR',
            message: 'Missing required compliance documentation',
            confidence: 0.95
          }
        ];
      }
      
      // Add to validations list
      setValidations(prev => [mockResult, ...prev]);
      setCurrentValidation(mockResult);
      
      toast.success('Validation completed successfully');
      return mockResult;
    } catch (err) {
      console.error('Error submitting validation:', err);
      setError('Failed to process validation');
      toast.error('Failed to process validation');
    } finally {
      setLoading(false);
    }
  };

  const value = {
    validations,
    currentValidation,
    loading,
    error,
    fetchRecentValidations,
    fetchValidationById,
    submitValidation
  };

  return (
    <ValidationContext.Provider value={value}>
      {children}
    </ValidationContext.Provider>
  );
};

const useValidation = () => {
  const context = useContext(ValidationContext);
  if (context === undefined) {
    throw new Error('useValidation must be used within a ValidationProvider');
  }
  return context;
};

export { ValidationProvider, useValidation }; 