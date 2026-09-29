// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Learning Store
// "Learn anything": the user's decks → topics → cards, per-card
// spaced-repetition state, a capped attempt log, mastery and JSON
// import/export. The sample decks are seeded on first run.
//
// In components, select `decks` / `reviews` and derive with the
// pure helpers exported below (computeDeckMastery, collectDueCards…)
// inside useMemo, or select primitives. The get* queries return
// fresh objects, so never return them straight from a selector.
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { generateId } from '@/lib/utils';
import { SAMPLE_DECKS } from '@/data/learning';
import {
  LEARNING_EXPORT_FORMAT,
  type Card,
  type CardAttempt,
  type CardInput,
  type CardKind,
  type CardLocation,
  type CardReview,
  type Deck,
  type DeckInput,
  type DeckPatch,
  type Difficulty,
  type DueCard,
  type DueCardsOptions,
  type ImportOptions,
  type ImportResult,
  type LearningExport,
  type Mastery,
  type QuizCard,
  type RecordAttemptInput,
  type ReviewGrade,
  type Topic,
  type TopicInput,
  type TopicPatch,
} from '@/types/learning';

export const LEARNING_STORAGE_KEY = 'warrior-os-learning';
/** v2: sample decks refreshed (expanded Warrior OS Basics, new Dev Fundamentals). */
const STORE_VERSION = 2;

// ─── Mastery ───

/** A card counts as mastered from this strength (0..1). */
export const MASTERED_THRESHOLD = 0.8;
/** Answers kept per card for mastery. */
const RECENT_RESULTS = 8;
/** Weight of each answer relative to the next newer one. */
const RECENCY_DECAY = 0.7;
/** Answers needed before a card can reach full strength (one lucky guess is not mastery). */
const CONFIDENT_ANSWERS = 2;

// ─── Scheduling (SM-2 style) ───

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
/** A missed card comes back this soon. */
const RELEARN_DELAY_MS = 10 * MINUTE;
/** A card rated Hard while still being learned comes back after this. */
const HARD_STEP_MS = 60 * MINUTE;
const MAX_INTERVAL_DAYS = 365;
const START_EASE = 2.5;
const MIN_EASE = 1.3;
const MAX_EASE = 3;

/** Attempt log cap, so localStorage stays bounded. */
const MAX_ATTEMPTS = 1000;

// ─── Input limits (editors and imports) ───

const MAX_DECKS = 200;
const MAX_TOPICS = 200;
const MAX_CARDS_PER_TOPIC = 2000;
const MAX_OPTIONS = 10;
const MAX_TAGS = 20;
const MAX_NAME = 80;
const MAX_DESCRIPTION = 500;
const MAX_PROMPT = 2000;
const MAX_TEXT = 4000;
const MAX_OPTION = 500;
const MAX_TAG = 40;
const MAX_UNIT = 20;
const MAX_ICON = 16;
const MAX_ID = 80;

const DECK_COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#f472b6', '#fbbf24', '#60a5fa', '#f87171'] as const;
const DEFAULT_DECK_ICON = '📚';
const DEFAULT_DECK_NAME = 'Untitled deck';
const DEFAULT_TOPIC_NAME = 'General';

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** Kind names accepted on import (own format plus common spellings). */
const KIND_ALIASES: Readonly<Record<string, CardKind>> = {
  mcq: 'mcq',
  single: 'mcq',
  'single-choice': 'mcq',
  'multi-select': 'multi-select',
  multiselect: 'multi-select',
  'multiple-select': 'multi-select',
  multi: 'multi-select',
  msq: 'multi-select',
  numeric: 'numeric',
  numerical: 'numeric',
  number: 'numeric',
  nat: 'numeric',
  flashcard: 'flashcard',
  flash: 'flashcard',
  basic: 'flashcard',
};

// ═══════════════════════════════════════════════════════════
// Validation (editors and imports pass untrusted data through here)
// ═══════════════════════════════════════════════════════════

function text(value: unknown, max: number): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function toNumber(value: unknown): number | null {
  const n =
    typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function toIndex(value: unknown, length: number): number | null {
  const n = toNumber(value);
  return n !== null && Number.isInteger(n) && n >= 0 && n < length ? n : null;
}

function optionList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_OPTIONS) return null;
  const options = value.map((o) => text(o, MAX_OPTION));
  return options.every(Boolean) ? options : null;
}

function tagList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const tags = value.map((t) => text(t, MAX_TAG).replace(/^#/, '')).filter(Boolean);
  return [...new Set(tags)].slice(0, MAX_TAGS);
}

function optionalId(value: unknown): string | undefined {
  const id = text(value, MAX_ID);
  return id || undefined;
}

function validColor(value: unknown): string | undefined {
  return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim())
    ? value.trim()
    : undefined;
}

/**
 * Validate one card. Accepts the store's own shape plus a few common
 * spellings (question/front for prompt, type for kind, numerical, msq).
 * Returns null when the card is unusable.
 */
