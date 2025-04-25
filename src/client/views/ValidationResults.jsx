import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import styled from 'styled-components';
import ValidationResultsComponent from '../components/ValidationResults';
import { useValidation } from '../context/ValidationContext';

const ResultsPageContainer = styled.div`
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
  background-color: ${props => props.theme.colors.cardBackground};
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
`;

const Spinner = styled.div`
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-top: 4px solid ${props => props.theme.colors.primary};
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const ErrorContainer = styled.div`
  padding: 20px;
  background-color: ${props => props.theme.colors.cardBackground};
  border-radius: 8px;
  border-left: 4px solid ${props => props.theme.colors.danger};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
`;

const BackButton = styled(Link)`
  display: inline-block;
  margin-bottom: 16px;
  color: ${props => props.theme.colors.primary};
  text-decoration: none;
  display: flex;
  align-items: center;

  &:hover {
    text-decoration: underline;
  }

  &:before {
    content: '←';
    margin-right: 8px;
  }
`;

const ValidationResultsView = () => {
  const { id } = useParams();
  const { fetchValidationById, currentValidation, loading, error } = useValidation();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadValidation = async () => {
      try {
        await fetchValidationById(id);
        setIsLoaded(true);
      } catch (err) {
        console.error('Error loading validation:', err);
      }
    };

    loadValidation();
  }, [id, fetchValidationById]);

  if (loading && !isLoaded) {
    return (
      <ResultsPageContainer>
        <BackButton to="/">Back to Dashboard</BackButton>
        <LoadingContainer>
          <Spinner />
          <p>Loading validation results...</p>
        </LoadingContainer>
      </ResultsPageContainer>
    );
  }

  if (error) {
    return (
      <ResultsPageContainer>
        <BackButton to="/">Back to Dashboard</BackButton>
        <ErrorContainer>
          <h3>Error Loading Results</h3>
          <p>{error}</p>
        </ErrorContainer>
      </ResultsPageContainer>
    );
  }

  if (!currentValidation) {
    return (
      <ResultsPageContainer>
        <BackButton to="/">Back to Dashboard</BackButton>
        <ErrorContainer>
          <h3>Validation Not Found</h3>
          <p>The validation with ID '{id}' could not be found.</p>
        </ErrorContainer>
      </ResultsPageContainer>
    );
  }

  return (
    <ResultsPageContainer>
      <BackButton to="/">Back to Dashboard</BackButton>
      <ValidationResultsComponent results={currentValidation} />
    </ResultsPageContainer>
  );
};

export default ValidationResultsView; 