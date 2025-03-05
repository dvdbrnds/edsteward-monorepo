/**
 * @module useAuth
 * @description Authentication context and hook for managing user authentication state
 */

import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
};

type LoginData = Pick<InsertUser, "username" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  // Add logging for debugging
  useEffect(() => {
    console.log('[AuthProvider] Initializing authentication provider');
    return () => {
      console.log('[AuthProvider] Cleaning up authentication provider');
    };
  }, []);

  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | null>({
    queryKey: ["/api/user"],
    queryFn: async ({ queryKey }) => {
      try {
        console.log('[AuthProvider] Fetching user data');
        const response = await fetch(queryKey[0], {
          credentials: "include"
        });

        if (response.status === 401) {
          console.log('[AuthProvider] User not authenticated');
          return null;
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch user: ${response.status}`);
        }

        const userData = await response.json();
        console.log('[AuthProvider] User data fetched:', userData);
        return userData;
      } catch (error) {
        console.error('[AuthProvider] Error fetching user:', error);
        throw error;
      }
    },
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      console.log('[AuthProvider] Attempting login');
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      console.log('[AuthProvider] Login successful');
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Welcome back!",
        description: `Logged in as ${user.username}`,
      });
    },
    onError: (error: Error) => {
      console.error('[AuthProvider] Login failed:', error);
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      console.log('[AuthProvider] Attempting registration');
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      console.log('[AuthProvider] Registration successful');
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      console.error('[AuthProvider] Registration failed:', error);
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      console.log('[AuthProvider] Attempting logout');
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      console.log('[AuthProvider] Logout successful');
      queryClient.setQueryData(["/api/user"], null);
    },
    onError: (error: Error) => {
      console.error('[AuthProvider] Logout failed:', error);
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  console.log('[AuthProvider] Current state:', { user, isLoading, error });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    console.error('[useAuth] Hook used outside of AuthProvider');
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}