import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();

  console.log(`🔐 ProtectedRoute ${path}:`, { 
    user: !!user, 
    isLoading, 
    userEmail: user?.email,
    currentPath: window.location.pathname,
    timestamp: new Date().toISOString()
  });

  if (isLoading) {
    console.log(`⏳ ProtectedRoute ${path}: Loading...`);
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
    console.log(`❌ ProtectedRoute ${path}: No user, redirecting to /auth`);
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  console.log(`✅ ProtectedRoute ${path}: User authenticated, rendering component`);
  return (
    <ErrorBoundary>
      <Component />
    </ErrorBoundary>
  );
}
