import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

// Layout Components
import { AdminLayout } from '@/components/layout/admin-layout';
import { AuthLayout } from '@/components/layout/auth-layout';

// Page Components
import { LoginPage } from '@/pages/auth/login-page';
import { DashboardPage } from '@/pages/dashboard/dashboard-page';
import { UserManagementPage } from '@/pages/users/user-management-page';
import { AuditLogsPage } from '@/pages/audit/audit-logs-page';
import { SecurityPage } from '@/pages/security/security-page';
import { AnalyticsPage } from '@/pages/analytics/analytics-page';
import { UsageTrackingPage } from '@/pages/usage/usage-tracking-page';
import { WorkflowsPage } from '@/pages/workflows/workflows-page';
import { ReportsPage } from '@/pages/reports/reports-page';
import { IntegrationsPage } from '@/pages/integrations/integrations-page';
import { AlertsPage } from '@/pages/alerts/alerts-page';
import { CustomerManagementPage } from '@/pages/customers/customer-management-page';
import TenantCreationWizard from '@/pages/customers/tenant-creation-wizard';
import { FeatureFlagsPage } from '@/pages/features/feature-flags-page';
import { SystemHealthPage } from '@/pages/system/system-health-page';
import { InstitutionAssessmentPage } from '@/pages/assessment/institution-assessment-page';
import { NotFoundPage } from '@/pages/error/not-found-page';

// Hooks
import { useAuth } from '@/hooks/use-auth';

// Types
import { AdminUser } from '@/types/auth';

function App() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-admin-500"></div>
            </div>
        );
    }

    const isAuthenticated = !!user;

    return (
        <HelmetProvider>
            <div className="App">
                <Routes>
                    {/* Authentication Routes */}
                    <Route
                        path="/login"
                        element={
                            isAuthenticated ? (
                                <Navigate to="/dashboard" replace />
                            ) : (
                                <AuthLayout>
                                    <LoginPage />
                                </AuthLayout>
                            )
                        }
                    />

                    {/* Protected Admin Routes */}
                    <Route
                        path="/*"
                        element={
                            isAuthenticated ? (
                                <AdminLayout user={user}>
                                    <Routes>
                                        {/* Dashboard */}
                                        <Route path="/dashboard" element={<DashboardPage />} />

                                        {/* User Management & Access Control */}
                                        <Route path="/users" element={<UserManagementPage />} />

                                        {/* Audit Logs & Activity Monitoring */}
                                        <Route path="/audit" element={<AuditLogsPage />} />

                                        {/* Security & Compliance Management */}
                                        <Route path="/security" element={<SecurityPage />} />

                                        {/* Real-time Dashboard & Analytics */}
                                        <Route path="/analytics" element={<AnalyticsPage />} />

                                        {/* Usage Tracking & Resource Optimization */}
                                        <Route path="/usage" element={<UsageTrackingPage />} />

                                        {/* Automated Workflows & Task Management */}
                                        <Route path="/workflows" element={<WorkflowsPage />} />

                                        {/* Comprehensive Reporting & Data Export */}
                                        <Route path="/reports" element={<ReportsPage />} />

                                        {/* Integration Capabilities */}
                                        <Route path="/integrations" element={<IntegrationsPage />} />

                                        {/* Alert & Notification System */}
                                        <Route path="/alerts" element={<AlertsPage />} />

                                        {/* Customer Management */}
                                        <Route path="/customers" element={<CustomerManagementPage />} />

                                        {/* Tenant Creation Wizard */}
                                        <Route path="/customers/new" element={<TenantCreationWizard />} />

                                        {/* System Health */}
                                        <Route path="/system" element={<SystemHealthPage />} />

                                        {/* Institution Assessment (Sales Tool) */}
                                        <Route path="/assessment" element={<InstitutionAssessmentPage />} />

                                        {/* Feature Flag Management */}
                                        <Route path="/features" element={<FeatureFlagsPage />} />

                                        {/* Default redirect */}
                                        <Route path="/" element={<Navigate to="/dashboard" replace />} />

                                        {/* 404 */}
                                        <Route path="*" element={<NotFoundPage />} />
                                    </Routes>
                                </AdminLayout>
                            ) : (
                                <Navigate to="/login" replace />
                            )
                        }
                    />
                </Routes>
            </div>
        </HelmetProvider>
    );
}

export default App; 