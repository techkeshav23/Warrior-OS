// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Activity History (read-only aggregator)
// Derives day-by-day activity from data other features already keep:
// Training Grounds card attempts, quiz history, notes, habit + routine
// logs, projects (Project Forge sessions), procedural music and the
// creature's own activity log (XP fed + focused minutes). Never writes
// to another feature's storage. Stores that the boot screen doesn't
// otherwise load (learning, forge, music) are read from their persisted
// JSON, so the boot bundle stays lean. Day keys are UTC (YYYY-MM-DD),
// the convention habits/routines use, so streaks line up across the OS.
// ═══════════════════════════════════════════════════════════

import { useQuizHistoryStore, type QuizAttempt } from '@/stores/useQuizHistoryStore';
import { useCreatureStore } from '@/stores/useCreatureStore';
import type { CreatureDayLog } from '@/types/creature';

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

/** Local-time day key (the procedural music log uses local days). */
export function localDayKey(ms: number = Date.now()): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

/** Notes created or edited on a day: count + titles (latest first). */
export function readNotesTouchedOn(day: string, maxTitles = 5): { count: number; titles: string[] } {
  const notes = readJSON<unknown>('warrior-notes', []);
  if (!Array.isArray(notes)) return { count: 0, titles: [] };
  const touched: { title: string; at: number }[] = [];
  for (const n of notes) {
    if (!n || typeof n !== 'object') continue;
    const r = n as Record<string, unknown>;
    if (toDayKey(r.createdAt) !== day && toDayKey(r.updatedAt) !== day) continue;
    const title = typeof r.title === 'string' ? r.title.trim() : '';
    const at = typeof r.updatedAt === 'string' ? Date.parse(r.updatedAt) : Number.NaN;
    touched.push({ title, at: Number.isNaN(at) ? 0 : at });
  }
  const titles = touched
    .filter((t) => t.title && t.title !== 'Untitled Note')
    .sort((a, b) => b.at - a.at)
    .slice(0, maxTitles)
    .map((t) => t.title);
  return { count: touched.length, titles };
}

/** Names of habits completed on a day (warrior-habits). */
export function readHabitNamesOn(day: string): string[] {
  const habits = readJSON<unknown>('warrior-habits', []);
  if (!Array.isArray(habits)) return [];
  const names: string[] = [];
  for (const h of habits) {
    const r = (h ?? {}) as { name?: unknown; completions?: unknown };
    if (typeof r.name !== 'string' || !r.name.trim() || !Array.isArray(r.completions)) continue;
    if (r.completions.some((c) => toDayKey(c) === day)) names.push(r.name.trim());
  }
  return names;
}

// ─── Training Grounds (useLearningStore's persisted state, read raw) ───

const LEARNING_KEY = 'warrior-os-learning';

export interface LearningAttemptLite {
  deckId: string;
  correct: boolean;
  timestamp: number;
}

export interface LearningSnapshot {
  /** Deck id → the user's deck name. */
  deckNames: Record<string, string>;
  /** Answered cards (quiz, mock, flashcards, reviews), oldest first. */
  attempts: LearningAttemptLite[];
}

const EMPTY_LEARNING: LearningSnapshot = { deckNames: {}, attempts: [] };
let learningCache: { raw: string; value: LearningSnapshot } | null = null;

/** Deck names + card attempts. Cached until the persisted state changes. */
export function readLearningSnapshot(): LearningSnapshot {
  if (typeof window === 'undefined') return EMPTY_LEARNING;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(LEARNING_KEY);
  } catch {
    return EMPTY_LEARNING;
  }
  if (!raw) return EMPTY_LEARNING;
  if (learningCache && learningCache.raw === raw) return learningCache.value;
  const value: LearningSnapshot = { deckNames: {}, attempts: [] };
  try {
    const state = (JSON.parse(raw) as { state?: { decks?: unknown; attempts?: unknown } } | null)?.state;
    if (Array.isArray(state?.decks)) {
      for (const d of state.decks as { id?: unknown; name?: unknown }[]) {
        if (d && typeof d.id === 'string' && typeof d.name === 'string') value.deckNames[d.id] = d.name;
      }
    }
    if (Array.isArray(state?.attempts)) {
      for (const a of state.attempts as { deckId?: unknown; correct?: unknown; timestamp?: unknown }[]) {
        if (!a || typeof a.deckId !== 'string' || typeof a.timestamp !== 'number' || !Number.isFinite(a.timestamp)) continue;
        value.attempts.push({ deckId: a.deckId, correct: a.correct === true, timestamp: a.timestamp });
      }
    }
  } catch {
    /* corrupt state → nothing studied */
  }
  learningCache = { raw, value };
  return value;
}

// ─── Project Forge sessions (persisted state, read raw) ───

/** Minutes logged per project on a UTC day (timer + manual sessions). */
export function readProjectMinutesOn(day: string): { minutes: number; names: string[] } {
  const blob = readJSON<{ state?: { projects?: unknown; sessions?: unknown } }>('warrior-os-project-forge', {});
  const state = blob?.state;
  if (!state || !Array.isArray(state.sessions)) return { minutes: 0, names: [] };
  const names = new Map<string, string>();
  if (Array.isArray(state.projects)) {
    for (const p of state.projects as { id?: unknown; name?: unknown }[]) {
      if (p && typeof p.id === 'string' && typeof p.name === 'string') names.set(p.id, p.name);
    }
  }
  const dayStart = Date.parse(`${day}T00:00:00Z`);
  const dayEnd = dayStart + DAY_MS;
  const perProject = new Map<string, number>();
  for (const s of state.sessions as { projectId?: unknown; start?: unknown; end?: unknown }[]) {
    if (!s || typeof s.projectId !== 'string' || typeof s.start !== 'number' || typeof s.end !== 'number') continue;
    const overlap = Math.min(s.end, dayEnd) - Math.max(s.start, dayStart);
    if (overlap > 0) perProject.set(s.projectId, (perProject.get(s.projectId) ?? 0) + overlap);
  }
  const ranked = [...perProject.entries()].sort((a, b) => b[1] - a[1]);
  return {
    minutes: Math.round(ranked.reduce((sum, [, ms]) => sum + ms, 0) / 60_000),
    names: ranked.map(([id]) => names.get(id)).filter((n): n is string => Boolean(n)),
  };
}

// ─── Procedural music (persisted state, read raw) ───

/** Music moods played on a local day ('warrior-os-musicgen' keeps the latest day only). */
export function readMusicMoodsOn(localDay: string): string[] {
  const blob = readJSON<{ state?: { modesToday?: { day?: unknown; modes?: unknown } } }>('warrior-os-musicgen', {});
  const today = blob?.state?.modesToday;
  if (!today || today.day !== localDay || !Array.isArray(today.modes)) return [];
  return today.modes.filter((m): m is string => typeof m === 'string');
}

/** Note timestamps only (cheap). */
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
  /** Days with real activity (cards, quiz, note, habit, routine, project, XP, focus). */
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
  // Flashcard + review sessions only write card attempts, so count those days too.
  for (const a of readLearningSnapshot().attempts) active.add(utcDayKey(a.timestamp));
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
