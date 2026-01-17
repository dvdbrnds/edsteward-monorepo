import { useState, useEffect, useContext, createContext, ReactNode, useRef, useCallback } from 'react';
import { AdminUser, LoginCredentials, AuthContextType } from '@/types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API base URL
const API_BASE = import.meta.env.DEV ? 'http://localhost:4000' : '';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasCheckedAuth = useRef(false);

  const checkAuthStatus = useCallback(async () => {
    // Prevent multiple auth checks (StrictMode calls useEffect twice)
    if (hasCheckedAuth.current) return;
    hasCheckedAuth.current = true;

    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const adminUser = await response.json();
        setUser(adminUser);
      } else {
        localStorage.removeItem('admin_token');
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      localStorage.removeItem('admin_token');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const login = async (credentials: LoginCredentials) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Login failed');
      }

      // Backend returns { token, user: { id, email, name, role } }
      localStorage.setItem('admin_token', data.token);
      setUser(data.user);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (token) {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('admin_token');
      setUser(null);
      setError(null);
    }
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    error,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 