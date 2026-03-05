/**
 * Institution Configuration Hook
 * Provides access to institution-specific configuration
 */

import { useState, useEffect } from 'react';

export interface InstitutionConfig {
  institution: {
    name: string;
    domain: string;
    branding: {
      logo: string;
      primaryColor: string;
      secondaryColor: string;
      favicon?: string;
    };
  };
  authentication: {
    samlEnabled: boolean;
    usernamePasswordEnabled: boolean;
    allowSelfRegistration: boolean;
  };
  features: {
    maxUsers: number;
    maxRegulations: number;
    apiAccess: boolean;
    customDomain: boolean;
    ssoEnabled: boolean;
  };
}

export function useInstitutionConfig() {
  const [config, setConfig] = useState<InstitutionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config');
        if (!response.ok) {
          throw new Error('Failed to fetch configuration');
        }
        const data = await response.json();
        setConfig(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  return { config, loading, error };
}
