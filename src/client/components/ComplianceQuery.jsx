/**
 * Compliance Query Component - Phase 3
 * Modern interface for processing compliance queries with the new backend
 */

import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { useCompliance } from '../context/ComplianceContext.jsx';
import { useComplianceQuery } from '../hooks/useComplianceApi.js';
import LoadingSpinner, { ButtonSpinner } from './LoadingSpinner.jsx';

const QueryContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.space[4]};
  padding: ${props => props.theme.space[4]};
  background-color: ${props => props.theme.colors.paper};
  border-radius: ${props => props.theme.radii[2]}px;
  box-shadow: ${props => props.theme.shadows.small};
`;

const QueryForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.space[3]};
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 120px;
  padding: ${props => props.theme.space[3]};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.radii[1]}px;
  font-family: ${props => props.theme.fonts.body};
  font-size: ${props => props.theme.fontSizes[1]}px;
  line-height: ${props => props.theme.lineHeights.body};
  resize: vertical;
  outline: none;
  transition: border-color 0.2s ease;

  &:focus {
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 2px ${props => props.theme.colors.focus};
  }

  &::placeholder {
    color: ${props => props.theme.colors.textDisabled};
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: ${props => props.theme.space[2]};
  justify-content: flex-end;
  align-items: center;
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  padding: ${props => props.theme.space[2]} ${props => props.theme.space[4]};
  border: none;
  border-radius: ${props => props.theme.radii[1]}px;
  font-size: ${props => props.theme.fontSizes[1]}px;
  font-weight: ${props => props.theme.fontWeights.bold};
  cursor: pointer;
  transition: all 0.2s ease;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  ${props => props.variant === 'primary' && `
    background-color: ${props.theme.colors.primary};
    color: ${props.theme.colors.textOnPrimary};
    
    &:hover:not(:disabled) {
      background-color: ${props.theme.colors.primaryDark};
    }
  `}

  ${props => props.variant === 'secondary' && `
    background-color: transparent;
    color: ${props.theme.colors.text};
    border: 1px solid ${props.theme.colors.border};
    
    &:hover:not(:disabled) {
      background-color: ${props.theme.colors.hover};
    }
  `}
`;

const QueryMeta = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: ${props => props.theme.fontSizes[0]}px;
  color: ${props => props.theme.colors.textSecondary};
  border-top: 1px solid ${props => props.theme.colors.divider};
  padding-top: ${props => props.theme.space[2]};
`;

const CharacterCount = styled.span`
  ${props => props.isNearLimit && `color: ${props.theme.colors.warning};`}
  ${props => props.isOverLimit && `color: ${props.theme.colors.error};`}
`;

const ResultsContainer = styled.div`
  margin-top: ${props => props.theme.space[4]};
`;

const ResultCard = styled.div`
  padding: ${props => props.theme.space[4]};
  background-color: ${props => props.theme.colors.paper};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.radii[2]}px;
  box-shadow: ${props => props.theme.shadows.small};
`;

const ResultHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: ${props => props.theme.space[3]};
`;

const ResultStatus = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.space[1]};
  font-size: ${props => props.theme.fontSizes[0]}px;
  color: ${props => props.theme.colors.textSecondary};
`;

const StatusIndicator = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  
  ${props => props.status === 'success' && `background-color: ${props.theme.colors.success};`}
  ${props => props.status === 'warning' && `background-color: ${props.theme.colors.warning};`}
  ${props => props.status === 'error' && `background-color: ${props.theme.colors.error};`}
`;

const ResultContent = styled.div`
  line-height: ${props => props.theme.lineHeights.body};
  color: ${props => props.theme.colors.text};

  h3 {
    color: ${props => props.theme.colors.primary};
    margin: ${props => props.theme.space[3]} 0 ${props => props.theme.space[2]} 0;
    font-size: ${props => props.theme.fontSizes[2]}px;
  }

  p {
    margin-bottom: ${props => props.theme.space[2]};
  }

  ul {
    margin: ${props => props.theme.space[2]} 0;
    padding-left: ${props => props.theme.space[4]};
  }

  code {
    background-color: ${props => props.theme.colors.background};
    padding: 2px 4px;
    border-radius: ${props => props.theme.radii[0]}px;
    font-family: ${props => props.theme.fonts.monospace};
    font-size: ${props => props.theme.fontSizes[0]}px;
  }
`;

