/**
 * Keyboard Shortcuts Hook
 * Provides global keyboard shortcuts for power users
 */

import { useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';

interface ShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
}

// Define all available shortcuts
export const SHORTCUTS: ShortcutConfig[] = [
  {
    key: 'g',
    altKey: true,
    action: () => {}, // Will be set dynamically
    description: 'Go to Dashboard',
  },
  {
    key: 'a',
    altKey: true,
    action: () => {},
    description: 'Go to Analytics',
  },
  {
    key: 'n',
    altKey: true,
    action: () => {},
    description: 'Go to Notifications',
  },
  {
    key: 's',
    altKey: true,
    action: () => {},
    description: 'Go to Settings',
  },
  {
    key: '/',
    action: () => {},
    description: 'Focus Search',
  },
  {
    key: '?',
    shiftKey: true,
    action: () => {},
    description: 'Show Keyboard Shortcuts',
  },
  {
    key: 'Escape',
    action: () => {},
    description: 'Close Dialog/Modal',
  },
];

export function useKeyboardShortcuts(onShowHelp?: () => void) {
  const [, navigate] = useLocation();

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Only allow Escape in input fields
      if (event.key !== 'Escape') {
        return;
      }
    }

    // Navigation shortcuts (Alt + key)
    if (event.altKey && !event.ctrlKey && !event.metaKey) {
      switch (event.key.toLowerCase()) {
        case 'g':
          event.preventDefault();
          navigate('/');
          break;
        case 'a':
          event.preventDefault();
          navigate('/analytics');
          break;
        case 'n':
          event.preventDefault();
          navigate('/notifications');
          break;
        case 's':
          event.preventDefault();
          navigate('/admin/settings');
          break;
        case 'u':
          event.preventDefault();
          navigate('/regulations/updates');
          break;
        case 't':
          event.preventDefault();
          navigate('/audit-trail');
          break;
      }
      return;
    }

    // Search shortcut (just /)
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
      return;
    }

    // Help shortcut (?)
    if (event.key === '?' && event.shiftKey) {
      event.preventDefault();
      onShowHelp?.();
      return;
    }

    // Escape - close modals/dialogs
    if (event.key === 'Escape') {
      // Try to find and click close buttons on dialogs
      const closeButton = document.querySelector('[data-state="open"] button[aria-label="Close"]') as HTMLButtonElement;
      if (closeButton) {
        closeButton.click();
      }
      // Also blur any focused element
      (document.activeElement as HTMLElement)?.blur?.();
    }
  }, [navigate, onShowHelp]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Exportable shortcut info for help display
export const SHORTCUT_GROUPS = [
  {
    name: 'Navigation',
    shortcuts: [
      { keys: ['Alt', 'G'], description: 'Go to Dashboard' },
      { keys: ['Alt', 'A'], description: 'Go to Analytics' },
      { keys: ['Alt', 'N'], description: 'Go to Notifications' },
      { keys: ['Alt', 'S'], description: 'Go to Settings' },
      { keys: ['Alt', 'U'], description: 'Go to Updates' },
      { keys: ['Alt', 'T'], description: 'Go to Audit Trail' },
    ],
  },
  {
    name: 'Actions',
    shortcuts: [
      { keys: ['/'], description: 'Focus Search' },
      { keys: ['Esc'], description: 'Close Dialog / Unfocus' },
      { keys: ['?'], description: 'Show Keyboard Shortcuts' },
    ],
  },
];

