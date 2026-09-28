// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Reality Decay Store
// The OS fights back: continuous-study decay tracking (stages 0-5),
// the recovery-break lifecycle, and lifetime decay statistics.
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

// Break duration options (minutes)
export type BreakDurationMinutes = 3 | 5 | 10;
export const BREAK_DURATION_OPTIONS: readonly BreakDurationMinutes[] = [3, 5, 10];

/** Why a break started. Forced = stage 5; voluntary = user asked. */
export type BreakReason = 'forced' | 'voluntary';

// Stage thresholds in continuous study MINUTES, mapped to decay stage index.
// Stage 1 @120, 2 @150, 3 @180, 4 @210, 5 @240.
export const DECAY_BASE_THRESHOLDS: readonly number[] = [120, 150, 180, 210, 240];
/** Settings slider range for the threshold offset (minutes). */
export const DECAY_OFFSET_LIMIT = 30;
/** No interaction for this long auto-pauses the timer. */
export const DECAY_IDLE_TIMEOUT_MS = 10 * 60_000;
/** Coming back after this long away counts as a natural break (decay resets). */
export const DECAY_NATURAL_BREAK_MS = 30 * 60_000;
/** The stage-3 vignette ramps to full intensity over this many minutes. */
export const DECAY_VIGNETTE_RAMP_MINUTES = 15;
/** A voluntary break must follow at least this much study to earn XP. */
const VOLUNTARY_REWARD_MIN_MINUTES = 30;
/** Never credit more than this per tick (sleep / throttling protection). */
const MAX_TICK_DELTA_MS = 2 * 60_000;

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

/** Local calendar day key, e.g. "2026-09-28". */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface DecayStats {
  /** Times continuous study reached stage 1. */
  stage1Reached: number;
  /** Times continuous study reached stage 5 (full decay). */
  fullDecays: number;
  /** Completed stage-5 forced breaks. */
  forcedBreaks: number;
  /** Completed breaks the user started themselves. */
  voluntaryBreaks: number;
  /** Returns after 30+ minutes away (decay reset without BreakMode). */
  naturalBreaks: number;
}

/** One-shot record of a just-completed break, consumed by DecayRepair. */
export interface RepairTicket {
  /** True when the break earned the +50 XP bonus. */
  reward: boolean;
  reason: BreakReason | null;
}

export interface DecayDaily {
  /** Local day key. */
  day: string;
  /** Active study minutes tracked today. */
  studyMinutes: number;
  /** Breaks completed today (forced, voluntary or natural). */
  breaks: number;
}

interface PersistedDecay {
  enabled: boolean;
  thresholdOffset: number;
  breakDuration: BreakDurationMinutes;
  breakEndsAt: number | null;
  breakStartedAt: number | null;
  breakReason: BreakReason | null;
  breakEarnsReward: boolean;
  stats: DecayStats;
  daily: DecayDaily;
}

interface DecayStore extends PersistedDecay {
  // Live tracking state (not persisted — a fresh boot starts fresh)
  isTracking: boolean;
  /** Active (non-idle) study time since the last break, ms. */
  activeMs: number;
  continuousStudyMinutes: number;
  decayStage: number; // 0-5
  isOnBreak: boolean;
  isRepairing: boolean;
  /** Set when a break completes; claimed exactly once by DecayRepair. */
  repairTicket: RepairTicket | null;
  lastInteractionAt: number | null;
  lastTickAt: number | null;
  /** True when the timer is paused because of 10+ min of no interaction. */
  pausedForIdle: boolean;

  // Config actions
  setEnabled: (enabled: boolean) => void;
  setThresholdOffset: (offset: number) => void;
  setBreakDuration: (duration: BreakDurationMinutes) => void;

  // Tracking actions
  startTracking: () => void;
  /** Returns true when this interaction ended a 30+ min absence (natural break). */
  registerInteraction: () => boolean;
  tick: (now?: number) => void;
  pauseTracking: () => void;
  resetDecay: () => void;