export function normalizeCardInput(raw: unknown): CardInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const kindName = text(r.kind ?? r.type, 40).toLowerCase();
  let kind: CardKind | undefined = Object.prototype.hasOwnProperty.call(KIND_ALIASES, kindName)
    ? KIND_ALIASES[kindName]
    : undefined;
  if (!kind) {
    // No (known) kind: infer it from the shape.
    if (typeof r.back === 'string') kind = 'flashcard';
    else if (Array.isArray(r.answers)) kind = 'multi-select';
    else if (Array.isArray(r.options)) kind = 'mcq';
    else if (toNumber(r.answer) !== null) kind = 'numeric';
    else return null;
  }

  const prompt = text(r.prompt ?? r.question ?? r.front, MAX_PROMPT);
  if (!prompt) return null;
  const explanation = text(r.explanation, MAX_TEXT);
  const base = {
    id: optionalId(r.id),
    prompt,
    difficulty: DIFFICULTIES.includes(r.difficulty as Difficulty) ? (r.difficulty as Difficulty) : 'medium',
    tags: tagList(r.tags),
    ...(explanation ? { explanation } : {}),
  };

  switch (kind) {
    case 'mcq': {
      const options = optionList(r.options);
      if (!options) return null;
      const answer = toIndex(Array.isArray(r.answer) ? r.answer[0] : r.answer, options.length);
      return answer === null ? null : { ...base, kind: 'mcq', options, answer };
    }
    case 'multi-select': {
      const options = optionList(r.options);
      if (!options) return null;
      const given: unknown[] = Array.isArray(r.answers) ? r.answers : Array.isArray(r.answer) ? r.answer : [r.answer];
      const answers = [
        ...new Set(given.map((a) => toIndex(a, options.length)).filter((a): a is number => a !== null)),
      ].sort((a, b) => a - b);
      return answers.length === 0 ? null : { ...base, kind: 'multi-select', options, answers };
    }
    case 'numeric': {
      const answer = toNumber(r.answer);
      if (answer === null) return null;
      const tolerance = toNumber(r.tolerance);
      const unit = text(r.unit, MAX_UNIT);
      return {
        ...base,
        kind: 'numeric',
        answer,
        ...(tolerance !== null && tolerance > 0 ? { tolerance } : {}),
        ...(unit ? { unit } : {}),
      };
    }
    case 'flashcard': {
      const back = text(r.back ?? r.answer, MAX_TEXT);
      return back ? { ...base, kind: 'flashcard', back } : null;
    }
  }
}

function normalizeCards(value: unknown, where: string, errors: string[]): CardInput[] {
  if (!Array.isArray(value)) return [];
  const cards: CardInput[] = [];
  let skipped = 0;
  for (const raw of value.slice(0, MAX_CARDS_PER_TOPIC)) {
    const card = normalizeCardInput(raw);
    if (card) cards.push(card);
    else skipped++;
  }
  if (skipped > 0) errors.push(`${where}: skipped ${skipped} invalid card${skipped === 1 ? '' : 's'}.`);
  if (value.length > MAX_CARDS_PER_TOPIC) errors.push(`${where}: only the first ${MAX_CARDS_PER_TOPIC} cards were kept.`);
  return cards;
}

/** Validate one deck (topics and cards included). Returns null when it has no name. */
export function normalizeDeckInput(raw: unknown, errors: string[] = []): DeckInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = text(r.name ?? r.title, MAX_NAME);
  if (!name) {
    errors.push('Skipped a deck without a name.');
    return null;
  }
  const topics: TopicInput[] = [];
  if (Array.isArray(r.topics)) {
    for (const rawTopic of r.topics.slice(0, MAX_TOPICS)) {
      if (!rawTopic || typeof rawTopic !== 'object') continue;
      const t = rawTopic as Record<string, unknown>;
      const topicName = text(t.name ?? t.title, MAX_NAME) || DEFAULT_TOPIC_NAME;
      const description = text(t.description, MAX_DESCRIPTION);
      topics.push({
        id: optionalId(t.id),
        name: topicName,
        ...(description ? { description } : {}),
        cards: normalizeCards(t.cards, `${name} › ${topicName}`, errors),
      });
    }
  }
  // A flat deck ({ name, cards }) gets a single "General" topic.
  if (Array.isArray(r.cards)) {
    const cards = normalizeCards(r.cards, name, errors);
    if (cards.length > 0) topics.push({ name: DEFAULT_TOPIC_NAME, cards });
  }
  return {
    id: optionalId(r.id),
    name,
    description: text(r.description, MAX_DESCRIPTION),
    color: validColor(r.color),
    icon: text(r.icon, MAX_ICON) || undefined,
    topics,
  };
}

function normalizeReview(raw: unknown, cardId: string): CardReview | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ease = toNumber(r.ease);
  const intervalDays = toNumber(r.intervalDays);
  const dueAt = toNumber(r.dueAt);
  const lastReviewedAt = toNumber(r.lastReviewedAt);
  if (ease === null || intervalDays === null || dueAt === null || lastReviewedAt === null) return null;
  return {
    cardId,
    ease: Math.min(MAX_EASE, Math.max(MIN_EASE, ease)),
    intervalDays: Math.min(MAX_INTERVAL_DAYS, Math.max(0, Math.round(intervalDays))),
    reps: Math.max(0, Math.round(toNumber(r.reps) ?? 0)),
    lapses: Math.max(0, Math.round(toNumber(r.lapses) ?? 0)),
    dueAt,
    lastReviewedAt,
    recent: Array.isArray(r.recent) ? r.recent.filter((x): x is boolean => typeof x === 'boolean').slice(-RECENT_RESULTS) : [],
  };
}

