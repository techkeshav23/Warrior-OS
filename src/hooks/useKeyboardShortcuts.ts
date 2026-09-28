// ═══════════════════════════════════════════════════════════
// WARRIOR OS — useKeyboardShortcuts Hook
// Global keyboard shortcut handler
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useCallback } from 'react';

interface ShortcutMap {
  [key: string]: () => void;
}

const MODIFIER_KEYS: readonly string[] = ['control', 'shift', 'alt', 'meta'];

/**
 * Combo string for a key event: modifiers in the order ctrl, shift, alt,
 * then the lowercased key — "ctrl+k", "ctrl+shift+m", "ctrl+.", "f11".
 * Cmd counts as ctrl, so one binding covers macOS too. App registry
 * `shortcut` values use this same format. Returns '' for a bare modifier.
 */
export function shortcutCombo(e: KeyboardEvent): string {
  // Browser autofill can dispatch keydown events without a key.
  const key = typeof e.key === 'string' ? e.key.toLowerCase() : '';
  if (!key || MODIFIER_KEYS.includes(key)) return '';
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  parts.push(key);
  return parts.join('+');
}

/** Typing into a field: only Escape counts as a shortcut there. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Register global keyboard shortcuts
 * Key format: see shortcutCombo — "ctrl+k", "ctrl+shift+p", "f11", etc.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs (Escape still works)
      if (isTypingTarget(e.target) && e.key !== 'Escape') return;

      const combo = shortcutCombo(e);
      const handler = combo ? shortcuts[combo] : undefined;
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
