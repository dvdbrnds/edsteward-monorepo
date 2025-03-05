import { useAuth } from "@/hooks/use-auth";
import { Loader2, AlertCircle } from "lucide-react";
import { Navigate, useParams, useLocation } from "react-router-dom";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useQuery } from "@tanstack/react-query";
import type { Regulation } from "@shared/schema";

interface ProtectedRegulationRouteProps {
  children: React.ReactNode;
}

export function ProtectedRegulationRoute({ children }: ProtectedRegulationRouteProps) {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { user, isLoading: authLoading, error: authError } = useAuth();

  console.log('[ProtectedRegulationRoute] Current state:', {
    regulationId: id,
    hasUser: !!user,
    authLoading,
    authError,
    path: location.pathname
  });

  const { 
    data: regulations, 
    isLoading: regulationsLoading,
    error: regulationsError
  } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
    enabled: !!user,
    onError: (error) => {
      console.error('[ProtectedRegulationRoute] Failed to fetch regulations:', error);
    }
  });

  // Handle various error states
  if (authError || regulationsError) {
    const error = authError || regulationsError;
    console.error('[ProtectedRegulationRoute] Error:', error);
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-red-600 mb-2">Error Loading Data</h2>
        <p className="text-gray-600 mb-4">{error.message}</p>
        <Navigate to="/regulations" replace />
      </div>
    );
  }

  // Handle loading state
  if (authLoading || regulationsLoading) {
    console.log('[ProtectedRegulationRoute] Loading:', {
      authLoading,
      regulationsLoading
    });
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  // Handle unauthenticated state
  if (!user) {
    console.log('[ProtectedRegulationRoute] No authenticated user');
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  // Validate regulation ID and find regulation
  const regulationId = id ? parseInt(id, 10) : null;
  const regulation = regulationId && !isNaN(regulationId)
    ? regulations?.find(r => r.id === regulationId)
    : null;

  console.log('[ProtectedRegulationRoute] Regulation lookup:', {
    regulationId,
    hasRegulation: !!regulation,
    availableIds: regulations?.map(r => r.id)
  });

  // Handle invalid or not found regulation
  if (!regulation) {
    console.log('[ProtectedRegulationRoute] Regulation not found');
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-semibold text-yellow-600 mb-2">Regulation Not Found</h2>
        <p className="text-gray-600 mb-4">The requested regulation could not be found.</p>
        <Navigate to="/regulations" replace />
      </div>
    );
  }

  console.log('[ProtectedRegulationRoute] Rendering regulation content');
  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 text-red-600">
          Error rendering regulation content. Please try refreshing the page.
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}