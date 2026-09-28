// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Study Streak
// A UTC day counts when the user studied: a quiz or mock test, a topic
// revision or planner task, a habit or routine check-off, a note
// written or edited, or 10+ tracked study minutes.
// Drives the streak achievements and the daily streak XP bonus.
// (Every habit check-off day counts, so it is never below the habit streak.)
// ═══════════════════════════════════════════════════════════

import { useQuizHistoryStore } from '@/stores/useQuizHistoryStore';
import { useXPStore } from '@/stores/useXPStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { utcDayKey, type WiredAchievementId } from './award';
import {
  checkStreakAchievements,
  currentStreak,
  longestStreak,
  streakAchievementsFor,
  toDayKey,
} from './day-streak';
import { useAchievementProgressStore } from './progress-store';

/** Tracked study minutes that make a day count on their own. */
export const STUDY_DAY_MIN_MINUTES = 10;
/** "Maintain streak +5 XP/day (compounds)": 5 XP per streak day, paid once a day. */
export const STREAK_BONUS_PER_DAY = 5;
/** The daily bonus stops growing after this many streak days (max 100 XP a day). */
export const STREAK_BONUS_CAP_DAYS = 20;

function readStored(key: string): unknown {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(window.localStorage.getItem(key) || 'null') as unknown;
  } catch {
    return null;
  }
}

/** Every UTC day with study activity. */
export function collectStudyDays(): Set<string> {
  const days = new Set<string>();
  const add = (value: unknown) => {
    const key = toDayKey(value);
    if (key) days.add(key);
  };

  for (const attempt of useQuizHistoryStore.getState().attempts) add(attempt.timestamp);

  const habits = readStored('warrior-habits');
  if (Array.isArray(habits)) {
    for (const habit of habits) {
      const completions = (habit as { completions?: unknown } | null)?.completions;
      if (Array.isArray(completions)) completions.forEach(add);
    }
  }

  const routines = readStored('warrior-routine-done');
  if (routines && typeof routines === 'object' && !Array.isArray(routines)) {
    for (const [day, ids] of Object.entries(routines as Record<string, unknown>)) {
      if (Array.isArray(ids) && ids.length > 0) add(day);
    }
  }

  const notes = readStored('warrior-notes');
  if (Array.isArray(notes)) {
    for (const note of notes) {
      const n = note as { createdAt?: unknown; updatedAt?: unknown } | null;
      add(n?.createdAt);
      add(n?.updatedAt);
    }
  }

  const progress = useAchievementProgressStore.getState();
  // Quizzes / mock tests (mocks never reach quiz history), revisions, planner check-offs.
  for (const day of progress.activityDays) add(day);
  for (const [day, minutes] of Object.entries(progress.studyMinutesByDay)) {
    if (minutes >= STUDY_DAY_MIN_MINUTES) add(day);
  }

  return days;
}

export interface StudyStreakCheck {
  /** Current study streak in days (today counts once it has activity). */
  streak: number;
  /** Streak bonus XP paid by this call (0 if already paid today). */
  bonusXp: number;
}

/**
 * Call right after any study activity has been saved. Unlocks the streak
 * achievements the current streak has reached and, on the first activity
 * of a day that continues a 2+ day streak, pays the daily streak bonus.
 */
export function checkStudyStreak(): StudyStreakCheck {
  const today = utcDayKey();
  const days = collectStudyDays();
  const streak = currentStreak(days, today);
  checkStreakAchievements(streak);

  let bonusXp = 0;
  const progress = useAchievementProgressStore.getState();
  if (days.has(today) && streak >= 2 && progress.streakBonusDay !== today) {
    bonusXp = STREAK_BONUS_PER_DAY * Math.min(streak, STREAK_BONUS_CAP_DAYS);
    progress.setStreakBonusDay(today);
    useXPStore.getState().addXP(bonusXp, 'streak');
    useNotificationStore.getState().addNotification({
      type: 'success',
      title: `🔥 ${streak}-day study streak`,
      message: `Streak kept alive. +${bonusXp} XP streak bonus.`,
      icon: '🔥',
    });
  }
  return { streak, bonusXp };
}

/**
 * For study actions whose own storage keeps no per-day history
 * (quiz / mock test completed, topic revised, planner task done): mark
 * today as a study day, then run the streak check.
 */
export function recordStudyAction(): StudyStreakCheck {
  useAchievementProgressStore.getState().markActiveDay(utcDayKey());
  return checkStudyStreak();
}

/** Catch-up: the best streak in the saved history counts as "maintained". */
export function studyStreakAchievementsFromHistory(): WiredAchievementId[] {
  const days = collectStudyDays();
  return streakAchievementsFor(Math.max(currentStreak(days), longestStreak(days)));
}
