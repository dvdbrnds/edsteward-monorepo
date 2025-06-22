import { useEffect } from 'react';

export function TenantTitleUpdater() {
  useEffect(() => {
    // Fetch tenant info from API to get the correct title
    const updateTitleFromAPI = async () => {
      try {
        const response = await fetch('/api/regulations', { 
          method: 'HEAD',
          headers: { 'Accept': 'application/json' }
        });
        
        const tenantId = response.headers.get('x-tenant-id');
        const tenantName = response.headers.get('x-tenant-name');
        
        console.log('🏷️  Tenant detected:', { tenantId, tenantName });
        
        if (tenantId === 'admin') {
          document.title = 'EdSteward Admin Console';
          console.log('✅ Title updated to: EdSteward Admin Console');
        } else if (tenantId === 'moravian') {
          document.title = 'Moravian University Compliance Portal';
          console.log('✅ Title updated to: Moravian University Compliance Portal');
        } else if (tenantId === 'test') {
          document.title = 'Generic Compliance Portal';
          console.log('✅ Title updated to: Generic Compliance Portal');
        } else {
          document.title = 'EdSteward Compliance Portal'; // Default
          console.log('✅ Title updated to default: EdSteward Compliance Portal');
        }
      } catch (error) {
        console.error('❌ Failed to update title from API:', error);
        // Fallback to hostname detection
        const hostname = window.location.hostname;
        if (hostname.startsWith('admin.')) {
          document.title = 'EdSteward Admin Console';
        } else if (hostname.startsWith('moravian.')) {
          document.title = 'Moravian University Compliance Portal';
        } else if (hostname.startsWith('test.')) {
          document.title = 'Generic Compliance Portal';
        } else {
          document.title = 'EdSteward Compliance Portal';
        }
      }
    };
    
    updateTitleFromAPI();
  }, []);

  return null; // This component doesn't render anything
} 