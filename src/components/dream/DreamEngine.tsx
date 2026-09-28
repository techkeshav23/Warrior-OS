// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dream Engine
// Reads yesterday's activity from data the OS already keeps — Training
// Grounds card attempts + quiz sessions, notes, habits + routines,
// Project Forge sessions, procedural music and the creature's activity
// log (XP earned, focused study/code minutes) — and builds a
// render-ready DreamScene. No new writes to other features. SSR-safe:
// every reader guards `window`; never throws.
//
// Theme rules (spec 6.63–6.67):
//   • nothing ever happened before today  → first-ever: no dream (boot)
//   • last presence 3+ days ago            → 'void' (deep, concerned)
//   • no activity yesterday                → 'idle' (dark void, stars)
//   • otherwise the kind of day picks the theme: decks, notes, project,
//     code, music, habits, focus — 'mixed' when two run neck and neck,
//     'marathon' for an all-out day across three or more
// The user's own deck names, note titles, projects and habits are woven
// into the narration and the glowing text.
// ═══════════════════════════════════════════════════════════

'use client';

import type {
  DreamActivity,
  DreamActivityKey,
  DreamAnimation,
  DreamBootPhase,
  DreamElement,
  DreamObjectKind,
  DreamScene,
  DreamThemeKey,
} from '@/types/dream';
import { DREAM_ACTIVITY_NOUNS, DREAM_NARRATION_HINTS, getDreamTheme, isActivityKey } from '@/data/dream-themes';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { isDeckAttempt } from '@/stores/useQuizHistoryStore';
import {
  collectActivityDays,
  computeActivityStreak,
  countQuizSubmissions,
  daysBetweenKeys,
  localDayKey,
  readCreatureLog,
  readHabitDays,
  readHabitNamesOn,
  readLearningSnapshot,
  readMusicMoodsOn,
  readNotesTouchedOn,
  readProjectMinutesOn,
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

/** An activity needs this much weight (≈ minutes) to count toward a marathon. */
const MARATHON_MIN_WEIGHT = 15;
const MARATHON_TOTAL = 150;
/** Runner-up within this share of the leader → 'mixed'. */
const MIXED_RATIO = 0.85;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function dayOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : utcDayKey(t);
}

// ─── ACTIVITY AGGREGATION ───

