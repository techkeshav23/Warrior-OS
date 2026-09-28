// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dream Engine
// Reads yesterday's activity from data the OS already keeps — quiz
// history, note timestamps, habit + routine logs, projects and the
// creature's activity log (XP earned, focused study/code minutes) —
// and builds a render-ready DreamScene. No Firestore, no new writes to
// other features. SSR-safe: every reader guards `window`; never throws.
//
// Theme rules (spec 6.63–6.67):
//   • nothing ever happened before today  → first-ever: no dream (boot)
//   • last presence 3+ days ago            → 'void' (deep, concerned)
//   • no activity yesterday                → 'idle' (dark void, stars)
//   • otherwise the subjects / work of yesterday pick the theme
// ═══════════════════════════════════════════════════════════

'use client';

import type {
  DreamActivity,
  DreamAnimation,
  DreamBootPhase,
  DreamElement,
  DreamObjectKind,
  DreamScene,
  DreamThemeKey,
} from '@/types/dream';
import {
  DREAM_NARRATION_HINTS,
  SUBJECT_THEME_KEYS,
  getDreamTheme,
  themeKeyForSubject,
} from '@/data/dream-themes';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { inferNoteSubject } from '@/components/apps/memory-palace/palaceData';
import {
  collectActivityDays,
  computeActivityStreak,
  countQuizSubmissions,
  daysBetweenKeys,
  readCreatureLog,
  readHabitDays,
  readJSON,
  readProjects,
  readQuizAttempts,
  readRoutineCounts,
  shiftDayKey,
  utcDayKey,
} from './activityHistory';

/** Dream length (spec: 5 seconds). */
export const DREAM_DURATION_MS = 5000;
/** Days away that trigger the void dream. */
export const VOID_AFTER_DAYS = 3;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function dayOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : utcDayKey(t);
}

