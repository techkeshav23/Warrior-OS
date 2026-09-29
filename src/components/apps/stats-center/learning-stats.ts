// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Stats Center learning helpers
// Pure numbers behind the learning section: deck mastery for the
// radar, today's review load, recent accuracy, the 30-day mastery /
// accuracy trend and the activity heatmap. Day keys are UTC dates,
// like every other streak and log in the OS.
// ═══════════════════════════════════════════════════════════

import {
  cardStrength,
  collectDueCards,
  computeDeckMastery,
  computeMastery,
  deckCards,
} from '@/stores/useLearningStore';
import type { QuizAttempt } from '@/stores/useQuizHistoryStore';
import type { CardAttempt, CardReview, Deck, Mastery } from '@/types/learning';
import { DAY_MS, utcDayKey, type HabitSnapshot } from '@/components/widgets/widget-data';
import { VIZ } from '@/styles/tokens';

/** Mastery marks (radar, trend): chart series 1 (viz-1, plasma). */
export const MASTERY_COLOR = VIZ[0];
/** Accuracy marks (trend): chart series 2 (viz-2, ember). */
export const ACCURACY_COLOR = VIZ[1];

/** Most decks the radar shows (the most studied ones). */
export const RADAR_MAX_DECKS = 6;
export const TREND_DAYS = 30;
export const ACCURACY_DAYS = 7;
export const HEATMAP_WEEKS = 26;

/** Answers the learning store keeps per card for mastery. */
const RECENT_KEPT = 8;

type Reviews = Readonly<Record<string, CardReview>>;

// ─── Day keys ───

/** Epoch ms of 00:00 UTC on a day key (NaN for a malformed key). */
export function dayStartMs(dayKey: string): number {
  return Date.parse(`${dayKey}T00:00:00Z`);
}

/** Move a day key by whole days ('' for a malformed key). */
export function shiftDayKey(dayKey: string, deltaDays: number): string {
  const ms = dayStartMs(dayKey);
  return Number.isNaN(ms) ? '' : utcDayKey(ms + deltaDays * DAY_MS);
}

// ─── Deck mastery ───

export interface DeckMasteryRow {
  id: string;
  name: string;
  icon: string;
  mastery: Mastery;
}

/** Every deck's mastery, most studied first (cards seen, then deck size, then name). */
export function rankDeckMastery(decks: readonly Deck[], reviews: Reviews): DeckMasteryRow[] {
  return decks
    .map((d) => ({ id: d.id, name: d.name, icon: d.icon, mastery: computeDeckMastery(d, reviews) }))
    .sort(
      (a, b) =>
        b.mastery.seen - a.mastery.seen || b.mastery.total - a.mastery.total || a.name.localeCompare(b.name)
    );
}

// ─── Today at a glance ───

export interface LearningSummary {
  /** Every card in every deck. */
  mastery: Mastery;
  /** Reviews due right now. */
  dueNow: number;
  /** Reviews due by the end of the UTC day (includes dueNow). */
  dueToday: number;
  /** Cards never answered. */
  newCards: number;
  /** Answers in the last ACCURACY_DAYS days (today included). */
  recentAnswers: number;
  /** 0..1 share of those answers that were right; null without answers. */
  recentAccuracy: number | null;
}

export function summarizeLearning(
  decks: readonly Deck[],
  reviews: Reviews,
  attempts: readonly CardAttempt[],
  nowMs: number
): LearningSummary {
  const today = utcDayKey(nowMs);
  const endOfDay = dayStartMs(today) + DAY_MS;
  const queue = collectDueCards(decks, reviews, { now: nowMs });
  const newCards = queue.filter((c) => c.review === null).length;
  const dueNow = queue.length - newCards;
  const dueToday = collectDueCards(decks, reviews, { now: endOfDay - 1, includeNew: false }).length;

  const since = dayStartMs(shiftDayKey(today, -(ACCURACY_DAYS - 1)));
  let recentAnswers = 0;
  let recentCorrect = 0;
  for (const a of attempts) {
    if (!Number.isFinite(a.timestamp) || a.timestamp < since) continue;
    recentAnswers++;
    if (a.correct) recentCorrect++;
  }

  return {
    mastery: computeMastery(decks.flatMap((d) => deckCards(d)), reviews),
    dueNow,
    dueToday,
    newCards,
    recentAnswers,
    recentAccuracy: recentAnswers > 0 ? recentCorrect / recentAnswers : null,
  };
}