/** Parse an import file: an export, a list of decks or a single deck. */
export function parseLearningImport(json: string): {
  decks: DeckInput[];
  reviews: Record<string, CardReview>;
  errors: string[];
} {
  const errors: string[] = [];
  let root: unknown;
  try {
    root = JSON.parse(json) as unknown;
  } catch {
    return { decks: [], reviews: {}, errors: ['The file is not valid JSON.'] };
  }
  let rawDecks: unknown[] = [];
  let rawReviews: unknown = null;
  if (Array.isArray(root)) {
    rawDecks = root;
  } else if (root && typeof root === 'object') {
    const r = root as Record<string, unknown>;
    if (Array.isArray(r.decks)) {
      rawDecks = r.decks;
      rawReviews = r.reviews;
    } else {
      rawDecks = [root];
    }
  }
  if (rawDecks.length > MAX_DECKS) errors.push(`Only the first ${MAX_DECKS} decks were read.`);
  const decks: DeckInput[] = [];
  for (const raw of rawDecks.slice(0, MAX_DECKS)) {
    const deck = normalizeDeckInput(raw, errors);
    if (deck) decks.push(deck);
  }
  const reviews: Record<string, CardReview> = {};
  if (rawReviews && typeof rawReviews === 'object' && !Array.isArray(rawReviews)) {
    for (const [cardId, raw] of Object.entries(rawReviews as Record<string, unknown>)) {
      const review = normalizeReview(raw, cardId);
      if (review) reviews[cardId] = review;
    }
  }
  return { decks, reviews, errors };
}

// ═══════════════════════════════════════════════════════════
// Building stored objects
// ═══════════════════════════════════════════════════════════

function collectIds(decks: readonly Deck[]): Set<string> {
  const ids = new Set<string>();
  for (const deck of decks) {
    ids.add(deck.id);
    for (const topic of deck.topics) {
      ids.add(topic.id);
      for (const card of topic.cards) ids.add(card.id);
    }
  }
  return ids;
}

/** One id namespace for decks, topics and cards; a taken id is replaced. */
function claimId(preferred: string | undefined, prefix: string, used: Set<string>): string {
  let id = preferred && !used.has(preferred) ? preferred : generateId(prefix);
  while (used.has(id)) id = generateId(prefix);
  used.add(id);
  return id;
}

function buildCard(input: CardInput, now: number, used: Set<string>): Card {
  return {
    ...input,
    id: claimId(input.id, 'card', used),
    tags: input.tags ?? [],
    difficulty: input.difficulty ?? 'medium',
    createdAt: now,
  };
}

function buildTopic(input: TopicInput, now: number, used: Set<string>): Topic {
  const id = claimId(input.id, 'topic', used);
  const cards: Card[] = [];
  for (const raw of (input.cards ?? []).slice(0, MAX_CARDS_PER_TOPIC)) {
    const card = normalizeCardInput(raw);
    if (card) cards.push(buildCard(card, now, used));
  }
  const description = text(input.description, MAX_DESCRIPTION);
  return {
    id,
    name: text(input.name, MAX_NAME) || DEFAULT_TOPIC_NAME,
    ...(description ? { description } : {}),
    cards,
    createdAt: now,
  };
}

function buildDeck(input: DeckInput, now: number, used: Set<string>, colorIndex: number): Deck {
  const id = claimId(input.id, 'deck', used);
  return {
    id,
    name: text(input.name, MAX_NAME) || DEFAULT_DECK_NAME,
    description: text(input.description, MAX_DESCRIPTION),
    color: validColor(input.color) ?? DECK_COLORS[colorIndex % DECK_COLORS.length],
    icon: text(input.icon, MAX_ICON) || DEFAULT_DECK_ICON,
    topics: (input.topics ?? []).slice(0, MAX_TOPICS).map((t) => buildTopic(t, now, used)),
    createdAt: now,
    ...(input.isSample ? { isSample: true } : {}),
  };
}

function seedSampleDecks(now: number): Deck[] {
  const used = new Set<string>();
  return SAMPLE_DECKS.map((deck, i) => buildDeck(deck, now, used, i));
}

// ═══════════════════════════════════════════════════════════
// Pure helpers (safe in useMemo / selectors)
// ═══════════════════════════════════════════════════════════

export function deckCards(deck: Deck): Card[] {
  return deck.topics.flatMap((t) => t.cards);
}

export function isQuizCard(card: Card): card is QuizCard {
  return card.kind !== 'flashcard';
}

/** Every card with its location, optionally limited to one deck / topic. */
export function listCardLocations(decks: readonly Deck[], deckId?: string, topicId?: string): CardLocation[] {
  const out: CardLocation[] = [];
  for (const deck of decks) {
    if (deckId && deck.id !== deckId) continue;
    for (const topic of deck.topics) {
      if (topicId && topic.id !== topicId) continue;
      for (const card of topic.cards) {
        out.push({ card, deckId: deck.id, deckName: deck.name, topicId: topic.id, topicName: topic.name });
      }
    }
  }
  return out;
}

export function findCardLocation(decks: readonly Deck[], cardId: string): CardLocation | undefined {
  for (const deck of decks) {
    for (const topic of deck.topics) {
      const card = topic.cards.find((c) => c.id === cardId);
      if (card) return { card, deckId: deck.id, deckName: deck.name, topicId: topic.id, topicName: topic.name };
    }
  }
  return undefined;
}

/** The correct answer as display text (flashcards: the back side). */
export function cardAnswerText(card: Card): string {
  switch (card.kind) {
    case 'mcq':
      return card.options[card.answer] ?? '';
    case 'multi-select':
      return card.answers
        .map((i) => card.options[i])
        .filter(Boolean)
        .join(', ');
    case 'numeric':
      return `${card.answer}${card.tolerance ? ` ± ${card.tolerance}` : ''}${card.unit ? ` ${card.unit}` : ''}`;
    case 'flashcard':
      return card.back;
  }
}

