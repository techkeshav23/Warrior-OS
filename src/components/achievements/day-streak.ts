// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Day Streaks
// Streak math over UTC day keys ('YYYY-MM-DD') and the streak
// milestone achievements (3 / 7 / 30 / 100 days)
// ═══════════════════════════════════════════════════════════

import { unlock, utcDayKey, type WiredAchievementId } from './award';

const DAY_MS = 86_400_000;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const STREAK_MILESTONES: ReadonlyArray<{ days: number; id: WiredAchievementId }> = [
  { days: 3, id: 'streak-3' },
  { days: 7, id: 'streak-7' },
  { days: 30, id: 'streak-30' },
  { days: 100, id: 'streak-100' },
];

/** Move a day key by whole days ('' for a malformed key). */
export function shiftDayKey(dayKey: string, deltaDays: number): string {
  const ms = Date.parse(`${dayKey}T00:00:00Z`);
  if (Number.isNaN(ms)) return '';
  return new Date(ms + deltaDays * DAY_MS).toISOString().slice(0, 10);
}

/** Normalise a stored date — day key, ISO string or epoch ms — to a UTC day key. */
export function toDayKey(value: unknown): string | null {
  if (typeof value === 'string' && DAY_KEY_PATTERN.test(value)) return value;
  let ms: number;
  if (typeof value === 'number') ms = value;
  else if (typeof value === 'string') ms = Date.parse(value);
  else return null;
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : utcDayKey(date);
}

/** Consecutive days ending today, or ending yesterday while today is still empty. */
export function currentStreak(days: ReadonlySet<string>, today: string = utcDayKey()): number {
  let cursor = days.has(today) ? today : shiftDayKey(today, -1);
  let streak = 0;
  while (cursor && days.has(cursor)) {
    streak += 1;
    cursor = shiftDayKey(cursor, -1);
  }
  return streak;
}

/** Longest run of consecutive days in the set. */
export function longestStreak(days: ReadonlySet<string>): number {
  const sorted = [...days].filter((d) => DAY_KEY_PATTERN.test(d)).sort();
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of sorted) {
    run = previous !== null && shiftDayKey(previous, 1) === day ? run + 1 : 1;
    if (run > longest) longest = run;
    previous = day;
  }
  return longest;
}

export function streakAchievementsFor(streakDays: number): WiredAchievementId[] {
  return STREAK_MILESTONES.filter((m) => streakDays >= m.days).map((m) => m.id);
}

export function checkStreakAchievements(streakDays: number): void {
  for (const id of streakAchievementsFor(streakDays)) unlock(id);
}
