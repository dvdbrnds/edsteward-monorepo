import React from 'react';
import { Alert, Button } from 'antd';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px' }}>
          <Alert
            message="Something went wrong"
            description="An error occurred while rendering this component. Please try refreshing the page."
            type="error"
            showIcon
            action={
              <Button 
                size="small" 
                type="primary" 
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </Button>
            }
          />
          
          {process.env.NODE_ENV === 'development' && (
            <details style={{ marginTop: '16px', whiteSpace: 'pre-wrap' }}>
              <summary>Error Details (Development Only)</summary>
              <div style={{ 
                background: '#f5f5f5', 
                padding: '10px', 
                marginTop: '10px',
                fontSize: '12px',
                fontFamily: 'monospace'
              }}>
                <strong>Error:</strong> {this.state.error && this.state.error.toString()}
                <br />
                <strong>Stack Trace:</strong> {this.state.errorInfo.componentStack}
              </div>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;