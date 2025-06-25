import React from 'react';
import { PageLayout } from '@/components/layout/page-layout';
import TenantFeatureManager from '@/components/admin/tenant-feature-manager';

export default function AdminFeatureManagementPage() {
  return (
    <PageLayout>
      <TenantFeatureManager />
    </PageLayout>
  );
} 