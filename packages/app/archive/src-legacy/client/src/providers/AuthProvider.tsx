import React, { createContext, useContext } from 'react';
// Temporarily disabled due to circular dependency
// import { useAuth as useAuthHook } from '@/hooks/useAuth';
// import { useWebSocket } from '@/hooks/useWebSocket';
// import { apiClient } from '@/api'; // Temporarily disabled

interface AuthContextType {
  user: any;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Temporarily disabled due to circular dependency
  const auth = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: async () => {},
    logout: async () => {},
    getToken: async () => null,
  };

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