// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Study Keys
// Keyboard for a card session, scoped to its own window: Space
// flips, 1-4 rate the recall (Again / Hard / Good / Easy), plus
// optional single-key extras. Keys are read from the session's
// root element, so two open study windows never both react.
// ═══════════════════════════════════════════════════════════

'use client';

import { useCallback, useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
import type { ReviewGrade } from '@/types/learning';

const GRADE_KEYS: Readonly<Record<string, ReviewGrade>> = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };

export interface StudyKeyHandlers {
  onFlip: () => void;
  onGrade: (grade: ReviewGrade) => void;
  /** Extra keys by lower-case `event.key`, e.g. { s: shuffle, arrowright: skip }. */
  extra?: Readonly<Record<string, () => void>>;
}

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Put the returned handlers on the session root (`rootRef`, with
 * tabIndex={-1}). Whenever `focusKey` changes (next card, flip) and the
 * control that had focus is gone (focus fell back to <body>), focus
 * returns to the root so the keys keep working. Pass null while no
 * session runs.
 */
export function useStudyKeys(
  rootRef: RefObject<HTMLDivElement | null>,
  handlers: StudyKeyHandlers,
  focusKey: string | null
) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (focusKey === null) return;
    const active = document.activeElement;
    if (!active || active === document.body) rootRef.current?.focus({ preventScroll: true });
  }, [focusKey, rootRef]);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey || isTextField(event.target)) return;
    const current = handlersRef.current;
    const key = event.key;
    if (key === ' ' || key === 'Spacebar') {
      // Space always flips, even on a focused button (its keyup click is cancelled below).
      event.preventDefault();
      if (!event.repeat) current.onFlip();
      return;
    }
    if (key === 'Enter' && (event.target === event.currentTarget || (event.target as HTMLElement).dataset?.flipCard)) {
      event.preventDefault();
      current.onFlip();
      return;
    }
    const grade = GRADE_KEYS[key];
    if (grade) {
      event.preventDefault();
      if (!event.repeat) current.onGrade(grade);
      return;
    }
    const extra = current.extra?.[key.toLowerCase()];
    if (extra) {
      event.preventDefault();
      if (!event.repeat) extra();
    }
  }, []);

  const onKeyUp = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.key === ' ' || event.key === 'Spacebar') && !isTextField(event.target)) event.preventDefault();
  }, []);

  return { onKeyDown, onKeyUp };
}
