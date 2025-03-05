import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import { ProtectedRoute } from "./lib/protected-route";
import { ProtectedRegulationRoute } from "./lib/protected-regulation-route";
import { ErrorBoundary } from "@/components/ui/error-boundary";

function Router() {
  console.log('[Router] Initializing router');

  return (
    <ErrorBoundary>
      <PageLayout>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/setup" element={<SetupWizardPage />} />
          <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/regulations" element={<ProtectedRoute><RegulationsPage /></ProtectedRoute>} />
          <Route path="/regulations/validate" element={<ProtectedRoute><ValidationPage /></ProtectedRoute>} />
          <Route 
            path="/regulations/:id" 
            element={<ProtectedRegulationRoute><RegulationDetailPage /></ProtectedRegulationRoute>} 
          />
          <Route 
            path="/compliance-wizard/:id" 
            element={<ProtectedRegulationRoute><ComplianceWizardPage /></ProtectedRegulationRoute>} 
          />
          <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute><AdminSettingsPage /></ProtectedRoute>} />
          <Route path="/admin/logs" element={<ProtectedRoute><LogsPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
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
          <BrowserRouter>
            <Router />
            <Toaster />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}