interface RawNote {
  title?: unknown;
  content?: unknown;
  tags?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/** Notes created or edited on a day, with their inferred subjects. */
function notesTouchedOn(day: string): { subject: string }[] {
  const notes = readJSON<unknown>('warrior-notes', []);
  if (!Array.isArray(notes)) return [];
  const out: { subject: string }[] = [];
  for (const n of notes as RawNote[]) {
    if (!n || typeof n !== 'object') continue;
    const created = typeof n.createdAt === 'string' ? dayOf(n.createdAt) : null;
    const updated = typeof n.updatedAt === 'string' ? dayOf(n.updatedAt) : null;
    if (created !== day && updated !== day) continue;
    const { subject } = inferNoteSubject({
      title: typeof n.title === 'string' ? n.title : '',
      content: typeof n.content === 'string' ? n.content : '',
      tags: Array.isArray(n.tags) ? n.tags.filter((t): t is string => typeof t === 'string') : [],
    });
    out.push({ subject });
  }
  return out;
}

// ─── ACTIVITY AGGREGATION ───

/** Snapshot of "yesterday" (UTC day key) relative to `now`. */
export function buildDreamActivity(now: Date = new Date()): DreamActivity {
  const today = utcDayKey(now.getTime());
  const yesterday = shiftDayKey(today, -1);
  const attempts = readQuizAttempts();
  const creatureLog = readCreatureLog();
  const { active, presence } = collectActivityDays();

  // Quizzes yesterday, weighted by questions per subject.
  const subjectWeight = new Map<string, number>();
  let questions = 0;
  let correct = 0;
  for (const a of attempts) {
    if (typeof a.timestamp !== 'number' || utcDayKey(a.timestamp) !== yesterday) continue;
    questions += a.totalQuestions;
    correct += a.correctAnswers;
    if (a.subject) subjectWeight.set(a.subject, (subjectWeight.get(a.subject) ?? 0) + Math.max(1, a.totalQuestions));
  }

  // Notes written yesterday count toward their subjects too.
  const notes = notesTouchedOn(yesterday);
  for (const n of notes) {
    if (n.subject !== 'General') subjectWeight.set(n.subject, (subjectWeight.get(n.subject) ?? 0) + 3);
  }
  const subjects = [...subjectWeight.entries()]
    .map(([subject, count]) => ({ subject, count }))
    .sort((x, y) => y.count - x.count);

  const log = creatureLog[yesterday];
  let studyHours = log ? round1(log.studyMinutes / 60) : 0;
  const codingHours = log ? round1(log.codeMinutes / 60) : 0;
  if (!log && questions > 0) studyHours = round1((questions * 1.5) / 60); // ~1.5 min per question

  const projectsWorkedOn = readProjects()
    .filter((p) => dayOf(p.updatedAt) === yesterday)
    .map((p) => p.name);
  const habitsCompleted =
    readHabitDays().filter((d) => d === yesterday).length + (readRoutineCounts()[yesterday] ?? 0);

  const prior = [...presence].filter((d) => d < today).sort();
  const firstEver = prior.length === 0;
  const daysSinceActive = firstEver ? 9999 : daysBetweenKeys(today, prior[prior.length - 1]);
  const streak = computeActivityStreak(active, today);

  return {
    recapDay: yesterday,
    subjects,
    quizzesTaken: countQuizSubmissions(attempts, yesterday),
    questionsAnswered: questions,
    accuracy: questions > 0 ? correct / questions : null,
    studyHours,
    codingHours,
    xpEarned: log?.xp ?? 0,
    notesTouched: notes.length,
    projectsWorkedOn,
    codedYesterday: codingHours >= 0.2 || projectsWorkedOn.length > 0,
    habitsCompleted,
    streak: streak.asOfYesterday,
    streakBroken: streak.brokenYesterday,
    daysSinceActive,
    firstEver,
    hadActivity: active.has(yesterday),
  };
}

// ─── THEME SELECTION ───

function pickThemeKey(activity: DreamActivity): DreamThemeKey {
  if (activity.daysSinceActive >= VOID_AFTER_DAYS) return 'void';
  if (!activity.hadActivity) return 'idle';
  const { subjects, quizzesTaken } = activity;
  if (subjects.length >= 3 && quizzesTaken >= 5) return 'exam';
  if (subjects.length >= 2) {
    const [top, second] = subjects;
    if (top.count - second.count <= Math.max(1, top.count * 0.15)) return 'mixed';
  }
  if (subjects.length >= 1) return themeKeyForSubject(subjects[0].subject);
  if (activity.projectsWorkedOn.length > 0) return 'project';
  if (activity.codedYesterday) return 'code';
  return activity.studyHours >= 0.5 ? 'exam' : 'mixed';
}

// ─── NARRATION (one block: fades in 1s, holds 3s, fades out 1s) ───

function buildNarration(themeKey: DreamThemeKey, activity: DreamActivity, rng: () => number): string[] {
  const theme = getDreamTheme(themeKey);
  const themeLine = theme.narration[Math.floor(rng() * theme.narration.length)] ?? theme.narration[0];

  if (themeKey === 'void') {
    const days = activity.daysSinceActive;
    return [
      `You were gone ${days} days. The void grew vast while you were away.`,
      'I kept the fire alive for you. Will you return to it?',
    ];
  }
  if (themeKey === 'idle') {
    return [
      DREAM_NARRATION_HINTS.idle,
      activity.streakBroken ? DREAM_NARRATION_HINTS.streakBroken : themeLine,
    ];
  }

  const studiedHard = activity.studyHours >= 2 || activity.quizzesTaken >= 3 || activity.questionsAnswered >= 20;
  const coded = activity.codedYesterday && activity.codingHours >= activity.studyHours;
  const primary = studiedHard
    ? DREAM_NARRATION_HINTS.studiedHard
    : activity.projectsWorkedOn.length > 0
      ? DREAM_NARRATION_HINTS.builtProject
      : coded
        ? DREAM_NARRATION_HINTS.coded
        : themeLine;
  const secondary =
    activity.streak >= 2 ? DREAM_NARRATION_HINTS.streakAlive : primary === themeLine ? null : themeLine;
  return secondary ? [primary, secondary] : [primary];
}

// ─── SCENE ELEMENTS ───

// Deterministic PRNG so a given day looks the same across re-mounts.
function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const ANIMATION_FOR: Partial<Record<DreamObjectKind, DreamAnimation>> = {
  'process-diagram': 'spin',
  'clock-orb': 'spin',
  'router-node': 'pulse',
  'sorting-bar': 'sort',
  'network-packet': 'travel',
  'distant-stars': 'twinkle',
  'void-particles': 'rise',
  'dark-fog': 'drift',
  'checkmark-orb': 'pulse',
  'automaton-state': 'pulse',
};

/** Themes represented in a scene: the main theme, plus the top subjects for mixed/exam. */
function sceneThemes(themeKey: DreamThemeKey, activity: DreamActivity): DreamThemeKey[] {
  if (themeKey !== 'mixed' && themeKey !== 'exam') return [themeKey];
  const subjectKeys = activity.subjects
    .map((s) => themeKeyForSubject(s.subject))
    .filter((k) => k !== 'mixed')
    .slice(0, 3);
  return subjectKeys.length > 0 ? [themeKey, ...subjectKeys] : [themeKey];
}

function buildElements(
  themeKey: DreamThemeKey,
  activity: DreamActivity,
  intensity: number,
  rng: () => number
): DreamElement[] {
  const elements: DreamElement[] = [];
  const voidish = themeKey === 'void' || themeKey === 'idle';
  const themes = sceneThemes(themeKey, activity);
  let n = 0;

  // Floating objects.
  const objectCount = voidish ? (themeKey === 'void' ? 3 : 5) : Math.round(7 + intensity * 9);
  for (let i = 0; i < objectCount; i++) {
    const tk = themes[i % themes.length];
    const theme = getDreamTheme(tk);
    const kind = theme.objects[Math.floor(rng() * theme.objects.length)];
    const speed = voidish ? 0.006 : 0.018;
    elements.push({
      id: `obj-${n++}`,
      type: 'floating-object',
      content: kind,
      position: { x: 0.08 + rng() * 0.84, y: 0.1 + rng() * 0.75 },
      velocity: { x: (rng() - 0.5) * speed, y: (rng() - 0.5) * speed - speed * 0.25 },
      size: voidish ? (kind === 'dark-fog' ? 260 + rng() * 240 : 30 + rng() * 30) : 46 + rng() * 54,
      rotation: rng() * 360,
      spin: (rng() - 0.5) * (voidish ? 4 : 14),
      opacity: voidish ? 0.35 + rng() * 0.3 : 0.55 + rng() * 0.4,
      phase: rng() * Math.PI * 2,
      animation: ANIMATION_FOR[kind] ?? (rng() < 0.5 ? 'drift' : 'pulse'),
      subjectTheme: tk,
      trail: !voidish && kind !== 'dark-fog',
    });
  }

  // Glowing text snippets (SQL, code, automata states…).
  if (!voidish) {
    const textCount = Math.round(3 + intensity * 4);
    for (let i = 0; i < textCount; i++) {
      const tk = themes[(i + 1) % themes.length];
      const snippets = getDreamTheme(tk).textSnippets;
      if (snippets.length === 0) continue;
      elements.push({
        id: `txt-${n++}`,
        type: 'text',
        content: snippets[Math.floor(rng() * snippets.length)],
        position: { x: 0.1 + rng() * 0.8, y: 0.12 + rng() * 0.7 },
        velocity: { x: (rng() - 0.5) * 0.012, y: -0.004 - rng() * 0.01 },
        size: 14 + rng() * 12,
        rotation: (rng() - 0.5) * 16,
        spin: 0,
        opacity: 0.45 + rng() * 0.4,
        phase: rng() * Math.PI * 2,
        animation: 'drift',
        subjectTheme: tk,
        trail: false,
      });
    }
  }

  // Motes of light / distant stars.
  const particleCount = themeKey === 'void' ? 70 : voidish ? 110 : Math.round(45 + intensity * 70);
  for (let i = 0; i < particleCount; i++) {
    const tk = themes[i % themes.length];
    elements.push({
      id: `p-${n++}`,
      type: 'particle',
      content: '',
      position: { x: rng(), y: rng() },
      velocity: { x: (rng() - 0.5) * 0.01, y: voidish ? -0.002 - rng() * 0.004 : -0.008 - rng() * 0.02 },
      size: voidish ? 0.6 + rng() * 1.4 : 0.8 + rng() * 2.2,
      rotation: 0,
      spin: 0,
      opacity: voidish ? 0.2 + rng() * 0.6 : 0.3 + rng() * 0.6,
      phase: rng() * Math.PI * 2,
      animation: voidish ? 'twinkle' : 'rise',
      subjectTheme: tk,
      trail: false,
    });
  }
  return elements;
}

// ─── PUBLIC API ───

/**
 * Build a fully render-ready DreamScene. SSR-safe and total: with no
 * data it returns a valid void scene rather than throwing.
 */
export function buildDreamScene(now: Date = new Date(), activityOverride?: DreamActivity): DreamScene {
  const activity = activityOverride ?? buildDreamActivity(now);
  const themeKey = pickThemeKey(activity);
  const theme = getDreamTheme(themeKey);
  const rng = makeRng(Number(activity.recapDay.replace(/-/g, '')) || 1);

  const intensity =
    themeKey === 'void' || themeKey === 'idle'
      ? 0
      : Math.min(
          1,
          Math.max(
            0.15,
            activity.studyHours / 6 +
              activity.codingHours / 6 +
              activity.quizzesTaken / 10 +
              activity.projectsWorkedOn.length / 4 +
              activity.xpEarned / 800
          )
        );

  const lines = buildNarration(themeKey, activity, rng);
  const subjects = sceneThemes(themeKey, activity).filter((k) => (SUBJECT_THEME_KEYS as string[]).includes(k));

  return {
    themeKey,
    label: theme.label,
    bgColor: theme.ambientColor,
    primaryColor: theme.color,
    ambientText: theme.ambient,
    narration: lines.join(' '),
    narrationLines: lines,
    duration: DREAM_DURATION_MS,
    elements: buildElements(themeKey, activity, intensity, rng),
    intensity,
    subjects,
    activity,
  };
}

/** The persisted Settings → NEXUS Dreams toggle (default on). */
export function dreamsEnabled(): boolean {
  return useSettingsStore.getState().dreams !== false;
}

/**
 * Which phase a page load should start in (spec 6.68):
 *   first-ever session       → 'boot'  (boot → lock → desktop)
 *   returning, dreams on     → 'dream' (dream → lock → desktop)
 *   returning, dreams off    → 'lock'  (the boot screen only plays on first load)
 * Browser only; returns 'boot' during SSR.
 */
export function decideInitialPhase(now: Date = new Date()): DreamBootPhase {
  if (typeof window === 'undefined') return 'boot';
  const activity = buildDreamActivity(now);
  if (activity.firstEver) return 'boot';
  return dreamsEnabled() ? 'dream' : 'lock';
}

/** Should the dream play at all? False for first-ever users or when disabled. */
export function shouldPlayDream(now: Date = new Date()): boolean {
  return decideInitialPhase(now) === 'dream';
}
