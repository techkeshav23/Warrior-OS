// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Demo Seed (guest sessions)
// A portfolio visitor exploring as a guest lands on a lived-in desktop:
// a few notes, Project Forge projects (Warrior OS itself among them),
// a habit streak, this week's calendar, some expenses, mid-game XP with
// a handful of achievements, and progress on the sample learning decks.
//
// • Guests only: an owner session never gets demo data.
// • Runs on its own once per browser (DEMO_SEED_FLAG_KEY), and only in a
//   clean browser: never where the owner has unlocked before
//   (hasOwnerHistory) and never when any app already holds data, so demo
//   rows are never mixed into someone's real notes, projects or expenses.
//   Settings → Showcase runs it again on request (`force`), per area.
// • Fills only areas that are empty, through each app's own store
//   actions (Notes and Habit Forge keep plain localStorage lists), and
//   never overwrites anything saved.
// • Quiet: the achievements the seeded data earns are stored as already
//   unlocked (dated in the past), so the catch-up that would unlock them
//   at boot finds nothing to celebrate, and any level-up celebration or
//   toast the seed itself causes is withdrawn. The first-boot unlock
//   still plays as usual.
// • All activity is dated before today (UTC), so today's habits, cards
//   and the streak bonus are left for the visitor to earn.
// ═══════════════════════════════════════════════════════════

import { OWNER } from '@/config/owner';
import { LEVEL_THRESHOLDS } from '@/lib/constants';
import { getVisitorMode, hasOwnerHistory, type VisitorMode } from '@/lib/visitor';
import { levelAchievementsFor, mergeAchievements, utcDayKey } from '@/components/achievements/award';
import { streakAchievementsFor } from '@/components/achievements/day-streak';
import { useEffectsStore } from '@/components/effects/useEffectsStore';
import { useXPStore } from '@/stores/useXPStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { FORGE_ACHIEVEMENT_IDS, useProjectForgeStore } from '@/stores/useProjectForgeStore';
import { useExpenseStore } from '@/stores/useExpenseStore';
import { CALENDAR_CATEGORY_COLORS, useCalendarStore } from '@/stores/useCalendarStore';
import { deckCards, isQuizCard, useLearningStore } from '@/stores/useLearningStore';
import type { Note } from '@/components/apps/notes-archive/NotesApp';
import type { Habit } from '@/components/apps/habit-forge/HabitForgeApp';
import type { CalendarEventCategory, CalendarRecurrence } from '@/types/calendar';
import type { ExpenseCategory } from '@/types/expense';
import type { ForgeLink, ForgeStage } from '@/types/project-forge';
import type { RecordAttemptInput, ReviewGrade } from '@/types/learning';

// ─── Public API ───

/** Set once the automatic guest seed has run in this browser (ISO timestamp). */
export const DEMO_SEED_FLAG_KEY = 'warrior-os-demo-seeded';

export type DemoSeedArea =
  | 'notes'
  | 'habits'
  | 'projects'
  | 'expenses'
  | 'calendar'
  | 'learning'
  | 'progress';

export interface DemoSeedReport {
  /** Areas that received demo data. */
  seeded: DemoSeedArea[];
  /** Areas left alone: they already had data (or could not be written). */
  skipped: DemoSeedArea[];
  /**
   * Why nothing ran at all. 'owner-history' / 'has-data': the automatic
   * seed found the owner's (or someone's) saved data in this browser.
   */
  blocked?: 'not-guest' | 'already-seeded' | 'owner-history' | 'has-data';
}

export interface DemoSeedOptions {
  /** Whose session this is. Defaults to the stored visitor mode; only 'guest' seeds. */
  mode?: VisitorMode | null;
  /** Run again even though the automatic seed already ran in this browser. */
  force?: boolean;
}