/**
 * Next review state after an answer (SM-2 style). Answering a card before
 * it is due only counts toward mastery; a miss always sends it back. A card
 * still being (re)learned (interval 0) is always rescheduled, so a second
 * try right after a miss takes effect. Again < Hard < Good < Easy at every
 * step.
 */
export function scheduleReview(
  prev: CardReview | null | undefined,
  cardId: string,
  grade: ReviewGrade,
  correct: boolean,
  now: number
): CardReview {
  const recent = [...(prev?.recent ?? []), correct].slice(-RECENT_RESULTS);
  if (prev && prev.intervalDays > 0 && now < prev.dueAt && grade !== 'again') {
    return { ...prev, lastReviewedAt: now, recent };
  }

  let ease = prev?.ease ?? START_EASE;
  let intervalDays = prev?.intervalDays ?? 0;
  let reps = prev?.reps ?? 0;
  let lapses = prev?.lapses ?? 0;
  // A new or just-missed card: Hard keeps it in learning, Good/Easy graduate it.
  const learning = reps === 0;
  // Graduated intervals, each at least a day past the one below it.
  const hardDays = Math.max(1, intervalDays + 1, Math.round(intervalDays * 1.2));
  const goodDays = Math.max(hardDays + 1, reps === 1 ? 3 : Math.round(intervalDays * ease));
  const easyDays = Math.max(goodDays + 1, Math.round(intervalDays * ease * 1.3));
  let stepMs = RELEARN_DELAY_MS;
  switch (grade) {
    case 'again':
      if (reps > 0) lapses += 1;
      reps = 0;
      intervalDays = 0;
      ease = Math.max(MIN_EASE, ease - 0.2);
      break;
    case 'hard':
      ease = Math.max(MIN_EASE, ease - 0.15);
      if (learning) {
        intervalDays = 0;
        stepMs = HARD_STEP_MS;
      } else {
        reps += 1;
        intervalDays = hardDays;
      }
      break;
    case 'good':
      reps += 1;
      intervalDays = learning ? 1 : goodDays;
      break;
    case 'easy':
      reps += 1;
      intervalDays = learning ? 4 : easyDays;
      ease = Math.min(MAX_EASE, ease + 0.15);
      break;
  }
  intervalDays = Math.min(MAX_INTERVAL_DAYS, intervalDays);
  return {
    cardId,
    ease: Math.round(ease * 100) / 100,
    intervalDays,
    reps,
    lapses,
    dueAt: intervalDays === 0 ? now + stepMs : now + intervalDays * DAY,
    lastReviewedAt: now,
    recent,
  };
}

/** 0..1: recency-weighted accuracy of a card, damped until it has CONFIDENT_ANSWERS answers. */
export function cardStrength(review: CardReview | null | undefined): number {
  const recent = review?.recent;
  if (!recent || recent.length === 0) return 0;
  let weight = 1;
  let hit = 0;
  let total = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    total += weight;
    if (recent[i]) hit += weight;
    weight *= RECENCY_DECAY;
  }
  return (hit / total) * Math.min(1, recent.length / CONFIDENT_ANSWERS);
}

/** Mastery of any set of cards: average strength, unseen cards count as 0. */
export function computeMastery(cards: Iterable<Card>, reviews: Readonly<Record<string, CardReview>>): Mastery {
  let total = 0;
  let seen = 0;
  let mastered = 0;
  let sum = 0;
  for (const card of cards) {
    total += 1;
    const review = reviews[card.id];
    if (review && review.recent.length > 0) seen += 1;
    const strength = cardStrength(review);
    sum += strength;
    if (strength >= MASTERED_THRESHOLD) mastered += 1;
  }
  return { value: total > 0 ? sum / total : 0, total, seen, mastered };
}

export function computeDeckMastery(deck: Deck, reviews: Readonly<Record<string, CardReview>>): Mastery {
  return computeMastery(deckCards(deck), reviews);
}

export function computeTopicMastery(topic: Topic, reviews: Readonly<Record<string, CardReview>>): Mastery {
  return computeMastery(topic.cards, reviews);
}

/** Cards due for review (most overdue first), then never-answered cards in deck order. */
export function collectDueCards(
  decks: readonly Deck[],
  reviews: Readonly<Record<string, CardReview>>,
  options: DueCardsOptions = {}
): DueCard[] {
  const now = options.now ?? Date.now();
  const includeNew = options.includeNew ?? true;
  const due: DueCard[] = [];
  const fresh: DueCard[] = [];
  for (const location of listCardLocations(decks, options.deckId, options.topicId)) {
    const review = reviews[location.card.id] ?? null;
    if (!review) {
      if (includeNew) fresh.push({ ...location, review: null, overdueMs: 0 });
    } else if (review.dueAt <= now) {
      due.push({ ...location, review, overdueMs: now - review.dueAt });
    }
  }
  due.sort((a, b) => b.overdueMs - a.overdueMs);
  const all = due.concat(fresh);
  return options.limit === undefined ? all : all.slice(0, Math.max(0, options.limit));
}

// ═══════════════════════════════════════════════════════════
// Store
// ═══════════════════════════════════════════════════════════

export interface LearningStore {
  decks: Deck[];
  /** Spaced-repetition state by card id. */
  reviews: Record<string, CardReview>;
  /** Answered cards, oldest first (capped). */
  attempts: CardAttempt[];
  /** Sample decks the user deleted (never re-added on their own). */
  dismissedSamples: string[];

