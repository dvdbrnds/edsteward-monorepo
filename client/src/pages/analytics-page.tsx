/**
 * Analytics Page
 * 
 * Page component that displays the comprehensive compliance analytics dashboard
 */

import React from 'react';
import { PageLayout } from '@/components/layout/page-layout';
import { ComplianceAnalyticsDashboard } from '@/components/analytics/compliance-analytics-dashboard';

export default function AnalyticsPage() {
  return (
    <PageLayout>
      <ComplianceAnalyticsDashboard />
    </PageLayout>
  );
}; 