/** True once the guest demo seed has run in this browser. */
export function hasDemoSeedRun(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DEMO_SEED_FLAG_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Fill the empty apps with demo data for a guest session. Safe to call on
 * every guest unlock: without `force` it runs once per browser. Never
 * throws; an area that fails is reported as skipped.
 */
export function seedDemoData(options: DemoSeedOptions = {}): DemoSeedReport {
  const report: DemoSeedReport = { seeded: [], skipped: [] };
  if (typeof window === 'undefined') return report;
  const mode = options.mode === undefined ? getVisitorMode() : options.mode;
  if (mode !== 'guest') return { ...report, blocked: 'not-guest' };
  if (!options.force && hasDemoSeedRun()) return { ...report, blocked: 'already-seeded' };
  // The automatic seed is all-or-nothing: a browser with the owner's history
  // or any saved data is left untouched (no flag written, nothing mixed in).
  if (!options.force && hasOwnerHistory()) return { ...report, blocked: 'owner-history' };

  const now = Date.now();
  const empty = new Set(AREA_ORDER.filter((area) => isAreaEmpty(area)));
  if (!options.force && AREA_ORDER.some((area) => !empty.has(area) && isAreaLoaded(area))) {
    return { ...report, blocked: 'has-data' };
  }

  quietly(() => {
    // Before the seeders: Project Forge unlocks its achievements as projects are created.
    attempt('achievements', () => preUnlockAchievements(empty, now));
    for (const area of AREA_ORDER) {
      if (empty.has(area) && attempt(area, () => SEEDERS[area](now))) report.seeded.push(area);
      else report.skipped.push(area);
    }
  });

  try {
    window.localStorage.setItem(DEMO_SEED_FLAG_KEY, new Date(now).toISOString());
  } catch {
    // Storage blocked: the seed simply may run again next time (areas are no longer empty).
  }
  // Same-tab listeners (desktop widgets, Memory Palace) re-read the plain lists.
  for (const area of report.seeded) {
    const key = area === 'notes' ? NOTES_KEY : area === 'habits' ? HABITS_KEY : null;
    if (key) window.dispatchEvent(new StorageEvent('storage', { key }));
  }
  return report;
}

// ─── Timeline ───

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/**
 * Days ago (1 = yesterday, UTC) with activity: a 9-day run that ends
 * yesterday, after two shorter runs. Habits, notes, cards and Forge
 * sessions all land on these days, so every streak in the OS agrees.
 */
const ACTIVE_DAYS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18];
/** Length of the current run in ACTIVE_DAYS. */
const DEMO_STREAK_DAYS = 9;

/** Demo XP: level 7 (Centurion), three quarters of the way to level 8. */
const DEMO_XP = 2140;
/** A browser under this much XP is fresh (level 1: boot and login bonuses at most). */
const FRESH_XP_LIMIT = 100;

/** UTC midnight `daysAgo` days before today. */
function utcDayStart(now: number, daysAgo: number): number {
  return Math.floor(now / DAY_MS) * DAY_MS - daysAgo * DAY_MS;
}

/**
 * The moment inside the UTC day `daysAgo` when local clocks read hh:mm.
 * Streaks count UTC days, so activity stays on its day in every timezone.
 */
