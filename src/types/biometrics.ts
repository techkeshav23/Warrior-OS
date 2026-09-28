// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Typing Biometrics Types
// Mental-state model derived from typing *timing* only.
// No key identities and no typed text are ever represented here.
// ═══════════════════════════════════════════════════════════

/** Live mental-state estimate, each field 0-100. */
export interface BiometricState {
  energy: number; // ⚡ derived from typing speed
  focus: number; // 🎯 derived from pause patterns
  fatigue: number; // 💤 derived from errors + session length
  stress: number; // 😤 derived from rhythm variance + errors
}

/** Raw typing metrics measured over a rolling 60s window. */
export interface TypingMetrics {
  wpm: number; // words per minute (rolling 60s, 5 chars = 1 word)
  errorRate: number; // backspace/delete per 100 keystrokes (0-100)
  pauseAvg: number; // average inter-keystroke gap in ms
  rhythmScore: number; // std-dev of in-burst keystroke intervals in ms (lower = steadier)
  /** Average key hold time (keydown→keyup) in ms. Optional for old snapshots. */
  dwellAvg?: number;
  /** Keystrokes counted in the rolling window. Optional for old snapshots. */
  keystrokes?: number;
}

/**
 * A timestamped snapshot combining state + metrics.
 * History entries are hourly aggregates: `timestamp` is the start of the
 * local hour, `state`/`metrics` are averages over `samples` readings.
 */
export interface BiometricSnapshot {
  timestamp: number; // epoch ms (start of the local hour for history buckets)
  hour: number; // 0-23 local hour, for heatmap bucketing
  state: BiometricState;
  metrics: TypingMetrics;
  /** Local calendar day, "YYYY-MM-DD". Optional for old snapshots. */
  day?: string;
  /** Number of 5-second readings averaged into this bucket. */
  samples?: number;
}

export type BiometricChannel = keyof BiometricState;
