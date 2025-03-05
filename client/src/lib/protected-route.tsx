import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";
import { ErrorBoundary } from "@/components/ui/error-boundary";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading, error } = useAuth();
  const location = useLocation();

  console.log('[ProtectedRoute] Current state:', {
    hasUser: !!user,
    isLoading,
    error,
    path: location.pathname
  });

  if (error) {
    console.error('[ProtectedRoute] Authentication error:', error);
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h2 className="text-xl font-semibold text-red-600 mb-2">Authentication Error</h2>
        <p className="text-gray-600 mb-4">{error.message}</p>
        <Navigate to="/auth" replace state={{ from: location }} />
      </div>
    );
  }

  if (isLoading) {
    console.log('[ProtectedRoute] Loading authentication state');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    console.log('[ProtectedRoute] No authenticated user, redirecting to auth');
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  console.log('[ProtectedRoute] Rendering protected content');
  return (
    <ErrorBoundary>
      <ErrorBoundary 
        fallback={
          <div className="p-4 text-red-600">
            Error rendering protected content. Please try refreshing the page.
          </div>
        }
      >
        {children}
      </ErrorBoundary>
    </ErrorBoundary>
  );
}