/** Snapshot of "yesterday" (UTC day key) relative to `now`. */
export function buildDreamActivity(now: Date = new Date()): DreamActivity {
  const today = utcDayKey(now.getTime());
  const yesterday = shiftDayKey(today, -1);
  const creatureLog = readCreatureLog();
  const { active, presence } = collectActivityDays();

  // Training Grounds: every answered card carries its deck.
  const learning = readLearningSnapshot();
  const perDeck = new Map<string, number>();
  let cards = 0;
  let cardsCorrect = 0;
  for (const a of learning.attempts) {
    if (utcDayKey(a.timestamp) !== yesterday) continue;
    cards += 1;
    if (a.correct) cardsCorrect += 1;
    perDeck.set(a.deckId, (perDeck.get(a.deckId) ?? 0) + 1);
  }

  // Quiz sessions. Rows without a deck predate decks: they count toward
  // the day's totals but never name a deck, pick a theme or reach narration.
  const quizRows = readQuizAttempts();
  const quizDeckNames = new Map<string, string>();
  let questions = 0;
  let questionsCorrect = 0;
  for (const row of quizRows) {
    if (typeof row.timestamp !== 'number' || utcDayKey(row.timestamp) !== yesterday) continue;
    questions += row.totalQuestions;
    questionsCorrect += row.correctAnswers;
    if (isDeckAttempt(row) && row.subject) quizDeckNames.set(row.deckId, row.subject);
  }
  const decks = [...perDeck.entries()]
    .map(([id, count]) => ({ id, name: learning.deckNames[id] ?? quizDeckNames.get(id) ?? '', cards: count }))
    .filter((d) => d.name)
    .sort((x, y) => y.cards - x.cards);
  const cardsReviewed = Math.max(cards, questions);
  const accuracy = cards > 0 ? cardsCorrect / cards : questions > 0 ? questionsCorrect / questions : null;

  const log = creatureLog[yesterday];
  let studyHours = log ? round1(log.studyMinutes / 60) : 0;
  const codingHours = log ? round1(log.codeMinutes / 60) : 0;
  const focusHours = log ? round1(log.focusMinutes / 60) : 0;
  if (!log && cardsReviewed > 0) studyHours = round1((cardsReviewed * 0.75) / 60); // ~45s per card

  const notes = readNotesTouchedOn(yesterday);
  const forge = readProjectMinutesOn(yesterday);
  const projectsWorkedOn = [
    ...new Set([...forge.names, ...readProjects().filter((p) => dayOf(p.updatedAt) === yesterday).map((p) => p.name)]),
  ];
  const habitNames = readHabitNamesOn(yesterday);
  const habitsCompleted =
    readHabitDays().filter((d) => d === yesterday).length + (readRoutineCounts()[yesterday] ?? 0);
  const localYesterday = new Date(now.getTime());
  localYesterday.setDate(localYesterday.getDate() - 1);
  const musicMoods = readMusicMoodsOn(localDayKey(localYesterday.getTime()));

  // Rough minutes per kind of activity → the dream's theme.
  const weights: { key: DreamActivityKey; weight: number }[] = [
    { key: 'decks', weight: cards > 0 ? cards * 0.6 : questions },
    { key: 'notes', weight: notes.count * 6 },
    { key: 'project', weight: Math.max(forge.minutes, projectsWorkedOn.length * 15) },
    { key: 'code', weight: log?.codeMinutes ?? 0 },
    { key: 'music', weight: musicMoods.length * 10 },
    { key: 'habits', weight: habitsCompleted * 5 },
    { key: 'focus', weight: (log?.focusMinutes ?? 0) * 0.35 },
  ];
  const activities = weights
    .filter((w) => w.weight >= 1)
    .map((w) => ({ key: w.key, weight: Math.round(w.weight) }))
    .sort((x, y) => y.weight - x.weight);

  const prior = [...presence].filter((d) => d < today).sort();
  const firstEver = prior.length === 0;
  const daysSinceActive = firstEver ? 9999 : daysBetweenKeys(today, prior[prior.length - 1]);
  const streak = computeActivityStreak(active, today);

  return {
    recapDay: yesterday,
    activities,
    decks,
    cardsReviewed,
    quizzesTaken: countQuizSubmissions(quizRows, yesterday),
    accuracy,
    studyHours,
    codingHours,
    focusHours,
    xpEarned: log?.xp ?? 0,
    notesTouched: notes.count,
    noteTitles: notes.titles,
    projectsWorkedOn,
    projectHours: round1(forge.minutes / 60),
    codedYesterday: codingHours >= 0.2 || projectsWorkedOn.length > 0,
    musicMoods,
    habitsCompleted,
    habitNames,
    streak: streak.asOfYesterday,
    streakBroken: streak.brokenYesterday,
    daysSinceActive,
    firstEver,
    hadActivity: active.has(yesterday) || musicMoods.length > 0,
  };
}

// ─── THEME SELECTION ───

function pickThemeKey(activity: DreamActivity): DreamThemeKey {
  if (activity.daysSinceActive >= VOID_AFTER_DAYS) return 'void';
  if (!activity.hadActivity) return 'idle';
  const acts = activity.activities;
  if (acts.length === 0) return 'mixed';
  const strong = acts.filter((a) => a.weight >= MARATHON_MIN_WEIGHT).length;
  const total = acts.reduce((sum, a) => sum + a.weight, 0);
  if (strong >= 3 && total >= MARATHON_TOTAL) return 'marathon';
  if (acts.length >= 2 && acts[1].weight >= acts[0].weight * MIXED_RATIO) return 'mixed';
  return acts[0].key;
}

// ─── NARRATION (one block: fades in 1s, holds 3s, fades out 1s) ───

function clip(text: string, max = 28): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function quoted(name: string): string {
  return `“${clip(name)}”`;
}

