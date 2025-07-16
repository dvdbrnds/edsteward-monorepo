import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import moravianLogo from "@/assets/Moravian-Monogram-MoravianBlue.png";

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

// Default fallback branding configuration
const DEFAULT_BRANDING: BrandingConfig = {
  institutionName: 'Moravian University',
  title: 'Moravian University Compliance Portal',
  logoUrl: moravianLogo,
  faviconUrl: '/favicon.ico',
  primaryColor: '#1e3a8a',
  secondaryColor: '#1e40af',
  accentColor: '#3b82f6',
  loginScreenBackgroundColor: '#f8fafc',
  loginScreenAccentColor: '#1e3a8a',
  loginScreenTextColor: '#1f2937',
  loginScreenHeroColor: '#002147',
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
  const { data: brandingData, isLoading, error } = useQuery({
    queryKey: ["/api/branding"],
    queryFn: async (): Promise<BrandingConfig> => {
      try {
        console.log('🔍 Fetching branding configuration from public endpoint...');
        // Use public endpoint for all users - it works for both authenticated and unauthenticated
        const response = await apiRequest("GET", "/api/branding");
        console.log('🎨 Fetched branding config successfully:', response.branding);
        console.log('🔵 Hero color in fetched data:', response.branding?.loginScreenHeroColor || 'NOT FOUND');
        return response.branding;
      } catch (error) {
        console.warn("⚠️ Failed to fetch branding configuration, using defaults:", error);
        console.log('🔴 Using default hero color:', DEFAULT_BRANDING.loginScreenHeroColor);
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
      console.log('🎨 Applying branding configuration to CSS custom properties:');
      console.log('🔵 Hero color being applied:', brandingData.loginScreenHeroColor);
      console.log('🔵 Full branding config:', brandingData);

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

      console.log('✅ Applied branding configuration:', branding.institutionName);
    }
  }, [brandingData]);

  // 🔧 FIX: Return fresh data immediately when available, not the potentially stale state
  const currentBranding = brandingData || appliedBranding;
  console.log('🔄 useBranding returning:', {
    hasData: !!brandingData,
    heroColor: currentBranding.loginScreenHeroColor,
    isLoading
  });

  return currentBranding;
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
      console.log('🎨 Updated favicon to:', favicon.href);
    } else {
      // Create favicon link if it doesn't exist
      const newFavicon = document.createElement('link');
      newFavicon.rel = 'icon';
      newFavicon.type = 'image/x-icon';
      newFavicon.id = 'favicon-link';
      const timestamp = new Date().getTime();
      newFavicon.href = `${faviconUrl}?v=${timestamp}`;
      document.head.appendChild(newFavicon);
      console.log('🎨 Created new favicon:', newFavicon.href);
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
    console.log('🎨 Updated meta description for:', institutionName);
  } else {
    const newMetaDescription = document.createElement('meta');
    newMetaDescription.name = 'description';
    newMetaDescription.content = `Welcome to ${institutionName}'s Compliance Portal. Manage your security and regulatory obligations effectively.`;
    document.head.appendChild(newMetaDescription);
    console.log('🎨 Created new meta description for:', institutionName);
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

    console.log('🎨 Applied theme colors:', {
      primary: branding.primaryColor,
      secondary: branding.secondaryColor,
      accent: branding.accentColor,
    });
  } catch (error) {
    console.error('Failed to apply theme colors:', error);
  }
}

// Static export for backward compatibility
export const BRANDING = DEFAULT_BRANDING; 