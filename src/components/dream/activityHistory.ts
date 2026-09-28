// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Activity History (read-only aggregator)
// Derives day-by-day activity from data other features already keep:
// quiz history, notes, habit + routine logs, projects, and the
// creature's own activity log (XP fed + focused minutes). Never writes
// to another feature's storage. Day keys are UTC (YYYY-MM-DD), the same
// convention habits/routines use, so streaks line up across the OS.
// ═══════════════════════════════════════════════════════════

import { useQuizHistoryStore, type QuizAttempt } from '@/stores/useQuizHistoryStore';
import { useCreatureStore } from '@/stores/useCreatureStore';
import type { CreatureDayLog } from '@/types/creature';
import { loadPalaceNotes, type PalaceNote } from '@/components/apps/memory-palace/palaceData';

const DAY_MS = 86_400_000;

// ─── Day keys ───

export function utcDayKey(ms: number = Date.now()): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function shiftDayKey(key: string, days: number): string {
  return utcDayKey(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS);
}

/** later - earlier, in whole days. */
export function daysBetweenKeys(later: string, earlier: string): number {
  return Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / DAY_MS);
}

function toDayKey(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return utcDayKey(value);
  if (typeof value !== 'string' || value.length < 10) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : utcDayKey(t);
}

// ─── Guarded readers ───

export function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function readQuizAttempts(): QuizAttempt[] {
  const attempts = useQuizHistoryStore.getState().attempts;
  return Array.isArray(attempts) ? attempts : [];
}

/**
 * Quiz submissions on a day. QuizEngine records one row per topic for
 * mixed quizzes, so rows within 3 seconds of each other are one quiz.
 */
export function countQuizSubmissions(attempts: QuizAttempt[], dayKey: string): number {
  const stamps = attempts
    .filter((a) => typeof a.timestamp === 'number' && utcDayKey(a.timestamp) === dayKey)
    .map((a) => a.timestamp)
    .sort((a, b) => a - b);
  let count = 0;
  let last = -Infinity;
  for (const t of stamps) {
    if (t - last > 3000) count += 1;
    last = t;
  }
  return count;
}

/** Habit completion day keys (warrior-habits). */
export function readHabitDays(): string[] {
  const habits = readJSON<unknown>('warrior-habits', []);
  if (!Array.isArray(habits)) return [];
  const days: string[] = [];
  for (const h of habits) {
    const completions = (h as { completions?: unknown })?.completions;
    if (!Array.isArray(completions)) continue;
    for (const c of completions) {
      const k = toDayKey(c);
      if (k) days.push(k);
    }
  }
  return days;
}

/** Routine check-offs per day (warrior-routine-done: { day: id[] }). */
export function readRoutineCounts(): Record<string, number> {
  const map = readJSON<unknown>('warrior-routine-done', {});
  const out: Record<string, number> = {};
  if (!map || typeof map !== 'object' || Array.isArray(map)) return out;
  for (const [day, list] of Object.entries(map as Record<string, unknown>)) {
    const k = toDayKey(day);
    if (k && Array.isArray(list) && list.length > 0) out[k] = (out[k] ?? 0) + list.length;
  }
  return out;
}

