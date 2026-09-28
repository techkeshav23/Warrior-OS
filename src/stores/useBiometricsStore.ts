// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Typing Biometrics Store
// Live mental-state + typing metrics, kept on this device only:
//   history — raw 5-second readings (most recent ~1 h of typing)
//   hourly  — hourly averages for 60 days (weekly charts, heatmap)
// Only timing statistics are stored: no keys, no text.
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import type {
  BiometricState,
  TypingMetrics,
  BiometricSnapshot,
} from '@/types/biometrics';

/** Raw readings kept (5 s each → about an hour of active typing). */
const MAX_RAW_HISTORY = 720;
/** Hourly buckets older than this are dropped. */
export const BIOMETRIC_HISTORY_DAYS = 60;
/** Hard cap on persisted hourly buckets (60 days × 24 h). */
const MAX_HOURLY = BIOMETRIC_HISTORY_DAYS * 24;
/** Cap on remembered "history checked" days. */
const MAX_CHECKED_DAYS = 400;

/** Focus above this is "in the zone". */
export const FLOW_FOCUS_THRESHOLD = 95;
/** Stress below this is "calm". */
export const CALM_STRESS_THRESHOLD = 10;
/** A gap longer than this between readings breaks a continuous streak. */
export const STREAK_GAP_MS = 5 * 60_000;

const NEUTRAL_STATE: BiometricState = {
  energy: 50,
  focus: 50,
  fatigue: 20,
  stress: 20,
};

const ZERO_METRICS: TypingMetrics = {
  wpm: 0,
  errorRate: 0,
  pauseAvg: 0,
  rhythmScore: 0,
  dwellAvg: 0,
  keystrokes: 0,
};

/** Local calendar day key, e.g. "2026-09-28". */
export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function blend(prev: number, next: number, n: number): number {
  return round1((prev * n + next) / (n + 1));
}

function blendState(a: BiometricState, b: BiometricState, n: number): BiometricState {
  return {
    energy: blend(a.energy, b.energy, n),
    focus: blend(a.focus, b.focus, n),
    fatigue: blend(a.fatigue, b.fatigue, n),
    stress: blend(a.stress, b.stress, n),
  };
}

function blendMetrics(a: TypingMetrics, b: TypingMetrics, n: number): TypingMetrics {
  return {
    wpm: blend(a.wpm, b.wpm, n),
    errorRate: blend(a.errorRate, b.errorRate, n),
    pauseAvg: blend(a.pauseAvg, b.pauseAvg, n),
    rhythmScore: blend(a.rhythmScore, b.rhythmScore, n),
    dwellAvg: blend(a.dwellAvg ?? 0, b.dwellAvg ?? 0, n),
    keystrokes: blend(a.keystrokes ?? 0, b.keystrokes ?? 0, n),
  };
}

/** Start-of-local-hour bucket for a reading. */
function bucketFor(ts: number, state: BiometricState, metrics: TypingMetrics): BiometricSnapshot {
  const d = new Date(ts);
  const hour = d.getHours();
  return {
    timestamp: new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour).getTime(),
    hour,
    day: localDayKey(d),
    samples: 1,
    state: { ...state },
    metrics: { ...ZERO_METRICS, ...metrics },
  };
}

/** Group raw readings into (local day, hour) averaged buckets. */
function aggregateHourly(raw: BiometricSnapshot[]): BiometricSnapshot[] {
  const buckets = new Map<string, BiometricSnapshot>();
  const sorted = [...raw]
    .filter((s) => s && typeof s.timestamp === 'number' && s.state)
    .sort((a, b) => a.timestamp - b.timestamp);
  for (const snap of sorted) {
    const fresh = bucketFor(snap.timestamp, snap.state, snap.metrics ?? ZERO_METRICS);
    const key = `${fresh.day}|${fresh.hour}`;
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, fresh);
      continue;
    }
    const n = existing.samples ?? 1;
    existing.state = blendState(existing.state, fresh.state, n);
    existing.metrics = blendMetrics(existing.metrics, fresh.metrics, n);
    existing.samples = n + 1;
  }
  return Array.from(buckets.values()).slice(-MAX_HOURLY);
}

interface PersistedBiometrics {
  history: BiometricSnapshot[];
  hourly: BiometricSnapshot[];
  checkedDays: string[];
  widgetCollapsed: boolean;
  widgetOffset: { x: number; y: number };
}

interface BiometricsStore extends PersistedBiometrics {
  current: BiometricState;
  metrics: TypingMetrics;
  /** Epoch ms of the most recent live reading (null = none this session). */
  lastUpdated: number | null;
  /** Live readings taken this session. */
  readings: number;
  /** Start of the current continuous focus > 95 streak (null = not in it). */
  flowSince: number | null;
  /** Start of the current continuous stress < 10 streak. */
  calmSince: number | null;

  // Actions
  /** Record one live reading (called every ~5 s while typing). */
  updateMetrics: (state: BiometricState, metrics: TypingMetrics) => void;
  resetSession: () => void;
  /** Mark today as a day the history was viewed; returns distinct day count. */
  markHistoryChecked: () => number;
  /** Wipe every stored reading (raw + hourly). */
  clearHistory: () => void;
  setWidgetCollapsed: (collapsed: boolean) => void;
  setWidgetOffset: (offset: { x: number; y: number }) => void;

  // Queries
  /** Long-term averages (sample-weighted over the hourly history). */
  getAverages: () => BiometricState;
  /** Hourly buckets for one local day. */
  getSnapshotsForDay: (date: Date) => BiometricSnapshot[];
}

