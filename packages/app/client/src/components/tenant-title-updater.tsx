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
        
        if (tenantId === 'admin') {
          document.title = 'EdSteward Admin Console';
        } else if (tenantId === 'moravian') {
          document.title = 'Moravian University Compliance Portal';
        } else if (tenantId === 'test') {
          document.title = 'Generic Compliance Portal';
        } else {
          document.title = 'EdSteward Compliance Portal';
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