export interface ProjectLike {
  name: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export function readProjects(): ProjectLike[] {
  const projects = readJSON<unknown>('warrior-projects', []);
  if (!Array.isArray(projects)) return [];
  return projects
    .filter((p) => p && typeof p === 'object')
    .map((p) => {
      const r = p as Record<string, unknown>;
      return {
        name: typeof r.name === 'string' ? r.name : 'Untitled project',
        createdAt: typeof r.createdAt === 'string' ? r.createdAt : null,
        updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : null,
      };
    });
}

/** Notes with subject/topic inference (heavier — use for a few notes / once). */
export function readNotes(): PalaceNote[] {
  return loadPalaceNotes();
}

/** Note timestamps only (cheap — no subject inference). */
export function readNoteDates(): { createdAt: string | null; updatedAt: string | null }[] {
  const notes = readJSON<unknown>('warrior-notes', []);
  if (!Array.isArray(notes)) return [];
  return notes
    .filter((n) => n && typeof n === 'object')
    .map((n) => {
      const r = n as Record<string, unknown>;
      return {
        createdAt: typeof r.createdAt === 'string' ? r.createdAt : null,
        updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : null,
      };
    });
}

/** The creature's persisted per-day log (XP fed, focused minutes). */
export function readCreatureLog(): Record<string, CreatureDayLog> {
  const log = useCreatureStore.getState().activityLog;
  return log && typeof log === 'object' ? log : {};
}

/** Creature birth day — only if it was actually persisted (not a fresh default). */
function readPersistedCreatureBirthDay(): string | null {
  const blob = readJSON<{ state?: { birthDate?: unknown; bornAt?: unknown } }>('warrior-os-creature', {});
  const state = blob?.state;
  return toDayKey(state?.birthDate) ?? toDayKey(state?.bornAt);
}

/** Days on which a dream was seen (raw read of the dream journal). */
function readDreamDays(): string[] {
  const journal = readJSON<{ dreamDays?: unknown }>('warrior-dream-journal', {});
  const days = journal?.dreamDays;
  return Array.isArray(days) ? days.filter((d): d is string => typeof d === 'string') : [];
}

// ─── Activity sets ───

export interface ActivityDaySets {
  /** Days with real activity (quiz, note, habit, routine, project, XP, focus). */
  active: Set<string>;
  /** active ∪ days the OS was simply opened (creature log / birth / dreams). */
  presence: Set<string>;
}

/** Minimum focused minutes for a day to count as "active" on its own. */
const ACTIVE_FOCUS_MINUTES = 10;

export function collectActivityDays(): ActivityDaySets {
  const active = new Set<string>();
  for (const a of readQuizAttempts()) {
    if (typeof a.timestamp === 'number') active.add(utcDayKey(a.timestamp));
  }
  for (const d of readHabitDays()) active.add(d);
  for (const d of Object.keys(readRoutineCounts())) active.add(d);
  for (const n of readNoteDates()) {
    const c = toDayKey(n.createdAt);
    const u = toDayKey(n.updatedAt);
    if (c) active.add(c);
    if (u) active.add(u);
  }
  for (const p of readProjects()) {
    const c = toDayKey(p.createdAt);
    const u = toDayKey(p.updatedAt);
    if (c) active.add(c);
    if (u) active.add(u);
  }
  const creatureLog = readCreatureLog();
  for (const [day, log] of Object.entries(creatureLog)) {
    if (log.xp > 0 || log.studyMinutes + log.codeMinutes >= 5 || log.focusMinutes >= ACTIVE_FOCUS_MINUTES) {
      active.add(day);
    }
  }

  const presence = new Set(active);
  for (const day of Object.keys(creatureLog)) presence.add(day);
  const birth = readPersistedCreatureBirthDay();
  if (birth) presence.add(birth);
  for (const d of readDreamDays()) presence.add(d);
  return { active, presence };
}

// ─── Streaks ───

export interface ActivityStreak {
  /** Streak counting today if active, else ending yesterday (a missing today is tolerated). */
  current: number;
  /** Streak length ending yesterday. */
  asOfYesterday: number;
  /** Yesterday was empty but the day before was active: a streak just ended. */
  brokenYesterday: boolean;
  /** Length of the streak that ended (when brokenYesterday). */
  brokenLength: number;
}

function runLength(days: Set<string>, from: string): number {
  let n = 0;
  let cursor = from;
  while (days.has(cursor) && n < 3650) {
    n += 1;
    cursor = shiftDayKey(cursor, -1);
  }
  return n;
}

export function computeActivityStreak(activeDays: Set<string>, today: string = utcDayKey()): ActivityStreak {
  const yesterday = shiftDayKey(today, -1);
  const dayBefore = shiftDayKey(today, -2);
  const asOfYesterday = runLength(activeDays, yesterday);
  const current = activeDays.has(today) ? 1 + asOfYesterday : asOfYesterday;
  const brokenYesterday = !activeDays.has(yesterday) && activeDays.has(dayBefore);
  return {
    current,
    asOfYesterday,
    brokenYesterday,
    brokenLength: brokenYesterday ? runLength(activeDays, dayBefore) : 0,
  };
}
