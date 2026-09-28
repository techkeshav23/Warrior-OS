// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Ghost presence: the local warrior's public stats
// studyHoursToday = focused minutes in study + build apps today (the
//                   creature's activity log), quizzesToday = quiz
//                   submissions today, streak = activity-day streak.
// All derived from data the OS already keeps; nothing is invented.
// ═══════════════════════════════════════════════════════════

import { useCreatureStore } from '@/stores/useCreatureStore';
import type { GhostSelfStats } from '@/types/ghost';
import {
  collectActivityDays,
  computeActivityStreak,
  countQuizSubmissions,
  readQuizAttempts,
  utcDayKey,
} from '@/components/dream/activityHistory';

const STREAK_CACHE_MS = 5 * 60 * 1000;
let streakCache: { at: number; day: string; value: number } | null = null;

function currentStreak(today: string): number {
  const now = Date.now();
  if (streakCache && streakCache.day === today && now - streakCache.at < STREAK_CACHE_MS) {
    return streakCache.value;
  }
  const value = computeActivityStreak(collectActivityDays().active, today).current;
  streakCache = { at: now, day: today, value };
  return value;
}

export function computeSelfStats(): GhostSelfStats {
  const today = utcDayKey();
  const log = useCreatureStore.getState().activityLog[today];
  const minutes = log ? log.studyMinutes + log.codeMinutes : 0;
  return {
    studyHoursToday: Math.round((minutes / 60) * 10) / 10,
    quizzesToday: countQuizSubmissions(readQuizAttempts(), today),
    streak: currentStreak(today),
  };
}
