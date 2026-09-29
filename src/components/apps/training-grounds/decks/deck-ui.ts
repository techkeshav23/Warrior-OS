// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault: shared UI constants and helpers
// Deck hues, card-kind + difficulty metadata, the Training Grounds
// tab icons, the per-deck summary (mastery, due and new counts) and
// small text / file helpers the Decks tab shares.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState, type CSSProperties } from 'react';
import {
  CircleDot,
  Crosshair,
  Hash,
  Layers,
  LibraryBig,
  ListChecks,
  Orbit,
  Repeat,
  Route,
  StickyNote,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import type { Tone } from '@/components/ui';
import { computeDeckMastery, deckCards, isQuizCard } from '@/stores/useLearningStore';
import { VIZ } from '@/styles/tokens';
import type { CardKind, CardReview, Deck, Difficulty, Mastery } from '@/types/learning';
import type { TrainingTab } from '../deep-link';

// ─── Training Grounds tabs ───

/** Glyph per Training Grounds tab (sidebar nav + the deck's study launchers). */
export const TAB_ICONS: Readonly<Record<'decks' | TrainingTab, LucideIcon>> = {
  decks: Layers,
  quiz: Crosshair,
  flashcards: Repeat,
  'skill-tree': Orbit,
  bank: LibraryBig,
  mock: Timer,
  planner: Route,
};

// ─── Deck look ───

/** Colours offered for a deck: the FORGE HUD viz palette. */
export const DECK_COLOR_CHOICES: readonly string[] = VIZ;

/** Deck colours from the pre-FORGE swatches → their on-palette successor (data, not styling). */
const LEGACY_DECK_COLORS: Readonly<Record<string, string>> = {
  '#22d3ee': VIZ[0], // cyan → plasma
  '#fb923c': VIZ[1], // orange → ember
  '#34d399': VIZ[3], // emerald → mint
  '#f472b6': VIZ[4], // pink → rose
  '#60a5fa': VIZ[5], // blue → azure
  '#fbbf24': VIZ[6], // amber → gold
};

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * The colour to paint for a stored deck colour: old swatches mapped onto
 * the palette, anything invalid → plasma. Always a plain hex, safe in CSS.
 */
export function deckHue(color: string | null | undefined): string {
  if (typeof color !== 'string') return VIZ[0];
  const hex = color.trim().toLowerCase();
  if (!HEX_COLOR.test(hex)) return VIZ[0];
  return LEGACY_DECK_COLORS[hex] ?? hex;
}

/** Exposes a deck's hue as `--deck`, for `text-(--deck)`, `bg-(--deck)/10`, … */
export function deckStyle(color: string | null | undefined): CSSProperties {
  return { '--deck': deckHue(color) } as CSSProperties;
}

export const DECK_ICON_CHOICES: readonly string[] = [
  '📚', '🧠', '💻', '⚛️', '🧮', '🔬', '🧪', '🧬', '🌍', '🗣️', '🎵', '🎨',
  '📜', '⚙️', '🛡️', '🚀', '📈', '🔐', '🌐', '🗂️', '✍️', '🏛️', '⚡', '🎯',
];

/** Store limits mirrored in the editors (the store trims anyway). */
export const LIMITS = {
  name: 80,
  description: 500,
  prompt: 2000,
  text: 4000,
  option: 500,
  options: 10,
  tag: 40,
  tags: 20,
  unit: 20,
  icon: 16,
} as const;

// ─── Cards ───

export const KIND_META: Readonly<Record<CardKind, { label: string; short: string; icon: LucideIcon; hint: string }>> = {
  mcq: {
    label: 'Multiple choice',
    short: 'MCQ',
    icon: CircleDot,
    hint: 'One correct option. Auto-graded in quizzes and mock tests.',
  },
  'multi-select': {
    label: 'Multi-select',
    short: 'Multi',
    icon: ListChecks,
    hint: 'Every correct option (and only those) must be picked.',
  },
  numeric: {
    label: 'Numeric',
    short: 'Num',
    icon: Hash,
    hint: 'A typed number, optionally within a tolerance.',
  },
  flashcard: {
    label: 'Flashcard',
    short: 'Card',
    icon: StickyNote,
    hint: 'Front and back. You grade your own recall in reviews.',
  },
};

export const CARD_KINDS: readonly CardKind[] = ['mcq', 'multi-select', 'numeric', 'flashcard'];

export const DIFFICULTY_META: Readonly<Record<Difficulty, { label: string; tone: Tone }>> = {
  easy: { label: 'Easy', tone: 'success' },
  medium: { label: 'Medium', tone: 'warning' },
  hard: { label: 'Hard', tone: 'danger' },
};

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

// ─── Deck summary ───

export interface DeckSummary {
  mastery: Mastery;
  cards: number;
  /** Auto-graded cards (MCQ, multi-select, numeric): what quizzes and mock tests use. */
  quizCards: number;
  /** Answered cards whose review is due. */
  due: number;
  /** Cards never answered. */
  fresh: number;
}

export function summarizeDeck(deck: Deck, reviews: Readonly<Record<string, CardReview>>, now: number): DeckSummary {
  let cards = 0;
  let quizCards = 0;
  let due = 0;
  let fresh = 0;
  for (const card of deckCards(deck)) {
    cards += 1;
    if (isQuizCard(card)) quizCards += 1;
    const review = reviews[card.id];
    if (!review) fresh += 1;
    else if (review.dueAt <= now) due += 1;
  }
  return { mastery: computeDeckMastery(deck, reviews), cards, quizCards, due, fresh };
}

/** Answered cards across every deck whose review is due at `now`. */
export function countDueCards(
  decks: readonly Deck[],
  reviews: Readonly<Record<string, CardReview>>,
  now: number
): number {
  let due = 0;
  for (const deck of decks) {
    for (const card of deckCards(deck)) {
      const review = reviews[card.id];
      if (review && review.dueAt <= now) due += 1;
    }
  }
  return due;
}

/** Epoch ms that ticks once a minute: enough for due counts, and it keeps render pure. */
export function useMinuteNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** Epoch ms of the most recent answer across all reviews (null = never studied). */
export function lastStudiedAt(reviews: Readonly<Record<string, CardReview>>): number | null {
  let last = 0;
  for (const review of Object.values(reviews)) if (review.lastReviewedAt > last) last = review.lastReviewedAt;
  return last > 0 ? last : null;
}

// ─── Text + files ───

export function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`;
}

/** "just now" · "12m ago" · "3h ago" · "5d ago" · "12 Aug". */
export function timeAgo(ms: number, now: number): string {
  const diff = Math.max(0, now - ms);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function fileSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'deck'
  );
}

/** Save text as a file through a temporary download link. */
export function downloadTextFile(filename: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Split "a, b, #c" into clean, unique tags (store rules: no '#', ≤ 40 chars, ≤ 20 tags). */
export function mergeTags(current: readonly string[], raw: string): string[] {
  const next = [...current];
  const seen = new Set(current.map((t) => t.toLowerCase()));
  for (const part of raw.split(',')) {
    const tag = part.trim().replace(/^#+/, '').slice(0, LIMITS.tag);
    if (!tag || seen.has(tag.toLowerCase()) || next.length >= LIMITS.tags) continue;
    seen.add(tag.toLowerCase());
    next.push(tag);
  }
  return next;
}
