// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Widget Data Helpers
// Pure functions that turn real OS data (Habit Forge's habits and
// the quiz history store) into widget numbers. Day keys are UTC
// dates, exactly like Habit Forge, routines, the planner and Stats
// Center's StreakBoard, so every streak in the OS agrees.
// ═══════════════════════════════════════════════════════════

import type { QuizAttempt } from '@/stores/useQuizHistoryStore';

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
 * Same rule as Stats Center's StreakBoard: a day is active when at least
 * one habit was completed; a not-yet-done "today" does not break the run.
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

/** Questions answered (and answered correctly) on a given UTC day. */
export function questionsOn(
  attempts: QuizAttempt[],
  dayKey: string
): { solved: number; correct: number } {
  let solved = 0;
  let correct = 0;
  for (const attempt of attempts) {
    if (!Number.isFinite(attempt.timestamp) || utcDayKey(attempt.timestamp) !== dayKey) continue;
    solved += Math.max(0, attempt.totalQuestions);
    correct += Math.max(0, Math.min(attempt.correctAnswers, attempt.totalQuestions));
  }
  return { solved, correct };
}
