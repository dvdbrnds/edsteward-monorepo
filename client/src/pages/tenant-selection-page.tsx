import React from 'react';
import TenantSelector from '@/components/tenant/tenant-selector';

export default function TenantSelectionPage() {
  const handleTenantSelect = (tenant: any) => {
    console.log('Selected tenant:', tenant);
    // TODO: Implement tenant selection logic (redirect to dashboard, set context, etc.)
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <TenantSelector onTenantSelect={handleTenantSelect} />
    </div>
  );
} 