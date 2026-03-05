import { apiClient } from './client';
import type { User, InsertUser } from '@shared/schema';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData extends InsertUser {
  password: string;
}

export interface AuthResponse {
  user: User;
  token?: string;
}

class AuthApi {
  // Login user
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/login', credentials);
  }

  // Register new user
  async register(data: RegisterData): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/register', data);
  }

  // Logout user
  async logout(): Promise<void> {
    return apiClient.post<void>('/auth/logout');
  }

  // Get current user
  async getCurrentUser(): Promise<User> {
    return apiClient.get<User>('/auth/me');
  }

  // Update user profile
  async updateProfile(data: Partial<User>): Promise<User> {
    return apiClient.put<User>('/auth/profile', data);
  }

  // Change password
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    return apiClient.post<void>('/auth/change-password', {
      oldPassword,
      newPassword
    });
  }

  // Request password reset
  async requestPasswordReset(email: string): Promise<void> {
    return apiClient.post<void>('/auth/reset-password', { email });
  }

  // Reset password with token
  async resetPassword(token: string, newPassword: string): Promise<void> {
    return apiClient.post<void>('/auth/reset-password/confirm', {
      token,
      newPassword
    });
  }

  // Verify session
  async verifySession(): Promise<{ valid: boolean; user?: User }> {
    try {
      const user = await this.getCurrentUser();
      return { valid: true, user };
    } catch {
      return { valid: false };
    }
  }
}

export const authApi = new AuthApi(); 