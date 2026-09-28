// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Context Builder
// Reads live stores + app data (visitor mode, habits, notes, decks,
// quizzes, biometrics, decay, pomodoro) and produces the OS-state
// context NEXUS sends to the AI route, plus small insight helpers
// reused by suggestions, the command palette and NexusCore.
// Browser-only data access happens inside functions (SSR-safe).
// ═══════════════════════════════════════════════════════════

import { useAppStore } from '@/stores/useAppStore';
import { useWindowStore } from '@/stores/useWindowStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useXPStore } from '@/stores/useXPStore';
import { deckAttempts, useQuizHistoryStore, type QuizAttempt } from '@/stores/useQuizHistoryStore';
import {
  cardAnswerText,
  collectDueCards,
  computeDeckMastery,
  listCardLocations,
  useLearningStore,
} from '@/stores/useLearningStore';
import { getVisitorMode } from '@/lib/visitor';
import { useDecayStore } from '@/stores/useDecayStore';
import { useBiometricsStore } from '@/stores/useBiometricsStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useNexusStore, nexusDayKey } from '@/stores/useNexusStore';
import { NEXUS_LIMITS } from './protocol';
import type { NexusContext, NexusPomodoroState } from '@/types/nexus';
import type { BiometricState } from '@/types/biometrics';

// ─── Raw app data (localStorage) ───

interface HabitLite {
  name: string;
  completions: string[];
}

export interface NoteLite {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: string;
}

function readJsonArray(key: string): unknown[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadHabitsLite(): HabitLite[] {
  return readJsonArray('warrior-habits')
    .filter((h): h is Record<string, unknown> => !!h && typeof h === 'object')
    .map((h) => ({
      name: typeof h.name === 'string' ? h.name : 'Habit',
      completions: Array.isArray(h.completions)
        ? h.completions.filter((d): d is string => typeof d === 'string')
        : [],
    }));
}

export function loadNotesLite(): NoteLite[] {
  return readJsonArray('warrior-notes')
    .filter((n): n is Record<string, unknown> => !!n && typeof n === 'object')
    .map((n) => ({
      id: typeof n.id === 'string' ? n.id : '',
      title: typeof n.title === 'string' ? n.title : 'Untitled',
      content: typeof n.content === 'string' ? n.content : '',
      tags: Array.isArray(n.tags) ? n.tags.filter((t): t is string => typeof t === 'string') : [],
      updatedAt: typeof n.updatedAt === 'string' ? n.updatedAt : '',
    }));
}

/** Notes whose title, tags or content contain the query (case-insensitive). */
export function findMatchingNotes(query: string, notes: NoteLite[] = loadNotesLite()): NoteLite[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return notes.filter(
    (n) =>
      n.title.toLowerCase().includes(q) ||
      n.tags.some((t) => t.toLowerCase().includes(q)) ||
      n.content.toLowerCase().includes(q)
  );
}

// ─── Streak (same algorithm as Stats Center's StreakBoard, UTC day keys) ───

export function computeHabitStreak(habits: HabitLite[], now: number): number {
  const activeDays = new Set<string>();
  habits.forEach((h) => h.completions.forEach((d) => activeDays.add(d)));
  if (activeDays.size === 0) return 0;
  let current = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    if (activeDays.has(key)) current++;
    else if (i === 0) continue; // today may simply not be done yet
    else break;
  }
  return current;
}

export function habitsDoneToday(habits: HabitLite[], now: number): number {
  const today = nexusDayKey(now);
  return habits.filter((h) => h.completions.includes(today)).length;
}

// ─── Time ───

export function timeOfDayFor(hour: number): NexusContext['timeOfDay'] {
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  if (hour >= 21 || hour < 1) return 'night';
  if (hour >= 1 && hour < 5) return 'late-night';
  return 'morning';
}

