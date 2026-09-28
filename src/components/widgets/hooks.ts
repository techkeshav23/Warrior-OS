// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Widget Hooks
// Small, lint-safe subscriptions the desktop widgets share:
// a second-aligned clock, the viewport size, and a live view of
// Habit Forge's localStorage data (same-tab writes fire no
// `storage` event, so it is re-read on a short poll).
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { HABITS_STORAGE_KEY, parseHabits, type HabitSnapshot } from './widget-data';

// ─── Clock ───

/** Current epoch ms, re-rendering on each `intervalMs` boundary. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      // Align to the boundary so a seconds display never lags by ~1s.
      timer = window.setTimeout(tick, intervalMs - (Date.now() % intervalMs) + 5);
    };
    const tick = () => {
      setNow(Date.now());
      schedule();
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [intervalMs]);

  return now;
}

// ─── Client-only gate ───

const noopSubscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * False during SSR and hydration, true afterwards. Lets widgets that
 * show live values (time, localStorage) skip the server render without
 * a setState-in-effect "mounted" flag.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, onClient, onServer);
}

// ─── Viewport ───

function subscribeResize(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

const readWidth = () => window.innerWidth;
const readHeight = () => window.innerHeight;
const serverWidth = () => 1280;
const serverHeight = () => 800;

export function useViewportSize(): { width: number; height: number } {
  const width = useSyncExternalStore(subscribeResize, readWidth, serverWidth);
  const height = useSyncExternalStore(subscribeResize, readHeight, serverHeight);
  return { width, height };
}

// ─── Habit Forge data ───

const HABIT_POLL_MS = 4000;

function subscribeHabits(onChange: () => void): () => void {
  const poll = window.setInterval(onChange, HABIT_POLL_MS);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === HABITS_STORAGE_KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener('focus', onChange);
  document.addEventListener('visibilitychange', onChange);
  return () => {
    window.clearInterval(poll);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('focus', onChange);
    document.removeEventListener('visibilitychange', onChange);
  };
}

function readHabitsRaw(): string | null {
  try {
    return window.localStorage.getItem(HABITS_STORAGE_KEY);
  } catch {
    return null;
  }
}

const serverHabitsRaw = () => null;

/** Habit Forge's habits, kept fresh within a few seconds of any change. */
export function useHabits(): HabitSnapshot[] {
  // The raw string is the snapshot: equal strings mean no re-render.
  const raw = useSyncExternalStore(subscribeHabits, readHabitsRaw, serverHabitsRaw);
  return useMemo(() => parseHabits(raw), [raw]);
}