function at(now: number, daysAgo: number, hour: number, minute = 0): number {
  const start = utcDayStart(now, daysAgo);
  const local = new Date(start);
  const offset = hour * 60 + minute - (local.getHours() * 60 + local.getMinutes());
  return start + (((offset % 1440) + 1440) % 1440) * MINUTE_MS;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/** Local day key 'yyyy-MM-dd', `offset` days from today. */
function localDateKey(now: number, offset: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function levelForXP(xp: number): number {
  let level = 1;
  for (const t of LEVEL_THRESHOLDS) if (xp >= t.minXP) level = t.level;
  return level;
}

/** Small deterministic PRNG (mulberry32): the demo looks the same in every browser. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

// ─── Areas ───

const NOTES_KEY = 'warrior-notes';
const HABITS_KEY = 'warrior-habits';

/** XP last: it tops up whatever the other seeders may have paid. */
const AREA_ORDER: readonly DemoSeedArea[] = [
  'notes',
  'habits',
  'projects',
  'expenses',
  'calendar',
  'learning',
  'progress',
];

type PersistedStore = { persist: { hasHydrated: () => boolean } };

/** A store that has not loaded its saved state yet can't be judged empty. */
function hydrated(store: PersistedStore): boolean {
  return store.persist.hasHydrated();
}

/** No saved list, or an empty one. Unreadable data counts as data. */
function isEmptyList(key: string): boolean {
  const raw = window.localStorage.getItem(key);
  if (raw === null) return true;
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.length === 0;
  } catch {
    return false;
  }
}

/** False while the area's store is still loading (it then counts as not empty, but not as data either). */
function isAreaLoaded(area: DemoSeedArea): boolean {
  switch (area) {
    case 'notes':
    case 'habits':
      return true;
    case 'projects':
      return hydrated(useProjectForgeStore);
    case 'expenses':
      return hydrated(useExpenseStore);
    case 'calendar':
      return hydrated(useCalendarStore);
    case 'learning':
      return hydrated(useLearningStore);
    case 'progress':
      return hydrated(useXPStore);
  }
}

function isAreaEmpty(area: DemoSeedArea): boolean {
  try {
    switch (area) {
      case 'notes':
        return isEmptyList(NOTES_KEY);
      case 'habits':
        return isEmptyList(HABITS_KEY);
      case 'projects': {
        if (!hydrated(useProjectForgeStore)) return false;
        const { projects, sessions } = useProjectForgeStore.getState();
        return projects.length === 0 && sessions.length === 0;
      }
      case 'expenses':
        return hydrated(useExpenseStore) && useExpenseStore.getState().expenses.length === 0;
      case 'calendar':
        return hydrated(useCalendarStore) && useCalendarStore.getState().events.length === 0;
      case 'learning': {
        if (!hydrated(useLearningStore)) return false;
        const { decks, reviews, attempts } = useLearningStore.getState();
        return attempts.length === 0 && Object.keys(reviews).length === 0 && decks.some((d) => d.isSample);
      }
      case 'progress':
        return hydrated(useXPStore) && useXPStore.getState().xp < FRESH_XP_LIMIT;
    }
  } catch {
    return false;
  }
}

/** Run one seeding step; a failure is logged and reported, never thrown. */
function attempt(label: string, step: () => void): boolean {
  try {
    step();
    return true;
  } catch (error) {
    console.warn(`[Warrior OS] Demo data (${label}) could not be added.`, error);
    return false;
  }
}

// ─── Quiet mode ───

/**
 * Run `seed`, then withdraw the celebrations and toasts it caused (a
 * jump to level 7 would otherwise play a level-up on arrival). The seed
 * is synchronous, so nothing else can add any in between.
 */
function quietly(seed: () => void): void {
  const queued = new Set(useEffectsStore.getState().queue.map((c) => c.key));
  const toasts = new Set(useNotificationStore.getState().notifications.map((n) => n.id));
  const recentUnlock = useXPStore.getState().recentUnlock;
  seed();
  attempt('quiet mode', () => {
    const { queue } = useEffectsStore.getState();
    const kept = queue.filter((c) => queued.has(c.key));
    if (kept.length !== queue.length) useEffectsStore.setState({ queue: kept });
    const notifications = useNotificationStore.getState();
    for (const n of notifications.notifications) {
      if (!toasts.has(n.id)) notifications.removeNotification(n.id);
    }
    const xp = useXPStore.getState();
    if (xp.recentUnlock && xp.recentUnlock !== recentUnlock) xp.clearRecentUnlock();
  });
}

// ─── Achievements ───

/** Unlocked by the boot catch-up whenever notes exist (skipped while the catalogue lacks it). */
const FIRST_NOTE_ID = 'first-note';

/** When each demo achievement was "earned": [days ago, hour, minute] local time. */
const ACHIEVEMENT_MOMENTS: Readonly<Record<string, readonly [number, number, number]>> = {
  [FIRST_NOTE_ID]: [17, 19, 6],
  [FORGE_ACHIEVEMENT_IDS.firstProject]: [18, 20, 10],
  [FORGE_ACHIEVEMENT_IDS.openSource]: [18, 20, 12],
  [FORGE_ACHIEVEMENT_IDS.firstShip]: [11, 21, 15],
  'streak-3': [7, 22, 5],
  'level-5': [5, 21, 40],
  'streak-7': [3, 22, 10],
};
const DEFAULT_MOMENT = [2, 21, 0] as const;

/**
 * Store the achievements the seeded data earns as already unlocked, dated
 * in the past. setAchievements pays no XP and sets no recentUnlock, so no
 * cinematic plays; the unlocks the seeders and the boot catch-up then
 * attempt are no-ops. Ids missing from the catalogue are skipped.
 */
function preUnlockAchievements(empty: ReadonlySet<DemoSeedArea>, now: number): void {
  const ids = new Set<string>();
  if (empty.has('notes')) ids.add(FIRST_NOTE_ID);
  if (empty.has('projects')) {
    ids.add(FORGE_ACHIEVEMENT_IDS.firstProject);
    ids.add(FORGE_ACHIEVEMENT_IDS.firstShip);
    if (OWNER.repo.trim()) ids.add(FORGE_ACHIEVEMENT_IDS.openSource);
  }
  if (empty.has('habits')) streakAchievementsFor(DEMO_STREAK_DAYS).forEach((id) => ids.add(id));
  if (empty.has('progress')) levelAchievementsFor(levelForXP(DEMO_XP)).forEach((id) => ids.add(id));
  if (ids.size === 0 || !hydrated(useXPStore)) return;

  const { achievements, setAchievements } = useXPStore.getState();
  let changed = false;
  const next = mergeAchievements(achievements).map((a) => {
    if (!ids.has(a.id) || a.unlockedAt) return a;
    const [daysAgo, hour, minute] = ACHIEVEMENT_MOMENTS[a.id] ?? DEFAULT_MOMENT;
    changed = true;
    return { ...a, unlockedAt: iso(at(now, daysAgo, hour, minute)) };
  });
  if (changed) setAchievements(next);
}

// ─── Notes (Notes Archive's plain 'warrior-notes' list) ───

interface DemoNote {
  title: string;
  tags: string[];
  /** [days ago, hour, minute] */
  created: readonly [number, number, number];
  updated: readonly [number, number, number];
  content: string;
}

/** Newest first, the order Notes Archive keeps. */
const DEMO_NOTES: readonly DemoNote[] = [
  {
    title: 'Weekly review',
    tags: ['review', 'planning'],
    created: [2, 21, 40],
    updated: [1, 22, 15],
    content: `# Weekly review

## Wins
- Guided tour shipped: five short stops, skippable, replayable from Settings
- Lite mode now turns itself on for low-end laptops
- Habit streak still alive, and deep work happened every single day

## What slowed me down
- Too many open tabs during deep work. The phone stays in the other room now.

## Next week
1. Accessibility pass, see [[Warrior OS — build log]]
2. Two chapters of *Designing Data-Intensive Applications*
3. First prototype of Shader Garden, see [[Ideas backlog]]`,
  },
  {
    title: 'Warrior OS — build log',
    tags: ['warrior-os', 'build-log'],
    created: [17, 19, 5],
    updated: [2, 20, 50],
    content: `# Warrior OS — build log

> Guest session: these notes, projects and streaks are sample data. Edit, add or delete anything; it all stays in this browser.

## What it is
A personal operating system that runs in the browser: windows, three workspaces, a command bar that understands plain English, and apps for notes, projects, habits and learning.

## Stack
- Next.js 16 + React 19, TypeScript
- One Zustand store per app, saved to localStorage
- Framer Motion for windows and transitions, Three.js for the Memory Palace
- Tailwind CSS 4

## Decisions
- **Offline-first.** No account needed: each browser keeps its own data.
- **Crash isolation.** Every window has its own error boundary, so one broken app never takes the desktop down.
- **Lite mode.** Low-memory machines skip the shader wallpaper, glass blur and particles.

## Next up
- Accessibility: labels and focus order in every app
- Write the case study, see [[Ideas backlog]]`,
  },
  {
    title: 'Ideas backlog',
    tags: ['ideas'],
    created: [14, 22, 30],
    updated: [4, 21, 5],
    content: `# Ideas backlog

- **Shader Garden**: a generative art toy; plants grow out of GLSL noise and sway to the music
- **Rain Check**: an offline weather app that warns before the commute gets wet
- **commit-journal**: turn the day's git commits into a short work log
- A case study for Warrior OS: the problem, the decisions, what I'd do differently
- Voice input for the command bar

Related: [[Warrior OS — build log]], [[Weekly review]]`,
  },
  {
    title: 'Reading list',
    tags: ['reading'],
    created: [18, 7, 40],
    updated: [6, 22, 20],
    content: `# Reading list

## Now
- *Designing Data-Intensive Applications*, Martin Kleppmann: chapter 5, replication

## Next
- *The Pragmatic Programmer*, David Thomas and Andrew Hunt
- *Refactoring UI*, Adam Wathan and Steve Schoger
- *Atomic Habits*, James Clear

## Done
- *Deep Work*, Cal Newport
- *Clean Code*, Robert C. Martin

> One book at a time, twenty pages a day.`,
  },
];

function seedNotes(now: number): void {
  const notes: Note[] = DEMO_NOTES.map((n) => {
    const created = at(now, ...n.created);
    return {
      id: `note-${created}`,
      title: n.title,
      content: n.content,
      tags: [...n.tags],
      createdAt: iso(created),
      updatedAt: iso(at(now, ...n.updated)),
    };
  });
  window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

// ─── Habits (Habit Forge's plain 'warrior-habits' list) ───

interface DemoHabit {
  name: string;
  icon: string;
  color: string;
  /** Days ago it was checked off; all within ACTIVE_DAYS. */
  days: readonly number[];
}

const DEMO_HABITS: readonly DemoHabit[] = [
  { name: 'Deep work 2h', icon: '💻', color: 'cyan', days: [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 16, 17] },
  { name: 'Workout', icon: '💪', color: 'green', days: [1, 2, 4, 5, 6, 8, 9, 12, 14, 17, 18] },
  { name: 'Read 20 pages', icon: '📖', color: 'amber', days: [2, 3, 5, 7, 9, 11, 13, 16, 18] },
  { name: 'Meditate', icon: '🧘', color: 'blue', days: [1, 3, 4, 6, 7, 12, 14] },
];

function seedHabits(now: number): void {
  const habits: Habit[] = DEMO_HABITS.map((h, i) => ({
    id: `habit-${at(now, 20, 9, i)}`,
    name: h.name,
    icon: h.icon,
    color: h.color,
    // Oldest first, as Habit Forge appends them.
    completions: [...h.days].sort((a, b) => b - a).map((d) => utcDayKey(new Date(utcDayStart(now, d)))),
  }));
  window.localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
}

// ─── Project Forge ───

interface DemoProject {
  name: string;
  description: string;
  techStack: string[];
  stage: ForgeStage;
  /** Manual progress; ignored with autoProgress. */
  progress: number;
  autoProgress: boolean;
  links: () => ForgeLink[];
  /** [title, done] */
  tasks: readonly (readonly [string, boolean])[];
  /** Tracked work: [days ago, local end hour, end minute, minutes, note]. */
  sessions: readonly (readonly [number, number, number, number, string])[];
}

function warriorOSLinks(): ForgeLink[] {
  const links: ForgeLink[] = [];
  if (OWNER.repo.trim()) links.push({ id: '', label: 'GitHub', url: OWNER.repo.trim() });
  const origin = window.location.origin;
  if (/^https?:\/\//.test(origin)) links.push({ id: '', label: 'Live', url: origin });
  return links;
}

/** One per column. Created in order, so each lands on top of its column. */
const DEMO_PROJECTS: readonly DemoProject[] = [
  {
    name: 'Shader Garden',
    description: 'A generative art toy: plants grow out of GLSL noise and sway to whatever music is playing.',
    techStack: ['WebGL', 'GLSL', 'TypeScript', 'Web Audio'],
    stage: 'ideas',
    progress: 10,
    autoProgress: false,
    links: () => [],
    tasks: [
      ['Sketch the growth rules', true],
      ['One plant in a fragment shader', false],
      ['React to the Web Audio analyser', false],
    ],
    sessions: [],
  },
  {
    name: 'commit-journal',
    description: "A small CLI that turns the day's git commits into a short, readable work log.",
    techStack: ['Node.js', 'TypeScript', 'Git'],
    stage: 'shipped',
    progress: 100,
    autoProgress: false,
    links: () => [],
    tasks: [
      ["Read today's commits from git log", true],
      ['Group commits by repository', true],
      ['Markdown and plain-text output', true],
      ['Install script and README', true],
    ],
    sessions: [],
  },
  {
    name: 'Rain Check',
    description: 'An offline-first weather app that warns you before the commute gets wet.',
    techStack: ['React', 'Service Worker', 'IndexedDB', 'Open-Meteo'],
    stage: 'testing',
    progress: 0,
    autoProgress: true,
    links: () => [],
    tasks: [
      ['Hourly forecast view', true],
      ['Cache forecasts for offline use', true],
      ['Commute alert at 8 AM', true],
      ['Install prompt and app icons', true],
      ['Lighthouse pass: performance and accessibility', false],
    ],
    sessions: [
      [7, 19, 30, 60, 'Commute alert logic'],
      [3, 21, 15, 45, 'Offline cache for forecasts'],
    ],
  },
  {
    name: 'Warrior OS',
    description:
      'This OS. A personal operating system in the browser: windows, workspaces, a command bar and apps for notes, projects, habits and learning. Offline-first; every browser keeps its own data.',
    techStack: ['Next.js', 'React', 'TypeScript', 'Zustand', 'Framer Motion', 'Tailwind CSS', 'Three.js'],
    stage: 'building',
    progress: 0,
    autoProgress: true,
    links: warriorOSLinks,
    tasks: [
      ['Window manager with three workspaces', true],
      ['Command bar that understands plain English', true],
      ['Crash-proof windows (error boundaries)', true],
      ['Lite mode for low-end laptops', true],
      ['Guided tour for first-time visitors', true],
      ['Guest mode with sample data', true],
      ['Accessibility pass: labels and focus order', false],
      ['Write the portfolio case study', false],
    ],
    sessions: [
      [8, 20, 20, 65, 'Command bar: fuzzy app search'],
      [6, 22, 5, 65, 'Sample data for guest sessions'],
      [4, 20, 10, 85, 'Error boundaries around every window'],
      [2, 21, 40, 100, 'Lite mode: profiling the wallpaper on an old laptop'],
      [1, 21, 5, 95, 'Guided tour polish'],
    ],
  },
];

function seedProjects(now: number): void {
  const forge = useProjectForgeStore.getState();
  for (const p of DEMO_PROJECTS) {
    const id = forge.createProject({
      name: p.name,
      description: p.description,
      techStack: p.techStack,
      stage: p.stage,
      progress: p.progress,
      autoProgress: p.autoProgress,
      links: p.links(),
      onHold: false,
    });
    for (const [title, done] of p.tasks) {
      forge.addTask(id, title);
      if (!done) continue;
      const tasks = useProjectForgeStore.getState().projects.find((x) => x.id === id)?.tasks;
      const task = tasks?.[tasks.length - 1];
      if (task) forge.toggleTask(id, task.id);
    }
    for (const [daysAgo, hour, minute, minutes, note] of p.sessions) {
      const end = at(now, daysAgo, hour, minute);
      forge.logManualSession({ projectId: id, start: end - minutes * MINUTE_MS, end, note });
    }
  }
}

// ─── Expense Vault ───

const DEMO_EXPENSES: readonly {
  daysAgo: number;
  amount: number;
  category: ExpenseCategory;
  note: string;
}[] = [
  { daysAgo: 12, amount: 899, category: 'other', note: 'Domain renewal' },
  { daysAgo: 10, amount: 119, category: 'entertainment', note: 'Music subscription' },
  { daysAgo: 8, amount: 380, category: 'entertainment', note: 'Movie night' },
  { daysAgo: 6, amount: 120, category: 'transport', note: 'Auto to the coworking space' },
  { daysAgo: 5, amount: 450, category: 'books', note: 'The Pragmatic Programmer (used copy)' },
  { daysAgo: 4, amount: 349, category: 'other', note: 'USB-C cable' },
  { daysAgo: 3, amount: 500, category: 'transport', note: 'Metro card top-up' },
  { daysAgo: 2, amount: 280, category: 'food', note: 'Lunch with the team' },
  { daysAgo: 1, amount: 640, category: 'food', note: 'Groceries for the week' },
  { daysAgo: 0, amount: 40, category: 'food', note: 'Filter coffee' },
];

function seedExpenses(now: number): void {
  const { addExpense } = useExpenseStore.getState();
  for (const e of DEMO_EXPENSES) {
    addExpense({ amount: e.amount, category: e.category, note: e.note, date: localDateKey(now, -e.daysAgo) });
  }
}

// ─── Calendar (this week, around today) ───

const DEMO_EVENTS: readonly {
  dayOffset: number;
  /** 'HH:mm', or null for all day. */
  time: string | null;
  title: string;
  category: CalendarEventCategory;
  recurrence?: CalendarRecurrence;
  reminderMinutes?: number;
  notes?: string;
}[] = [
  {
    dayOffset: -1,
    time: '16:00',
    title: 'Design review: guided tour',
    category: 'project',
    notes: 'Walk through all five stops; cut any line that runs longer than two sentences.',
  },
  {
    dayOffset: 0,
    time: '19:30',
    title: 'Deep work: Warrior OS',
    category: 'project',
    notes: 'Accessibility pass on Settings and Notes.',
  },
  { dayOffset: 1, time: '07:00', title: 'Morning run', category: 'personal', recurrence: 'weekly' },
  {
    dayOffset: 2,
    time: '18:00',
    title: 'System design reading group',
    category: 'study',
    reminderMinutes: 30,
    notes: 'Designing Data-Intensive Applications, chapter 5: replication.',
  },
  { dayOffset: 3, time: null, title: 'Rain Check beta: collect feedback', category: 'project' },
  { dayOffset: 4, time: '20:00', title: 'Movie night', category: 'personal' },
  {
    dayOffset: 5,
    time: '10:30',
    title: 'Weekly review',
    category: 'personal',
    recurrence: 'weekly',
    notes: 'Wins, blockers, next week. Write it up in Notes.',
  },
];

function seedCalendar(now: number): void {
  const { addEvent } = useCalendarStore.getState();
  for (const e of DEMO_EVENTS) {
    addEvent({
      title: e.title,
      date: localDateKey(now, e.dayOffset),
      time: e.time,
      category: e.category,
      color: CALENDAR_CATEGORY_COLORS[e.category],
      recurrence: e.recurrence ?? 'none',
      recurUntil: null,
      reminderMinutes: e.time ? (e.reminderMinutes ?? null) : null,
      notes: e.notes ?? '',
    });
  }
}

// ─── Learning (sample decks) ───

/** Share of each sample deck already studied, in deck order; later sample decks start fresh. */
const DECK_STUDIED_SHARE: readonly number[] = [0.7, 0.4, 0.2];
/** Local start of the study session on each active day (cycled): evenings, some early mornings. */
const STUDY_SESSIONS: readonly (readonly [number, number])[] = [
  [21, 30],
  [7, 10],
  [22, 0],
  [20, 45],
  [6, 50],
  [21, 10],
];

/** Quiz answers grade themselves; flashcards get the self-rating a person would give. */
function gradeFor(correct: boolean, quiz: boolean, random: () => number): ReviewGrade {
  if (!correct) return 'again';
  if (quiz) return 'good';
  const roll = random();
  return roll < 0.2 ? 'easy' : roll < 0.35 ? 'hard' : 'good';
}

function seedLearning(now: number): void {
  const learning = useLearningStore.getState();
  const decks = learning.decks.filter((d) => d.isSample).slice(0, DECK_STUDIED_SHARE.length);
  const random = prng(0x5eed_2026);
  // Oldest first.
  const days = [...ACTIVE_DAYS].sort((a, b) => b - a);
  const answersOnDay = new Map<number, number>();
  const inputs: RecordAttemptInput[] = [];

  decks.forEach((deck, deckIndex) => {
    const cards = deckCards(deck);
    const studied = cards.slice(0, Math.round(cards.length * DECK_STUDIED_SHARE[deckIndex]));
    for (const card of studied) {
      const quiz = isQuizCard(card);
      const answers = 1 + Math.floor(random() * 3) + (deckIndex === 0 ? 1 : 0);
      // Later decks were picked up more recently.
      let dayIndex = Math.min(days.length - 1, Math.floor(random() * days.length * 0.5) + deckIndex * 4);
      for (let k = 0; k < answers && dayIndex < days.length; k++) {
        const daysAgo = days[dayIndex];
        const correct = random() < (k === 0 ? 0.65 : 0.85);
        const [hour, minute] = STUDY_SESSIONS[dayIndex % STUDY_SESSIONS.length];
        const position = answersOnDay.get(daysAgo) ?? 0;
        answersOnDay.set(daysAgo, position + 1);
        const dayEnd = utcDayStart(now, daysAgo) + DAY_MS - 1000;
        inputs.push({
          cardId: card.id,
          correct,
          grade: gradeFor(correct, quiz, random),
          source: k > 0 ? 'review' : quiz ? 'quiz' : 'flashcards',
          durationMs: Math.round((quiz ? 6 + random() * 34 : 3 + random() * 11) * 1000),
          at: Math.min(dayEnd, at(now, daysAgo, hour, minute) + position * 40_000),
        });
        dayIndex += 1 + Math.floor(random() * 3);
      }
    }
  });

  // One write, in the order the answers were given (spaced repetition replays them).
  inputs.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  if (inputs.length > 0) learning.recordAttempts(inputs);
}

// ─── XP ───

function seedProgress(): void {
  const { xp, addXP } = useXPStore.getState();
  if (xp < DEMO_XP) addXP(DEMO_XP - xp, 'demo');
}

const SEEDERS: Record<DemoSeedArea, (now: number) => void> = {
  notes: seedNotes,
  habits: seedHabits,
  projects: seedProjects,
  expenses: seedExpenses,
  calendar: seedCalendar,
  learning: seedLearning,
  progress: seedProgress,
};