const ErrorMessage = styled.div`
  padding: ${props => props.theme.space[3]};
  background-color: rgba(211, 47, 47, 0.1);
  border: 1px solid ${props => props.theme.colors.error};
  border-radius: ${props => props.theme.radii[1]}px;
  color: ${props => props.theme.colors.error};
  margin-top: ${props => props.theme.space[3]};
`;

const MAX_QUERY_LENGTH = 5000;

const ComplianceQuery = () => {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const textareaRef = useRef(null);
  
  const { isHealthy } = useCompliance();
  const { result, loading, error, processQuery, clearCache } = useComplianceQuery();

  const characterCount = query.length;
  const isNearLimit = characterCount > MAX_QUERY_LENGTH * 0.8;
  const isOverLimit = characterCount > MAX_QUERY_LENGTH;

  useEffect(() => {
    // Focus textarea on mount
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!query.trim() || isOverLimit || loading) {
      return;
    }

    setSubmitted(true);
    
    try {
      await processQuery(query.trim());
    } catch (err) {
      console.error('Query failed:', err);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSubmitted(false);
    clearCache();
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const formatResult = (result) => {
    if (!result || !result.data) return null;

    const { data } = result;
    
    return (
      <ResultContent>
        {data.response && (
          <div dangerouslySetInnerHTML={{ __html: data.response.replace(/\n/g, '<br />') }} />
        )}
        
        {data.analysis && (
          <>
            <h3>Compliance Analysis</h3>
            <p>{data.analysis}</p>
          </>
        )}

        {data.relevantRegulations && data.relevantRegulations.length > 0 && (
          <>
            <h3>Relevant Regulations</h3>
            <ul>
              {data.relevantRegulations.map((reg, index) => (
                <li key={index}>{reg.name || reg.title || reg}</li>
              ))}
            </ul>
          </>
        )}

        {data.recommendations && data.recommendations.length > 0 && (
          <>
            <h3>Recommendations</h3>
            <ul>
              {data.recommendations.map((rec, index) => (
                <li key={index}>{rec}</li>
              ))}
            </ul>
          </>
        )}
      </ResultContent>
    );
  };

  return (
    <QueryContainer>
      <h2>Compliance Query</h2>
      
      <QueryForm onSubmit={handleSubmit}>
        <TextArea
          ref={textareaRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter your compliance question here... For example: 'What are the FERPA requirements for student data privacy?' or 'How should we handle ADA accessibility requirements for our website?'"
          disabled={loading}
        />
        
        <QueryMeta>
          <div>
            {!isHealthy && (
              <span style={{ color: 'orange' }}>⚠️ Service partially available</span>
            )}
          </div>
          <CharacterCount 
            isNearLimit={isNearLimit} 
            isOverLimit={isOverLimit}
          >
            {characterCount} / {MAX_QUERY_LENGTH}
          </CharacterCount>
        </QueryMeta>

        <ActionButtons>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClear}
            disabled={loading || (!query && !submitted)}
          >
            Clear
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!query.trim() || isOverLimit || loading}
          >
            {loading && <ButtonSpinner />}
            {loading ? 'Processing...' : 'Submit Query'}
          </Button>
        </ActionButtons>
      </QueryForm>

      {error && (
        <ErrorMessage>
          <strong>Error:</strong> {error}
        </ErrorMessage>
      )}

      {result && (
        <ResultsContainer>
          <ResultCard>
            <ResultHeader>
              <h3>Query Results</h3>
              <ResultStatus>
                <StatusIndicator status={result.success ? 'success' : 'error'} />
                {result.data?.processingTime && (
                  <span>Processed in {result.data.processingTime}ms</span>
                )}
              </ResultStatus>
            </ResultHeader>
            {formatResult(result)}
          </ResultCard>
        </ResultsContainer>
      )}

      {loading && !result && (
        <LoadingSpinner 
          text="Processing your compliance query..." 
          size="large"
        />
      )}
    </QueryContainer>
  );
};

export default ComplianceQuery; 