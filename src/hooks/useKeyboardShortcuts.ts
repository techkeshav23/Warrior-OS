// ═══════════════════════════════════════════════════════════
// WARRIOR OS — useKeyboardShortcuts Hook
// Global keyboard shortcut handler
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useCallback } from 'react';

interface ShortcutMap {
  [key: string]: () => void;
}

/**
 * Register global keyboard shortcuts
 * Key format: "ctrl+k", "ctrl+shift+p", "f11", etc.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        // Allow Escape in inputs
        if (e.key !== 'Escape') return;
      }

      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push('ctrl');
      if (e.shiftKey) parts.push('shift');
      if (e.altKey) parts.push('alt');

      const key = e.key.toLowerCase();
      if (!['control', 'shift', 'alt', 'meta'].includes(key)) {
        parts.push(key);
      }

      const combo = parts.join('+');
      const handler = shortcuts[combo];
      if (handler) {
        e.preventDefault();
        e.stopPropagation();
        handler();
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
