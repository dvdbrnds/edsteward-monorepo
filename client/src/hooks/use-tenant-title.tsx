import { useEffect } from 'react';

export function useTenantTitle() {
  useEffect(() => {
    const hostname = window.location.hostname;
    
    if (hostname.startsWith('admin.')) {
      document.title = 'EdSteward Admin Console';
    } else if (hostname.startsWith('moravian.')) {
      document.title = 'Moravian University Compliance Portal';
    } else {
      document.title = 'EdSteward Admin Console';
    }
  }, []);
} 