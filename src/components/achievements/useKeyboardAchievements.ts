// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Keyboard Achievements
// Power User (Ctrl+K), Keyboard Warrior (every global shortcut)
// and the Konami code easter egg
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { unlock } from './award';
import { useAchievementProgressStore } from './progress-store';
import { sendPendingEvent } from './pending-events';

/** The global shortcuts page.tsx binds, in useKeyboardShortcuts' combo format. */
export const GLOBAL_SHORTCUTS: readonly string[] = ['ctrl+k', 'ctrl+1', 'ctrl+2', 'ctrl+3'];

const COMMAND_PALETTE_COMBO = 'ctrl+k';

const MODIFIER_KEYS: readonly string[] = ['control', 'shift', 'alt', 'meta'];

export const KONAMI_SEQUENCE: readonly string[] = [
  'arrowup',
  'arrowup',
  'arrowdown',
  'arrowdown',
  'arrowleft',
  'arrowright',
  'arrowleft',
  'arrowright',
  'b',
  'a',
];

/** Browser autofill can dispatch keydown events without a key. */
function keyOf(e: KeyboardEvent): string {
  return typeof e.key === 'string' ? e.key.toLowerCase() : '';
}

/** Same format as useKeyboardShortcuts: ctrl (or meta), shift, alt, then the key. */
function comboFromEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  const key = keyOf(e);
  if (!MODIFIER_KEYS.includes(key)) parts.push(key);
  return parts.join('+');
}

/** useKeyboardShortcuts ignores shortcuts typed into fields, so these don't count either. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.contentEditable === 'true'
  );
}

/** Mount once (from AchievementTriggers). */
export function useKeyboardAchievements(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let recentKeys: string[] = [];

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = keyOf(e);
      if (!key || MODIFIER_KEYS.includes(key)) return;

      // Konami code — anywhere on the desktop, even while a field has focus.
      recentKeys = [...recentKeys, key].slice(-KONAMI_SEQUENCE.length);
      if (
        recentKeys.length === KONAMI_SEQUENCE.length &&
        recentKeys.every((k, i) => k === KONAMI_SEQUENCE[i])
      ) {
        recentKeys = [];
        if (unlock('easter-egg')) {
          sendPendingEvent('warrior:nexus-say', {
            text: 'Konami code accepted. Old-school warrior detected.',
            tone: 'success',
          });
        }
      }

      // Global shortcuts — captured before page.tsx's handler, same rules as it.
      if (isTypingTarget(e.target)) return;
      const combo = comboFromEvent(e);
      if (!GLOBAL_SHORTCUTS.includes(combo)) return;
      if (combo === COMMAND_PALETTE_COMBO) unlock('command-palette');
      useAchievementProgressStore.getState().addShortcutUsed(combo);
      const used = useAchievementProgressStore.getState().shortcutsUsed;
      if (GLOBAL_SHORTCUTS.every((c) => used.includes(c))) unlock('shortcut-master');
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);
}
