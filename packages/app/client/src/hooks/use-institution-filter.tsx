import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState, useEffect, createContext, useContext } from "react";
import type { ReactNode } from "react";

interface InstitutionConfig {
  primaryType: string | null;
  characteristics: string[];
  hideNonApplicable: boolean;
  allowUsersToToggle: boolean;
}

const CONFIG_QUERY_KEY = ["/api/institution-config/types"] as const;

interface InstitutionFilterContextType {
  config: InstitutionConfig | undefined;
  isLoading: boolean;
  institutionTypes: string[];
  isConfigured: boolean;
  isFiltering: boolean;
  toggleFilter: () => void;
  regulationsQueryKey: readonly [string];
  invalidateRegulations: () => void;
}

const InstitutionFilterContext = createContext<InstitutionFilterContextType | null>(null);

export function InstitutionFilterProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery<InstitutionConfig>({
    queryKey: CONFIG_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/institution-config/types");
      if (!res.ok) throw new Error("Failed to load institution config");
      const data = await res.json();
      return data.config;
    },
  });

  const institutionTypes = useMemo(() => {
    if (!config) return [];
    return [config.primaryType, ...config.characteristics].filter(Boolean) as string[];
  }, [config]);

  const isConfigured = institutionTypes.length > 0;

  const [isFiltering, setIsFiltering] = useState<boolean | null>(null);

  useEffect(() => {
    if (config && isFiltering === null) {
      setIsFiltering(config.hideNonApplicable);
    }
  }, [config, isFiltering]);

  const effectiveFiltering = isFiltering ?? config?.hideNonApplicable ?? false;

  const toggleFilter = useCallback(() => {
    setIsFiltering(prev => !(prev ?? config?.hideNonApplicable ?? false));
  }, [config]);

  const regulationsQueryKey = useMemo(() => {
    if (effectiveFiltering && isConfigured) {
      return [`/api/regulations?institutionTypes=${institutionTypes.join(",")}`] as const;
    }
    return ["/api/regulations"] as const;
  }, [effectiveFiltering, isConfigured, institutionTypes]);

  const invalidateRegulations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/regulations"] });
  }, [queryClient]);

  const value = useMemo<InstitutionFilterContextType>(() => ({
    config,
    isLoading,
    institutionTypes,
    isConfigured,
    isFiltering: effectiveFiltering,
    toggleFilter,
    regulationsQueryKey,
    invalidateRegulations,
  }), [config, isLoading, institutionTypes, isConfigured, effectiveFiltering, toggleFilter, regulationsQueryKey, invalidateRegulations]);

  return (
    <InstitutionFilterContext.Provider value={value}>
      {children}
    </InstitutionFilterContext.Provider>
  );
}

export function useInstitutionFilter() {
  const context = useContext(InstitutionFilterContext);
  if (!context) {
    throw new Error("useInstitutionFilter must be used within an InstitutionFilterProvider");
  }
  return context;
}
