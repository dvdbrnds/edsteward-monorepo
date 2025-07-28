import React from 'react';
import { PageLayout } from '@/components/layout/page-layout';
import TenantManagementDashboard from '@/components/vendor-admin/tenant-management-dashboard';

export default function VendorAdminPage() {
  return (
    <PageLayout>
      <TenantManagementDashboard />
    </PageLayout>
  );
} 