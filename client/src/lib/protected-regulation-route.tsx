import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route, useParams } from "wouter";
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
  const params = useParams<{ id: string }>();
  
  const { data: regulations, isLoading: regulationsLoading } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
  });

  if (authLoading || regulationsLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  const regulationId = params?.id ? parseInt(params.id, 10) : null;
  const regulation = regulationId && !isNaN(regulationId)
    ? regulations?.find(r => r.id === regulationId)
    : null;

  if (!regulation) {
    return (
      <Route path={path}>
        <Redirect to="/regulations" />
      </Route>
    );
  }

  return (
    <Route path={path}>
      <ErrorBoundary>
        <Component regulation={regulation} />
      </ErrorBoundary>
    </Route>
  );
}
