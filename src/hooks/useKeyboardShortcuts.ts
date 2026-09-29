// ═══════════════════════════════════════════════════════════
// WARRIOR OS — useKeyboardShortcuts Hook
// Global keyboard shortcut handler
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef } from 'react';

/**
 * A handler may return `false` to say it did nothing (e.g. Escape with no
 * overlay open): the event is then left alone for other listeners.
 */
interface ShortcutMap {
  [key: string]: () => unknown;
}

const MODIFIER_KEYS: readonly string[] = ['control', 'shift', 'alt', 'meta'];

/**
 * Combo string for a key event: modifiers in the order ctrl, shift, alt,
 * then the lowercased key — "ctrl+k", "ctrl+shift+m", "ctrl+.", "f11",
 * "ctrl+alt+w" (next wallpaper), "ctrl+shift+alt+w" (previous).
 * Cmd counts as ctrl, so one binding covers macOS too. App registry
 * `shortcut` values use this same format. Returns '' for a bare modifier.
 */
export function shortcutCombo(e: KeyboardEvent): string {
  // Browser autofill can dispatch keydown events without a key.
  let key = typeof e.key === 'string' ? e.key.toLowerCase() : '';
  if (!key || MODIFIER_KEYS.includes(key)) return '';
  // Alt (Option on macOS) turns letters into symbols (Option+W = "∑"), so
  // with Alt held a letter key is named by its physical key: "ctrl+alt+w".
  if (e.altKey && typeof e.code === 'string' && /^Key[A-Z]$/.test(e.code)) key = e.code.slice(3).toLowerCase();
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
  // One listener for the component's lifetime, reading the latest map: it
  // stays ahead of listeners that overlays add later (so a page-level
  // Escape sees the overlay it closes), and callers can pass a fresh map
  // each render.
  const shortcutsRef = useRef(shortcuts);
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs (Escape still works)
      if (isTypingTarget(e.target) && e.key !== 'Escape') return;

      const combo = shortcutCombo(e);
      const handler = combo ? shortcutsRef.current[combo] : undefined;
      if (handler && handler() !== false) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}
