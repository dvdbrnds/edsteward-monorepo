import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useQuery } from "@tanstack/react-query";
import type { Regulation } from "@shared/schema";

interface ProtectedRegulationRouteProps {
  path: string;
  component: React.ComponentType<{ regulation: Regulation }>;
}

export function ProtectedRegulationRoute({
  path,
  component: Component,
}: ProtectedRegulationRouteProps) {
  console.log('[ProtectedRegulationRoute] Initializing with path:', path);

  const { user, isLoading: authLoading } = useAuth();

  console.log('[ProtectedRegulationRoute] Current state:', {
    path,
    hasUser: !!user,
    isAuthLoading: authLoading
  });

  const { data: regulations, isLoading: regulationsLoading } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
  });

  return (
    <Route path={path}>
      {(params: { id?: string }) => {
        console.log('[ProtectedRegulationRoute] Route matched with params:', params);

        if (authLoading || regulationsLoading) {
          console.log('[ProtectedRegulationRoute] Loading state:', {
            authLoading,
            regulationsLoading
          });

          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-border" />
            </div>
          );
        }

        if (!user) {
          console.log('[ProtectedRegulationRoute] No user, redirecting to auth');
          return <Redirect to="/auth" />;
        }

        const regulationId = params?.id ? parseInt(params.id, 10) : null;
        const regulation = regulationId && !isNaN(regulationId)
          ? regulations?.find(r => r.id === regulationId)
          : null;

        console.log('[ProtectedRegulationRoute] Regulation lookup:', {
          regulationId,
          hasRegulation: !!regulation,
          availableIds: regulations?.map(r => r.id)
        });

        if (!regulation) {
          console.log('[ProtectedRegulationRoute] Regulation not found, redirecting');
          return <Redirect to="/regulations" />;
        }

        console.log('[ProtectedRegulationRoute] Rendering regulation component');
        return (
          <ErrorBoundary>
            <Component regulation={regulation} />
          </ErrorBoundary>
        );
      }}
    </Route>
  );
}