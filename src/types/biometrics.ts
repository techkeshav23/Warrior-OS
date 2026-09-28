// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Typing Biometrics Types
// Mental-state model derived from typing behaviour
// ═══════════════════════════════════════════════════════════

/** Live mental-state estimate, each field 0-100. */
export interface BiometricState {
  energy: number; // ⚡ derived from typing speed
  focus: number; // 🎯 derived from pause patterns
  fatigue: number; // 💤 derived from errors + session length
  stress: number; // 😤 derived from rhythm variance + errors
}

/** Raw typing metrics measured over a rolling window. */
export interface TypingMetrics {
  wpm: number; // words per minute (rolling 60s)
  errorRate: number; // backspace/delete per 100 keystrokes (0-100)
  pauseAvg: number; // average inter-keystroke pause in ms
  rhythmScore: number; // std-dev of keystroke intervals in ms (lower = steadier)
}

/** A timestamped snapshot combining state + metrics. */
export interface BiometricSnapshot {
  timestamp: number; // Date.now()
  hour: number; // 0-23 local hour, for heatmap bucketing
  state: BiometricState;
  metrics: TypingMetrics;
}

export type BiometricChannel = keyof BiometricState;
