// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault: shared UI constants and helpers
// Class names, colour / icon choices, card-kind metadata and the
// per-deck summary (mastery, due and new counts) the Decks tab shows.
// ═══════════════════════════════════════════════════════════

import { computeDeckMastery, deckCards, isQuizCard } from '@/stores/useLearningStore';
import type { CardKind, CardReview, Deck, Difficulty, Mastery } from '@/types/learning';

// ─── Class names ───

export const INPUT =
  'w-full rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white/90 outline-none transition-colors placeholder:text-white/30 focus:border-cyan-400/50 focus:bg-white/[0.06]';
export const LABEL = 'text-[10px] font-semibold uppercase tracking-wider text-white/45';

const BTN = 'inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40';
export const BTN_PRIMARY = `${BTN} border-cyan-400/40 bg-cyan-500/20 font-semibold text-cyan-100 hover:bg-cyan-500/30`;
export const BTN_GHOST = `${BTN} border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10 hover:text-white`;
export const BTN_DANGER = `${BTN} border-red-400/40 bg-red-500/20 font-semibold text-red-100 hover:bg-red-500/30`;
export const ICON_BTN =
  'rounded-md p-1.5 text-white/45 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30';

// ─── Deck look ───

export const DECK_COLOR_CHOICES: readonly string[] = [
  '#22d3ee',
  '#a78bfa',
  '#34d399',
  '#f472b6',
  '#fbbf24',
  '#60a5fa',
  '#f87171',
  '#fb923c',
  '#2dd4bf',
  '#e879f9',
];

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

/** #rgb / #rrggbb / #rrggbbaa → rgba() with the given alpha (for tints and glows). */
export function withAlpha(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return `rgba(34, 211, 238, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Cards ───

export const KIND_META: Readonly<Record<CardKind, { label: string; short: string; badge: string }>> = {
  mcq: { label: 'Multiple choice', short: 'MCQ', badge: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200' },
  'multi-select': { label: 'Multi-select', short: 'MULTI', badge: 'border-purple-400/30 bg-purple-400/10 text-purple-200' },
  numeric: { label: 'Numeric', short: 'NUM', badge: 'border-amber-400/30 bg-amber-400/10 text-amber-200' },
  flashcard: { label: 'Flashcard', short: 'CARD', badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' },
};

export const CARD_KINDS: readonly CardKind[] = ['mcq', 'multi-select', 'numeric', 'flashcard'];

export const DIFFICULTY_META: Readonly<Record<Difficulty, { label: string; dot: string; active: string }>> = {
  easy: { label: 'Easy', dot: 'bg-green-400', active: 'border-green-400/40 bg-green-500/15 text-green-200' },
  medium: { label: 'Medium', dot: 'bg-yellow-400', active: 'border-yellow-400/40 bg-yellow-500/15 text-yellow-200' },
  hard: { label: 'Hard', dot: 'bg-red-400', active: 'border-red-400/40 bg-red-500/15 text-red-200' },
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

// ─── Text + files ───

export function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`;
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