  // ─── Decks ───
  /** Returns the new deck id. Invalid cards inside the input are skipped. */
  createDeck: (input: DeckInput) => string;
  updateDeck: (deckId: string, patch: DeckPatch) => void;
  deleteDeck: (deckId: string) => void;

  // ─── Topics ───
  /** Returns the new topic id, or null when the deck does not exist. */
  addTopic: (deckId: string, input: TopicInput) => string | null;
  updateTopic: (deckId: string, topicId: string, patch: TopicPatch) => void;
  deleteTopic: (deckId: string, topicId: string) => void;

  // ─── Cards ───
  /**
   * Returns the new card id, or null (unknown deck/topic, invalid card).
   * topicId null = the deck's first topic ("General" is created if it has none).
   */
  addCard: (deckId: string, topicId: string | null, input: CardInput) => string | null;
  /** Replaces a card's content (kind may change); id, createdAt and review state stay. */
  updateCard: (cardId: string, input: CardInput) => boolean;
  moveCard: (cardId: string, deckId: string, topicId: string) => boolean;
  deleteCard: (cardId: string) => void;

  // ─── Learning ───
  /** Grade one answer: updates the card's schedule + mastery and logs the attempt. */
  recordAttempt: (input: RecordAttemptInput) => CardReview | null;
  /** Same as recordAttempt for many answers, in one store write (quizzes, mock tests). */
  recordAttempts: (inputs: readonly RecordAttemptInput[]) => (CardReview | null)[];
  /** Forget review state + attempts of one deck, or of everything. */
  resetProgress: (deckId?: string) => void;
  /** Re-add deleted sample decks; returns how many came back. */
  restoreSampleDecks: () => number;

  // ─── Import / export ───
  /** Pretty-printed LearningExport JSON of the given decks (default: all). */
  exportDecks: (deckIds?: readonly string[], options?: { includeProgress?: boolean }) => string;
  importDecks: (json: string, options?: ImportOptions) => ImportResult;

  // ─── Queries (fresh objects: call from handlers, or select primitives) ───
  getDeck: (deckId: string) => Deck | undefined;
  findCard: (cardId: string) => CardLocation | undefined;
  getDeckMastery: (deckId: string) => Mastery;
  getTopicMastery: (deckId: string, topicId: string) => Mastery;
  /** 0..1 strength of one card. */
  getCardStrength: (cardId: string) => number;
  getDueCards: (options?: DueCardsOptions) => DueCard[];
}

type PersistedLearning = Pick<LearningStore, 'decks' | 'reviews' | 'attempts' | 'dismissedSamples'>;

const EMPTY_MASTERY: Mastery = { value: 0, total: 0, seen: 0, mastered: 0 };

const GRADES: readonly ReviewGrade[] = ['again', 'hard', 'good', 'easy'];
const ATTEMPT_SOURCES: readonly CardAttempt['source'][] = ['quiz', 'mock', 'flashcards', 'review'];

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** A saved card with its id and timestamps kept; null when unusable. */
function sanitizeSavedCard(raw: unknown): Card | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) return null;
  const card = normalizeCardInput(raw);
  if (!card) return null;
  return {
    ...card,
    id: r.id,
    tags: card.tags ?? [],
    difficulty: card.difficulty ?? 'medium',
    createdAt: finiteNumber(r.createdAt) ? r.createdAt : 0,
    ...(finiteNumber(r.updatedAt) ? { updatedAt: r.updatedAt } : {}),
  } as Card;
}

function sanitizeSavedTopic(raw: unknown): Topic | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) return null;
  const cards = Array.isArray(r.cards)
    ? r.cards.map(sanitizeSavedCard).filter((c): c is Card => c !== null)
    : [];
  const description = typeof r.description === 'string' ? r.description : '';
  return {
    id: r.id,
    name: (typeof r.name === 'string' && r.name) || DEFAULT_TOPIC_NAME,
    ...(description ? { description } : {}),
    cards,
    createdAt: finiteNumber(r.createdAt) ? r.createdAt : 0,
  };
}

/**
 * Deep-check a saved deck: non-object topics/cards and cards that fail the
 * import validator are dropped, bad fields fall back to defaults. Ids are
 * kept as saved so review state still matches.
 */
function sanitizeSavedDeck(raw: unknown, index: number): Deck | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id || !Array.isArray(r.topics)) return null;
  return {
    id: r.id,
    name: (typeof r.name === 'string' && r.name) || DEFAULT_DECK_NAME,
    description: typeof r.description === 'string' ? r.description : '',
    color: validColor(r.color) ?? DECK_COLORS[index % DECK_COLORS.length],
    icon: (typeof r.icon === 'string' && r.icon) || DEFAULT_DECK_ICON,
    topics: r.topics.map(sanitizeSavedTopic).filter((t): t is Topic => t !== null),
    createdAt: finiteNumber(r.createdAt) ? r.createdAt : 0,
    ...(finiteNumber(r.updatedAt) ? { updatedAt: r.updatedAt } : {}),
    ...(r.isSample === true ? { isSample: true } : {}),
  };
}

function isAttemptShape(value: unknown): value is CardAttempt {
  if (!value || typeof value !== 'object') return false;
  const a = value as Partial<CardAttempt>;
  return (
    typeof a.cardId === 'string' &&
    typeof a.deckId === 'string' &&
    typeof a.topicId === 'string' &&
    typeof a.correct === 'boolean' &&
    GRADES.includes(a.grade as ReviewGrade) &&
    ATTEMPT_SOURCES.includes(a.source as CardAttempt['source']) &&
    finiteNumber(a.timestamp) &&
    (a.durationMs === undefined || finiteNumber(a.durationMs))
  );
}

