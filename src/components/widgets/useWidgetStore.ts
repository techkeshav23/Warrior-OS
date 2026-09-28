// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Desktop Widget Store
// Which desktop widgets are visible, where each one sits, and the
// daily goal (review N cards or focus N minutes). Persisted as
// 'warrior-os-widgets'.
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

export type WidgetId = 'clock' | 'streak' | 'target';

export const WIDGET_IDS: readonly WidgetId[] = ['clock', 'streak', 'target'];

export const WIDGET_LABELS: Record<WidgetId, string> = {
  clock: 'Clock',
  streak: 'Streak',
  target: 'Daily goal',
};

export interface WidgetPosition {
  x: number;
  y: number;
}

// ─── Daily goal ───

/** What the daily goal counts: cards answered, or focused minutes. */
export type DailyGoalKind = 'cards' | 'focus';

export const DAILY_GOAL_KINDS: readonly DailyGoalKind[] = ['cards', 'focus'];

export interface DailyGoalSpec {
  /** Verb before the number, e.g. "Review". */
  verb: string;
  /** Unit after the number, e.g. "cards". */
  unit: string;
  /** Compact unit for tight spots, e.g. "min". */
  shortUnit: string;
  /** Floor that keeps the daily bonus honest. */
  min: number;
  max: number;
  step: number;
  defaultTarget: number;
}

export const DAILY_GOALS: Record<DailyGoalKind, DailyGoalSpec> = {
  cards: { verb: 'Review', unit: 'cards', shortUnit: 'cards', min: 10, max: 300, step: 5, defaultTarget: 30 },
  focus: { verb: 'Focus', unit: 'minutes', shortUnit: 'min', min: 15, max: 480, step: 15, defaultTarget: 60 },
};

interface WidgetStore {
  enabled: Record<WidgetId, boolean>;
  /** Top-left corner in viewport px. Missing → the widget's default slot. */
  positions: Partial<Record<WidgetId, WidgetPosition>>;
  /** What the "Daily goal" widget counts. */
  dailyGoalKind: DailyGoalKind;
  /** Daily target per goal kind (each kind keeps its own). */
  dailyGoalTargets: Record<DailyGoalKind, number>;
  /** UTC day key (YYYY-MM-DD) of the last "goal crushed" celebration */
  lastCelebratedDay: string | null;

  setEnabled: (id: WidgetId, enabled: boolean) => void;
  toggleWidget: (id: WidgetId) => void;
  setPosition: (id: WidgetId, position: WidgetPosition) => void;
  resetPositions: () => void;
  setDailyGoalKind: (kind: DailyGoalKind) => void;
  setDailyGoalTarget: (kind: DailyGoalKind, target: number) => void;
  markCelebrated: (dayKey: string) => void;
}

type PersistedWidgetState = Pick<
  WidgetStore,
  'enabled' | 'positions' | 'dailyGoalKind' | 'dailyGoalTargets' | 'lastCelebratedDay'
>;

/** Saves written before daily goal kinds existed kept one question target. */
type LegacyWidgetState = Partial<PersistedWidgetState> & { dailyQuestionTarget?: unknown };

const DEFAULT_ENABLED: Record<WidgetId, boolean> = { clock: true, streak: true, target: true };

function defaultTargets(): Record<DailyGoalKind, number> {
  return { cards: DAILY_GOALS.cards.defaultTarget, focus: DAILY_GOALS.focus.defaultTarget };
}

export function isDailyGoalKind(value: unknown): value is DailyGoalKind {
  return typeof value === 'string' && (DAILY_GOAL_KINDS as readonly string[]).includes(value);
}

/** Snap a target to its kind's step and bounds. */
export function clampGoalTarget(kind: DailyGoalKind, value: number): number {
  const spec = DAILY_GOALS[kind];
  if (!Number.isFinite(value)) return spec.defaultTarget;
  const stepped = Math.round(value / spec.step) * spec.step;
  return Math.min(spec.max, Math.max(spec.min, stepped));
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
      dailyGoalKind: 'cards',
      dailyGoalTargets: defaultTargets(),
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

      setDailyGoalKind: (kind) =>
        set((s) => {
          if (isDailyGoalKind(kind)) s.dailyGoalKind = kind;
        }),

      setDailyGoalTarget: (kind, target) =>
        set((s) => {
          if (isDailyGoalKind(kind)) s.dailyGoalTargets[kind] = clampGoalTarget(kind, target);
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
        dailyGoalKind: state.dailyGoalKind,
        dailyGoalTargets: state.dailyGoalTargets,
        lastCelebratedDay: state.lastCelebratedDay,
      }),
      // Deep-merge so a widget added later defaults to "on", drop any
      // malformed positions instead of rendering a widget at NaN, and
      // carry an old question target over as the card goal.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as LegacyWidgetState;
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
        const dailyGoalTargets = { ...current.dailyGoalTargets };
        if (typeof saved.dailyQuestionTarget === 'number') {
          dailyGoalTargets.cards = clampGoalTarget('cards', saved.dailyQuestionTarget);
        }
        for (const kind of DAILY_GOAL_KINDS) {
          const target = saved.dailyGoalTargets?.[kind];
          if (typeof target === 'number') dailyGoalTargets[kind] = clampGoalTarget(kind, target);
        }
        return {
          ...current,
          enabled,
          positions,
          dailyGoalKind: isDailyGoalKind(saved.dailyGoalKind) ? saved.dailyGoalKind : current.dailyGoalKind,
          dailyGoalTargets,
          lastCelebratedDay:
            typeof saved.lastCelebratedDay === 'string' ? saved.lastCelebratedDay : null,
        };
      },
    }
  )
);
