import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import HomePage from "@/pages/home-page";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import RegulationsPage from "@/pages/regulations-page";
import RegulationDetailPage from "@/pages/regulation-detail-page";
import ComplianceWizardPage from "@/pages/compliance-wizard-page";
import NotificationsPage from "@/pages/notifications-page";
import ReportsPage from "@/pages/reports-page";
import { ProtectedRoute } from "./lib/protected-route";
import { ProtectedRegulationRoute } from "./lib/protected-regulation-route";
import { ErrorBoundary } from "@/components/ui/error-boundary";

function Router() {
  console.log('[Router] Initializing router');

  return (
    <ErrorBoundary>
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <ProtectedRoute path="/" component={HomePage} />
        <ProtectedRoute path="/regulations" component={RegulationsPage} />
        <ProtectedRegulationRoute 
          path="/regulations/:id" 
          component={RegulationDetailPage} 
        />
        <ProtectedRegulationRoute 
          path="/compliance-wizard/:id" 
          component={ComplianceWizardPage} 
        />
        <ProtectedRoute path="/notifications" component={NotificationsPage} />
        <ProtectedRoute path="/reports" component={ReportsPage} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

export default function App() {
  console.log('[App] Initializing application');

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router />
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}