// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Effects Store
// Persisted toggles for the cinematic layers + the live queue that
// plays achievement and level-up celebrations one at a time
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import type { Achievement } from '@/types/achievement';
import { useOSStore } from '@/stores/useOSStore';

export interface AchievementCelebration {
  kind: 'achievement';
  key: string;
  achievement: Achievement;
}

export interface LevelUpCelebration {
  kind: 'levelup';
  key: string;
  fromLevel: number;
  toLevel: number;
  fromXP: number;
  toXP: number;
}

export type Celebration = AchievementCelebration | LevelUpCelebration;

/** Pause between two queued celebrations so each reads as its own beat. */
export const CELEBRATION_GAP_MS = 450;
/** Wait after the desktop appears (lets the unlock shatter finish) before celebrating. */
export const DESKTOP_SETTLE_MS = 1700;

interface EffectsState {
  // ─── Settings (persisted) ───
  /** Full-screen unlock cinematic; off (or reduced motion) → compact toast. */
  achievementCinematic: boolean;
  /** Level-up fill/flash/number burst; off (or reduced motion) → toast. */
  levelUpEffect: boolean;
  /** Pixel-block window close. Off by default: it overlaps Phantom Windows. */
  disintegrateOnClose: boolean;

  // ─── Live queue (not persisted) ───
  queue: Celebration[];
  current: Celebration | null;

  // Settings actions
  toggleAchievementCinematic: () => void;
  setAchievementCinematic: (on: boolean) => void;
  toggleLevelUpEffect: () => void;
  setLevelUpEffect: (on: boolean) => void;
  toggleDisintegrateOnClose: () => void;
  setDisintegrateOnClose: (on: boolean) => void;

  // Queue actions
  enqueueCelebration: (celebration: Celebration) => void;
  /** Starts the next queued celebration when idle, on the desktop and past any hold. */
  advanceCelebration: () => void;
  /** Ends `key` if it is the one on screen, then advances after a short gap. */
  finishCelebration: (key: string) => void;
}

let advanceTimer: ReturnType<typeof setTimeout> | null = null;
let nextAllowedAt = 0;

function scheduleAdvance(delayMs: number): void {
  if (typeof window === 'undefined') return;
  if (advanceTimer !== null) clearTimeout(advanceTimer);
  advanceTimer = setTimeout(() => {
    advanceTimer = null;
    useEffectsStore.getState().advanceCelebration();
  }, Math.max(0, delayMs));
}

/** Keep celebrations off screen for at least `ms` (e.g. while a phase transition plays). */
export function holdCelebrations(ms: number): void {
  nextAllowedAt = Math.max(nextAllowedAt, Date.now() + ms);
  scheduleAdvance(ms);
}

export const useEffectsStore = create<EffectsState>()(
  persist(
    immer((set, get) => ({
      achievementCinematic: true,
      levelUpEffect: true,
      disintegrateOnClose: false,

      queue: [],
      current: null,

      toggleAchievementCinematic: () =>
        set((s) => {
          s.achievementCinematic = !s.achievementCinematic;
        }),
      setAchievementCinematic: (on) =>
        set((s) => {
          s.achievementCinematic = on;
        }),
      toggleLevelUpEffect: () =>
        set((s) => {
          s.levelUpEffect = !s.levelUpEffect;
        }),
      setLevelUpEffect: (on) =>
        set((s) => {
          s.levelUpEffect = on;
        }),
      toggleDisintegrateOnClose: () =>
        set((s) => {
          s.disintegrateOnClose = !s.disintegrateOnClose;
        }),
      setDisintegrateOnClose: (on) =>
        set((s) => {
          s.disintegrateOnClose = on;
        }),

      enqueueCelebration: (celebration) => {
        set((s) => {
          if (s.current?.key === celebration.key) return;
          if (s.queue.some((q) => q.key === celebration.key)) return;
          if (celebration.kind === 'levelup') {
            // Fold consecutive waiting level-ups into one "Lv.a → Lv.b" beat.
            const pending = s.queue.find((q) => q.kind === 'levelup');
            if (pending && pending.kind === 'levelup') {
              pending.toLevel = Math.max(pending.toLevel, celebration.toLevel);
              pending.toXP = celebration.toXP;
              return;
            }
          }
          s.queue.push(celebration);
        });
        // Deferred so unlocks that land in the same tick are all queued before
        // one is picked (achievements go first: they usually cause the level-up).
        scheduleAdvance(0);
      },

      advanceCelebration: () => {
        const { current, queue } = get();
        if (current || queue.length === 0) return;
        // Celebrations only play on the desktop; entering it re-triggers this.
        if (useOSStore.getState().phase !== 'desktop') return;
        const wait = nextAllowedAt - Date.now();
        if (wait > 0) {
          scheduleAdvance(wait);
          return;
        }
        const achievementIndex = queue.findIndex((q) => q.kind === 'achievement');
        const index = achievementIndex >= 0 ? achievementIndex : 0;
        const next = queue[index];
        set((s) => {
          s.current = next;
          s.queue.splice(index, 1);
        });
      },

      finishCelebration: (key) => {
        if (get().current?.key !== key) return;
        set((s) => {
          s.current = null;
        });
        nextAllowedAt = Math.max(nextAllowedAt, Date.now() + CELEBRATION_GAP_MS);
        scheduleAdvance(CELEBRATION_GAP_MS);
      },
    })),
    {
      name: 'warrior-os-effects',
      partialize: (state) => ({
        achievementCinematic: state.achievementCinematic,
        levelUpEffect: state.levelUpEffect,
        disintegrateOnClose: state.disintegrateOnClose,
      }),
    }
  )
);