export function formatAgo(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatHour(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const suffix = h < 12 ? 'AM' : 'PM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${suffix}`;
}

// ─── Quiz insights ───

export interface SubjectAccuracy {
  /** Current deck name (the name the quiz was saved under when the deck is gone). */
  subject: string;
  deckId: string;
  accuracy: number; // 0-100
  attempts: number;
}

export interface QuizInsights {
  /** Every finished quiz, legacy rows included. */
  totalAttempts: number;
  /** Latest deck quiz (retry rounds and legacy rows excluded). */
  last: (QuizAttempt & { pct: number }) | null;
  subjects: SubjectAccuracy[];
  weakest: SubjectAccuracy | null;
  strongest: SubjectAccuracy | null;
}

/**
 * Accuracy per deck from the quiz log. Only deck quizzes are named
 * (deckAttempts): legacy rows saved before decks existed count toward
 * the total only, like the store's other totals, and "retry wrong ones"
 * rounds are left out (the answers were just shown).
 */
export function getQuizInsights(attempts: QuizAttempt[] = useQuizHistoryStore.getState().attempts): QuizInsights {
  const deckNames = new Map(useLearningStore.getState().decks.map((d) => [d.id, d.name] as const));
  const byDeck = new Map<string, QuizAttempt[]>();
  let last: QuizAttempt | null = null;
  for (const a of deckAttempts(attempts)) {
    if (a.retry) continue;
    if (!last || a.timestamp > last.timestamp) last = a;
    const list = byDeck.get(a.deckId) ?? [];
    list.push(a);
    byDeck.set(a.deckId, list);
  }
  const subjects: SubjectAccuracy[] = [];
  byDeck.forEach((list, deckId) => {
    const name = deckNames.get(deckId);
    if (!name) return; // deleted deck: nothing left to quiz
    const recent = [...list].sort((x, y) => y.timestamp - x.timestamp).slice(0, 10);
    const total = recent.reduce((n, a) => n + a.totalQuestions, 0);
    const correct = recent.reduce((n, a) => n + a.correctAnswers, 0);
    if (total >= 3) {
      subjects.push({ subject: name, deckId, accuracy: Math.round((correct / total) * 100), attempts: list.length });
    }
  });
  subjects.sort((a, b) => a.accuracy - b.accuracy);
  const lastPct =
    last && last.totalQuestions > 0 ? Math.round((last.correctAnswers / last.totalQuestions) * 100) : 0;
  const lastName = last?.deckId ? (deckNames.get(last.deckId) ?? last.subject) : '';
  return {
    totalAttempts: attempts.length,
    last: last ? { ...last, subject: lastName, pct: lastPct } : null,
    subjects,
    weakest: subjects[0] ?? null,
    strongest: subjects.length > 1 ? subjects[subjects.length - 1] : null,
  };
}

// ─── Learning insights (Training Grounds decks) ───

export interface DeckInsight {
  id: string;
  name: string;
  /** Cards in the deck. */
  total: number;
  /** Cards answered at least once. */
  seen: number;
  /** Cards due for review now (answered before, due date passed). */
  due: number;
  /** Cards never answered. */
  fresh: number;
  /** 0-100: average card strength. */
  mastery: number;
}

export interface LearningInsights {
  decks: DeckInsight[];
  dueCards: number;
  newCards: number;
  /** Deck to work on next: most cards due, else the weakest started deck, else the first unstarted one. */
  focus: DeckInsight | null;
}

export function getLearningInsights(now: number): LearningInsights {
  const { decks, reviews } = useLearningStore.getState();
  const insights: DeckInsight[] = decks.map((deck) => {
    const mastery = computeDeckMastery(deck, reviews);
    const queue = collectDueCards([deck], reviews, { now });
    const due = queue.filter((c) => c.review !== null).length;
    return {
      id: deck.id,
      name: deck.name,
      total: mastery.total,
      seen: mastery.seen,
      due,
      fresh: queue.length - due,
      mastery: Math.round(mastery.value * 100),
    };
  });
  const withCards = insights.filter((d) => d.total > 0);
  const mostDue = withCards.reduce<DeckInsight | null>((best, d) => (d.due > (best?.due ?? 0) ? d : best), null);
  const weakest = withCards
    .filter((d) => d.seen > 0 && d.mastery < 80)
    .reduce<DeckInsight | null>((best, d) => (!best || d.mastery < best.mastery ? d : best), null);
  return {
    decks: insights,
    dueCards: insights.reduce((n, d) => n + d.due, 0),
    newCards: insights.reduce((n, d) => n + d.fresh, 0),
    focus: mostDue ?? weakest ?? withCards.find((d) => d.seen === 0) ?? withCards[0] ?? null,
  };
}

/** Deck and topic names, for matching free text such as "review javascript". */
export function listDeckNames(): string[] {
  const names: string[] = [];
  for (const deck of useLearningStore.getState().decks) {
    names.push(deck.name);
    for (const topic of deck.topics) names.push(topic.name);
  }
  return names;
}

export interface DeckKnowledge {
  deckName: string;
  topicName: string;
  prompt: string;
  answer: string;
  explanation?: string;
}

const LOOKUP_STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'what', 'how', 'does', 'why', 'kya', 'hai', 'about']);

function clipText(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * Cards in the user's own decks that talk about `query` (every word must
 * appear in the card, its tags, its topic or its answer). NEXUS shows
 * them under offline replies, so "what is a closure" finds the user's
 * closure cards even without an AI key.
 */
