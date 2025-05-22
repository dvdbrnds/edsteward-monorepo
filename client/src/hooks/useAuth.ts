import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  username: string;
  email?: string;
  role?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  tokens: AuthTokens | null;
}

export function useAuth() {
  const { toast } = useToast();
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    tokens: null,
  });

  // Load tokens from localStorage on mount
  useEffect(() => {
    const savedTokens = localStorage.getItem('auth_tokens');
    const savedUser = localStorage.getItem('auth_user');
    
    if (savedTokens && savedUser) {
      try {
        const tokens: AuthTokens = JSON.parse(savedTokens);
        const user: User = JSON.parse(savedUser);
        
        // Check if access token is still valid
        if (tokens.expiresAt > Date.now()) {
          setAuthState({
            user,
            isAuthenticated: true,
            isLoading: false,
            tokens,
          });
        } else {
          // Try to refresh the token
          silentRefresh(tokens.refreshToken);
        }
      } catch (error) {
        console.error('Failed to parse stored auth data:', error);
        clearAuth();
      }
    } else {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const saveAuthData = useCallback((user: User, tokens: AuthTokens) => {
    localStorage.setItem('auth_user', JSON.stringify(user));
    localStorage.setItem('auth_tokens', JSON.stringify(tokens));
    setAuthState({
      user,
      isAuthenticated: true,
      isLoading: false,
      tokens,
    });
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_tokens');
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      tokens: null,
    });
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant': import.meta.env.VITE_TENANT_ID,
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Login failed');
      }

      const data = await response.json();
      const { user, accessToken, refreshToken, expiresIn } = data;
      
      const tokens: AuthTokens = {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + (expiresIn * 1000),
      };

      saveAuthData(user, tokens);
      
      toast({
        title: "Welcome back!",
        description: `Successfully logged in as ${user.username}`,
      });
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      throw error;
    }
  }, [saveAuthData, toast]);

  const logout = useCallback(async (): Promise<void> => {
    try {
      if (authState.tokens?.refreshToken) {
        await fetch(`${import.meta.env.VITE_API_URL}/v1/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authState.tokens.accessToken}`,
            'X-Tenant': import.meta.env.VITE_TENANT_ID,
          },
          body: JSON.stringify({ refreshToken: authState.tokens.refreshToken }),
        });
      }
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      clearAuth();
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
    }
  }, [authState.tokens, clearAuth, toast]);

  const silentRefresh = useCallback(async (refreshToken?: string): Promise<string | null> => {
    const tokenToUse = refreshToken || authState.tokens?.refreshToken;
    
    if (!tokenToUse) {
      clearAuth();
      return null;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant': import.meta.env.VITE_TENANT_ID,
        },
        body: JSON.stringify({ refreshToken: tokenToUse }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      const { user, accessToken, refreshToken: newRefreshToken, expiresIn } = data;
      
      const tokens: AuthTokens = {
        accessToken,
        refreshToken: newRefreshToken,
        expiresAt: Date.now() + (expiresIn * 1000),
      };

      saveAuthData(user, tokens);
      return accessToken;
    } catch (error) {
      console.error('Silent refresh failed:', error);
      clearAuth();
      return null;
    }
  }, [authState.tokens?.refreshToken, saveAuthData, clearAuth]);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (!authState.tokens) {
      return null;
    }

    // If token expires in less than 5 minutes, refresh it
    const fiveMinutes = 5 * 60 * 1000;
    if (authState.tokens.expiresAt - Date.now() < fiveMinutes) {
      return await silentRefresh();
    }

    return authState.tokens.accessToken;
  }, [authState.tokens, silentRefresh]);

  // Auto-refresh token when it's about to expire
  useEffect(() => {
    if (!authState.tokens || !authState.isAuthenticated) return;

    const timeUntilExpiry = authState.tokens.expiresAt - Date.now();
    const refreshTime = Math.max(timeUntilExpiry - (5 * 60 * 1000), 1000); // Refresh 5 min before expiry

    const timeout = setTimeout(() => {
      silentRefresh();
    }, refreshTime);

    return () => clearTimeout(timeout);
  }, [authState.tokens, authState.isAuthenticated, silentRefresh]);

  return {
    ...authState,
    login,
    logout,
    getToken,
    silentRefresh,
  };
}