import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ForcePasswordReset } from "@/components/auth/force-password-reset";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: React.ComponentType<any>;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
          <p className="ml-2">Loading authentication...</p>
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

  if ((user as any).mustResetPassword) {
    return <ForcePasswordReset />;
  }

  return (
    <ErrorBoundary>
      <Component />
    </ErrorBoundary>
  );
}
