// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Reality Decay Store
// The OS fights back: continuous-study decay tracking (stages 0-5)
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

// Break duration options (minutes)
export type BreakDurationMinutes = 3 | 5 | 10;

// Stage thresholds in continuous study MINUTES, mapped to decay stage index.
// Stage 1 @120, 2 @150, 3 @180, 4 @210, 5 @240.
export const DECAY_BASE_THRESHOLDS: readonly number[] = [120, 150, 180, 210, 240];

/** Resolve which decay stage (0-5) a given minute count maps to, given an
 *  additive threshold offset (from settings, +/- minutes). */
export function stageForMinutes(minutes: number, thresholdOffset = 0): number {
  let stage = 0;
  for (let i = 0; i < DECAY_BASE_THRESHOLDS.length; i++) {
    if (minutes >= DECAY_BASE_THRESHOLDS[i] + thresholdOffset) {
      stage = i + 1;
    }
  }
  return stage;
}

interface DecayStore {
  // Persisted config
  enabled: boolean;              // master on/off (settings-friendly flag)
  thresholdOffset: number;       // minutes +/- applied to every stage threshold
  breakDuration: BreakDurationMinutes;

  // Live tracking state (not persisted)
  isTracking: boolean;           // timer running
  continuousStudyMinutes: number;
  decayStage: number;            // 0-5
  isOnBreak: boolean;
  isRepairing: boolean;          // repair animation in progress
  lastInteractionAt: number | null; // epoch ms of last user interaction

  // Config actions
  setEnabled: (enabled: boolean) => void;
  setThresholdOffset: (offset: number) => void;
  setBreakDuration: (duration: BreakDurationMinutes) => void;

  // Tracking actions
  startTracking: () => void;
  registerInteraction: () => void;
  tick: () => void;                       // called every minute by the engine
  pauseTracking: () => void;
  resetDecay: () => void;

  // Break lifecycle
  triggerBreak: () => void;
  endBreak: () => void;
  repairOS: () => void;
  finishRepair: () => void;

  // Testing / debug helper — force a stage & matching minutes
  setStage: (stage: number) => void;

  // Query
  getCurrentThresholds: () => number[];
}

export const useDecayStore = create<DecayStore>()(
  persist(
    immer((set, get) => ({
      // Persisted config
      enabled: true,
      thresholdOffset: 0,
      breakDuration: 5,

      // Live state
      isTracking: false,
      continuousStudyMinutes: 0,
      decayStage: 0,
      isOnBreak: false,
      isRepairing: false,
      lastInteractionAt: null,

      setEnabled: (enabled) =>
        set((s) => {
          s.enabled = enabled;
          if (!enabled) {
            s.isTracking = false;
            s.decayStage = 0;
            s.continuousStudyMinutes = 0;
            s.isOnBreak = false;
            s.isRepairing = false;
          }
        }),

      setThresholdOffset: (offset) =>
        set((s) => {
          // Clamp to +/- 30 min per spec (slider)
          s.thresholdOffset = Math.max(-30, Math.min(30, Math.round(offset)));
          s.decayStage = stageForMinutes(s.continuousStudyMinutes, s.thresholdOffset);
        }),

      setBreakDuration: (duration) =>
        set((s) => {
          s.breakDuration = duration;
        }),

      startTracking: () =>
        set((s) => {
          if (!s.enabled || s.isOnBreak) return;
          if (!s.isTracking) {
            s.isTracking = true;
            s.lastInteractionAt = Date.now();
          }
        }),

      registerInteraction: () =>
        set((s) => {
          if (!s.enabled || s.isOnBreak) return;
          s.lastInteractionAt = Date.now();
          if (!s.isTracking) {
            s.isTracking = true;
          }
        }),

      tick: () =>
        set((s) => {
          if (!s.enabled || !s.isTracking || s.isOnBreak) return;
          s.continuousStudyMinutes += 1;
          s.decayStage = stageForMinutes(s.continuousStudyMinutes, s.thresholdOffset);
        }),

      pauseTracking: () =>
        set((s) => {
          s.isTracking = false;
        }),

      resetDecay: () =>
        set((s) => {
          s.continuousStudyMinutes = 0;
          s.decayStage = 0;
          s.isTracking = false;
          s.lastInteractionAt = null;
        }),

      triggerBreak: () =>
        set((s) => {
          s.isOnBreak = true;
          s.isTracking = false;
        }),

      endBreak: () =>
        set((s) => {
          s.isOnBreak = false;
        }),

      repairOS: () =>
        set((s) => {
          s.isRepairing = true;
          s.isOnBreak = false;
        }),

      finishRepair: () =>
        set((s) => {
          s.isRepairing = false;
          s.continuousStudyMinutes = 0;
          s.decayStage = 0;
          s.isTracking = false;
          s.lastInteractionAt = null;
        }),

      setStage: (stage) =>
        set((s) => {
          const clamped = Math.max(0, Math.min(5, Math.round(stage)));
          s.decayStage = clamped;
          if (clamped === 0) {
            s.continuousStudyMinutes = 0;
          } else {
            // Snap minutes to that stage's threshold so tick() stays consistent
            s.continuousStudyMinutes =
              DECAY_BASE_THRESHOLDS[clamped - 1] + s.thresholdOffset;
          }
        }),

      getCurrentThresholds: () => {
        const offset = get().thresholdOffset;
        return DECAY_BASE_THRESHOLDS.map((t) => t + offset);
      },
    })),
    {
      name: 'warrior-os-decay',
      // Persist only user config, never transient tracking state
      partialize: (state) => ({
        enabled: state.enabled,
        thresholdOffset: state.thresholdOffset,
        breakDuration: state.breakDuration,
      }),
    }
  )
);
