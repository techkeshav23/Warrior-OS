// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dream Engine
// Reads yesterday's activity from localStorage (NO Firestore) and
// builds a render-ready DreamScene. Pure + SSR-safe: every reader
// guards `typeof window` and swallows parse errors — never throws.
// ═══════════════════════════════════════════════════════════

'use client';

import type {
  DreamActivity,
  DreamObjectKind,
  DreamScene,
  DreamSceneObject,
  DreamThemeKey,
} from '@/types/dream';
import { getDreamTheme, themeKeyForSubject, DREAM_NARRATION_HINTS } from '@/data/dream-themes';
import { clamp } from '@/lib/utils';

const DREAM_DURATION_MS = 5000;

// ─── DATE HELPERS ───

function dayKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Whole-day difference between two YYYY-MM-DD keys (a - b), in days. */
function daysBetween(aKey: string, bKey: string): number {
  const a = new Date(aKey + 'T00:00:00Z').getTime();
  const b = new Date(bKey + 'T00:00:00Z').getTime();
  return Math.round((a - b) / 86_400_000);
}

// ─── LOCALSTORAGE READERS (all guarded, all safe) ───

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

interface QuizAttemptLike {
  subject?: string;
  timestamp?: number;
  totalQuestions?: number;
}

/** Pull quiz attempts out of the persisted quiz-history store blob. */
function readQuizAttempts(): QuizAttemptLike[] {
  const blob = readJSON<{ state?: { attempts?: QuizAttemptLike[] } }>(
    'warrior-os-quiz-history',
    {}
  );
  const attempts = blob?.state?.attempts;
  return Array.isArray(attempts) ? attempts : [];
}

interface HabitLike {
  completions?: string[];
}

function readHabitCompletions(): string[] {
  const habits = readJSON<HabitLike[]>('warrior-habits', []);
  if (!Array.isArray(habits)) return [];
  return habits.flatMap((h) => (Array.isArray(h.completions) ? h.completions : []));
}

/** routine-done + plan-done are { 'YYYY-MM-DD': string[] } maps. */
function readDayMapCount(key: string, day: string): number {
  const map = readJSON<Record<string, unknown>>(key, {});
  const list = map?.[day];
  return Array.isArray(list) ? list.length : 0;
}

interface ProjectLike {
  name?: string;
  updatedAt?: string;
}

function readProjects(): ProjectLike[] {
  const projects = readJSON<ProjectLike[]>('warrior-projects', []);
  return Array.isArray(projects) ? projects : [];
}

function codeLabTouched(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('warrior-codelab') != null;
}

// ─── ACTIVITY AGGREGATION ───

/**
 * Build a DreamActivity snapshot for "yesterday" relative to `now`.
 * Falls back gracefully to an idle/void/first-ever shape when data is
 * sparse or missing.
 */
export function buildDreamActivity(now: Date = new Date()): DreamActivity {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000));

  const attempts = readQuizAttempts();
  const habitDates = readHabitCompletions();
  const projects = readProjects();

  // --- subjects studied yesterday (grouped by subject, counted) ---
  const subjectCounts = new Map<string, number>();
  let quizzesYesterday = 0;
  let questionsYesterday = 0;
  for (const a of attempts) {
    if (typeof a.timestamp !== 'number') continue;
    if (dayKey(new Date(a.timestamp)) !== yesterday) continue;
    quizzesYesterday += 1;
    questionsYesterday += typeof a.totalQuestions === 'number' ? a.totalQuestions : 0;
    if (a.subject) subjectCounts.set(a.subject, (subjectCounts.get(a.subject) ?? 0) + 1);
  }
  const subjects = [...subjectCounts.entries()]
    .map(([subject, count]) => ({ subject, count }))
    .sort((x, y) => y.count - x.count);

  // --- habits/routine yesterday ---
  const habitsYesterday =
    habitDates.filter((d) => d === yesterday).length +
    readDayMapCount('warrior-routine-done', yesterday) +
    readDayMapCount('warrior-plan-done', yesterday);

  // --- projects touched yesterday ---
  const projectsWorkedOn = projects
    .filter((p) => p.updatedAt && dayKey(new Date(p.updatedAt)) === yesterday && p.name)
    .map((p) => p.name as string);

  // --- coding heuristic: codelab exists OR a project was touched ---
  const codedYesterday = codeLabTouched() || projectsWorkedOn.length > 0;

  // --- rough study hours: ~4 min per question, capped at 12h ---
  const studyHours = clamp(Math.round((questionsYesterday * 4) / 60 * 10) / 10, 0, 12);

  // --- days since ANY activity (quiz timestamps + habit dates) ---
  const allDays = new Set<string>();
  for (const a of attempts) {
    if (typeof a.timestamp === 'number') allDays.add(dayKey(new Date(a.timestamp)));
  }
  for (const d of habitDates) allDays.add(d);
  for (const p of projects) if (p.updatedAt) allDays.add(dayKey(new Date(p.updatedAt)));

  const firstEver = allDays.size === 0;

  let daysSinceActive = firstEver ? Infinity : Number.MAX_SAFE_INTEGER;
  if (!firstEver) {
    for (const d of allDays) {
      const diff = daysBetween(today, d);
      if (diff >= 0 && diff < daysSinceActive) daysSinceActive = diff;
    }
  }

  // --- streak: count consecutive active days ending yesterday/today ---
  const { streak, streakBroken } = computeStreak(allDays, today, yesterday);

  return {
    subjects,
    quizzesTaken: quizzesYesterday,
    studyHours,
    projectsWorkedOn,
    codedYesterday,
    habitsCompleted: habitsYesterday,
    streak,
    streakBroken,
    daysSinceActive: firstEver ? 9999 : daysSinceActive,
    firstEver,
  };
}

