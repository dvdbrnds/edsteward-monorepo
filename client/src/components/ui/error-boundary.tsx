import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCcw, Bug } from "lucide-react";
import { Button } from "./button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "./alert";
import { BugReportButton } from "@/components/common/bug-report-button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error to our logging system
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[200px] flex items-center justify-center p-4">
          <Alert variant="destructive" className="max-w-xl">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="flex items-center gap-2 text-lg">
              Something went wrong
            </AlertTitle>
            <AlertDescription className="mt-4">
              <div className="space-y-4">
                <p className="text-sm">
                  {this.state.error?.message || "An unexpected error occurred."}
                </p>

                <div className="flex items-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={this.handleRetry}
                    className="gap-2"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Try again
                  </Button>

                  <BugReportButton 
                    errorDetails={{
                      message: this.state.error?.message,
                      stack: this.state.error?.stack,
                      componentStack: this.state.errorInfo?.componentStack
                    }}
                  />
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}