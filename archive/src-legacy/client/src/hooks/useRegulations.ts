import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { apiClient, isRateLimited } from '@/api';
import { useToast } from '@/hooks/use-toast';

export interface Regulation {
  id: string;
  name: string;
  topic: string;
  content: string;
  category: string;
  jurisdiction: 'federal' | 'state';
  effectiveDate?: string;
  lastUpdated?: string;
  version: number;
  // Add other regulation fields as needed
}

export interface RegulationDelta {
  data: Regulation[];
  latest_version: number;
  has_more: boolean;
}

export interface UseRegulationsOptions {
  initialCursor?: number;
  enableAutoRefresh?: boolean;
  refreshInterval?: number;
}

const REGULATIONS_QUERY_KEY = ['regulations'];
const CURSOR_STORAGE_KEY = 'regulations_cursor';

export function useRegulations(options: UseRegulationsOptions = {}) {
  const { 
    initialCursor = 0, 
    enableAutoRefresh = true, 
    refreshInterval = 30000 // 30 seconds
  } = options;
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [cursor, setCursor] = useState(() => {
    const saved = localStorage.getItem(CURSOR_STORAGE_KEY);
    return saved ? parseInt(saved, 10) : initialCursor;
  });
  const [isRefreshDisabled, setIsRefreshDisabled] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [lastRefreshReset, setLastRefreshReset] = useState(Date.now());

  // Check if we've hit daily refresh limit (10 per day)
  const checkRefreshLimit = useCallback(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    if (now - lastRefreshReset > oneDayMs) {
      setRefreshCount(0);
      setLastRefreshReset(now);
      setIsRefreshDisabled(false);
      return false;
    }
    
    return refreshCount >= 10;
  }, [refreshCount, lastRefreshReset]);

  // Save cursor to localStorage
  const saveCursor = useCallback((newCursor: number) => {
    setCursor(newCursor);
    localStorage.setItem(CURSOR_STORAGE_KEY, newCursor.toString());
  }, []);

  // Fetch regulations with delta support
  const {
    data: regulations = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: [...REGULATIONS_QUERY_KEY, cursor],
    queryFn: async () => {
      try {
        const response = await apiClient.get<RegulationDelta>(
          `/v1/regs?since_version=${cursor}`
        );
        
        // Update cursor with latest version
        if (response.latest_version > cursor) {
          saveCursor(response.latest_version);
        }
        
        return response.data;
      } catch (error) {
        if (isRateLimited(error)) {
          toast({
            title: "Rate limit reached",
            description: "Please wait before requesting more data",
            variant: "destructive",
          });
        }
        throw error;
      }
    },
    refetchInterval: enableAutoRefresh ? refreshInterval : false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Full refresh mutation (counts towards daily limit)
  const refreshAllMutation = useMutation({
    mutationFn: async () => {
      if (checkRefreshLimit()) {
        throw new Error('Daily refresh limit reached (10/day)');
      }

      // Reset cursor to 0 to get all regulations
      const response = await apiClient.get<RegulationDelta>('/v1/regs?since_version=0');
      
      // Update cursor and count
      saveCursor(response.latest_version);
      setRefreshCount(prev => prev + 1);
      
      return response.data;
    },
    onSuccess: (data) => {
      // Replace all regulations in cache
      queryClient.setQueryData([...REGULATIONS_QUERY_KEY, cursor], data);
      toast({
        title: "Refresh complete",
        description: `Updated ${data.length} regulations`,
      });
    },
    onError: (error) => {
      if (isRateLimited(error)) {
        setIsRefreshDisabled(true);
        toast({
          title: "Rate limit exceeded",
          description: "Bulk refresh temporarily disabled",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Refresh failed",
          description: error instanceof Error ? error.message : "An error occurred",
          variant: "destructive",
        });
      }
    },
  });

  // Delta update function (doesn't count towards limit)
  const deltaUpdate = useCallback(async () => {
    try {
      const response = await apiClient.get<RegulationDelta>(
        `/v1/regs?since_version=${cursor}`
      );
      
      if (response.data.length > 0) {
        // Merge new regulations with existing ones
        const currentRegulations = queryClient.getQueryData<Regulation[]>([...REGULATIONS_QUERY_KEY, cursor]) || [];
        const updatedRegulations = mergeRegulations(currentRegulations, response.data);
        
        queryClient.setQueryData([...REGULATIONS_QUERY_KEY, cursor], updatedRegulations);
        saveCursor(response.latest_version);
        
        toast({
          title: "Updates received",
          description: `${response.data.length} regulation(s) updated`,
        });
      }
      
      return response.data;
    } catch (error) {
      console.error('Delta update failed:', error);
      throw error;
    }
  }, [cursor, queryClient, saveCursor, toast]);

  // Merge regulations helper
  const mergeRegulations = useCallback((existing: Regulation[], updates: Regulation[]): Regulation[] => {
    const regulationMap = new Map(existing.map(reg => [reg.id, reg]));
    
    // Apply updates
    updates.forEach(update => {
      regulationMap.set(update.id, update);
    });
    
    return Array.from(regulationMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  // Get regulation by ID
  const getRegulation = useCallback((id: string): Regulation | undefined => {
    return regulations.find(reg => reg.id === id);
  }, [regulations]);

  // Search regulations
  const searchRegulations = useCallback((query: string): Regulation[] => {
    if (!query.trim()) return regulations;
    
    const searchTerm = query.toLowerCase();
    return regulations.filter(reg => 
      reg.name.toLowerCase().includes(searchTerm) ||
      reg.topic.toLowerCase().includes(searchTerm) ||
      reg.content.toLowerCase().includes(searchTerm)
    );
  }, [regulations]);

  return {
    regulations,
    isLoading,
    error,
    cursor,
    refreshAll: refreshAllMutation.mutate,
    isRefreshing: refreshAllMutation.isPending,
    isRefreshDisabled: isRefreshDisabled || checkRefreshLimit(),
    refreshCount,
    deltaUpdate,
    getRegulation,
    searchRegulations,
    refetch,
  };
}