  // Break lifecycle
  startBreak: (reason: BreakReason) => void;
  /**
   * Start a break now: "forced" when reality has fully decayed (stage 5),
   * otherwise it counts as a voluntary break (e.g. asked for via NEXUS).
   */
  triggerBreak: () => void;
  /** Re-open a break persisted across a reload (it cannot be skipped). */
  resumePersistedBreak: () => void;
  /** Break countdown finished → start the repair sequence. */
  completeBreak: () => void;
  /** @deprecated alias of completeBreak */
  endBreak: () => void;
  /** @deprecated alias of completeBreak */
  repairOS: () => void;
  /** Take the repair ticket (non-null exactly once per completed break). */
  claimRepairTicket: () => RepairTicket | null;
  finishRepair: () => void;

  // Testing / debug helper — force a stage & matching minutes
  setStage: (stage: number) => void;
  /**
   * Testing / debug helper — jump the continuous-study timer to `minutes`
   * (stage, stats and the vignette ramp follow exactly as if studied) and
   * keep tracking from now.
   */
  setContinuousMinutes: (minutes: number) => void;

  // Query
  getCurrentThresholds: () => number[];
}

const EMPTY_STATS: DecayStats = {
  stage1Reached: 0,
  fullDecays: 0,
  forcedBreaks: 0,
  voluntaryBreaks: 0,
  naturalBreaks: 0,
};

