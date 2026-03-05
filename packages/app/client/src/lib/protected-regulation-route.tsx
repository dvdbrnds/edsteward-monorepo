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
  

  const { user, isLoading: authLoading } = useAuth();

  

  const { data: regulations, isLoading: regulationsLoading } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
  });

  return (
    <Route path={path}>
      {(params: { id?: string }) => {
        

        if (authLoading || regulationsLoading) {
          

          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-border" />
            </div>
          );
        }

        if (!user) {
          
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
          
          return <Redirect to="/regulations" />;
        }

        
        return (
          <ErrorBoundary>
            <Component regulation={regulation} />
          </ErrorBoundary>
        );
      }}
    </Route>
  );
}