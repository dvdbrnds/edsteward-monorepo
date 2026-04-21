import React, { useCallback } from 'react';
import { useLocation } from 'wouter';
import TenantSelector from '@/components/tenant/tenant-selector';
import { apiClient } from '@/api';
import { useToast } from '@/hooks/use-toast';

// TypeScript interface for tenant selection (matching TenantSelector component)
interface TenantOption {
  id: string;
  name: string;
  domain: string;
  description: string;
  userCount: number;
  status: 'active' | 'setup' | 'maintenance';
  logoUrl?: string;
  samlEnabled: boolean;
}

export default function TenantSelectionPage() {
  // Context7 Best Practice: Use wouter navigation hook
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Context7 Best Practice: Use useCallback for stable function references
  const handleTenantSelect = useCallback(async (tenant: TenantOption) => {
    try {
      console.log('🏢 Tenant selected:', tenant.name, '(ID:', tenant.id, ')');
      
      // Set tenant context in API client
      // Note: The apiClient already has tenant management built-in
      // We need to update the tenantId in the API client
      if ('setTenantId' in apiClient && typeof (apiClient as any).setTenantId === 'function') {
        (apiClient as any).setTenantId(tenant.id);
      } else {
        console.log('⚠️ setTenantId method not found, using fallback');
      }

      // Store tenant selection in localStorage for persistence
      const tenantContext = {
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain,
        selectedAt: new Date().toISOString()
      };
      localStorage.setItem('selectedTenant', JSON.stringify(tenantContext));

      // Show success feedback
      toast({
        title: "Tenant Selected",
        description: `Successfully selected ${tenant.name}. Redirecting to dashboard...`,
        variant: "default",
      });

      // Context7 Best Practice: Navigate to dashboard after successful selection
      // Using a small delay to show the success message
      setTimeout(() => {
        navigate('/');
      }, 1000);

    } catch (error) {
      console.error('❌ Failed to select tenant:', error);
      
      // Show error feedback
      toast({
        title: "Selection Failed",
        description: error instanceof Error ? error.message : "Failed to select tenant. Please try again.",
        variant: "destructive",
      });
    }
  }, [navigate, toast]); // Context7 Best Practice: Include all dependencies

  return (
    <div className="container mx-auto px-4 py-8">
      <TenantSelector onTenantSelect={() => handleTenantSelect({ id: 'default', name: 'Default', domain: '', description: '', userCount: 0, status: 'active', samlEnabled: false })} />
    </div>
  );
} 