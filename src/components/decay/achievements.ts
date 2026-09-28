// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Reality Decay Achievements
// Unlock checks fired at the exact moment each condition becomes
// true (stage transitions, break completion, study-minute ticks).
// ═══════════════════════════════════════════════════════════

import { useXPStore } from '@/stores/useXPStore';
import { useDecayStore } from '@/stores/useDecayStore';

export const DECAY_ACHIEVEMENTS = {
  /** First decay stage reached (spec "Mortal"). */
  mortal: 'decay-mortal',
  /** Stage 5 reached. */
  legendaryFocus: 'decay-legendary-focus',
  /** Stage 5 reached 10 times (spec "Iron Body"). */
  ironBody: 'decay-iron-body',
  /** First forced break completed. */
  firstBreak: 'decay-first-break',
  /** 50 forced breaks completed (spec "Balanced Warrior"). */
  balancedWarrior: 'decay-balanced-warrior',
  /** 8+ study hours in one day with breaks (spec "The Machine"). */
  theMachine: 'decay-the-machine',
} as const;

export const IRON_BODY_COUNT = 10;
export const BALANCED_WARRIOR_COUNT = 50;
/** The Machine: 8 hours in a day… */
export const MACHINE_MINUTES = 8 * 60;
/** …with at least one break per 4 hours of that study. */
export const MACHINE_MIN_BREAKS = 2;

function unlockOnce(id: string): void {
  const xp = useXPStore.getState();
  const existing = xp.achievements.find((a) => a.id === id);
  if (existing?.unlockedAt) return;
  xp.unlockAchievement(id);
}

/** Call when the decay stage increases. */
export function onDecayStageReached(stage: number): void {
  const { stats } = useDecayStore.getState();
  if (stage >= 1) unlockOnce(DECAY_ACHIEVEMENTS.mortal);
  if (stage >= 5) {
    unlockOnce(DECAY_ACHIEVEMENTS.legendaryFocus);
    if (stats.fullDecays >= IRON_BODY_COUNT) unlockOnce(DECAY_ACHIEVEMENTS.ironBody);
  }
}

/** Call after a break completes (counters already updated). */
export function onDecayBreakCompleted(reason: 'forced' | 'voluntary' | null): void {
  const { stats } = useDecayStore.getState();
  if (reason === 'forced') {
    unlockOnce(DECAY_ACHIEVEMENTS.firstBreak);
    if (stats.forcedBreaks >= BALANCED_WARRIOR_COUNT) {
      unlockOnce(DECAY_ACHIEVEMENTS.balancedWarrior);
    }
  }
  checkTheMachine();
}

/** 8+ hours studied today with the breaks to match. */
export function checkTheMachine(): void {
  const { daily } = useDecayStore.getState();
  if (daily.studyMinutes >= MACHINE_MINUTES && daily.breaks >= MACHINE_MIN_BREAKS) {
    unlockOnce(DECAY_ACHIEVEMENTS.theMachine);
  }
}
