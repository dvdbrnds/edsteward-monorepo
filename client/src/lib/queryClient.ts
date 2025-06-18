import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(_options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Enhanced API request function for mutations
export async function apiRequest(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  data?: unknown
): Promise<any> {
  const response = await fetch(url, {
    method,
    headers: await getRequestHeaders(),
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
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

  // Handle no content responses
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// Simple API function for queries (GET requests)
export async function apiQuery(url: string): Promise<any> {
  return apiRequest('GET', url);
}

// Helper to get request headers with auth and tenant
async function getRequestHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add tenant header if available
  const tenantId = import.meta.env.VITE_TENANT_ID;
  if (tenantId) {
    headers['X-Tenant'] = tenantId;
  }

  return headers;
}