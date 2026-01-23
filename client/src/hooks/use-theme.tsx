/**
 * Theme Provider and Hook
 * Manages dark/light mode with localStorage persistence
 * 
 * FIXED: Uses direct DOM manipulation + event-based sync instead of React context
 * to avoid context isolation issues during HMR and component mounting
 */

import React, { useEffect, useState, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

const THEME_KEY = 'edsteward-theme';
const THEME_CHANGE_EVENT = 'edsteward-theme-change';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function getStoredTheme(): Theme {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(THEME_KEY) as Theme | null;
    return stored || 'system';
  }
  return 'system';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
}

function applyThemeToDOM(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  if (resolved === 'dark') {
    root.classList.add('dark');
  }
}

// Apply theme immediately on script load (before React hydrates)
if (typeof window !== 'undefined') {
  const initialTheme = getStoredTheme();
  const resolved = resolveTheme(initialTheme);
  applyThemeToDOM(resolved);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Apply theme on mount
  useEffect(() => {
    const theme = getStoredTheme();
    const resolved = resolveTheme(theme);
    applyThemeToDOM(resolved);
  }, []);

  // Listen for system theme changes when in system mode
  useEffect(() => {
    const theme = getStoredTheme();
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      applyThemeToDOM(e.matches ? 'dark' : 'light');
      window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return <>{children}</>;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => resolveTheme(getStoredTheme()));

  // Sync state when theme changes (from other components or tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_KEY) {
        const newTheme = (e.newValue as Theme) || 'system';
        setThemeState(newTheme);
        setResolvedTheme(resolveTheme(newTheme));
      }
    };

    const handleThemeChange = () => {
      const newTheme = getStoredTheme();
      setThemeState(newTheme);
      setResolvedTheme(resolveTheme(newTheme));
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    };
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    console.log('[Theme] setTheme called:', newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
    setThemeState(newTheme);
    const resolved = resolveTheme(newTheme);
    setResolvedTheme(resolved);
    applyThemeToDOM(resolved);
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
  }, []);

  const toggleTheme = useCallback(() => {
    const currentResolved = resolveTheme(getStoredTheme());
    const newTheme = currentResolved === 'light' ? 'dark' : 'light';
    console.log('[Theme] toggleTheme called! Current:', currentResolved, '-> New:', newTheme);
    setTheme(newTheme);
  }, [setTheme]);

  return { theme, resolvedTheme, setTheme, toggleTheme };
}

export default ThemeProvider;
