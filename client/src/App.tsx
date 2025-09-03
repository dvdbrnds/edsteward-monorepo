import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { PageLayout } from "@/components/layout/page-layout";
import { useEffect, useState } from 'react';

import HomePage from "@/pages/home-page";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import RegulationsPage from "@/pages/regulations-page";
import RegulationDetailPage from "@/pages/RegulationDetailPage";
import ComplianceWizardPage from "@/pages/compliance-wizard-page";
import ReportsPage from "@/pages/reports-page";
import ValidationPage from "@/pages/validation-page";
import AdminSettingsPage from "@/pages/admin-settings-page";
import AdminDashboardPage from "@/pages/admin-dashboard-page";
import LogsPage from "@/pages/admin/logs-page";
import DebugToolsPage from "@/pages/admin/debug-tools-page";
import AWSTenantsManagementPage from "@/pages/admin/aws-tenant-management-page";
import UtilitiesIndexPage from "@/pages/utilities/index";
import { RegulationViewer } from "@/pages/RegulationViewer";
import SetupWizardPage from "@/pages/setup-wizard-page";
import UpdatesListPage from "@/pages/updates-list-page";
import DifferentialViewPage from "@/pages/differential-view-page";
import DiffTestPage from "@/pages/diff-test-page";
import PublicDashboardPage from "@/pages/public-dashboard-page";
import { ProtectedRoute } from "./lib/protected-route";
import { ProtectedRegulationRoute } from "./lib/protected-regulation-route";
import { ErrorBoundary } from "@/components/ui/error-boundary";

// Tenant detection utility
function useCurrentTenant() {
  const [tenant, setTenant] = useState<string | null>(null);
  
  useEffect(() => {
    const hostname = window.location.hostname;
    
    if (hostname.startsWith('admin.')) {
      setTenant('admin');
    } else if (hostname.startsWith('moravian.')) {
      setTenant('moravian');
    } else if (hostname.startsWith('template.')) {
      setTenant('template');
    } else if (hostname.startsWith('staging.')) {
      setTenant('staging');
    } else {
      // Default to admin for edsteward.ai or localhost
      setTenant('admin');
    }
  }, []);
  
  return tenant;
}

export default function App() {
  console.log('[App] Initializing single-tenant application');
  const currentTenant = useCurrentTenant();
  const [location] = useLocation();
  
  // Debug current location - this will update when routes change
  console.log('[App] Current location from wouter:', location);
  console.log('[App] Current location from window:', window.location.pathname);
  
  useEffect(() => {
    console.log('[App] Route changed to:', location);
  }, [location]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PageLayout>
            <Switch>
              {/* Authentication Route */}
              <Route path="/auth" component={AuthPage} />
              <Route path="/setup" component={SetupWizardPage} />
              
              {/* Public Dashboard - No authentication required */}
              <Route path="/public-dashboard" component={PublicDashboardPage} />

              {/* Protected Routes - Authentication Required */}
              <ProtectedRoute path="/" component={HomePage} />
              {/* Admin Dashboard - DISABLED */}
              {/* {currentTenant === 'admin' && (
                <ProtectedRoute path="/admin/dashboard" component={AdminDashboardPage} />
              )} */}
              {/* More specific routes MUST come before general ones */}
              <ProtectedRoute path="/regulations/validate" component={ValidationPage} />
              <ProtectedRoute path="/regulations/updates/demo" component={() => <DifferentialViewPage isDemo={true} />} />
              <ProtectedRoute path="/regulations/updates/:id" component={DifferentialViewPage} />
              <ProtectedRoute path="/regulations/updates" component={UpdatesListPage} />
              {/* Debug route */}
              <Route path="/test-route">
                <div style={{padding: '20px', backgroundColor: 'yellow'}}>
                  <h1>🧪 TEST ROUTE WORKING!</h1>
                  <p>If you see this, routing is working. Current path: {window.location.pathname}</p>
                </div>
              </Route>
              <ProtectedRoute path="/regulations/diff-test" component={DiffTestPage} />
              <ProtectedRegulationRoute
                path="/regulations/:id"
                component={RegulationDetailPage}
              />
              <ProtectedRoute path="/regulations" component={RegulationsPage} />
              <ProtectedRegulationRoute
                path="/compliance-wizard/:id"
                component={ComplianceWizardPage}
              />
              <ProtectedRoute path="/reports" component={ReportsPage} />
              
              {/* System Settings - Available to all tenants */}
              <ProtectedRoute path="/admin/settings" component={AdminSettingsPage} />
              
              {/* AWS Tenant Management - DISABLED */}
              {/* {currentTenant === 'admin' && (
                <ProtectedRoute path="/admin/aws-tenant-management" component={AWSTenantsManagementPage} />
              )} */}
              
              <ProtectedRoute path="/admin/logs" component={LogsPage} />
              <ProtectedRoute path="/admin/debug" component={DebugToolsPage} />
              <ProtectedRoute path="/admin/regulations" component={RegulationViewer} />
              <Route path="/utilities" component={UtilitiesIndexPage} />
              <Route component={NotFound} />
            </Switch>
          </PageLayout>
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}