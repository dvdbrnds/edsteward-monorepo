import { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { FEATURE_FLAGS, FeatureFlag } from '@shared/feature-flags';

interface FeatureFlagContextType {
  isFeatureEnabled: (featureKey: string) => boolean;
  getFeaturesByCategory: (category: string) => FeatureFlag[];
  getAllFeatures: () => Record<string, FeatureFlag>;
  tenantFeatures: Record<string, boolean>;
  loading: boolean;
}

const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(undefined);

interface FeatureFlagProviderProps {
  children: ReactNode;
  tenantId: string;
}

export function FeatureFlagProvider({ children, tenantId }: FeatureFlagProviderProps) {
  const [tenantFeatures, setTenantFeatures] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTenantFeatures();
  }, [tenantId]);

  const fetchTenantFeatures = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tenants/${tenantId}/features`);
      
      if (response.ok) {
        const data = await response.json();
        setTenantFeatures(data.features || {});
      } else {
        console.warn('Failed to fetch tenant features, using defaults');
        setTenantFeatures({});
      }
    } catch (error) {
      console.error('Error fetching tenant features:', error);
      setTenantFeatures({});
    } finally {
      setLoading(false);
    }
  };

  const isFeatureEnabled = (featureKey: string): boolean => {
    const featureDefinition = FEATURE_FLAGS[featureKey];
    if (!featureDefinition) {
      console.warn(`Unknown feature flag: ${featureKey}`);
      return false;
    }

    // Return tenant-specific setting or default value
    return tenantFeatures[featureKey] ?? featureDefinition.defaultValue;
  };

  const getFeaturesByCategory = (category: string): FeatureFlag[] => {
    return Object.values(FEATURE_FLAGS).filter(flag => flag.category === category);
  };

  const getAllFeatures = (): Record<string, FeatureFlag> => {
    return FEATURE_FLAGS;
  };

  const value: FeatureFlagContextType = {
    isFeatureEnabled,
    getFeaturesByCategory,
    getAllFeatures,
    tenantFeatures,
    loading
  };

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags(): FeatureFlagContextType {
  const context = useContext(FeatureFlagContext);
  if (context === undefined) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }
  return context;
}

// Convenience hook for checking a single feature
export function useFeatureFlag(featureKey: string): boolean {
  const { isFeatureEnabled } = useFeatureFlags();
  return isFeatureEnabled(featureKey);
}

// Hook for getting features by category
export function useFeaturesByCategory(category: string): FeatureFlag[] {
  const { getFeaturesByCategory } = useFeatureFlags();
  return getFeaturesByCategory(category);
} 