/** Shape-check saved state (deeply) so a corrupted key can never crash the apps. */
function sanitizePersisted(raw: unknown): Partial<PersistedLearning> {
  if (!raw || typeof raw !== 'object') return {};
  const p = raw as Record<string, unknown>;
  const out: Partial<PersistedLearning> = {};
  if (Array.isArray(p.decks)) {
    out.decks = p.decks.map(sanitizeSavedDeck).filter((d): d is Deck => d !== null);
  }
  if (p.reviews && typeof p.reviews === 'object' && !Array.isArray(p.reviews)) {
    const reviews: Record<string, CardReview> = {};
    for (const [cardId, value] of Object.entries(p.reviews as Record<string, unknown>)) {
      const review = normalizeReview(value, cardId);
      if (review) reviews[cardId] = review;
    }
    out.reviews = reviews;
  }
  if (Array.isArray(p.attempts)) out.attempts = p.attempts.filter(isAttemptShape).slice(-MAX_ATTEMPTS);
  if (Array.isArray(p.dismissedSamples)) {
    out.dismissedSamples = p.dismissedSamples.filter((id): id is string => typeof id === 'string');
  }
  return out;
}

/** Card ids of a saved deck, tolerating malformed topics. */
function savedCardIds(deck: Deck): string[] {
  const ids: string[] = [];
  for (const topic of deck.topics) {
    if (!topic || !Array.isArray(topic.cards)) continue;
    for (const card of topic.cards) if (card && typeof card.id === 'string') ids.push(card.id);
  }
  return ids;
}

/**
 * Bring shipped sample content up to date in saved state: a sample deck the
 * user never edited (no updatedAt) gets the current version (card ids are
 * stable, so review state carries over), and sample decks added since are
 * seeded unless the user deleted them. Edited sample decks are left alone.
 */
function refreshSampleDecks(state: PersistedLearning, now: number): PersistedLearning {
  const decks = [...state.decks];
  const reviews = { ...state.reviews };
  const dismissed = new Set(state.dismissedSamples);
  SAMPLE_DECKS.forEach((sample, i) => {
    if (!sample.id) return;
    const index = decks.findIndex((d) => d.id === sample.id);
    if (index === -1) {
      if (!dismissed.has(sample.id)) decks.push(buildDeck(sample, now, collectIds(decks), decks.length));
      return;
    }
    const existing = decks[index];
    if (!existing.isSample || existing.updatedAt !== undefined) return;
    const fresh = buildDeck(sample, now, collectIds(decks.filter((_, j) => j !== index)), i);
    if (typeof existing.createdAt === 'number') fresh.createdAt = existing.createdAt;
    const kept = new Set(deckCards(fresh).map((c) => c.id));
    for (const id of savedCardIds(existing)) if (!kept.has(id)) delete reviews[id];
    decks[index] = fresh;
  });
  return { ...state, decks, reviews };
}

function touch(deck: Deck): void {
  deck.updatedAt = Date.now();
}

function dropReviews(reviews: Record<string, CardReview>, cards: readonly Card[]): void {
  for (const card of cards) delete reviews[card.id];
}

