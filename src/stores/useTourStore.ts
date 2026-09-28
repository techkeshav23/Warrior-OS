// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Guided Tour Store
// The first-visit NEXUS tour: whether it has run (persisted) and
// where it is right now (live). It starts on its own once, after the
// desktop settles, and never again once finished or skipped;
// `startTour()` replays it on demand (Settings → Replay tour).
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getVisitorMode, type VisitorMode } from '@/lib/visitor';

export type TourStatus = 'pending' | 'done' | 'skipped';

/**
 * localStorage key. Seeding it with
 * `{"state":{"status":"skipped"},"version":1}` keeps the tour away
 * (handy for e2e runs that don't want to click "Skip").
 */
export const TOUR_STORAGE_KEY = 'warrior-os-tour';

/** The tour stepped aside while the Ctrl+K command bar is open. */
export interface TourAside {
  /** Stop to show once the command bar closes. */
  resumeStep: number;
  /** When the tour stepped aside (epoch ms). */
  since: number;
  /** The command bar has actually been seen open since then. */
  seen: boolean;
}

interface TourPersisted {
  status: TourStatus;
}

interface TourState extends TourPersisted {
  // ─── Live (not persisted) ───
  /** The tour is running: on screen, or stepped aside for the command bar. */
  active: boolean;
  /** Current stop (0-based). */
  step: number;
  /** Who is visiting, captured when the tour starts. */
  mode: VisitorMode | null;
  aside: TourAside | null;

  // ─── Actions ───
  /** Start (or replay) from the first stop. */
  startTour: () => void;
  /** Start only if the tour has never been finished or skipped. */
  autoStart: () => void;
  goTo: (step: number) => void;
  /** Completed the last stop. */
  finish: () => void;
  /** Skip button / Esc. */
  skip: () => void;
  /** Hide while the command bar is open; `resume()` shows `resumeStep`. */
  stepAside: (resumeStep: number) => void;
  markAsideSeen: () => void;
  resume: () => void;
}

export const useTourStore = create<TourState>()(
  persist(
    (set, get) => ({
      status: 'pending',
      active: false,
      step: 0,
      mode: null,
      aside: null,

      startTour: () => set({ active: true, step: 0, aside: null, mode: getVisitorMode() }),

      autoStart: () => {
        const { status, active, startTour } = get();
        if (status === 'pending' && !active) startTour();
      },

      goTo: (step) => set({ step: Math.max(0, Math.round(step)) }),

      finish: () => set({ active: false, aside: null, status: 'done' }),

      // A replay that gets skipped doesn't undo an earlier full run.
      skip: () =>
        set((s) => ({ active: false, aside: null, status: s.status === 'done' ? 'done' : 'skipped' })),

      stepAside: (resumeStep) => {
        const { active, aside } = get();
        if (!active || aside) return;
        set({ aside: { resumeStep, since: Date.now(), seen: false } });
      },

      markAsideSeen: () => {
        const { aside } = get();
        if (aside && !aside.seen) set({ aside: { ...aside, seen: true } });
      },

      resume: () => {
        const { aside } = get();
        if (aside) set({ aside: null, step: aside.resumeStep });
      },
    }),
    {
      name: TOUR_STORAGE_KEY,
      version: 1,
      partialize: (s): TourPersisted => ({ status: s.status }),
    }
  )
);
