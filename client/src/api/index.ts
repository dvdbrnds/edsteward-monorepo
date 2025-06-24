// import _React from 'react'; // Removed unused import

export interface ApiError extends Error {
  status: number;
  retryAfter?: number;
}

export interface ApiResponse<T = unknown> {
  data: T;
  success: boolean;
  message?: string;
}

class ApiClient {
  private baseURL: string;
  private tenantId: string;
  private getToken: (() => Promise<string | null>) | null = null;
  private onUnauthorized: (() => void) | null = null;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL;
    this.tenantId = import.meta.env.VITE_TENANT_ID;
  }

  setAuthHandlers(getToken: () => Promise<string | null>, onUnauthorized: () => void) {
    this.getToken = getToken;
    this.onUnauthorized = onUnauthorized;
  }

  private async getHeaders(includeAuth = true): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant': this.tenantId,
    };

    if (includeAuth && this.getToken) {
      const token = await this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    if (!response.ok) {
      const error: ApiError = new Error() as ApiError;
      error.status = response.status;

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          error.retryAfter = parseInt(retryAfter, 10);
        }
        error.message = `Rate limit exceeded. ${retryAfter ? `Retry after ${retryAfter} seconds.` : ''}`;
      } else if (response.status === 401) {
        error.message = 'Authentication required';
        if (this.onUnauthorized) {
          this.onUnauthorized();
        }
      } else if (response.status === 403) {
        error.message = 'Access forbidden';
      } else if (isJson) {
        try {
          const errorData = await response.json();
          error.message = errorData.message || errorData.error || response.statusText;
        } catch {
          error.message = response.statusText;
        }
      } else {
        error.message = await response.text() || response.statusText;
      }

      throw error;
    }

    if (isJson) {
      return await response.json();
    }
    
    // For non-JSON responses, return the text
    const text = await response.text();
    return text as unknown as T;
  }

  async get<T>(endpoint: string, options: { includeAuth?: boolean } = {}): Promise<T> {
    const { includeAuth = true } = options;
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'GET',
      headers: await this.getHeaders(includeAuth),
    });

    return this.handleResponse<T>(response);
  }

  async post<T>(
    endpoint: string, 
    data?: unknown, 
    options: { includeAuth?: boolean } = {}
  ): Promise<T> {
    const { includeAuth = true } = options;
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: await this.getHeaders(includeAuth),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async put<T>(
    endpoint: string, 
    data?: unknown, 
    options: { includeAuth?: boolean } = {}
  ): Promise<T> {
    const { includeAuth = true } = options;
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      headers: await this.getHeaders(includeAuth),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async patch<T>(
    endpoint: string, 
    data?: unknown, 
    options: { includeAuth?: boolean } = {}
  ): Promise<T> {
    const { includeAuth = true } = options;
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PATCH',
      headers: await this.getHeaders(includeAuth),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async delete<T>(
    endpoint: string, 
    options: { includeAuth?: boolean } = {}
  ): Promise<T> {
    const { includeAuth = true } = options;
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'DELETE',
      headers: await this.getHeaders(includeAuth),
    });

    return this.handleResponse<T>(response);
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Utility function for handling API errors in components
export function isApiError(error: unknown): error is ApiError {
  return error instanceof Error && 'status' in error;
}

// Rate limiting helper
export function isRateLimited(error: unknown): boolean {
  return isApiError(error) && error.status === 429;
}

// Auth error helpers
export function isUnauthorized(error: unknown): boolean {
  return isApiError(error) && error.status === 401;
}

export function isForbidden(error: unknown): boolean {
  return isApiError(error) && error.status === 403;
}