// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Widget Data Helpers
// Pure functions that turn real OS data (Habit Forge's habits and
// the learning store's answer log) into widget numbers. Day keys are
// UTC dates, exactly like Habit Forge, routines, the planner and the
// study streak, so every "today" in the OS agrees.
// ═══════════════════════════════════════════════════════════

import type { CardAttempt } from '@/types/learning';

export const HABITS_STORAGE_KEY = 'warrior-habits';
export const DAY_MS = 24 * 60 * 60 * 1000;

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD of the UTC day containing `ms` (the OS-wide day key). */
export function utcDayKey(ms: number): string {
  const date = new Date(ms);
  // toISOString throws on an invalid date; corrupt data must not crash a widget.
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export interface HabitSnapshot {
  id: string;
  name: string;
  completions: string[];
}

/** Defensive parse of the raw `warrior-habits` localStorage value. */
export function parseHabits(raw: string | null): HabitSnapshot[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  const habits: HabitSnapshot[] = [];
  for (const item of data as unknown[]) {
    if (typeof item !== 'object' || item === null) continue;
    const record = item as Record<string, unknown>;
    const completions = Array.isArray(record.completions)
      ? (record.completions as unknown[])
          .filter((d): d is string => typeof d === 'string')
          .map((d) => d.slice(0, 10))
          .filter((d) => DAY_KEY_PATTERN.test(d))
      : [];
    habits.push({
      id: typeof record.id === 'string' ? record.id : `habit-${habits.length}`,
      name: typeof record.name === 'string' ? record.name : 'Habit',
      completions,
    });
  }
  return habits;
}

export interface StreakInfo {
  /** Consecutive active days ending today (or yesterday, if today is still open) */
  current: number;
  longest: number;
  /** Whether today already counts */
  doneToday: boolean;
}

/**
 * Habit streak: a day is active when at least one habit was completed;
 * a not-yet-done "today" does not break the run. (Stats Center shows it
 * next to the study streak, which also counts cards, quizzes and notes.)
 */
export function computeStreak(habits: HabitSnapshot[], nowMs: number): StreakInfo {
  const activeDays = new Set<string>();
  for (const habit of habits) {
    for (const day of habit.completions) activeDays.add(day);
  }

  const todayKey = utcDayKey(nowMs);
  let current = 0;
  // Walk back one UTC day at a time; stops at the first gap.
  for (let i = 0; i < 3700; i++) {
    const key = utcDayKey(nowMs - i * DAY_MS);
    if (activeDays.has(key)) {
      current++;
    } else if (i === 0) {
      continue; // today may simply not be done yet
    } else {
      break;
    }
  }

  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const key of [...activeDays].sort()) {
    const t = Date.parse(`${key}T00:00:00Z`);
    if (Number.isNaN(t)) continue;
    run = prev !== null && t - prev === DAY_MS ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = t;
  }

  return { current, longest: Math.max(longest, current), doneToday: activeDays.has(todayKey) };
}

/** Habits ticked today vs. habits defined. */
export function habitsDoneOn(habits: HabitSnapshot[], dayKey: string): { done: number; total: number } {
  let done = 0;
  for (const habit of habits) {
    if (habit.completions.includes(dayKey)) done++;
  }
  return { done, total: habits.length };
}

/** Cards answered (and answered right) on a given UTC day: quizzes, mock tests and reviews alike. */
export function cardsAnsweredOn(
  attempts: readonly CardAttempt[],
  dayKey: string
): { answered: number; correct: number } {
  const start = Date.parse(`${dayKey}T00:00:00Z`);
  if (Number.isNaN(start)) return { answered: 0, correct: 0 };
  const end = start + DAY_MS;
  let answered = 0;
  let correct = 0;
  for (const attempt of attempts) {
    const t = attempt.timestamp;
    if (!Number.isFinite(t) || t < start || t >= end) continue;
    answered++;
    if (attempt.correct) correct++;
  }
  return { answered, correct };
}
