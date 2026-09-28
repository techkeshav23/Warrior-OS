// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Biometric Calculator
// Pure functions mapping raw typing *timing* metrics → mental-state
// values (0-100). Logistic and log-logistic sigmoid curves plus an
// exponential session ramp give a natural, non-linear feel.
// Nothing here ever sees which keys were pressed.
// ═══════════════════════════════════════════════════════════

import type { BiometricState, TypingMetrics } from '@/types/biometrics';

// ─── Curve helpers ──────────────────────────────────────────

/** Logistic sigmoid centred at `mid` with steepness `k`. Returns 0-1. */
function sigmoid(x: number, mid: number, k: number): number {
  return 1 / (1 + Math.exp(-k * (x - mid)));
}

/**
 * Log-logistic falling curve: 1 at x = 0, 0.5 at x = `half`, → 0 as x grows.
 * `steep` controls how sharp the knee is.
 */
function falling(x: number, half: number, steep: number): number {
  if (!Number.isFinite(x) || x <= 0) return 1;
  return 1 / (1 + Math.pow(x / half, steep));
}

/** Log-logistic rising curve: 0 at x = 0, 0.5 at x = `half`, → 1 as x grows. */
function rising(x: number, half: number, steep: number): number {
  return 1 - falling(x, half, steep);
}

function clamp100(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

// ─── Mental-state functions ─────────────────────────────────

/**
 * Energy — driven by typing speed. Fast typing = high energy.
 * Logistic curve centred on 40 WPM, re-based so 0 WPM → 0.
 * 20 WPM ≈ 12, 40 WPM ≈ 49, 60 WPM ≈ 85, 80 WPM ≈ 97.
 */
export function calcEnergy(wpm: number): number {
  const base = sigmoid(0, 40, 0.09);
  const s = sigmoid(Math.max(0, wpm), 40, 0.09);
  return clamp100(((s - base) / (1 - base)) * 100);
}

/**
 * Fatigue — more errors and longer sessions raise fatigue.
 * `sessionDuration` is in minutes of continuous work. The time term is an
 * exponential ramp (≈40 at 1 h, ≈57 at 2 h, ≈71 at 4 h with clean typing);
 * errors combine with it like independent probabilities.
 */
export function calcFatigue(errorRate: number, sessionDuration: number): number {
  const timeComponent = 1 - Math.exp(-Math.max(0, sessionDuration) / 90);
  const errorComponent = rising(errorRate, 12, 2);
  const fatigue = 1 - (1 - 0.75 * timeComponent) * (1 - 0.8 * errorComponent);
  return clamp100(fatigue * 100);
}

/**
 * Focus — fewer / shorter pauses = higher focus.
 * `avgPauseDuration` is the mean gap between keystrokes (ms);
 * `pauseFrequency` is long pauses (≥1.5 s) per minute.
 * Steady 200 ms typing with ≤1 pause/min scores ~97.
 */
export function calcFocus(avgPauseDuration: number, pauseFrequency: number): number {
  const pauseComp = falling(avgPauseDuration, 650, 3);
  const freqComp = falling(pauseFrequency, 5, 2);
  return clamp100((0.6 * pauseComp + 0.4 * freqComp) * 100);
}

/**
 * Stress — erratic rhythm + errors = stressed.
 * `rhythmStdDev` is the std-dev (ms) of in-burst keystroke intervals.
 * Calm, even typing (≈70 ms jitter, ~2 % corrections) stays under 10.
 */
export function calcStress(rhythmStdDev: number, errorRate: number): number {
  const rhythmComp = rising(rhythmStdDev, 170, 2.5);
  const errorComp = rising(errorRate, 14, 2);
  return clamp100((0.6 * rhythmComp + 0.4 * errorComp) * 100);
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

// ─── Rolling-window typing metrics ──────────────────────────

/** One keystroke, reduced to timing + a coarse class. Never the key itself. */
export interface KeystrokeSample {
  /** keydown time, epoch ms */
  t: number;
  /** Backspace / Delete */
  correction: boolean;
  /** Counts toward WPM (single printable character or Enter) */
  printable: boolean;
  /** Hold time keydown→keyup in ms, or null if unknown */
  dwell: number | null;
}

export interface TypingWindowResult {
  metrics: TypingMetrics;
  /** Long pauses (≥ LONG_PAUSE_MS) per minute inside the window. */
  pauseFrequency: number;
}

/** Rolling window used for every metric. */
export const TYPING_WINDOW_MS = 60_000;
/** Floor on the measured span so a short burst cannot inflate WPM. */
export const MIN_TYPING_SPAN_MS = 15_000;
/** A gap this long counts as a pause/interruption rather than rhythm. */
export const LONG_PAUSE_MS = 1_500;
/** Below this many keystrokes in the window there is not enough signal. */
export const MIN_KEYSTROKES = 8;

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

function stdDev(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  let acc = 0;
  for (const v of values) acc += (v - m) ** 2;
  return Math.sqrt(acc / values.length);
}

/**
 * Compute WPM, error rate, pause average and rhythm jitter from the
 * keystrokes inside the rolling 60 s window ending at `now`.
 * Returns null when there is too little signal to say anything.
 */
export function computeTypingMetrics(
  samples: readonly KeystrokeSample[],
  now: number
): TypingWindowResult | null {
  const cutoff = now - TYPING_WINDOW_MS;
  const win = samples.filter((s) => s.t >= cutoff && s.t <= now);
  if (win.length < MIN_KEYSTROKES) return null;

  // WPM over the real span (capped at the window, floored to avoid bursts).
  const span = Math.max(
    MIN_TYPING_SPAN_MS,
    Math.min(TYPING_WINDOW_MS, now - win[0].t)
  );
  const minutes = span / 60_000;
  let printable = 0;
  let corrections = 0;
  const dwells: number[] = [];
  for (const s of win) {
    if (s.printable) printable++;
    if (s.correction) corrections++;
    if (s.dwell !== null && s.dwell > 0 && s.dwell < 2_000) dwells.push(s.dwell);
  }
  const wpm = printable / 5 / minutes;
  const errorRate = (corrections / win.length) * 100;

  // Inter-keystroke intervals.
  const intervals: number[] = [];
  for (let i = 1; i < win.length; i++) {
    intervals.push(Math.max(0, win[i].t - win[i - 1].t));
  }
  const pauseAvg = mean(intervals);
  const burst = intervals.filter((g) => g < LONG_PAUSE_MS);
  const rhythm = stdDev(burst.length >= 3 ? burst : intervals);
  const longPauses = intervals.length - burst.length;

  return {
    metrics: {
      wpm: Math.round(wpm),
      errorRate: Math.round(errorRate),
      pauseAvg: Math.round(pauseAvg),
      rhythmScore: Math.round(rhythm),
      dwellAvg: Math.round(mean(dwells)),
      keystrokes: win.length,
    },
    pauseFrequency: longPauses / minutes,
  };
}

/**
 * Average interval (ms) between the most recent in-burst keystrokes,
 * used by the typing-rhythm music generator. Null if not enough data.
 */
export function recentKeystrokeInterval(
  times: readonly number[],
  maxSamples = 16
): number | null {
  if (times.length < 3) return null;
  const start = Math.max(1, times.length - maxSamples);
  const gaps: number[] = [];
  for (let i = start; i < times.length; i++) {
    const g = times[i] - times[i - 1];
    if (g > 30 && g < LONG_PAUSE_MS) gaps.push(g);
  }
  if (gaps.length < 2) return null;
  return mean(gaps);
}
