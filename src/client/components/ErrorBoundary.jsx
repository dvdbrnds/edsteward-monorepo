/**
 * Error Boundary Component - Phase 3
 * Catches React errors and provides fallback UI
 */

import React from 'react';
import styled from 'styled-components';

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: ${props => props.theme.space[6]};
  text-align: center;
  background-color: ${props => props.theme.colors.background};
  border: 1px solid ${props => props.theme.colors.error};
  border-radius: ${props => props.theme.radii[2]}px;
  margin: ${props => props.theme.space[4]};
`;

const ErrorIcon = styled.div`
  font-size: 48px;
  color: ${props => props.theme.colors.error};
  margin-bottom: ${props => props.theme.space[4]};
`;

const ErrorTitle = styled.h2`
  color: ${props => props.theme.colors.error};
  margin-bottom: ${props => props.theme.space[3]};
  font-size: ${props => props.theme.fontSizes[4]}px;
`;

const ErrorMessage = styled.p`
  color: ${props => props.theme.colors.textSecondary};
  margin-bottom: ${props => props.theme.space[4]};
  max-width: 600px;
  line-height: ${props => props.theme.lineHeights.body};
`;

const ErrorDetails = styled.details`
  margin-top: ${props => props.theme.space[4]};
  padding: ${props => props.theme.space[3]};
  background-color: ${props => props.theme.colors.paper};
  border-radius: ${props => props.theme.radii[1]}px;
  border: 1px solid ${props => props.theme.colors.divider};
  max-width: 100%;
  overflow: auto;

  summary {
    cursor: pointer;
    color: ${props => props.theme.colors.textSecondary};
    font-weight: ${props => props.theme.fontWeights.bold};
    margin-bottom: ${props => props.theme.space[2]};
  }

  pre {
    white-space: pre-wrap;
    word-break: break-word;
    font-family: ${props => props.theme.fonts.monospace};
    font-size: ${props => props.theme.fontSizes[0]}px;
    color: ${props => props.theme.colors.text};
    background-color: ${props => props.theme.colors.background};
    padding: ${props => props.theme.space[2]};
    border-radius: ${props => props.theme.radii[1]}px;
    overflow-x: auto;
  }
`;

const ActionButton = styled.button`
  background-color: ${props => props.theme.colors.primary};
  color: ${props => props.theme.colors.textOnPrimary};
  border: none;
  border-radius: ${props => props.theme.radii[1]}px;
  padding: ${props => props.theme.space[2]} ${props => props.theme.space[4]};
  font-size: ${props => props.theme.fontSizes[1]}px;
  font-weight: ${props => props.theme.fontWeights.bold};
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: ${props => props.theme.colors.primaryDark};
  }

  &:not(:last-child) {
    margin-right: ${props => props.theme.space[2]};
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: ${props => props.theme.space[2]};
  margin-top: ${props => props.theme.space[4]};
`;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Store error details
    this.setState({
      error,
      errorInfo
    });

    // Log error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // In production, you might want to log to an error reporting service
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  }

  handleReload = () => {
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      const { fallback: Fallback } = this.props;
      
      // If a custom fallback component is provided, use it
      if (Fallback) {
        return (
          <Fallback 
            error={this.state.error}
            errorInfo={this.state.errorInfo}
            retry={this.handleRetry}
          />
        );
      }

      // Default error UI
      return (
        <ErrorContainer>
          <ErrorIcon>⚠️</ErrorIcon>
          <ErrorTitle>Something went wrong</ErrorTitle>
          <ErrorMessage>
            {this.props.message || 
              'An unexpected error occurred. Please try refreshing the page or contact support if the problem continues.'}
          </ErrorMessage>
          
          <ButtonGroup>
            <ActionButton onClick={this.handleRetry}>
              Try Again
            </ActionButton>
            <ActionButton onClick={this.handleReload}>
              Reload Page
            </ActionButton>
          </ButtonGroup>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <ErrorDetails>
              <summary>Error Details (Development)</summary>
              <pre>
                <strong>Error:</strong> {this.state.error.toString()}
                {this.state.errorInfo && (
                  <>
                    <br /><br />
                    <strong>Component Stack:</strong>
                    {this.state.errorInfo.componentStack}
                  </>
                )}
              </pre>
            </ErrorDetails>
          )}
        </ErrorContainer>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 