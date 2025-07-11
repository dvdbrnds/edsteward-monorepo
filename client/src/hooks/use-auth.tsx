/**
 * @module useAuth
 * @description Authentication context and hook for managing user authentication state
 * @compliance ISO/IEC/IEEE 26514 4.3.3 - Authentication Documentation
 * 
 * @securityControl Authentication & Session Management
 * - Implements secure session-based authentication
 * - Manages user login/logout state
 * - Handles registration process
 */

import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/**
 * @interface AuthContextType
 * @description Context type definition for authentication state and operations
 */
type AuthContextType = {
  /** Currently authenticated user or null if not authenticated */
  user: SelectUser | null;
  /** Loading state for authentication operations */
  isLoading: boolean;
  /** Any error that occurred during authentication */
  error: Error | null;
  /** Mutation for handling user login */
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  /** Mutation for handling user logout */
  logoutMutation: UseMutationResult<void, Error, void>;
  /** Mutation for handling user registration */
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
};

/**
 * @interface LoginData
 * @description Required data for user login
 */
type LoginData = Pick<InsertUser, "username" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);

/**
 * @component AuthProvider
 * @description Provider component for authentication context
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Child components to be wrapped
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/auth/status"],
    queryFn: async () => {
      // Context7 Multi-Tenant Fix: Use auth status endpoint to avoid 401 console errors
      const res = await fetch("/api/auth/status", { credentials: "include" });
      if (!res.ok) throw new Error(res.statusText);
      const statusData = await res.json();
      return statusData.authenticated ? statusData.user : null;
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      return await apiRequest("POST", "/api/login", credentials);
    },
    onSuccess: (loginResponse: any) => {
      // Don't set query data directly - let the auth status query refetch with correct structure
      queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
      // Invalidate all other queries to refresh data after login
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications", "v2"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deadlines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/regulations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      return await apiRequest("POST", "/api/register", credentials);
    },
    onSuccess: (registerResponse: any) => {
      // Don't set query data directly - let the auth status query refetch with correct structure
      queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/status"], null);
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Use the actual user data from the API
  return (
    <AuthContext.Provider
      value={{
        user: user || null,
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

/**
 * @hook useAuth
 * @description Custom hook for accessing authentication context
 * @throws {Error} If used outside of AuthProvider
 * @returns {AuthContextType} Authentication context value
 * 
 * @example
 * ```tsx
 * function LoginButton() {
 *   const { loginMutation } = useAuth();
 *   
 *   const handleLogin = () => {
 *     loginMutation.mutate({ username: "user", password: "pass" });
 *   };
 *   
 *   return <button onClick={handleLogin}>Login</button>;
 * }
 * ```
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}