import { QueryClient } from "@tanstack/react-query";
import { apiClient, isApiError, isRateLimited, isUnauthorized } from "@/api";

// Create a custom query function that uses our API client
const defaultQueryFn = async ({ queryKey }: { queryKey: any[] }) => {
  const [url, ...params] = queryKey;
  
  // Handle parameterized queries
  let finalUrl = url;
  if (params.length > 0) {
    const searchParams = new URLSearchParams();
    params.forEach((param, index) => {
      if (param !== undefined && param !== null) {
        searchParams.append(`param${index}`, param.toString());
      }
    });
    if (searchParams.toString()) {
      finalUrl += `?${searchParams.toString()}`;
    }
  }
  
  return await apiClient.get(finalUrl);
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry on auth errors or rate limits
        if (isUnauthorized(error) || isRateLimited(error)) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry mutations on auth errors or rate limits
        if (isUnauthorized(error) || isRateLimited(error)) {
          return false;
        }
        // Retry once for network errors
        return failureCount < 1;
      },
      retryDelay: 1000,
    },
  },
});

// Enhanced API request function for mutations
export async function apiRequest(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  data?: unknown
): Promise<Response> {
  const response = await fetch(url, {
    method,
    headers: await getRequestHeaders(),
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const error = new Error(`${response.status}: ${response.statusText}`) as any;
    error.status = response.status;
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      if (retryAfter) {
        error.retryAfter = parseInt(retryAfter, 10);
      }
    }
    
    throw error;
  }

  return response;
}

// Helper to get request headers with auth and tenant
async function getRequestHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Tenant': import.meta.env.VITE_TENANT_ID,
  };

  // Note: Auth headers will be handled by the API client
  return headers;
}