export const useBiometricsStore = create<BiometricsStore>()(
  persist(
    immer((set, get) => ({
      current: { ...NEUTRAL_STATE },
      metrics: { ...ZERO_METRICS },
      history: [],
      hourly: [],
      lastUpdated: null,
      readings: 0,
      flowSince: null,
      calmSince: null,
      checkedDays: [],
      widgetCollapsed: false,
      widgetOffset: { x: 0, y: 0 },

      updateMetrics: (state, metrics) =>
        set((s) => {
          const now = Date.now();
          const prevAt = s.lastUpdated;
          const continuous = prevAt !== null && now - prevAt <= STREAK_GAP_MS;

          // Continuous streak markers (used by achievements + the widget).
          if (state.focus > FLOW_FOCUS_THRESHOLD) {
            if (!continuous || s.flowSince === null) s.flowSince = now;
          } else {
            s.flowSince = null;
          }
          if (state.stress < CALM_STRESS_THRESHOLD) {
            if (!continuous || s.calmSince === null) s.calmSince = now;
          } else {
            s.calmSince = null;
          }

          s.current = { ...state };
          s.metrics = { ...metrics };
          s.lastUpdated = now;
          s.readings += 1;

          // Raw reading.
          const d = new Date(now);
          s.history.push({ timestamp: now, hour: d.getHours(), state: { ...state }, metrics: { ...metrics } });
          if (s.history.length > MAX_RAW_HISTORY) {
            s.history.splice(0, s.history.length - MAX_RAW_HISTORY);
          }

          // Merge into the current local-hour bucket.
          const fresh = bucketFor(now, state, metrics);
          const last = s.hourly[s.hourly.length - 1];
          if (last && last.day === fresh.day && last.hour === fresh.hour) {
            const n = last.samples ?? 1;
            last.state = blendState(last.state, fresh.state, n);
            last.metrics = blendMetrics(last.metrics, fresh.metrics, n);
            last.samples = n + 1;
          } else {
            s.hourly.push(fresh);
          }

          // Retention: last N days, hard cap.
          const oldest = now - BIOMETRIC_HISTORY_DAYS * 24 * 60 * 60_000;
          let drop = 0;
          while (drop < s.hourly.length && s.hourly[drop].timestamp < oldest) drop++;
          if (drop > 0) s.hourly.splice(0, drop);
          if (s.hourly.length > MAX_HOURLY) s.hourly.splice(0, s.hourly.length - MAX_HOURLY);
        }),

      resetSession: () =>
        set((s) => {
          s.current = { ...NEUTRAL_STATE };
          s.metrics = { ...ZERO_METRICS };
          s.lastUpdated = null;
          s.flowSince = null;
          s.calmSince = null;
        }),

      markHistoryChecked: () => {
        const today = localDayKey(new Date());
        if (!get().checkedDays.includes(today)) {
          set((s) => {
            s.checkedDays.push(today);
            if (s.checkedDays.length > MAX_CHECKED_DAYS) {
              s.checkedDays.splice(0, s.checkedDays.length - MAX_CHECKED_DAYS);
            }
          });
        }
        return get().checkedDays.length;
      },

      clearHistory: () =>
        set((s) => {
          s.history = [];
          s.hourly = [];
        }),

      setWidgetCollapsed: (collapsed) =>
        set((s) => {
          s.widgetCollapsed = collapsed;
        }),

      setWidgetOffset: (offset) =>
        set((s) => {
          s.widgetOffset = { x: Math.round(offset.x), y: Math.round(offset.y) };
        }),

      getAverages: () => {
        const { hourly } = get();
        if (hourly.length === 0) return { ...NEUTRAL_STATE };
        let total = 0;
        const sum = { energy: 0, focus: 0, fatigue: 0, stress: 0 };
        for (const snap of hourly) {
          const w = snap.samples ?? 1;
          total += w;
          sum.energy += snap.state.energy * w;
          sum.focus += snap.state.focus * w;
          sum.fatigue += snap.state.fatigue * w;
          sum.stress += snap.state.stress * w;
        }
        return {
          energy: Math.round(sum.energy / total),
          focus: Math.round(sum.focus / total),
          fatigue: Math.round(sum.fatigue / total),
          stress: Math.round(sum.stress / total),
        };
      },

      getSnapshotsForDay: (date) => {
        const key = localDayKey(date);
        return get().hourly.filter(
          (snap) => (snap.day ?? localDayKey(new Date(snap.timestamp))) === key
        );
      },
    })),
    {
      name: 'warrior-biometrics',
      version: 1,
      partialize: (state): PersistedBiometrics => ({
        history: state.history,
        hourly: state.hourly,
        checkedDays: state.checkedDays,
        widgetCollapsed: state.widgetCollapsed,
        widgetOffset: state.widgetOffset,
      }),
      // v0 persisted only raw readings (capped at 500 ≈ 40 min);
      // v1 adds the long-term hourly aggregates, seeded from them.
      migrate: (persisted, version): PersistedBiometrics => {
        const p = (persisted ?? {}) as Partial<PersistedBiometrics>;
        const history = Array.isArray(p.history) ? p.history : [];
        return {
          history: history.slice(-MAX_RAW_HISTORY),
          hourly: version < 1 || !Array.isArray(p.hourly) ? aggregateHourly(history) : p.hourly,
          checkedDays: Array.isArray(p.checkedDays) ? p.checkedDays : [],
          widgetCollapsed: typeof p.widgetCollapsed === 'boolean' ? p.widgetCollapsed : false,
          widgetOffset:
            p.widgetOffset && typeof p.widgetOffset.x === 'number' && typeof p.widgetOffset.y === 'number'
              ? p.widgetOffset
              : { x: 0, y: 0 },
        };
      },
    }
  )
);
