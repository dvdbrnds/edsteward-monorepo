import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, type LoginCredentials, type RegisterData } from '../../lib/api/auth';
import type { User } from '@shared/schema';

// Query keys for auth
export const authKeys = {
  all: ['auth'] as const,
  user: () => [...authKeys.all, 'user'] as const,
  session: () => [...authKeys.all, 'session'] as const,
};

// Hook for getting current user
export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.user(),
    queryFn: () => authApi.getCurrentUser(),
    retry: false, // Don't retry on auth failures
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook for session verification
export function useSession() {
  return useQuery({
    queryKey: authKeys.session(),
    queryFn: () => authApi.verifySession(),
    retry: false,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Hook for login
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: (data) => {
      // Update user cache
      queryClient.setQueryData(authKeys.user(), data.user);
      queryClient.setQueryData(authKeys.session(), { valid: true, user: data.user });
      
      // Invalidate all queries to refetch with new auth
      queryClient.invalidateQueries();
    },
  });
}

// Hook for registration
export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RegisterData) => authApi.register(data),
    onSuccess: (data) => {
      // Update user cache
      queryClient.setQueryData(authKeys.user(), data.user);
      queryClient.setQueryData(authKeys.session(), { valid: true, user: data.user });
      
      // Invalidate all queries to refetch with new auth
      queryClient.invalidateQueries();
    },
  });
}

// Hook for logout
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
      
      // Set session as invalid
      queryClient.setQueryData(authKeys.session(), { valid: false });
    },
  });
}

// Hook for updating profile
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<User>) => authApi.updateProfile(data),
    onSuccess: (updatedUser) => {
      // Update user cache
      queryClient.setQueryData(authKeys.user(), updatedUser);
      queryClient.setQueryData(authKeys.session(), { valid: true, user: updatedUser });
    },
  });
}

// Hook for changing password
export function useChangePassword() {
  return useMutation({
    mutationFn: ({ oldPassword, newPassword }: { oldPassword: string; newPassword: string }) =>
      authApi.changePassword(oldPassword, newPassword),
  });
}

// Hook for password reset request
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (email: string) => authApi.requestPasswordReset(email),
  });
}

// Hook for password reset confirmation
export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      authApi.resetPassword(token, newPassword),
  });
} 