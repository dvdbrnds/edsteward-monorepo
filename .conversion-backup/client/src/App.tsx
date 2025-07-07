import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { PageLayout } from "@/components/layout/page-layout";
import { useTenantTitle } from "@/hooks/use-tenant-title";
import { TenantTitleUpdater } from "@/components/tenant-title-updater";
import HomePage from "@/pages/home-page";
import NotFound from "@/pages/not-found";
import TenantAwareAuth from "@/components/tenant-aware-auth";
import RegulationsPage from "@/pages/regulations-page";
import RegulationDetailPage from "@/pages/RegulationDetailPage";
import ComplianceWizardPage from "@/pages/compliance-wizard-page";
import ReportsPage from "@/pages/reports-page";
import ValidationPage from "@/pages/validation-page";
import AdminSettingsPage from "@/pages/admin-settings-page";
import AdminConsolePage from "@/pages/admin-console-page";
import AdminFeatureManagementPage from "@/pages/admin-feature-management-page";
import LogsPage from "@/pages/admin/logs-page";
import DebugToolsPage from "@/pages/admin/debug-tools-page";
import UtilitiesIndexPage from "@/pages/utilities/index";
import { RegulationViewer } from "@/pages/RegulationViewer";
import SetupWizardPage from "@/pages/setup-wizard-page";
import VendorAdminPage from "@/pages/vendor-admin-page";
import TenantSelectionPage from "@/pages/tenant-selection-page";
import PublicDashboardPage from "@/pages/public-dashboard-page";
import PublicRegulationDetailPage from "@/pages/public-regulation-detail-page";
import UpdatesListPage from "@/pages/updates-list-page";
import DifferentialViewPage from "@/pages/differential-view-page";
import DiffTestPage from "@/pages/diff-test-page";
import EnhancedJurisdictionDemo from "@/pages/enhanced-jurisdiction-demo";
import { ProtectedRoute } from "./lib/protected-route";
import { ProtectedRegulationRoute } from "./lib/protected-regulation-route";
import { ErrorBoundary } from "@/components/ui/error-boundary";

// Function to detect if we're on admin subdomain
function isAdminSubdomain(): boolean {
  const hostname = window.location.hostname;
  const isAdmin = hostname.startsWith('admin.') || 
                  hostname === 'admin.edsteward.local' || 
                  hostname === 'admin.edsteward.ai' ||
                  hostname.includes('admin.edsteward');
  
  console.log('[isAdminSubdomain] Hostname:', hostname, 'Is Admin:', isAdmin);
  return isAdmin;
}

function Router() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  console.log('[Router] Initializing router - Hostname:', hostname, 'Path:', pathname);
  
  // Set tenant-aware title
  useTenantTitle();

  // If we're on admin subdomain, show admin console interface
  const isAdmin = isAdminSubdomain();
  console.log('[Router] Is admin subdomain?', isAdmin);
  
  if (isAdmin) {
    console.log('[Router] ✅ Admin subdomain detected - routing to admin console');
    return (
      <ErrorBoundary>
        <Switch>
          {/* Admin authentication */}
          <Route path="/auth" component={TenantAwareAuth} />
          
          {/* Admin console routes */}
          <ProtectedRoute path="/" component={AdminConsolePage} />
          <ProtectedRoute path="/console" component={AdminConsolePage} />
          <ProtectedRoute path="/tenants" component={AdminConsolePage} />
          <ProtectedRoute path="/admin/feature-management" component={AdminFeatureManagementPage} />
          <ProtectedRoute path="/admin/logs" component={LogsPage} />
          <ProtectedRoute path="/admin/debug" component={DebugToolsPage} />
          <ProtectedRoute path="/logs" component={LogsPage} />
          <ProtectedRoute path="/debug" component={DebugToolsPage} />
          
          {/* Fallback */}
          <Route component={NotFound} />
        </Switch>
      </ErrorBoundary>
    );
  }

  console.log('[Router] ❌ Regular tenant routing - not admin subdomain');
  // Regular tenant routing
  return (
    <ErrorBoundary>
      <PageLayout>
        <Switch>
          {/* Public Routes - No Authentication Required */}
          <Route path="/public-dashboard" component={PublicDashboardPage} />
          <Route path="/public-dashboard/regulation/:id" component={PublicRegulationDetailPage} />
          <Route path="/enhanced-jurisdiction-demo" component={EnhancedJurisdictionDemo} />
          
          {/* Authentication Route - Now tenant-aware */}
          <Route path="/auth" component={TenantAwareAuth} />
          <Route path="/setup" component={SetupWizardPage} />
          
          {/* Tenant Management Routes */}
          <Route path="/tenant-select" component={TenantSelectionPage} />
          <ProtectedRoute path="/vendor-admin" component={VendorAdminPage} />
          
          {/* Protected Routes - Authentication Required */}
          <ProtectedRoute path="/" component={HomePage} />
          <ProtectedRoute path="/regulations" component={RegulationsPage} />
          <ProtectedRoute path="/regulations/validate" component={ValidationPage} />
          <ProtectedRoute path="/regulations/updates" component={UpdatesListPage} />
          <ProtectedRoute path="/regulations/updates/:id" component={DifferentialViewPage} />
          <ProtectedRoute path="/regulations/diff-test" component={DiffTestPage} />
          <ProtectedRegulationRoute 
            path="/regulations/:id" 
            component={RegulationDetailPage} 
          />
          <ProtectedRegulationRoute 
            path="/compliance-wizard/:id" 
            component={ComplianceWizardPage} 
          />
          <ProtectedRoute path="/reports" component={ReportsPage} />
          <ProtectedRoute path="/admin/settings" component={AdminSettingsPage} />
          <ProtectedRoute path="/admin/logs" component={LogsPage} />
          <ProtectedRoute path="/admin/debug" component={DebugToolsPage} />
          <ProtectedRoute path="/admin/regulations" component={RegulationViewer} />
          <Route path="/utilities" component={UtilitiesIndexPage} />
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
          <TenantTitleUpdater />
          <Router />
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}