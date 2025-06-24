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

const TENANT_BRANDING: Record<string, TenantBranding> = {
  admin: {
    id: 'admin',
    name: 'EdSteward Admin',
    title: 'EdSteward Admin Console',
    logo: '/src/assets/Screenshot_2025-02-12_at_9.15.57_AM-removebg-preview.png',
    favicon: '/admin-favicon.ico',
    primaryColor: '#2563EB', // Blue
    secondaryColor: '#1E40AF',
    accentColor: '#3B82F6'
  },
  moravian: {
    id: 'moravian',
    name: 'Moravian University',
    title: 'Moravian University Compliance Portal',
    logo: '/src/assets/Moravian-Monogram-MoravianBlue.png',
    favicon: '/moravian-favicon.ico',
    primaryColor: '#002147', // Moravian Blue (darker)
    secondaryColor: '#003166',
    accentColor: '#1E3A8A'
  },
  test: {
    id: 'test',
    name: 'Generic Organization',
    title: 'Generic Compliance Portal',
    logo: '/src/assets/generic-logo.svg',
    favicon: '/generic-favicon.ico',
    primaryColor: '#6B7280', // Gray
    secondaryColor: '#374151',
    accentColor: '#9CA3AF'
  }
};

export function useTenantBranding(): TenantBranding {
  const [branding, setBranding] = useState<TenantBranding>(TENANT_BRANDING.test);

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
          console.log('🎨 Branding detected for tenant:', tenantId);
        } else {
          // Fallback to hostname detection
          const hostname = window.location.hostname;
          
          if (hostname.startsWith('admin.')) {
            setBranding(TENANT_BRANDING.admin);
          } else if (hostname.startsWith('moravian.')) {
            setBranding(TENANT_BRANDING.moravian);
          } else if (hostname.startsWith('test.')) {
            setBranding(TENANT_BRANDING.test);
          } else {
            setBranding(TENANT_BRANDING.test); // Default to generic
          }
        }
      } catch (error) {
        console.error('❌ Failed to detect tenant branding:', error);
        // Default to generic branding
        setBranding(TENANT_BRANDING.test);
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
      console.log('🎨 Updated favicon to:', favicon.href);
    } else {
      // Create favicon link if it doesn't exist
      const newFavicon = document.createElement('link');
      newFavicon.rel = 'icon';
      newFavicon.type = 'image/x-icon';
      newFavicon.id = 'favicon-link';
      const timestamp = new Date().getTime();
      newFavicon.href = `${branding.favicon}?v=${timestamp}`;
      document.head.appendChild(newFavicon);
      console.log('🎨 Created new favicon:', newFavicon.href);
    }
    
    // Update CSS custom properties for theming
    document.documentElement.style.setProperty('--tenant-primary', branding.primaryColor);
    document.documentElement.style.setProperty('--tenant-secondary', branding.secondaryColor);
    document.documentElement.style.setProperty('--tenant-accent', branding.accentColor);
    
    console.log('🎨 Applied branding:', branding.name, 'favicon:', branding.favicon);
  }, [branding]);

  return branding;
} 