/** “A”, “A” and “B”. */
function nameList(names: string[]): string {
  const q = names.map(quoted);
  return q.length <= 1 ? q.join('') : `${q.slice(0, -1).join(', ')} and ${q[q.length - 1]}`;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

const MOOD_WORDS: Record<string, string> = {
  morning: 'morning',
  study: 'study',
  coding: 'coding',
  night: 'night',
};

/** One sentence about an activity, using the user's own names. */
function activityLine(key: DreamActivityKey, a: DreamActivity): string | null {
  switch (key) {
    case 'decks': {
      const decks = a.decks.slice(0, 2).map((d) => d.name);
      const recalled = a.cardsReviewed > 0 ? ` — ${plural(a.cardsReviewed, 'card')} recalled` : '';
      if (decks.length === 0) {
        return a.cardsReviewed > 0 ? `${plural(a.cardsReviewed, 'card')} you answered are settling into memory.` : null;
      }
      return `${nameList(decks)} ${decks.length === 1 ? 'echoes' : 'echo'} through your sleep${recalled}.`;
    }
    case 'notes': {
      if (a.notesTouched === 0) return null;
      const [title] = a.noteTitles;
      if (!title) return `${plural(a.notesTouched, 'page')} you wrote settle into the archive.`;
      const more = a.notesTouched - 1;
      return more > 0
        ? `${quoted(title)} and ${plural(more, 'more page')} settle into the archive.`
        : `${quoted(title)} settles into the archive of your mind.`;
    }
    case 'project': {
      const names = a.projectsWorkedOn.slice(0, 2);
      if (names.length === 0) return DREAM_NARRATION_HINTS.builtProject;
      const hours = a.projectHours >= 0.5 ? ` after ${a.projectHours}h at the forge` : '';
      return `${nameList(names)} still ${names.length === 1 ? 'glows' : 'glow'} in the dark${hours}.`;
    }
    case 'code':
      return a.codingHours >= 0.3 ? `${a.codingHours}h of code still flows through your veins.` : DREAM_NARRATION_HINTS.coded;
    case 'music': {
      const mood = MOOD_WORDS[a.musicMoods[0] ?? ''];
      return mood ? `Yesterday’s ${mood} melodies still hum in the dark.` : null;
    }
    case 'habits': {
      if (a.habitsCompleted === 0) return null;
      const [habit] = a.habitNames;
      return habit && a.habitsCompleted === 1
        ? `${quoted(habit)} — done. The discipline machine hums.`
        : `${plural(a.habitsCompleted, 'promise')} kept yesterday. The discipline machine hums.`;
    }
    case 'focus':
      return a.focusHours >= 0.5 ? `${a.focusHours} focused hours sharpened your mind like a blade.` : null;
  }
}

/** "Training, writing and building — all in one day." */
function summaryLine(keys: DreamActivityKey[]): string {
  const words = keys.map((k) => DREAM_ACTIVITY_NOUNS[k]);
  const list = words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} — all in one day.`;
}

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

  const top = activity.activities.map((a) => a.key);
  let primary: string;
  let secondary: string | null;
  if (themeKey === 'marathon') {
    primary = themeLine;
    secondary = summaryLine(top.slice(0, 3));
  } else if (themeKey === 'mixed') {
    primary = (top[0] && activityLine(top[0], activity)) || themeLine;
    secondary = (top[1] && activityLine(top[1], activity)) || null;
  } else {
    primary = (isActivityKey(themeKey) && activityLine(themeKey, activity)) || themeLine;
    secondary = primary === themeLine ? null : themeLine;
  }
  // A living streak outranks a generic theme line, never a line about the day itself.
  if (activity.streak >= 2 && (secondary === null || secondary === themeLine)) {
    secondary = DREAM_NARRATION_HINTS.streakAlive;
  }
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
  'recall-ring': 'spin',
  'clock-orb': 'spin',
  'sorting-bar': 'sort',
  'distant-stars': 'twinkle',
  'void-particles': 'rise',
  'dark-fog': 'drift',
  'checkmark-orb': 'pulse',
  flame: 'pulse',
  equalizer: 'pulse',
  'habit-grid': 'pulse',
  'music-note': 'drift',
  hourglass: 'drift',
};

/** Themes represented in a scene: the main theme, plus the top activities for mixed/marathon days. */
function sceneThemes(themeKey: DreamThemeKey, activity: DreamActivity): DreamThemeKey[] {
  if (themeKey !== 'mixed' && themeKey !== 'marathon') return [themeKey];
  const keys = activity.activities.map((a) => a.key).slice(0, 3);
  return keys.length > 0 ? [themeKey, ...keys] : [themeKey];
}

/** The user's own words for a theme's glowing text (deck names, note titles…). */
function highlightsFor(key: DreamThemeKey, a: DreamActivity): string[] {
  switch (key) {
    case 'decks':
      return a.decks.map((d) => clip(d.name, 24));
    case 'notes':
      return a.noteTitles.map((t) => clip(t, 24));
    case 'project':
      return a.projectsWorkedOn.map((p) => clip(p, 24));
    case 'habits':
      return a.habitNames.map((h) => `${clip(h, 20)} ✓`);
    case 'music':
      return a.musicMoods.map((m) => `${MOOD_WORDS[m] ?? m} mode`);
    case 'focus':
      return a.focusHours >= 0.5 ? [`${a.focusHours}h focus`] : [];
    default:
      return [];
  }
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
      theme: tk,
      trail: !voidish && kind !== 'dark-fog',
    });
  }

  // Glowing text: the user's own names first, then the theme's snippets.
  if (!voidish) {
    const textCount = Math.round(3 + intensity * 4);
    const used = new Set<string>();
    for (let i = 0; i < textCount; i++) {
      const tk = themes[(i + 1) % themes.length];
      const own = highlightsFor(tk, activity).filter((h) => !used.has(h));
      const snippets = getDreamTheme(tk).textSnippets;
      const pool = own.length > 0 && rng() < 0.65 ? own : snippets;
      if (pool.length === 0) continue;
      const content = pool[Math.floor(rng() * pool.length)];
      used.add(content);
      elements.push({
        id: `txt-${n++}`,
        type: 'text',
        content,
        position: { x: 0.1 + rng() * 0.8, y: 0.12 + rng() * 0.7 },
        velocity: { x: (rng() - 0.5) * 0.012, y: -0.004 - rng() * 0.01 },
        size: 14 + rng() * 12,
        rotation: (rng() - 0.5) * 16,
        spin: 0,
        opacity: 0.45 + rng() * 0.4,
        phase: rng() * Math.PI * 2,
        animation: 'drift',
        theme: tk,
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
      theme: tk,
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
              activity.cardsReviewed / 100 +
              activity.quizzesTaken / 10 +
              activity.projectsWorkedOn.length / 4 +
              activity.notesTouched / 10 +
              activity.habitsCompleted / 10 +
              activity.xpEarned / 800
          )
        );

  const lines = buildNarration(themeKey, activity, rng);
  const shown = sceneThemes(themeKey, activity).filter(isActivityKey);
  const motifs = [...shown, ...(shown.includes('decks') ? activity.decks.slice(0, 3).map((d) => `deck:${d.id}`) : [])];

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
    motifs,
    activity,
  };
}

/** The persisted Settings → NEXUS Dreams toggle (default on). */
export function dreamsEnabled(): boolean {
  return useSettingsStore.getState().dreams !== false;
}

/** True when there was any activity / presence before today (not a first-ever session). */
function hasPriorPresence(now: Date): boolean {
  const today = utcDayKey(now.getTime());
  for (const day of collectActivityDays().presence) if (day < today) return true;
  return false;
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
  if (!hasPriorPresence(now)) return 'boot';
  return dreamsEnabled() ? 'dream' : 'lock';
}

/** Should the dream play at all? False for first-ever users or when disabled. */
export function shouldPlayDream(now: Date = new Date()): boolean {
  return decideInitialPhase(now) === 'dream';
}
