import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

// Generic EdSteward logo for default branding
const edstewardLogo = '/assets/es-white-on-purple-logo.png';

export interface BrandingConfig {
  institutionName: string;
  title: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  loginScreenBackgroundColor: string;
  loginScreenAccentColor: string;
  loginScreenTextColor: string;
  loginScreenHeroColor: string;
}

// Default fallback branding configuration - GENERIC, not tenant-specific!
const DEFAULT_BRANDING: BrandingConfig = {
  institutionName: 'Compliance Portal',
  title: 'Compliance Portal',
  logoUrl: edstewardLogo,
  faviconUrl: '/favicon.ico',
  primaryColor: '#3d1a5a', // EdSteward purple
  secondaryColor: '#2d1345',
  accentColor: '#6b3fa0',
  loginScreenBackgroundColor: '#f8fafc',
  loginScreenAccentColor: '#3d1a5a',
  loginScreenTextColor: '#1f2937',
  loginScreenHeroColor: '#2d1345',
};

// Legacy interface for backward compatibility
export interface LegacyBranding {
  name: string;
  title: string;
  logo: string;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export function useBranding(): BrandingConfig {
  const [appliedBranding, setAppliedBranding] = useState<BrandingConfig>(DEFAULT_BRANDING);

  // Fetch branding configuration from API
  const { data: brandingData } = useQuery({
    queryKey: ["/api/branding"],
    queryFn: async (): Promise<BrandingConfig> => {
      try {
        const response = await apiRequest("GET", "/api/branding");
        
        // Map API response to expected format
        const apiData = response.branding;
        const mappedBranding: BrandingConfig = {
          institutionName: apiData.institutionName || apiData.title || DEFAULT_BRANDING.institutionName,
          title: apiData.title || DEFAULT_BRANDING.title,
          logoUrl: apiData.logoUrl || DEFAULT_BRANDING.logoUrl,
          faviconUrl: apiData.faviconUrl || DEFAULT_BRANDING.faviconUrl,
          primaryColor: apiData.primaryColor || DEFAULT_BRANDING.primaryColor,
          secondaryColor: apiData.secondaryColor || DEFAULT_BRANDING.secondaryColor,
          accentColor: apiData.accentColor || DEFAULT_BRANDING.accentColor,
          loginScreenBackgroundColor: apiData.loginScreenBackgroundColor || DEFAULT_BRANDING.loginScreenBackgroundColor,
          loginScreenAccentColor: apiData.loginScreenAccentColor || DEFAULT_BRANDING.loginScreenAccentColor,
          loginScreenTextColor: apiData.loginScreenTextColor || DEFAULT_BRANDING.loginScreenTextColor,
          loginScreenHeroColor: apiData.heroColor || apiData.loginScreenHeroColor || DEFAULT_BRANDING.loginScreenHeroColor,
        };
        
        return mappedBranding;
      } catch {
        return DEFAULT_BRANDING;
      }
    },
    staleTime: 30 * 1000, // Reduced from 5 minutes to 30 seconds
    retry: 3, // Increased retry count for network issues
    refetchOnMount: true, // Always refetch on component mount
    refetchOnWindowFocus: false, // Don't refetch on window focus to avoid excessive requests
  });

  // Apply branding configuration when it changes
  useEffect(() => {
    if (brandingData) {
      const branding = brandingData;
      setAppliedBranding(branding);

      // Update document title
      document.title = branding.title;

      // Update meta description
      updateMetaDescription(branding.institutionName);

      // Update favicon
      updateFavicon(branding.faviconUrl);

      // Apply CSS custom properties for theming
      applyThemeColors(branding);
    }
  }, [brandingData]);

  // Return fresh data immediately when available, not the potentially stale state
  return brandingData || appliedBranding;
}

// Legacy hook for backward compatibility
export function useLegacyBranding(): LegacyBranding {
  const branding = useBranding();

  return {
    name: branding.institutionName,
    title: branding.title,
    logo: branding.logoUrl,
    favicon: branding.faviconUrl,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    accentColor: branding.accentColor,
  };
}

// Update favicon with cache busting
function updateFavicon(faviconUrl: string) {
  try {
    // Target by ID first, then by selector
    let favicon = document.getElementById('favicon-link') as HTMLLinkElement;
    if (!favicon) {
      favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    }

    if (favicon) {
      // Add timestamp to force browser to reload favicon
      const timestamp = new Date().getTime();
      favicon.href = `${faviconUrl}?v=${timestamp}`;
    } else {
      // Create favicon link if it doesn't exist
      const newFavicon = document.createElement('link');
      newFavicon.rel = 'icon';
      newFavicon.type = 'image/x-icon';
      newFavicon.id = 'favicon-link';
      const timestamp = new Date().getTime();
      newFavicon.href = `${faviconUrl}?v=${timestamp}`;
      document.head.appendChild(newFavicon);
    }
  } catch (error) {
    console.error('Failed to update favicon:', error);
  }
}

// Update meta description
function updateMetaDescription(institutionName: string) {
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute('content', `Welcome to ${institutionName}'s Compliance Portal. Manage your security and regulatory obligations effectively.`);
  } else {
    const newMetaDescription = document.createElement('meta');
    newMetaDescription.name = 'description';
    newMetaDescription.content = `Welcome to ${institutionName}'s Compliance Portal. Manage your security and regulatory obligations effectively.`;
    document.head.appendChild(newMetaDescription);
  }
}

// Apply theme colors as CSS variables
function applyThemeColors(branding: BrandingConfig) {
  try {
    const root = document.documentElement;

    // Convert hex to RGB for CSS variables
    const hexToRgb = (hex: string): string => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return '0, 0, 0';
      return [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ].join(', ');
    };

    // Apply branding colors
    root.style.setProperty('--branding-primary', branding.primaryColor);
    root.style.setProperty('--branding-primary-rgb', hexToRgb(branding.primaryColor));
    root.style.setProperty('--branding-secondary', branding.secondaryColor);
    root.style.setProperty('--branding-secondary-rgb', hexToRgb(branding.secondaryColor));
    root.style.setProperty('--branding-accent', branding.accentColor);
    root.style.setProperty('--branding-accent-rgb', hexToRgb(branding.accentColor));

    // Login screen specific colors
    root.style.setProperty('--login-background', branding.loginScreenBackgroundColor);
    root.style.setProperty('--login-background-rgb', hexToRgb(branding.loginScreenBackgroundColor));
    root.style.setProperty('--login-accent', branding.loginScreenAccentColor);
    root.style.setProperty('--login-accent-rgb', hexToRgb(branding.loginScreenAccentColor));
    root.style.setProperty('--login-text', branding.loginScreenTextColor);
    root.style.setProperty('--login-text-rgb', hexToRgb(branding.loginScreenTextColor));
    root.style.setProperty('--login-hero', branding.loginScreenHeroColor);
    root.style.setProperty('--login-hero-rgb', hexToRgb(branding.loginScreenHeroColor));
  } catch (error) {
    console.error('Failed to apply theme colors:', error);
  }
}

// Static export for backward compatibility
export const BRANDING = DEFAULT_BRANDING; 