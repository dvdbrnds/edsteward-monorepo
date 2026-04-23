import { useEffect, useState } from 'react';

export interface TenantBranding {
  id: string;
  name: string;
  title: string;
  logo: string;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

// Generic defaults - actual branding comes from API via useBranding hook
const TENANT_BRANDING: Record<string, TenantBranding> = {
  admin: {
    id: 'admin',
    name: 'EdSteward Admin',
    title: 'EdSteward Admin Console',
    logo: '/assets/es-logo-pdf.png',
    favicon: '/favicon.ico',
    primaryColor: '#2e1b68', // EdSteward purple
    secondaryColor: '#1a0f3d',
    accentColor: '#6b3fa0'
  },
  // Default/generic branding for all tenants - API overrides this
  default: {
    id: 'default',
    name: 'Compliance Portal',
    title: 'Compliance Portal',
    logo: '/assets/es-logo-pdf.png',
    favicon: '/favicon.ico',
    primaryColor: '#2e1b68', // EdSteward purple
    secondaryColor: '#1a0f3d',
    accentColor: '#6b3fa0'
  }
};

export function useTenantBranding(): TenantBranding {
  const [branding, setBranding] = useState<TenantBranding>(TENANT_BRANDING.default);

  useEffect(() => {
    const detectTenant = async () => {
      try {
        // Try to detect tenant from API
        const response = await fetch('/api/regulations', { 
          method: 'HEAD',
          headers: { 'Accept': 'application/json' }
        });
        
        const tenantId = response.headers.get('x-tenant-id');
        
        if (tenantId && TENANT_BRANDING[tenantId]) {
          setBranding(TENANT_BRANDING[tenantId]);
          
        } else {
          // Fallback to hostname detection - use generic defaults
          const hostname = window.location.hostname;
          
          if (hostname.startsWith('admin.')) {
            setBranding(TENANT_BRANDING.admin);
          } else {
            // All other tenants use generic default - API provides actual branding
            setBranding(TENANT_BRANDING.default);
          }
        }
      } catch {
        // Default to generic branding on error
        setBranding(TENANT_BRANDING.default);
      }
    };

    detectTenant();
  }, []);

  // Update document title and favicon
  useEffect(() => {
    document.title = branding.title;
    
    // Update favicon with cache busting - target by ID first, then by selector
    let favicon = document.getElementById('favicon-link') as HTMLLinkElement;
    if (!favicon) {
      favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    }
    
    if (favicon) {
      // Add timestamp to force browser to reload favicon
      const timestamp = new Date().getTime();
      favicon.href = `${branding.favicon}?v=${timestamp}`;
      
    } else {
      // Create favicon link if it doesn't exist
      const newFavicon = document.createElement('link');
      newFavicon.rel = 'icon';
      newFavicon.type = 'image/x-icon';
      newFavicon.id = 'favicon-link';
      const timestamp = new Date().getTime();
      newFavicon.href = `${branding.favicon}?v=${timestamp}`;
      document.head.appendChild(newFavicon);
      
    }
    
    // Update CSS custom properties for theming
    document.documentElement.style.setProperty('--tenant-primary', branding.primaryColor);
    document.documentElement.style.setProperty('--tenant-secondary', branding.secondaryColor);
    document.documentElement.style.setProperty('--tenant-accent', branding.accentColor);
    
    
  }, [branding]);

  return branding;
} 