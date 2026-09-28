// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Desktop Widget Store
// Which desktop widgets are visible, where each one sits, and the
// daily question target. Persisted as 'warrior-os-widgets'.
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

export type WidgetId = 'clock' | 'streak' | 'target';

export const WIDGET_IDS: readonly WidgetId[] = ['clock', 'streak', 'target'];

export const WIDGET_LABELS: Record<WidgetId, string> = {
  clock: 'Clock',
  streak: 'Streak',
  target: "Today's target",
};

export interface WidgetPosition {
  x: number;
  y: number;
}

/** Daily question target bounds (a floor keeps the daily bonus honest). */
export const TARGET_MIN = 10;
export const TARGET_MAX = 200;
export const TARGET_STEP = 5;
export const TARGET_DEFAULT = 30;

interface WidgetStore {
  enabled: Record<WidgetId, boolean>;
  /** Top-left corner in viewport px. Missing → the widget's default slot. */
  positions: Partial<Record<WidgetId, WidgetPosition>>;
  /** Questions to solve per day for the "Today's target" widget */
  dailyQuestionTarget: number;
  /** UTC day key (YYYY-MM-DD) of the last "target crushed" celebration */
  lastCelebratedDay: string | null;

  setEnabled: (id: WidgetId, enabled: boolean) => void;
  toggleWidget: (id: WidgetId) => void;
  setPosition: (id: WidgetId, position: WidgetPosition) => void;
  resetPositions: () => void;
  setDailyQuestionTarget: (target: number) => void;
  markCelebrated: (dayKey: string) => void;
}

type PersistedWidgetState = Pick<
  WidgetStore,
  'enabled' | 'positions' | 'dailyQuestionTarget' | 'lastCelebratedDay'
>;

const DEFAULT_ENABLED: Record<WidgetId, boolean> = { clock: true, streak: true, target: true };

export function clampTarget(value: number): number {
  if (!Number.isFinite(value)) return TARGET_DEFAULT;
  const stepped = Math.round(value / TARGET_STEP) * TARGET_STEP;
  return Math.min(TARGET_MAX, Math.max(TARGET_MIN, stepped));
}

function isPosition(value: unknown): value is WidgetPosition {
  if (typeof value !== 'object' || value === null) return false;
  const { x, y } = value as Record<string, unknown>;
  return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y);
}

export const useWidgetStore = create<WidgetStore>()(
  persist(
    immer((set) => ({
      enabled: { ...DEFAULT_ENABLED },
      positions: {},
      dailyQuestionTarget: TARGET_DEFAULT,
      lastCelebratedDay: null,

      setEnabled: (id, enabled) =>
        set((s) => {
          s.enabled[id] = enabled;
        }),

      toggleWidget: (id) =>
        set((s) => {
          s.enabled[id] = !s.enabled[id];
        }),

      setPosition: (id, position) =>
        set((s) => {
          s.positions[id] = { x: Math.round(position.x), y: Math.round(position.y) };
        }),

      resetPositions: () =>
        set((s) => {
          s.positions = {};
        }),

      setDailyQuestionTarget: (target) =>
        set((s) => {
          s.dailyQuestionTarget = clampTarget(target);
        }),

      markCelebrated: (dayKey) =>
        set((s) => {
          s.lastCelebratedDay = dayKey;
        }),
    })),
    {
      name: 'warrior-os-widgets',
      partialize: (state): PersistedWidgetState => ({
        enabled: state.enabled,
        positions: state.positions,
        dailyQuestionTarget: state.dailyQuestionTarget,
        lastCelebratedDay: state.lastCelebratedDay,
      }),
      // Deep-merge so a widget added later defaults to "on", and drop any
      // malformed positions instead of rendering a widget at NaN.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PersistedWidgetState>;
        const enabled = { ...current.enabled };
        for (const id of WIDGET_IDS) {
          const flag = saved.enabled?.[id];
          if (typeof flag === 'boolean') enabled[id] = flag;
        }
        const positions: Partial<Record<WidgetId, WidgetPosition>> = {};
        for (const id of WIDGET_IDS) {
          const pos = saved.positions?.[id];
          if (isPosition(pos)) positions[id] = { x: pos.x, y: pos.y };
        }
        return {
          ...current,
          enabled,
          positions,
          dailyQuestionTarget:
            typeof saved.dailyQuestionTarget === 'number'
              ? clampTarget(saved.dailyQuestionTarget)
              : current.dailyQuestionTarget,
          lastCelebratedDay:
            typeof saved.lastCelebratedDay === 'string' ? saved.lastCelebratedDay : null,
        };
      },
    }
  )
);