function computeStreak(
  activeDays: Set<string>,
  today: string,
  yesterday: string
): { streak: number; streakBroken: boolean } {
  // Anchor: if active today use today, else if active yesterday use yesterday.
  let anchor: string | null = null;
  if (activeDays.has(today)) anchor = today;
  else if (activeDays.has(yesterday)) anchor = yesterday;

  if (!anchor) {
    // Not active today or yesterday. Broken if there was ever activity.
    return { streak: 0, streakBroken: activeDays.size > 0 };
  }

  let streak = 0;
  let cursor = new Date(anchor + 'T00:00:00Z');
  while (activeDays.has(dayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  // If anchored on yesterday (not today) and today is empty, the streak is
  // "at risk" but not yet broken — treat as alive.
  return { streak, streakBroken: false };
}

// ─── THEME SELECTION ───

function pickThemeKey(activity: DreamActivity): DreamThemeKey {
  if (activity.firstEver || activity.daysSinceActive >= 3) return 'void';

  const {
    subjects,
    projectsWorkedOn,
    codedYesterday,
    quizzesTaken,
    studyHours,
    habitsCompleted,
  } = activity;

  const hadAnyActivity =
    subjects.length > 0 ||
    projectsWorkedOn.length > 0 ||
    codedYesterday ||
    quizzesTaken > 0 ||
    habitsCompleted > 0;

  if (!hadAnyActivity) return 'idle';

  // Heavy mixed study day → exam-prep vibe.
  if (subjects.length >= 3 && quizzesTaken >= 5) return 'exam';

  // Multiple subjects, no dominant one → mixed constellation.
  if (subjects.length >= 2) {
    const top = subjects[0].count;
    const second = subjects[1].count;
    if (top - second <= 1) return 'mixed';
  }

  // A clear top subject wins.
  if (subjects.length >= 1) return themeKeyForSubject(subjects[0].subject);

  // No quizzes but they built something.
  if (projectsWorkedOn.length > 0) return 'project';
  if (codedYesterday) return 'code';
  if (studyHours > 0) return 'exam';

  return 'idle';
}

// ─── NARRATION SELECTION ───

function buildNarration(themeKey: DreamThemeKey, activity: DreamActivity): string[] {
  const theme = getDreamTheme(themeKey);
  const lines: string[] = [];

  // Opening: activity-driven hint layered on top of the theme.
  if (themeKey === 'void') {
    lines.push(DREAM_NARRATION_HINTS.returned, theme.narration[0]);
  } else if (themeKey === 'idle') {
    lines.push(DREAM_NARRATION_HINTS.idle, theme.narration[1] ?? theme.narration[0]);
  } else {
    // pick a theme flavour line
    lines.push(theme.narration[0]);
    if (activity.studyHours >= 2 || activity.quizzesTaken >= 3) {
      lines.push(DREAM_NARRATION_HINTS.studiedHard);
    } else if (activity.projectsWorkedOn.length > 0) {
      lines.push(DREAM_NARRATION_HINTS.builtProject);
    } else if (activity.codedYesterday) {
      lines.push(DREAM_NARRATION_HINTS.coded);
    } else {
      lines.push(theme.narration[1] ?? theme.narration[0]);
    }
  }

  // Closing: streak state.
  if (activity.streakBroken) lines.push(DREAM_NARRATION_HINTS.streakBroken);
  else if (activity.streak >= 2) lines.push(DREAM_NARRATION_HINTS.streakAlive);

  // De-dupe while preserving order, cap at 3 (fits the 5s window).
  return [...new Set(lines)].slice(0, 3);
}

// ─── SCENE OBJECT GENERATION ───

// Deterministic-ish PRNG so a given day looks stable across re-mounts.
function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const SUBJECT_TEXT: Partial<Record<DreamObjectKind, string[]>> = {
  'sql-query-text': ['SELECT *', 'JOIN ON', 'GROUP BY', 'WHERE id=', 'INDEX'],
  'code-block': ['fn()', '{ }', '=>', 'async', 'return'],
  'terminal-line': ['$ run', '> build', 'PASS', '✓ ok', 'exit 0'],
  'binary-stream': ['0110', '1001', '1110', '0101'],
  'automaton-state': ['q0', 'q1', 'qf', 'q2'],
  'logic-gate': ['AND', 'OR', 'XOR', 'NAND'],
  'brace-glyph': ['{', '}', '( )', '[ ]'],
};

function buildObjects(
  themeKey: DreamThemeKey,
  intensity: number,
  seed: number
): DreamSceneObject[] {
  const theme = getDreamTheme(themeKey);
  const rng = makeRng(seed);
  const isVoidish = themeKey === 'void' || themeKey === 'idle';

  // Object count scales with intensity; voidish dreams are sparse & drifty.
  const base = isVoidish ? 10 : 14;
  const count = Math.round(base + intensity * 12);

  const objects: DreamSceneObject[] = [];
  for (let i = 0; i < count; i++) {
    const kind = theme.objects[i % theme.objects.length];
    const textPool = SUBJECT_TEXT[kind];
    const text = textPool ? textPool[Math.floor(rng() * textPool.length)] : undefined;

    objects.push({
      id: `dobj_${i}`,
      kind,
      x: rng(),
      y: rng(),
      vx: (rng() - 0.5) * (isVoidish ? 0.012 : 0.03),
      vy: (rng() - 0.5) * (isVoidish ? 0.012 : 0.03) - (isVoidish ? 0.004 : 0.008),
      size: (isVoidish ? 6 : 26) + rng() * (isVoidish ? 10 : 48),
      rotation: rng() * 360,
      spin: (rng() - 0.5) * (isVoidish ? 6 : 24),
      opacity: (isVoidish ? 0.25 : 0.45) + rng() * 0.4,
      text,
      phase: rng() * Math.PI * 2,
    });
  }
  return objects;
}

// ─── PUBLIC API ───

/**
 * Build a fully render-ready DreamScene from localStorage activity.
 * SSR-safe and total: on the server (or with no data) it returns a
 * valid void/idle scene rather than throwing.
 */
export function buildDreamScene(now: Date = new Date()): DreamScene {
  const activity = buildDreamActivity(now);
  const themeKey = pickThemeKey(activity);
  const theme = getDreamTheme(themeKey);

  // Intensity from study hours / quizzes / projects, 0..1.
  const intensity = clamp(
    activity.studyHours / 6 +
      activity.quizzesTaken / 12 +
      activity.projectsWorkedOn.length / 4,
    themeKey === 'void' ? 0 : 0.15,
    1
  );

  const seed = Number(dayKey(now).replace(/-/g, '')) || 1;
  const objects = buildObjects(themeKey, intensity, seed);
  const narration = buildNarration(themeKey, activity);

  return {
    themeKey,
    label: theme.label,
    primaryColor: theme.color,
    ambientColor: theme.ambientColor,
    ambient: theme.ambient,
    objects,
    narration,
    durationMs: DREAM_DURATION_MS,
    intensity,
    activity,
  };
}

/**
 * Should the dream be shown at all? First-ever users skip straight to
 * boot (spec 6.67). Returning users always dream.
 */
export function shouldPlayDream(now: Date = new Date()): boolean {
  const activity = buildDreamActivity(now);
  return !activity.firstEver;
}

export { DREAM_DURATION_MS };
