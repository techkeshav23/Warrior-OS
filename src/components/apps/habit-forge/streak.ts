// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Habit Streak & Rewards
// Habit completion XP, stored-habit parsing, and the hand-off to the
// study streak (streak achievements + daily streak bonus)
// ═══════════════════════════════════════════════════════════

import type { Habit } from './HabitForgeApp';
import { useXPStore } from '@/stores/useXPStore';
import { utcDayKey } from '@/components/achievements/award';
import { useAchievementProgressStore } from '@/components/achievements/progress-store';
import { checkStudyStreak } from '@/components/achievements/study-streak';

/** "Complete habit +3 XP per habit" — paid once per habit per UTC day. */
export const HABIT_COMPLETION_XP = 3;

/** Validate the raw 'warrior-habits' localStorage value. */
export function parseStoredHabits(raw: unknown): Habit[] {
  if (!Array.isArray(raw)) return [];
  const habits: Habit[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const h = item as Partial<Habit>;
    if (typeof h.id !== 'string' || !Array.isArray(h.completions)) continue;
    habits.push({
      id: h.id,
      name: typeof h.name === 'string' ? h.name : '',
      icon: typeof h.icon === 'string' ? h.icon : '',
      color: typeof h.color === 'string' ? h.color : '',
      completions: h.completions.filter((d): d is string => typeof d === 'string'),
    });
  }
  return habits;
}

export interface HabitReward {
  /** Completion XP paid now (0 if this habit was already paid today). */
  habitXp: number;
  /** Study streak after this check-off. */
  streak: number;
  /** Streak bonus paid now (0 unless this was the day's first study activity). */
  streakBonus: number;
}

/**
 * Call right after a habit has been checked off for today and saved.
 * Pays the habit XP, then lets the study streak unlock streak achievements
 * and pay the once-a-day streak bonus.
 */
export function rewardHabitCompletion(habitId: string): HabitReward {
  const claimed = useAchievementProgressStore.getState().claimHabitXp(utcDayKey(), habitId);
  if (claimed) useXPStore.getState().addXP(HABIT_COMPLETION_XP, 'habit');
  const { streak, bonusXp } = checkStudyStreak();
  return { habitXp: claimed ? HABIT_COMPLETION_XP : 0, streak, streakBonus: bonusXp };
}