export const useDecayStore = create<DecayStore>()(
  persist(
    immer((set, get) => ({
      // Persisted config
      enabled: true,
      thresholdOffset: 0,
      breakDuration: 5,
      breakEndsAt: null,
      breakStartedAt: null,
      breakReason: null,
      breakEarnsReward: false,
      stats: { ...EMPTY_STATS },
      daily: { day: '', studyMinutes: 0, breaks: 0 },

      // Live state
      isTracking: false,
      activeMs: 0,
      continuousStudyMinutes: 0,
      decayStage: 0,
      isOnBreak: false,
      isRepairing: false,
      repairTicket: null,
      lastInteractionAt: null,
      lastTickAt: null,
      pausedForIdle: false,

      setEnabled: (enabled) =>
        set((s) => {
          s.enabled = enabled;
          if (!enabled) {
            s.isTracking = false;
            s.decayStage = 0;
            s.activeMs = 0;
            s.continuousStudyMinutes = 0;
            s.isOnBreak = false;
            s.isRepairing = false;
            s.repairTicket = null;
            s.breakEndsAt = null;
            s.breakStartedAt = null;
            s.breakReason = null;
            s.pausedForIdle = false;
          }
        }),

      setThresholdOffset: (offset) =>
        set((s) => {
          // Clamp to +/- 30 min per spec (slider)
          const clamped = Math.max(-DECAY_OFFSET_LIMIT, Math.min(DECAY_OFFSET_LIMIT, Math.round(offset)));
          s.thresholdOffset = Number.isFinite(clamped) ? clamped : 0;
          s.decayStage = stageForMinutes(s.continuousStudyMinutes, s.thresholdOffset);
        }),

      setBreakDuration: (duration) =>
        set((s) => {
          s.breakDuration = BREAK_DURATION_OPTIONS.includes(duration) ? duration : 5;
        }),

      startTracking: () =>
        set((s) => {
          if (!s.enabled || s.isOnBreak || s.isRepairing) return;
          if (!s.isTracking) {
            const now = Date.now();
            s.isTracking = true;
            s.pausedForIdle = false;
            s.lastInteractionAt = now;
            s.lastTickAt = now;
          }
        }),

      registerInteraction: () => {
        const cur = get();
        if (!cur.enabled || cur.isOnBreak || cur.isRepairing) return false;
        const now = Date.now();
        const awayMs = cur.lastInteractionAt === null ? 0 : now - cur.lastInteractionAt;
        // 30+ minutes with no interaction at all (idle, asleep, or away)
        // is a real break: the decay heals on its own.
        const naturalBreak = awayMs >= DECAY_NATURAL_BREAK_MS && cur.continuousStudyMinutes > 0;

        set((s) => {
          if (naturalBreak) {
            s.activeMs = 0;
            s.continuousStudyMinutes = 0;
            s.decayStage = 0;
            s.stats.naturalBreaks += 1;
            const today = dayKey(now);
            if (s.daily.day !== today) s.daily = { day: today, studyMinutes: 0, breaks: 0 };
            s.daily.breaks += 1;
          }
          // Never credit an idle gap (e.g. the tab slept and no tick paused us).
          if (!s.isTracking || awayMs >= DECAY_IDLE_TIMEOUT_MS) s.lastTickAt = now;
          s.lastInteractionAt = now;
          s.isTracking = true;
          s.pausedForIdle = false;
        });
        return naturalBreak;
      },

      tick: (nowArg) =>
        set((s) => {
          const now = nowArg ?? Date.now();
          const last = s.lastTickAt ?? now;
          s.lastTickAt = now;
          if (!s.enabled || !s.isTracking || s.isOnBreak || s.isRepairing) return;

          // Idle for 10+ minutes → auto-pause (accumulated time is kept).
          if (s.lastInteractionAt !== null && now - s.lastInteractionAt >= DECAY_IDLE_TIMEOUT_MS) {
            s.isTracking = false;
            s.pausedForIdle = true;
            return;
          }

          s.activeMs += Math.min(Math.max(0, now - last), MAX_TICK_DELTA_MS);
          const minutes = Math.floor(s.activeMs / 60_000);
          const gained = minutes - s.continuousStudyMinutes;
          if (gained <= 0) return;

          s.continuousStudyMinutes = minutes;
          const today = dayKey(now);
          if (s.daily.day !== today) s.daily = { day: today, studyMinutes: 0, breaks: 0 };
          s.daily.studyMinutes += gained;

          const prevStage = s.decayStage;
          const nextStage = stageForMinutes(minutes, s.thresholdOffset);
          s.decayStage = nextStage;
          if (nextStage > prevStage) {
            if (prevStage < 1 && nextStage >= 1) s.stats.stage1Reached += 1;
            if (prevStage < 5 && nextStage >= 5) s.stats.fullDecays += 1;
          }
        }),

      pauseTracking: () =>
        set((s) => {
          s.isTracking = false;
        }),

      resetDecay: () =>
        set((s) => {
          s.activeMs = 0;
          s.continuousStudyMinutes = 0;
          s.decayStage = 0;
          s.isTracking = false;
          s.pausedForIdle = false;
          s.lastInteractionAt = null;
          s.lastTickAt = null;
        }),

      startBreak: (reason) =>
        set((s) => {
          if (!s.enabled || s.isOnBreak || s.isRepairing) return;
          const now = Date.now();
          s.isOnBreak = true;
          s.isTracking = false;
          s.breakReason = reason;
          s.breakStartedAt = now;
          s.breakEndsAt = now + s.breakDuration * 60_000;
          s.breakEarnsReward =
            reason === 'forced' || s.continuousStudyMinutes >= VOLUNTARY_REWARD_MIN_MINUTES;
        }),

      triggerBreak: () => get().startBreak(get().decayStage >= 5 ? 'forced' : 'voluntary'),

      resumePersistedBreak: () =>
        set((s) => {
          if (!s.enabled || s.breakEndsAt === null || s.isOnBreak || s.isRepairing) return;
          s.isOnBreak = true;
          s.isTracking = false;
        }),

      completeBreak: () =>
        set((s) => {
          if (!s.isOnBreak) return;
          const now = Date.now();
          s.isOnBreak = false;
          s.isRepairing = true;
          s.repairTicket = { reward: s.breakEarnsReward, reason: s.breakReason };
          if (s.breakReason === 'forced') s.stats.forcedBreaks += 1;
          else s.stats.voluntaryBreaks += 1;
          const today = dayKey(now);
          if (s.daily.day !== today) s.daily = { day: today, studyMinutes: 0, breaks: 0 };
          s.daily.breaks += 1;
          s.breakEndsAt = null;
          s.breakStartedAt = null;
          s.breakEarnsReward = false;
          // breakReason is kept until finishRepair so the repair can read it.
        }),

      endBreak: () => get().completeBreak(),
      repairOS: () => get().completeBreak(),

      claimRepairTicket: () => {
        const ticket = get().repairTicket;
        if (!ticket) return null;
        set((s) => {
          s.repairTicket = null;
        });
        return { ...ticket };
      },

      finishRepair: () =>
        set((s) => {
          s.isRepairing = false;
          s.repairTicket = null;
          s.breakReason = null;
          s.activeMs = 0;
          s.continuousStudyMinutes = 0;
          s.decayStage = 0;
          s.isTracking = false;
          s.pausedForIdle = false;
          s.lastInteractionAt = null;
          s.lastTickAt = null;
        }),

      setStage: (stage) =>
        set((s) => {
          const clamped = Math.max(0, Math.min(5, Math.round(stage)));
          s.decayStage = clamped;
          const minutes =
            clamped === 0 ? 0 : Math.max(0, DECAY_BASE_THRESHOLDS[clamped - 1] + s.thresholdOffset);
          // Snap minutes to that stage's threshold so tick() stays consistent
          s.continuousStudyMinutes = minutes;
          s.activeMs = minutes * 60_000;
        }),

      setContinuousMinutes: (minutes) =>
        set((s) => {
          if (!s.enabled || s.isOnBreak || s.isRepairing) return;
          const m = Math.max(0, Math.min(24 * 60, Math.floor(Number.isFinite(minutes) ? minutes : 0)));
          const now = Date.now();
          const prevStage = s.decayStage;
          s.activeMs = m * 60_000;
          s.continuousStudyMinutes = m;
          s.decayStage = stageForMinutes(m, s.thresholdOffset);
          if (s.decayStage > prevStage) {
            if (prevStage < 1 && s.decayStage >= 1) s.stats.stage1Reached += 1;
            if (prevStage < 5 && s.decayStage >= 5) s.stats.fullDecays += 1;
          }
          s.isTracking = true;
          s.pausedForIdle = false;
          s.lastInteractionAt = now;
          s.lastTickAt = now;
        }),

      getCurrentThresholds: () => {
        const offset = get().thresholdOffset;
        return DECAY_BASE_THRESHOLDS.map((t) => t + offset);
      },
    })),
    {
      name: 'warrior-os-decay',
      // Persist user config, the in-progress break (so a reload cannot skip
      // it) and lifetime stats — never the live study timer.
      partialize: (state): PersistedDecay => ({
        enabled: state.enabled,
        thresholdOffset: state.thresholdOffset,
        breakDuration: state.breakDuration,
        breakEndsAt: state.breakEndsAt,
        breakStartedAt: state.breakStartedAt,
        breakReason: state.breakReason,
        breakEarnsReward: state.breakEarnsReward,
        stats: state.stats,
        daily: state.daily,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PersistedDecay>;
        return {
          ...current,
          ...p,
          stats: { ...EMPTY_STATS, ...(p.stats ?? {}) },
          daily: p.daily && typeof p.daily.day === 'string' ? p.daily : current.daily,
        };
      },
    }
  )
);

/**
 * Wallpaper/particle speed multiplier for the current decay state:
 * 0.5 from stage 2 (the world "slows"), back to 1 during repair.
 * Particle systems can multiply their per-frame motion by this.
 */
export function getDecayTimeScale(): number {
  const s = useDecayStore.getState();
  if (!s.enabled || s.isRepairing || s.isOnBreak) return 1;
  return s.decayStage >= 2 ? 0.5 : 1;
}

/** Continuous-study minutes today (local day) tracked by the decay engine. */
export function getTodayStudyMinutes(): number {
  const s = useDecayStore.getState();
  return s.daily.day === dayKey(Date.now()) ? s.daily.studyMinutes : 0;
}
