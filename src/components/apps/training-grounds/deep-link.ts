// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Training Grounds Deep Link
// The start event (WARRIOR_EVENTS.gateStartQuiz, detail { subject?, mode? })
// makes TrainingGroundsApp jump to a mode with the deck or topic named by
// `subject` preselected. Senders: NEXUS, the terminal, the command palette.
// ═══════════════════════════════════════════════════════════

import { WARRIOR_EVENTS } from '@/lib/nexus/events';
import type { NexusGateMode } from '@/types/nexus';
import type { Deck } from '@/types/learning';

export const TRAINING_START_EVENT = WARRIOR_EVENTS.gateStartQuiz;

/** App ids whose windows render TrainingGroundsApp. */
export const TRAINING_APP_IDS: readonly string[] = ['training-grounds', 'flashcards'];

export type TrainingTab = 'quiz' | 'flashcards' | 'skill-tree' | 'bank' | 'mock' | 'planner';

/** Launch modes carried by the start event (the set NEXUS uses). */
export type TrainingLinkMode = NexusGateMode;

const LINK_MODES: readonly string[] = ['quiz', 'mock', 'flashcards', 'planner'];

export interface TrainingStartDetail {
  /** Free text naming a deck or a topic, e.g. "javascript" or "react hooks". */
  subject?: string;
  mode?: TrainingLinkMode;
}

/** Validate an untrusted event detail. A missing detail means "open the quiz". */
export function parseTrainingStart(raw: unknown): TrainingStartDetail | null {
  if (raw === null || raw === undefined) return {};
  if (typeof raw !== 'object') return null;
  const { subject, mode } = raw as { subject?: unknown; mode?: unknown };
  const detail: TrainingStartDetail = {};
  if (typeof subject === 'string' && subject.trim()) detail.subject = subject.trim().slice(0, 80);
  if (typeof mode === 'string' && LINK_MODES.includes(mode)) detail.mode = mode as TrainingLinkMode;
  return detail;
}

export function tabForMode(mode: TrainingLinkMode | undefined): TrainingTab {
  switch (mode) {
    case 'mock':
      return 'mock';
    case 'flashcards':
      return 'flashcards';
    case 'planner':
      return 'planner';
    default:
      return 'quiz';
  }
}

/** The deck (and optionally one of its topics) a deep link points at. */
export interface DeckTarget {
  deckId: string;
  topicId: string | null;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, ' ')
    .trim();
}

/** Whole-word containment: "js quiz" contains "js", "react" does not contain "c". */
function containsWords(haystack: string, needle: string): boolean {
  return needle !== '' && ` ${haystack} `.includes(` ${needle} `);
}

/**
 * Map free text ("javascript", "React hooks quiz", "hooks") to a deck or a
 * topic: exact name first, then a name inside the phrase (or the phrase
 * inside a name), then the most shared words. Decks win ties over topics.
 */
export function resolveDeckTarget(input: string | null | undefined, decks: readonly Deck[]): DeckTarget | null {
  if (!input) return null;
  const phrase = normalize(input);
  if (!phrase) return null;

  const candidates: { name: string; target: DeckTarget }[] = [];
  for (const deck of decks) candidates.push({ name: normalize(deck.name), target: { deckId: deck.id, topicId: null } });
  for (const deck of decks) {
    for (const topic of deck.topics) {
      candidates.push({ name: normalize(topic.name), target: { deckId: deck.id, topicId: topic.id } });
    }
  }

  const exact = candidates.find((c) => c.name === phrase);
  if (exact) return exact.target;

  const nested = candidates.find((c) => containsWords(phrase, c.name) || containsWords(c.name, phrase));
  if (nested) return nested.target;

  const words = phrase.split(' ').filter((w) => w.length >= 3);
  let best: DeckTarget | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const names = new Set(c.name.split(' '));
    const score = words.filter((w) => names.has(w)).length;
    if (score > bestScore) {
      best = c.target;
      bestScore = score;
    }
  }
  return best;
}
