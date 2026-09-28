// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Reality Decay dev/test hook
// Exposes window.__warriorDecay so the decay stages can be verified
// without studying for four hours:
//
//   __warriorDecay.setMinutes(185)  // jump to 185 continuous minutes
//   __warriorDecay.setStage(4)      // snap to a stage's threshold
//   __warriorDecay.advance(30)      // add 30 minutes
//   __warriorDecay.startBreak()     // voluntary break (forced at stage 5)
//   __warriorDecay.finishBreak()    // end the break now → repair
//   __warriorDecay.reset()          // back to a clean, stable OS
//   __warriorDecay.state()          // snapshot of the live timer
//
// Installed in development builds, or in production when
// localStorage 'warrior-decay-debug' is '1' or the URL has ?decayDebug.
// ═══════════════════════════════════════════════════════════

import { useDecayStore } from '@/stores/useDecayStore';

export interface WarriorDecayDebug {
  setMinutes: (minutes: number) => number;
  advance: (minutes: number) => number;
  setStage: (stage: number) => number;
  startBreak: () => void;
  finishBreak: () => void;
  reset: () => void;
  state: () => {
    enabled: boolean;
    minutes: number;
    stage: number;
    isTracking: boolean;
    isOnBreak: boolean;
    isRepairing: boolean;
    thresholds: number[];
    breakEndsAt: number | null;
  };
}

declare global {
  interface Window {
    __warriorDecay?: WarriorDecayDebug;
  }
}

function debugAllowed(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  try {
    if (window.localStorage.getItem('warrior-decay-debug') === '1') return true;
  } catch {
    /* storage blocked */
  }
  return new URLSearchParams(window.location.search).has('decayDebug');
}

/** Install window.__warriorDecay; returns an uninstall function. */
export function installDecayDebug(): () => void {
  if (typeof window === 'undefined' || !debugAllowed()) return () => undefined;
  const store = () => useDecayStore.getState();
  const api: WarriorDecayDebug = {
    setMinutes: (minutes) => {
      store().setContinuousMinutes(minutes);
      return store().decayStage;
    },
    advance: (minutes) => {
      store().setContinuousMinutes(store().continuousStudyMinutes + minutes);
      return store().decayStage;
    },
    setStage: (stage) => {
      const clamped = Math.max(0, Math.min(5, Math.round(stage)));
      const minutes = clamped === 0 ? 0 : store().getCurrentThresholds()[clamped - 1];
      store().setContinuousMinutes(minutes);
      return store().decayStage;
    },
    startBreak: () => store().triggerBreak(),
    finishBreak: () => store().completeBreak(),
    reset: () => {
      // Disabling clears the timer, any break and any repair without
      // touching lifetime stats; then restore the user's on/off choice.
      const wasEnabled = store().enabled;
      store().setEnabled(false);
      if (wasEnabled) store().setEnabled(true);
    },
    state: () => {
      const s = store();
      return {
        enabled: s.enabled,
        minutes: s.continuousStudyMinutes,
        stage: s.decayStage,
        isTracking: s.isTracking,
        isOnBreak: s.isOnBreak,
        isRepairing: s.isRepairing,
        thresholds: s.getCurrentThresholds(),
        breakEndsAt: s.breakEndsAt,
      };
    },
  };
  window.__warriorDecay = api;
  return () => {
    if (window.__warriorDecay === api) delete window.__warriorDecay;
  };
}
