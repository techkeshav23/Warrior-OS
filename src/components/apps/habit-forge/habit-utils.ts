// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Habit Forge helpers
// Presets, the custom-habit emoji set and pure day-key maths for the
// streak hero, habit cards and the 90-day grid (UTC day keys, like
// every other streak and log in the OS).
// ═══════════════════════════════════════════════════════════

import { shiftDayKey } from '@/components/achievements/day-streak';

export interface HabitPreset {
  name: string;
  icon: string;
  color: string;
}

export const PRESET_HABITS: readonly HabitPreset[] = [
  { name: 'Study 4h+', icon: '📚', color: 'cyan' },
  { name: 'Exercise', icon: '💪', color: 'green' },
  { name: 'No social media', icon: '📵', color: 'red' },
  { name: 'Daily quiz', icon: '✏️', color: 'purple' },
  { name: 'Read 20 pages', icon: '📖', color: 'amber' },
  { name: 'Early wake up', icon: '🌅', color: 'orange' },
  { name: 'Meditate', icon: '🧘', color: 'blue' },
  { name: 'Drank 3L water', icon: '💧', color: 'sky' },
];

/** Emoji a custom habit can wear (user content, chosen in the add dialog). */
export const HABIT_EMOJI_CHOICES: readonly string[] = [
  '🔥', '📚', '💪', '🧠', '💻', '🏃', '🧘', '💧', '✍️', '🎯', '🥗', '😴', '🎧', '🧹', '🌱', '🎸',
];

export const MAX_HABIT_NAME_LENGTH = 40;

/** localStorage key of the routine checklist: { [utcDayKey]: routineId[] }. */
export const ROUTINE_KEY = 'warrior-routine-done';

/** Routine ids checked off on a day (UTC day key). Empty when storage is blocked or corrupt. */
export function loadRoutineDone(dayKey: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const data = JSON.parse(localStorage.getItem(ROUTINE_KEY) || '{}');
    return new Set(Array.isArray(data[dayKey]) ? data[dayKey] : []);
  } catch {
    return new Set();
  }
}

/** Day keys for the last `count` days, oldest first, ending on `today`. */
export function lastDays(today: string, count: number): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) keys.push(shiftDayKey(today, -i));
  return keys;
}

/** Consecutive completed days ending today (or yesterday while today is still open). */
export function habitRun(completions: readonly string[], today: string): number {
  const done = new Set(completions);
  let cursor = done.has(today) ? today : shiftDayKey(today, -1);
  let run = 0;
  while (cursor && done.has(cursor)) {
    run += 1;
    cursor = shiftDayKey(cursor, -1);
  }
  return run;
}

/** 0 = Monday … 6 = Sunday for a UTC day key. */
export function mondayIndex(dayKey: string): number {
  const day = new Date(`${dayKey}T00:00:00Z`).getUTCDay();
  return (day + 6) % 7;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** "Mon 28 Sep" for a UTC day key. */
export function shortDate(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dayKey;
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Sep" for a UTC day key. */
export function monthLabel(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? '' : MONTHS[d.getUTCMonth()];
}