// ─── Trend ───

export interface TrendRow {
  /** UTC day key. */
  key: string;
  /** 0..100 mastery of the cards that existed by the end of the day; null before the first card. */
  mastery: number | null;
  /** 0..100 share of that day's answers that were right; null on days without answers. */
  accuracy: number | null;
  answered: number;
}

const STRENGTH_PROBE: CardReview = {
  cardId: '',
  ease: 0,
  intervalDays: 0,
  reps: 0,
  lapses: 0,
  dueAt: 0,
  lastReviewedAt: 0,
  recent: [],
};

/** Strength of a card whose answers so far were `results`, oldest first. */
function strengthOf(results: readonly boolean[]): number {
  if (results.length === 0) return 0;
  return cardStrength({ ...STRENGTH_PROBE, recent: results.slice(-RECENT_KEPT) });
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Mastery and accuracy for each of the last `days` UTC days, oldest first.
 * Mastery is rebuilt by replaying each card's logged answers up to the end
 * of every day; answers older than the capped log come from the card's
 * saved recent results. The last day always equals the live mastery.
 */
export function buildLearningTrend(
  decks: readonly Deck[],
  reviews: Reviews,
  attempts: readonly CardAttempt[],
  todayKey: string,
  days: number = TREND_DAYS
): TrendRow[] {
  const firstKey = shiftDayKey(todayKey, -(days - 1));
  const windowStart = dayStartMs(firstKey);
  if (!firstKey || Number.isNaN(windowStart) || days <= 0) return [];

  // Daily answers + accuracy: every logged answer, deleted cards included.
  const answered = new Array<number>(days).fill(0);
  const correct = new Array<number>(days).fill(0);
  for (const a of attempts) {
    if (!Number.isFinite(a.timestamp) || a.timestamp < windowStart) continue;
    const i = Math.floor((a.timestamp - windowStart) / DAY_MS);
    if (i >= days) continue;
    answered[i]++;
    if (a.correct) correct[i]++;
  }

  // Mastery at the end of each day, over the cards that existed then.
  const cards = decks.flatMap((d) => deckCards(d));
  const logs = new Map<string, CardAttempt[]>();
  for (const card of cards) logs.set(card.id, []);
  for (const a of attempts) {
    if (Number.isFinite(a.timestamp)) logs.get(a.cardId)?.push(a);
  }

  const sums = new Array<number>(days).fill(0);
  const counts = new Array<number>(days).fill(0);
  for (const card of cards) {
    const created = Number.isFinite(card.createdAt) ? card.createdAt : -Infinity;
    const recent = reviews[card.id]?.recent ?? [];
    const log = (logs.get(card.id) ?? []).sort((a, b) => a.timestamp - b.timestamp);
    // Saved results the log no longer holds (capped log, imported progress) came first.
    const results = recent.slice(0, Math.max(0, recent.length - log.length));
    let next = 0;
    for (let d = 0; d < days; d++) {
      const end = windowStart + (d + 1) * DAY_MS;
      if (created >= end) continue;
      while (next < log.length && log[next].timestamp < end) results.push(log[next++].correct);
      counts[d]++;
      sums[d] += strengthOf(results);
    }
  }

  const rows: TrendRow[] = [];
  for (let d = 0; d < days; d++) {
    rows.push({
      key: shiftDayKey(firstKey, d),
      mastery: counts[d] > 0 ? round1((sums[d] / counts[d]) * 100) : null,
      accuracy: answered[d] > 0 ? Math.round((correct[d] / answered[d]) * 100) : null,
      answered: answered[d],
    });
  }
  // Today is the live value, exactly what the radar and tiles show.
  if (cards.length > 0) rows[days - 1].mastery = round1(computeMastery(cards, reviews).value * 100);
  return rows;
}

// ─── Activity heatmap ───

export interface ActivityCell {
  key: string;
  /** Cards answered (older quiz rows count their questions). */
  cards: number;
  habits: number;
  /** 0 (none) .. 4 (busiest). */
  level: number;
  /** After today: drawn as an empty slot. */
  future: boolean;
}

export interface ActivityCalendar {
  /** Columns of seven days, Monday first, oldest week first. */
  weeks: ActivityCell[][];
  activeDays: number;
}

/**
 * Day-by-day study activity for the last `weeks` weeks: habits ticked plus
 * cards answered. Quiz history rows (older, pre-deck rows included) cover
 * answers the capped card log has dropped; a day takes the larger of the
 * two so a quiz is never counted twice.
 */
export function buildActivityCalendar(
  habits: readonly HabitSnapshot[],
  cardAttempts: readonly CardAttempt[],
  quizAttempts: readonly QuizAttempt[],
  todayKey: string,
  weeks: number = HEATMAP_WEEKS
): ActivityCalendar {
  const todayStart = dayStartMs(todayKey);
  if (Number.isNaN(todayStart) || weeks <= 0) return { weeks: [], activeDays: 0 };
  const mondayOffset = (new Date(todayStart).getUTCDay() + 6) % 7;
  const firstKey = shiftDayKey(todayKey, -(mondayOffset + (weeks - 1) * 7));

  const cardsByDay = new Map<string, number>();
  for (const a of cardAttempts) {
    if (!Number.isFinite(a.timestamp)) continue;
    const key = utcDayKey(a.timestamp);
    if (key >= firstKey) cardsByDay.set(key, (cardsByDay.get(key) ?? 0) + 1);
  }
  const quizByDay = new Map<string, number>();
  for (const q of quizAttempts) {
    if (!Number.isFinite(q.timestamp)) continue;
    const key = utcDayKey(q.timestamp);
    if (key >= firstKey) quizByDay.set(key, (quizByDay.get(key) ?? 0) + Math.max(0, q.totalQuestions || 0));
  }
  const habitsByDay = new Map<string, number>();
  for (const habit of habits) {
    for (const key of new Set(habit.completions)) {
      if (key >= firstKey) habitsByDay.set(key, (habitsByDay.get(key) ?? 0) + 1);
    }
  }

  const cells: ActivityCell[] = [];
  const totals: number[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const key = shiftDayKey(firstKey, i);
    const future = key > todayKey;
    const cards = future ? 0 : Math.max(cardsByDay.get(key) ?? 0, quizByDay.get(key) ?? 0);
    const habitCount = future ? 0 : (habitsByDay.get(key) ?? 0);
    cells.push({ key, cards, habits: habitCount, level: 0, future });
    if (cards + habitCount > 0) totals.push(cards + habitCount);
  }

  // Levels scale to this warrior's own typical busy day (upper quartile),
  // so one marathon day does not wash every other day out.
  totals.sort((a, b) => a - b);
  const cap = totals.length > 0 ? totals[Math.max(0, Math.ceil(totals.length * 0.75) - 1)] : 1;
  for (const cell of cells) {
    const total = cell.cards + cell.habits;
    cell.level = total > 0 ? Math.min(4, Math.max(1, Math.ceil((total / cap) * 4))) : 0;
  }

  const columns: ActivityCell[][] = [];
  for (let w = 0; w < weeks; w++) columns.push(cells.slice(w * 7, w * 7 + 7));
  return { weeks: columns, activeDays: totals.length };
}