export const useLearningStore = create<LearningStore>()(
  persist(
    immer((set, get) => ({
      decks: seedSampleDecks(Date.now()),
      reviews: {},
      attempts: [],
      dismissedSamples: [],

      // ─── Decks ───

      createDeck: (input) => {
        const { decks } = get();
        const deck = buildDeck(input, Date.now(), collectIds(decks), decks.length);
        set((state) => {
          state.decks.push(deck);
        });
        return deck.id;
      },

      updateDeck: (deckId, patch) =>
        set((state) => {
          const deck = state.decks.find((d) => d.id === deckId);
          if (!deck) return;
          if (patch.name !== undefined) deck.name = text(patch.name, MAX_NAME) || deck.name;
          if (patch.description !== undefined) deck.description = text(patch.description, MAX_DESCRIPTION);
          if (patch.color !== undefined) deck.color = validColor(patch.color) ?? deck.color;
          if (patch.icon !== undefined) deck.icon = text(patch.icon, MAX_ICON) || deck.icon;
          touch(deck);
        }),

      deleteDeck: (deckId) =>
        set((state) => {
          const index = state.decks.findIndex((d) => d.id === deckId);
          if (index === -1) return;
          const deck = state.decks[index];
          dropReviews(state.reviews, deckCards(deck));
          if (deck.isSample && !state.dismissedSamples.includes(deck.id)) state.dismissedSamples.push(deck.id);
          state.decks.splice(index, 1);
        }),

      // ─── Topics ───

      addTopic: (deckId, input) => {
        const { decks } = get();
        if (!decks.some((d) => d.id === deckId)) return null;
        const topic = buildTopic(input, Date.now(), collectIds(decks));
        set((state) => {
          const deck = state.decks.find((d) => d.id === deckId);
          if (!deck) return;
          deck.topics.push(topic);
          touch(deck);
        });
        return topic.id;
      },

      updateTopic: (deckId, topicId, patch) =>
        set((state) => {
          const deck = state.decks.find((d) => d.id === deckId);
          const topic = deck?.topics.find((t) => t.id === topicId);
          if (!deck || !topic) return;
          if (patch.name !== undefined) topic.name = text(patch.name, MAX_NAME) || topic.name;
          if (patch.description !== undefined) {
            const description = text(patch.description, MAX_DESCRIPTION);
            if (description) topic.description = description;
            else delete topic.description;
          }
          touch(deck);
        }),

      deleteTopic: (deckId, topicId) =>
        set((state) => {
          const deck = state.decks.find((d) => d.id === deckId);
          const index = deck ? deck.topics.findIndex((t) => t.id === topicId) : -1;
          if (!deck || index === -1) return;
          dropReviews(state.reviews, deck.topics[index].cards);
          deck.topics.splice(index, 1);
          touch(deck);
        }),

      // ─── Cards ───

      addCard: (deckId, topicId, input) => {
        const normalized = normalizeCardInput(input);
        const { decks } = get();
        const deck = decks.find((d) => d.id === deckId);
        if (!normalized || !deck) return null;
        if (topicId !== null && !deck.topics.some((t) => t.id === topicId)) return null;
        const used = collectIds(decks);
        const now = Date.now();
        const card = buildCard(normalized, now, used);
        const newTopic = topicId === null && deck.topics.length === 0 ? buildTopic({ name: DEFAULT_TOPIC_NAME }, now, used) : null;
        set((state) => {
          const target = state.decks.find((d) => d.id === deckId);
          if (!target) return;
          if (newTopic) target.topics.push(newTopic);
          const topic = topicId === null ? target.topics[0] : target.topics.find((t) => t.id === topicId);
          topic?.cards.push(card);
          touch(target);
        });
        return card.id;
      },

      updateCard: (cardId, input) => {
        const normalized = normalizeCardInput(input);
        const location = findCardLocation(get().decks, cardId);
        if (!normalized || !location) return false;
        set((state) => {
          const deck = state.decks.find((d) => d.id === location.deckId);
          const topic = deck?.topics.find((t) => t.id === location.topicId);
          const index = topic ? topic.cards.findIndex((c) => c.id === cardId) : -1;
          if (!deck || !topic || index === -1) return;
          const previous = topic.cards[index];
          topic.cards[index] = {
            ...normalized,
            id: previous.id,
            tags: normalized.tags ?? [],
            difficulty: normalized.difficulty ?? 'medium',
            createdAt: previous.createdAt,
            updatedAt: Date.now(),
          };
          touch(deck);
        });
        return true;
      },

      moveCard: (cardId, deckId, topicId) => {
        const { decks } = get();
        const location = findCardLocation(decks, cardId);
        const target = decks.find((d) => d.id === deckId)?.topics.find((t) => t.id === topicId);
        if (!location || !target) return false;
        if (location.deckId === deckId && location.topicId === topicId) return true;
        set((state) => {
          const fromDeck = state.decks.find((d) => d.id === location.deckId);
          const fromTopic = fromDeck?.topics.find((t) => t.id === location.topicId);
          const toDeck = state.decks.find((d) => d.id === deckId);
          const toTopic = toDeck?.topics.find((t) => t.id === topicId);
          const index = fromTopic ? fromTopic.cards.findIndex((c) => c.id === cardId) : -1;
          if (!fromDeck || !fromTopic || !toDeck || !toTopic || index === -1) return;
          const [card] = fromTopic.cards.splice(index, 1);
          toTopic.cards.push(card);
          touch(fromDeck);
          touch(toDeck);
        });
        return true;
      },

      deleteCard: (cardId) =>
        set((state) => {
          for (const deck of state.decks) {
            for (const topic of deck.topics) {
              const index = topic.cards.findIndex((c) => c.id === cardId);
              if (index === -1) continue;
              topic.cards.splice(index, 1);
              delete state.reviews[cardId];
              touch(deck);
              return;
            }
          }
        }),

      // ─── Learning ───

      recordAttempt: (input) => get().recordAttempts([input])[0] ?? null,

      recordAttempts: (inputs) => {
        const { decks, reviews } = get();
        const locations = new Map(listCardLocations(decks).map((l) => [l.card.id, l] as const));
        const results: (CardReview | null)[] = [];
        const nextReviews: Record<string, CardReview> = {};
        const newAttempts: CardAttempt[] = [];
        for (const input of inputs) {
          const location = locations.get(input.cardId);
          if (!location) {
            results.push(null);
            continue;
          }
          const at = input.at ?? Date.now();
          const grade: ReviewGrade = input.grade ?? (input.correct ? 'good' : 'again');
          const review = scheduleReview(nextReviews[input.cardId] ?? reviews[input.cardId], input.cardId, grade, input.correct, at);
          nextReviews[input.cardId] = review;
          newAttempts.push({
            cardId: input.cardId,
            deckId: location.deckId,
            topicId: location.topicId,
            correct: input.correct,
            grade,
            source: input.source ?? 'quiz',
            timestamp: at,
            ...(input.durationMs !== undefined ? { durationMs: Math.max(0, Math.round(input.durationMs)) } : {}),
          });
          results.push(review);
        }
        if (newAttempts.length > 0) {
          set((state) => {
            Object.assign(state.reviews, nextReviews);
            state.attempts.push(...newAttempts);
            if (state.attempts.length > MAX_ATTEMPTS) state.attempts.splice(0, state.attempts.length - MAX_ATTEMPTS);
          });
        }
        return results;
      },

      resetProgress: (deckId) =>
        set((state) => {
          if (deckId === undefined) {
            state.reviews = {};
            state.attempts = [];
            return;
          }
          const deck = state.decks.find((d) => d.id === deckId);
          if (deck) dropReviews(state.reviews, deckCards(deck));
          state.attempts = state.attempts.filter((a) => a.deckId !== deckId);
        }),

      restoreSampleDecks: () => {
        const { decks } = get();
        const present = new Set(decks.map((d) => d.id));
        const used = collectIds(decks);
        const now = Date.now();
        const restored = SAMPLE_DECKS.filter((d) => d.id === undefined || !present.has(d.id)).map((d, i) =>
          buildDeck(d, now, used, decks.length + i)
        );
        if (restored.length > 0) {
          set((state) => {
            state.decks.push(...restored);
            const back = new Set(restored.map((d) => d.id));
            state.dismissedSamples = state.dismissedSamples.filter((id) => !back.has(id));
          });
        }
        return restored.length;
      },

      // ─── Import / export ───

      exportDecks: (deckIds, options = {}) => {
        const { decks, reviews } = get();
        const chosen = deckIds ? decks.filter((d) => deckIds.includes(d.id)) : decks;
        const payload: LearningExport = {
          format: LEARNING_EXPORT_FORMAT,
          version: 1,
          exportedAt: new Date().toISOString(),
          decks: chosen,
        };
        if (options.includeProgress) {
          const progress: Record<string, CardReview> = {};
          for (const deck of chosen) {
            for (const card of deckCards(deck)) {
              if (reviews[card.id]) progress[card.id] = reviews[card.id];
            }
          }
          payload.reviews = progress;
        }
        return JSON.stringify(payload, null, 2);
      },

      importDecks: (json, options = {}) => {
        const parsed = parseLearningImport(json);
        const errors = [...parsed.errors];
        if (parsed.decks.length === 0) {
          return {
            ok: false,
            decksAdded: 0,
            decksReplaced: 0,
            cardsImported: 0,
            errors: errors.length > 0 ? errors : ['No decks found in the file.'],
          };
        }

        const { decks } = get();
        const used = collectIds(decks);
        const now = Date.now();
        const replaceMode = options.onConflict === 'replace';
        const added: Deck[] = [];
        const replaced: Deck[] = [];
        for (const input of parsed.decks) {
          const existing =
            input.id !== undefined && !replaced.some((d) => d.id === input.id)
              ? decks.find((d) => d.id === input.id)
              : undefined;
          if (existing && replaceMode) {
            // Free the old deck's ids so its replacement can keep them.
            for (const id of collectIds([existing])) used.delete(id);
            replaced.push(buildDeck(input, now, used, decks.indexOf(existing)));
          } else if (decks.length + added.length >= MAX_DECKS) {
            errors.push(`Deck limit (${MAX_DECKS}) reached: skipped "${input.name}".`);
          } else {
            // A taken id (copy mode) is swapped for a fresh one inside buildDeck.
            added.push(buildDeck(input, now, used, decks.length + added.length));
          }
        }

        const imported = added.concat(replaced);
        const cardsImported = imported.reduce((n, d) => n + deckCards(d).length, 0);
        set((state) => {
          for (const deck of replaced) {
            const index = state.decks.findIndex((d) => d.id === deck.id);
            if (index === -1) continue;
            const kept = new Set(deckCards(deck).map((c) => c.id));
            dropReviews(
              state.reviews,
              deckCards(state.decks[index]).filter((c) => !kept.has(c.id))
            );
            state.decks[index] = deck;
          }
          state.decks.push(...added);
          // Progress from the file fills in cards that have none here yet.
          for (const deck of imported) {
            for (const card of deckCards(deck)) {
              const review = parsed.reviews[card.id];
              if (review && !state.reviews[card.id]) state.reviews[card.id] = review;
            }
          }
        });
        return {
          ok: imported.length > 0,
          decksAdded: added.length,
          decksReplaced: replaced.length,
          cardsImported,
          errors,
        };
      },

      // ─── Queries ───

      getDeck: (deckId) => get().decks.find((d) => d.id === deckId),

      findCard: (cardId) => findCardLocation(get().decks, cardId),

      getDeckMastery: (deckId) => {
        const { decks, reviews } = get();
        const deck = decks.find((d) => d.id === deckId);
        return deck ? computeDeckMastery(deck, reviews) : EMPTY_MASTERY;
      },

      getTopicMastery: (deckId, topicId) => {
        const { decks, reviews } = get();
        const topic = decks.find((d) => d.id === deckId)?.topics.find((t) => t.id === topicId);
        return topic ? computeTopicMastery(topic, reviews) : EMPTY_MASTERY;
      },

      getCardStrength: (cardId) => cardStrength(get().reviews[cardId]),

      getDueCards: (options) => {
        const { decks, reviews } = get();
        return collectDueCards(decks, reviews, options);
      },
    })),
    {
      name: LEARNING_STORAGE_KEY,
      version: STORE_VERSION,
      migrate: (persisted: unknown, version: number): PersistedLearning => {
        const state: PersistedLearning = {
          decks: [],
          reviews: {},
          attempts: [],
          dismissedSamples: [],
          ...sanitizePersisted(persisted),
        };
        if (version >= 2) return state;
        // v1 → v2: refresh the shipped sample decks (never lose saved data over it).
        try {
          return refreshSampleDecks(state, Date.now());
        } catch {
          return state;
        }
      },
      merge: (persisted, current) => ({ ...current, ...sanitizePersisted(persisted) }),
      partialize: (state): PersistedLearning => ({
        decks: state.decks,
        reviews: state.reviews,
        attempts: state.attempts,
        dismissedSamples: state.dismissedSamples,
      }),
    }
  )
);
