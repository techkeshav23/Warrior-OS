// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Typing Biometrics Store
// Live mental-state + typing metrics + persisted history
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import type {
  BiometricState,
  TypingMetrics,
  BiometricSnapshot,
} from '@/types/biometrics';

const MAX_HISTORY = 500; // cap persisted snapshots

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
};

interface BiometricsStore {
  current: BiometricState;
  metrics: TypingMetrics;
  history: BiometricSnapshot[];
  lastUpdated: number | null;

  // Actions
  updateMetrics: (state: BiometricState, metrics: TypingMetrics) => void;
  resetSession: () => void;

  // Queries
  getAverages: () => BiometricState;
  getSnapshotsForDay: (date: Date) => BiometricSnapshot[];
}

export const useBiometricsStore = create<BiometricsStore>()(
  persist(
    immer((set, get) => ({
      current: { ...NEUTRAL_STATE },
      metrics: { ...ZERO_METRICS },
      history: [],
      lastUpdated: null,

      updateMetrics: (state, metrics) =>
        set((s) => {
          s.current = state;
          s.metrics = metrics;
          const now = Date.now();
          s.lastUpdated = now;
          s.history.push({
            timestamp: now,
            hour: new Date(now).getHours(),
            state,
            metrics,
          });
          if (s.history.length > MAX_HISTORY) {
            s.history.splice(0, s.history.length - MAX_HISTORY);
          }
        }),

      resetSession: () =>
        set((s) => {
          s.current = { ...NEUTRAL_STATE };
          s.metrics = { ...ZERO_METRICS };
        }),

      getAverages: () => {
        const { history } = get();
        if (history.length === 0) return { ...NEUTRAL_STATE };
        const sum = history.reduce(
          (acc, snap) => {
            acc.energy += snap.state.energy;
            acc.focus += snap.state.focus;
            acc.fatigue += snap.state.fatigue;
            acc.stress += snap.state.stress;
            return acc;
          },
          { energy: 0, focus: 0, fatigue: 0, stress: 0 }
        );
        const n = history.length;
        return {
          energy: Math.round(sum.energy / n),
          focus: Math.round(sum.focus / n),
          fatigue: Math.round(sum.fatigue / n),
          stress: Math.round(sum.stress / n),
        };
      },

      getSnapshotsForDay: (date) => {
        const { history } = get();
        const y = date.getFullYear();
        const m = date.getMonth();
        const d = date.getDate();
        return history.filter((snap) => {
          const t = new Date(snap.timestamp);
          return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
        });
      },
    })),
    {
      name: 'warrior-biometrics',
      partialize: (state) => ({ history: state.history }),
    }
  )
);
