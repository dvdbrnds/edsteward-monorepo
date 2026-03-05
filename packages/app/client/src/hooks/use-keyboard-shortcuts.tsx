/**
 * Keyboard Shortcuts Hook
 * Provides global keyboard shortcuts for power users
 * Cross-platform: Uses ⌘ (Command) on Mac, Ctrl on Windows/Linux
 */

import { useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';

// Detect if user is on Mac
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

// Get the modifier key symbol based on platform
export const getModifierSymbol = () => isMac ? '⌘' : 'Ctrl';

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
    metaKey: isMac,
    ctrlKey: !isMac,
    action: () => {},
    description: 'Go to Dashboard',
  },
  {
    key: 'a',
    metaKey: isMac,
    ctrlKey: !isMac,
    shiftKey: true,
    action: () => {},
    description: 'Go to Analytics',
  },
  {
    key: 'n',
    metaKey: isMac,
    ctrlKey: !isMac,
    shiftKey: true,
    action: () => {},
    description: 'Go to Notifications',
  },
  {
    key: 's',
    metaKey: isMac,
    ctrlKey: !isMac,
    shiftKey: true,
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

    // Check for modifier key (Command on Mac, Ctrl on Windows/Linux)
    const hasModifier = isMac ? event.metaKey : event.ctrlKey;
    
    // Navigation shortcuts (Cmd/Ctrl + key)
    if (hasModifier && !event.altKey) {
      const key = event.key.toLowerCase();
      
      // Cmd/Ctrl + G - Dashboard
      if (key === 'g' && !event.shiftKey) {
        event.preventDefault();
        navigate('/');
        return;
      }
      
      // Cmd/Ctrl + Shift + A - Analytics
      if (key === 'a' && event.shiftKey) {
        event.preventDefault();
        navigate('/analytics');
        return;
      }
      
      // Cmd/Ctrl + Shift + N - Notifications
      if (key === 'n' && event.shiftKey) {
        event.preventDefault();
        navigate('/notifications');
        return;
      }
      
      // Cmd/Ctrl + Shift + S - Settings (using Shift to avoid browser save)
      if (key === 's' && event.shiftKey) {
        event.preventDefault();
        navigate('/admin/settings');
        return;
      }
      
      // Cmd/Ctrl + U - Updates
      if (key === 'u' && !event.shiftKey) {
        event.preventDefault();
        navigate('/regulations/updates');
        return;
      }
      
      // Cmd/Ctrl + Shift + T - Audit Trail (using Shift to avoid browser reopen tab)
      if (key === 't' && event.shiftKey) {
        event.preventDefault();
        navigate('/audit-trail');
        return;
      }
      
      // Cmd/Ctrl + R - Regulations (using R to avoid conflict)
      if (key === 'r' && event.shiftKey) {
        event.preventDefault();
        navigate('/regulations');
        return;
      }
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

// Exportable shortcut info for help display - dynamically uses correct modifier
export const SHORTCUT_GROUPS = [
  {
    name: 'Navigation',
    shortcuts: [
      { keys: [getModifierSymbol(), 'G'], description: 'Go to Dashboard' },
      { keys: [getModifierSymbol(), 'Shift', 'R'], description: 'Go to Regulations' },
      { keys: [getModifierSymbol(), 'Shift', 'A'], description: 'Go to Analytics' },
      { keys: [getModifierSymbol(), 'Shift', 'N'], description: 'Go to Notifications' },
      { keys: [getModifierSymbol(), 'Shift', 'S'], description: 'Go to Settings' },
      { keys: [getModifierSymbol(), 'U'], description: 'Go to Updates' },
      { keys: [getModifierSymbol(), 'Shift', 'T'], description: 'Go to Audit Trail' },
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
