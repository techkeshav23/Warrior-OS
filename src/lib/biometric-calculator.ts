// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Biometric Calculator
// Pure functions mapping raw typing metrics → mental-state 0-100
// Uses sigmoid / exponential curves for a natural, non-linear feel
// ═══════════════════════════════════════════════════════════

import type { BiometricState, TypingMetrics } from '@/types/biometrics';

/** Logistic sigmoid centred at `mid` with steepness `k`. Returns 0-1. */
function sigmoid(x: number, mid: number, k: number): number {
  return 1 / (1 + Math.exp(-k * (x - mid)));
}

function clamp100(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/**
 * Energy — driven by typing speed. Fast typing = high energy.
 * Sigmoid centred around ~45 WPM so a comfortable pace sits mid-high.
 */
export function calcEnergy(wpm: number): number {
  const s = sigmoid(wpm, 40, 0.09); // 0 wpm ≈ 0.03, 40 wpm = 0.5, 80 wpm ≈ 0.97
  return clamp100(s * 100);
}

/**
 * Fatigue — more errors and longer sessions raise fatigue.
 * `sessionDuration` in minutes. Combines an error component and a
 * time-decay-of-freshness component (exponential ramp toward 1).
 */
export function calcFatigue(errorRate: number, sessionDuration: number): number {
  const errorComponent = sigmoid(errorRate, 12, 0.18); // errors past ~12/100 spike fatigue
  const timeComponent = 1 - Math.exp(-sessionDuration / 45); // ~63% by 45 min, ~86% by 90 min
  // Weighted blend, both 0-1.
  const blended = 0.55 * errorComponent + 0.45 * timeComponent;
  return clamp100(blended * 100);
}

/**
 * Focus — fewer / shorter pauses = higher focus.
 * `avgPauseDuration` ms between keystrokes, `pauseFrequency` = long-pauses per minute.
 * Inverted sigmoids so calm steady typing scores high.
 */
export function calcFocus(avgPauseDuration: number, pauseFrequency: number): number {
  const pauseComp = 1 - sigmoid(avgPauseDuration, 550, 0.006); // <550ms feels engaged
  const freqComp = 1 - sigmoid(pauseFrequency, 8, 0.35); // few interruptions = focused
  const blended = 0.6 * pauseComp + 0.4 * freqComp;
  return clamp100(blended * 100);
}

/**
 * Stress — erratic rhythm + errors = stressed.
 * `rhythmStdDev` ms std-dev of keystroke intervals.
 */
export function calcStress(rhythmStdDev: number, errorRate: number): number {
  const rhythmComp = sigmoid(rhythmStdDev, 260, 0.012); // jittery timing raises stress
  const errorComp = sigmoid(errorRate, 15, 0.16);
  const blended = 0.6 * rhythmComp + 0.4 * errorComp;
  return clamp100(blended * 100);
}

/** Convenience: compute the full state from metrics + session context. */
export function calcBiometricState(
  metrics: TypingMetrics,
  sessionMinutes: number,
  pauseFrequency: number
): BiometricState {
  return {
    energy: calcEnergy(metrics.wpm),
    focus: calcFocus(metrics.pauseAvg, pauseFrequency),
    fatigue: calcFatigue(metrics.errorRate, sessionMinutes),
    stress: calcStress(metrics.rhythmScore, metrics.errorRate),
  };
}
