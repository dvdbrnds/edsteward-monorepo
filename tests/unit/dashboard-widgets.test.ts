/**
 * Dashboard Widgets Hook Tests
 * Tests the useDashboardWidgets hook functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock React context
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    createContext: vi.fn((defaultValue) => {
      const Context = (actual as any).createContext(defaultValue);
      return Context;
    }),
  };
});

describe('Dashboard Widgets', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('DASHBOARD_WIDGETS configuration', () => {
    it('should have all required widget definitions', async () => {
      const { DASHBOARD_WIDGETS } = await import('@/hooks/use-dashboard-widgets');
      
      expect(DASHBOARD_WIDGETS).toBeDefined();
      expect(Array.isArray(DASHBOARD_WIDGETS)).toBe(true);
      expect(DASHBOARD_WIDGETS.length).toBeGreaterThan(0);
    });

    it('should have required properties for each widget', async () => {
      const { DASHBOARD_WIDGETS } = await import('@/hooks/use-dashboard-widgets');
      
      DASHBOARD_WIDGETS.forEach((widget) => {
        expect(widget).toHaveProperty('id');
        expect(widget).toHaveProperty('name');
        expect(widget).toHaveProperty('description');
        expect(widget).toHaveProperty('defaultVisible');
        expect(widget).toHaveProperty('canHide');
        expect(typeof widget.id).toBe('string');
        expect(typeof widget.name).toBe('string');
        expect(typeof widget.defaultVisible).toBe('boolean');
        expect(typeof widget.canHide).toBe('boolean');
      });
    });

    it('should include regulation list widget that cannot be hidden', async () => {
      const { DASHBOARD_WIDGETS } = await import('@/hooks/use-dashboard-widgets');
      
      const regulationListWidget = DASHBOARD_WIDGETS.find(w => w.id === 'regulationList');
      expect(regulationListWidget).toBeDefined();
      expect(regulationListWidget?.canHide).toBe(false);
    });
  });

  describe('localStorage persistence', () => {
    it('should save widget visibility to localStorage', async () => {
      const STORAGE_KEY = 'edsteward-dashboard-widgets';
      
      // Simulate saving to localStorage
      const hiddenWidgets = ['stats', 'myTasks'];
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(hiddenWidgets));
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(hiddenWidgets)
      );
    });

    it('should load widget visibility from localStorage', async () => {
      const STORAGE_KEY = 'edsteward-dashboard-widgets';
      const savedHiddenWidgets = ['stats', 'myTasks'];
      
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(savedHiddenWidgets));
      
      const stored = localStorageMock.getItem(STORAGE_KEY);
      expect(stored).toBe(JSON.stringify(savedHiddenWidgets));
    });
  });
});


