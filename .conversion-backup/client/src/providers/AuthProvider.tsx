import React, { createContext, useContext, useEffect } from 'react';
import { useAuth as useAuthHook } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { apiClient } from '@/api';

interface AuthContextType {
  user: any;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { username: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuthHook();
  const webSocket = useWebSocket({ autoConnect: true });

  // Initialize API client with auth handlers when auth is ready
  useEffect(() => {
    if (auth.getToken && auth.logout) {
      apiClient.setAuthHandlers(auth.getToken, auth.logout);
    }
  }, [auth.getToken, auth.logout]);

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}