export function findDeckKnowledge(query: string, limit = 2): DeckKnowledge[] {
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((w) => w.length >= 3 && !LOOKUP_STOP_WORDS.has(w));
  if (words.length === 0) return [];
  const scored: { score: number; item: DeckKnowledge }[] = [];
  for (const loc of listCardLocations(useLearningStore.getState().decks)) {
    const prompt = loc.card.prompt.toLowerCase();
    const labels = `${loc.card.tags.join(' ')} ${loc.topicName} ${loc.deckName}`.toLowerCase();
    const answer = cardAnswerText(loc.card);
    const body = `${answer} ${loc.card.explanation ?? ''}`.toLowerCase();
    let score = 0;
    let matched = 0;
    for (const w of words) {
      const hit = (prompt.includes(w) ? 3 : 0) + (labels.includes(w) ? 2 : 0) + (body.includes(w) ? 1 : 0);
      if (hit > 0) matched += 1;
      score += hit;
    }
    if (matched < words.length || score < 3) continue;
    scored.push({
      score,
      item: {
        deckName: loc.deckName,
        topicName: loc.topicName,
        prompt: clipText(loc.card.prompt, 160),
        answer: clipText(answer, 120),
        ...(loc.card.explanation ? { explanation: clipText(loc.card.explanation, 200) } : {}),
      },
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}

// ─── Biometric insights (task 6.62) ───

export interface BiometricInsights {
  /** Current state when the tracker produced a reading in the last 3 minutes */
  current: BiometricState | null;
  lastUpdated: number | null;
  /** Local hour with the best average focus, when history is rich enough */
  focusPeakHour: number | null;
  focusPeakValue: number | null;
  /** Average fatigue 10–40 min ago (for "rising" detection) */
  earlierFatigue: number | null;
}

const BIOMETRIC_FRESH_MS = 3 * 60_000;

export function getBiometricInsights(now: number): BiometricInsights {
  const { current, lastUpdated, history } = useBiometricsStore.getState();
  const fresh = lastUpdated !== null && now - lastUpdated <= BIOMETRIC_FRESH_MS;

  // Focus peak: average focus per local hour over the last 14 days.
  const cutoff = now - 14 * 24 * 60 * 60_000;
  const buckets = new Map<number, { sum: number; n: number }>();
  for (const snap of history) {
    if (snap.timestamp < cutoff) continue;
    const bucket = buckets.get(snap.hour) ?? { sum: 0, n: 0 };
    bucket.sum += snap.state.focus;
    bucket.n += 1;
    buckets.set(snap.hour, bucket);
  }
  let peakHour: number | null = null;
  let peakValue: number | null = null;
  const richHours = [...buckets.entries()].filter(([, b]) => b.n >= 12); // ≥ 1 min of typing
  if (richHours.length >= 3) {
    for (const [hour, b] of richHours) {
      const avg = b.sum / b.n;
      if (peakValue === null || avg > peakValue) {
        peakValue = avg;
        peakHour = hour;
      }
    }
  }

  let fatigueSum = 0;
  let fatigueCount = 0;
  for (const snap of history) {
    if (snap.timestamp >= now - 40 * 60_000 && snap.timestamp <= now - 10 * 60_000) {
      fatigueSum += snap.state.fatigue;
      fatigueCount += 1;
    }
  }

  return {
    current: fresh ? current : null,
    lastUpdated,
    focusPeakHour: peakHour,
    focusPeakValue: peakValue === null ? null : Math.round(peakValue),
    earlierFatigue: fatigueCount >= 6 ? Math.round(fatigueSum / fatigueCount) : null,
  };
}

// ─── Pomodoro ───

export function pomodoroRemainingMs(p: NexusPomodoroState, now: number): number {
  if (p.phase === 'idle') return 0;
  if (p.pausedRemainingMs !== null) return p.pausedRemainingMs;
  if (p.endsAt === null) return 0;
  return Math.max(0, p.endsAt - now);
}

export function describePomodoro(p: NexusPomodoroState, now: number): string | null {
  if (p.phase === 'idle') return null;
  const remaining = formatClock(pomodoroRemainingMs(p, now));
  const paused = p.pausedRemainingMs !== null ? ', paused' : '';
  return p.phase === 'focus' ? `focus ${remaining} left${paused}` : `break ${remaining} left${paused}`;
}

// ─── Context ───

function openAppNames(): string[] {
  const apps = useAppStore.getState().registeredApps;
  const names: string[] = [];
  useWindowStore.getState().windows.forEach((w) => {
    const name = apps.find((a) => a.id === w.appId)?.name ?? w.title;
    if (!names.includes(name)) names.push(name);
  });
  return names.slice(0, 12);
}

/**
 * Build the context object sent to /api/ai. With `detailed`, a
 * multi-line summary of the OS state is attached (context toggle on).
 * The JSON form always stays under NEXUS_LIMITS.contextChars.
 */
export function buildNexusContext(options: { detailed: boolean }): NexusContext {
  const now = Date.now();
  const date = new Date(now);
  const xp = useXPStore.getState();
  const habits = loadHabitsLite();
  const streak = computeHabitStreak(habits, now);
  const quiz = getQuizInsights();
  const decay = useDecayStore.getState();
  const pomodoro = useNexusStore.getState().pomodoro;
  const isToday = pomodoro.dayKey === nexusDayKey(now);
  const focusToday = isToday ? pomodoro.focusMinutesToday : 0;
  const completedToday = isToday ? pomodoro.completedToday : 0;
  const idleMinutes =
    decay.lastInteractionAt !== null && !decay.isTracking
      ? Math.round((now - decay.lastInteractionAt) / 60_000)
      : 0;

  const context: NexusContext = {
    openApps: openAppNames(),
    currentWorkspace: useWorkspaceStore.getState().activeWorkspaceId,
    timeOfDay: timeOfDayFor(date.getHours()),
    userLevel: xp.level,
    currentStreak: streak,
    idleMinutes,
    studyHoursToday: Math.round((focusToday / 60) * 10) / 10,
    localTime: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
  };
  if (quiz.last) context.lastQuizScore = quiz.last.pct;
  const visitor = getVisitorMode();
  if (visitor) context.visitor = visitor;
  // An empty list tells NEXUS "no decks yet" (vs. no learning data sent at all).
  const learning = getLearningInsights(now);
  context.decks = learning.decks.slice(0, 12).map((d) => d.name.slice(0, 60));
  if (learning.decks.length > 0) {
    context.dueCards = learning.dueCards;
    if (learning.focus) context.focusDeck = learning.focus.name.slice(0, 60);
  }
  if (!options.detailed) return context;

  const lines: string[] = [];
  const toNext = xp.getXPForNextLevel();
  lines.push(`Level ${xp.level} ${xp.getLevelTitle()}, ${xp.xp} XP${toNext > 0 ? ` (${toNext} to next level)` : ''}.`);
  lines.push(
    habits.length > 0
      ? `Habits: ${habitsDoneToday(habits, now)}/${habits.length} done today, streak ${streak} day(s).`
      : 'Habits: none tracked yet.'
  );
  if (learning.decks.length > 0) {
    const decks = learning.decks
      .slice(0, 6)
      .map((d) => `${d.name} ${d.mastery}% mastery${d.due > 0 ? `, ${d.due} due` : ''}`)
      .join('; ');
    lines.push(
      `Decks (${learning.decks.length}): ${decks}. Cards due now: ${learning.dueCards}; new: ${learning.newCards}.`
    );
  } else {
    lines.push('Decks: none yet.');
  }
  if (quiz.last) {
    const parts = [`Quizzes: ${quiz.totalAttempts} attempts; last ${quiz.last.subject} ${quiz.last.pct}% (${formatAgo(now - quiz.last.timestamp)})`];
    if (quiz.weakest) parts.push(`weakest ${quiz.weakest.subject} ${quiz.weakest.accuracy}%`);
    if (quiz.strongest) parts.push(`strongest ${quiz.strongest.subject} ${quiz.strongest.accuracy}%`);
    lines.push(`${parts.join('; ')}.`);
  } else {
    lines.push(quiz.totalAttempts > 0 ? `Quizzes: ${quiz.totalAttempts} attempts.` : 'Quizzes: none attempted yet.');
  }
  if (decay.enabled && decay.continuousStudyMinutes > 0) {
    lines.push(`Continuous study session: ${decay.continuousStudyMinutes} min (decay stage ${decay.decayStage}).`);
  }
  const pomo = describePomodoro(pomodoro, now);
  lines.push(`Pomodoro: ${pomo ?? 'not running'}; ${completedToday} completed today (${focusToday} focus min).`);
  if (useSettingsStore.getState().biometricsEnabled) {
    const bio = getBiometricInsights(now);
    if (bio.current) {
      const c = bio.current;
      lines.push(
        `Typing biometrics now: energy ${Math.round(c.energy)}, focus ${Math.round(c.focus)}, fatigue ${Math.round(c.fatigue)}, stress ${Math.round(c.stress)}.`
      );
    }
    if (bio.focusPeakHour !== null) {
      lines.push(`Focus usually peaks around ${formatHour(bio.focusPeakHour)}.`);
    }
  }
  const notes = loadNotesLite();
  if (notes.length > 0) lines.push(`Notes: ${notes.length} saved.`);
  const windows = useWindowStore.getState().windows;
  if (windows.length > 0) lines.push(`Open windows: ${windows.length} (${context.openApps.join(', ')}).`);

  // Hard cap: trim the summary until the whole JSON fits the route limit.
  const budget = NEXUS_LIMITS.contextChars - 200;
  let summary = lines.join('\n');
  while (summary.length > 0 && JSON.stringify({ ...context, summary }).length > budget) {
    summary = summary.slice(0, Math.max(0, summary.length - 200));
  }
  if (summary) context.summary = summary;
  return context;
}
