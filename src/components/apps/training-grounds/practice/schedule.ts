// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Practice Schedule Helpers
// UTC day math (the OS keys every day by UTC), short interval
// labels and the due forecast shared by Review, Flashcards,
// the Skill Tree and the Quest Planner
// ═══════════════════════════════════════════════════════════

import { listCardLocations } from '@/stores/useLearningStore';
import type { CardReview, Deck } from '@/types/learning';

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** Epoch ms of 00:00 UTC on the day containing `ms`. */
export function utcDayStart(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

/** 'YYYY-MM-DD' (UTC) of an epoch ms. */
export function dayKeyOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Epoch ms of 00:00 UTC for a 'YYYY-MM-DD' key, or null when it is not one. */
export function parseDayKey(key: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const ms = Date.parse(`${key}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

/** Whole UTC days from one moment's day to another's (negative when `toMs` is earlier). */
export function daysBetween(fromMs: number, toMs: number): number {
  return Math.round((utcDayStart(toMs) - utcDayStart(fromMs)) / DAY_MS);
}

/** Compact interval: "now", "10m", "5h", "3d", "2w", "4mo", "1.5y". */
export function formatInterval(ms: number): string {
  if (ms < MINUTE_MS) return 'now';
  if (ms < HOUR_MS) return `${Math.max(1, Math.round(ms / MINUTE_MS))}m`;
  if (ms < DAY_MS) return `${Math.round(ms / HOUR_MS)}h`;
  const days = Math.round(ms / DAY_MS);
  if (days < 14) return `${days}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round((days / 365) * 10) / 10}y`;
}

/** "45s", "6m 12s", "1h 04m". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m ${String(total % 60).padStart(2, '0')}s`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });
const SHORT_DATE = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "Tue" for a UTC day. */
export function weekdayLabel(ms: number): string {
  return WEEKDAY.format(ms);
}

/** "Oct 16" / "16 Oct" (viewer's locale) for a UTC day. */
export function shortDateLabel(ms: number): string {
  return SHORT_DATE.format(ms);
}

/** "Today", "Tomorrow", else "Tue". */
export function relativeDayLabel(dayStartMs: number, todayStartMs: number): string {
  const offset = Math.round((dayStartMs - todayStartMs) / DAY_MS);
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  return weekdayLabel(dayStartMs);
}

export interface ForecastScope {
  deckId?: string;
  topicId?: string;
  /** Only these decks (e.g. a plan's decks); ignored when deckId is set. */
  deckIds?: readonly string[];
}

/**
 * Reviews due per UTC day, starting today. Overdue cards count toward today;
 * never-answered cards are not scheduled, so they are left out.
 */
export function dueForecast(
  decks: readonly Deck[],
  reviews: Readonly<Record<string, CardReview>>,
  now: number,
  days: number,
  scope: ForecastScope = {}
): number[] {
  const counts = new Array<number>(Math.max(0, days)).fill(0);
  const todayStart = utcDayStart(now);
  const pool = scope.deckIds && !scope.deckId ? decks.filter((d) => scope.deckIds?.includes(d.id)) : decks;
  for (const { card } of listCardLocations(pool, scope.deckId, scope.topicId)) {
    const review = reviews[card.id];
    if (!review) continue;
    const offset = Math.max(0, Math.floor((review.dueAt - todayStart) / DAY_MS));
    if (offset < counts.length) counts[offset] += 1;
  }
  return counts;
}

/** Fisher-Yates copy (call from event handlers: it is random). */
export function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
