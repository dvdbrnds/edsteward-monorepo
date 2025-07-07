import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    vi.stubEnv('VITE_API_URL', 'https://api.example.com');
    vi.stubEnv('VITE_TENANT_ID', 'test-tenant');
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useAuth());
    
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBe(null);
  });

  it('should login successfully', async () => {
    const mockUser = { id: '1', username: 'testuser' };
    const mockTokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
    };

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        user: mockUser,
        ...mockTokens,
      }),
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login({ username: 'testuser', password: 'password' });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'auth_user',
      JSON.stringify(mockUser)
    );
  });

  it('should handle login failure', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('Invalid credentials'),
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      try {
        await result.current.login({ username: 'testuser', password: 'wrong' });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should logout successfully', async () => {
    // First login
    const mockUser = { id: '1', username: 'testuser' };
    mockLocalStorage.getItem
      .mockReturnValueOnce(JSON.stringify(mockUser))
      .mockReturnValueOnce(JSON.stringify({
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: Date.now() + 3600000,
      }));

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBe(null);
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_user');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_tokens');
  });

  it('should refresh token when needed', async () => {
    const mockUser = { id: '1', username: 'testuser' };
    const expiredTokens = {
      accessToken: 'old-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() - 1000, // Expired
    };

    mockLocalStorage.getItem
      .mockReturnValueOnce(JSON.stringify(mockUser))
      .mockReturnValueOnce(JSON.stringify(expiredTokens));

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        user: mockUser,
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
        expiresIn: 3600,
      }),
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    const token = await result.current.getToken();
    expect(token).toBe('new-token');
  });
});