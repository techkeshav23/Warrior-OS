// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Biometric Achievements
// Unlocks biometric achievements at the moment their condition
// becomes true. Called after every live reading and when the
// history view is opened.
// ═══════════════════════════════════════════════════════════

import { useXPStore } from '@/stores/useXPStore';
import { useBiometricsStore } from '@/stores/useBiometricsStore';

export const BIOMETRIC_ACHIEVEMENTS = {
  /** First live reading of the user's mental state. */
  firstRead: 'biometrics-first-read',
  /** A reading with 90%+ focus. */
  inTheZone: 'biometrics-in-the-zone',
  /** Focus > 95% continuously for one hour (spec "In The Zone"). */
  zoneHour: 'biometrics-zone-hour',
  /** History viewed on 30 different days (spec "Self-Aware"). */
  selfAware: 'biometrics-self-aware',
  /** Stress < 10% continuously for two hours (spec "Zen Master"). */
  zenMaster: 'biometrics-zen-master',
  /** 100+ WPM reading (spec "Speedster"). */
  speedster: 'biometrics-speedster',
} as const;

const ZONE_HOUR_MS = 60 * 60_000;
const ZEN_MS = 2 * 60 * 60_000;
export const SELF_AWARE_DAYS = 30;

/** Unlock once; skips the store write when already unlocked. */
function unlockOnce(id: string): void {
  const xp = useXPStore.getState();
  const existing = xp.achievements.find((a) => a.id === id);
  if (existing?.unlockedAt) return;
  xp.unlockAchievement(id);
}

/** Evaluate reading-driven achievements. `now` is epoch ms. */
export function evaluateBiometricAchievements(now: number): void {
  const s = useBiometricsStore.getState();
  if (s.lastUpdated === null) return;

  unlockOnce(BIOMETRIC_ACHIEVEMENTS.firstRead);
  if (s.current.focus >= 90) unlockOnce(BIOMETRIC_ACHIEVEMENTS.inTheZone);
  if (s.metrics.wpm >= 100) unlockOnce(BIOMETRIC_ACHIEVEMENTS.speedster);
  if (s.flowSince !== null && now - s.flowSince >= ZONE_HOUR_MS) {
    unlockOnce(BIOMETRIC_ACHIEVEMENTS.zoneHour);
  }
  if (s.calmSince !== null && now - s.calmSince >= ZEN_MS) {
    unlockOnce(BIOMETRIC_ACHIEVEMENTS.zenMaster);
  }
}

/** Record that the history was viewed today; unlock at 30 distinct days. */
export function recordHistoryCheck(): number {
  const days = useBiometricsStore.getState().markHistoryChecked();
  if (days >= SELF_AWARE_DAYS) unlockOnce(BIOMETRIC_ACHIEVEMENTS.selfAware);
  return days;
}
