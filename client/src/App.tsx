import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { PageLayout } from "@/components/layout/page-layout";
import HomePage from "@/pages/home-page";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import RegulationsPage from "@/pages/regulations-page";
import RegulationDetailPage from "@/pages/regulation-detail-page";
import ComplianceWizardPage from "@/pages/compliance-wizard-page";
import ReportsPage from "@/pages/reports-page";
import ValidationPage from "@/pages/validation-page";
import AdminSettingsPage from "@/pages/admin-settings-page";
import LogsPage from "@/pages/admin/logs-page";
import SetupWizardPage from "@/pages/setup-wizard-page";
import UtilitiesPage from "@/pages/utilities";
import { ProtectedRoute } from "./lib/protected-route";
import { ProtectedRegulationRoute } from "./lib/protected-regulation-route";
import { ErrorBoundary } from "@/components/ui/error-boundary";

function Router() {
  console.log('[Router] Initializing router');

  return (
    <ErrorBoundary>
      <PageLayout>
        <Switch>
          <Route path="/auth" component={AuthPage} />
          <Route path="/setup" component={SetupWizardPage} />
          <ProtectedRoute path="/" component={HomePage} />
          <ProtectedRoute path="/regulations" component={RegulationsPage} />
          <ProtectedRoute path="/regulations/validate" component={ValidationPage} />
          <ProtectedRegulationRoute 
            path="/regulations/:id" 
            component={RegulationDetailPage} 
          />
          <ProtectedRegulationRoute 
            path="/compliance-wizard/:id" 
            component={ComplianceWizardPage} 
          />
          <ProtectedRoute path="/reports" component={ReportsPage} />
          <ProtectedRoute path="/utilities" component={UtilitiesPage} />
          <ProtectedRoute path="/admin/settings" component={AdminSettingsPage} />
          <ProtectedRoute path="/admin/logs" component={LogsPage} />
          <Route component={NotFound} />
        </Switch>
      </PageLayout>
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