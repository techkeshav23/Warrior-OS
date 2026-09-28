// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Learning Types
// "Learn anything": decks → topics → cards, per-card attempts,
// spaced-repetition review state and mastery. Used by Training
// Grounds, Flashcards and everything that reads study progress.
// ═══════════════════════════════════════════════════════════

export type CardKind = 'mcq' | 'multi-select' | 'numeric' | 'flashcard';

export type Difficulty = 'easy' | 'medium' | 'hard';

interface CardBase {
  id: string;
  kind: CardKind;
  /** Question text; for a flashcard, its front side. */
  prompt: string;
  /** Why the answer is right; shown after answering / under the back side. */
  explanation?: string;
  difficulty: Difficulty;
  tags: string[];
  /** Epoch ms. */
  createdAt: number;
  /** Epoch ms of the last edit. */
  updatedAt?: number;
}

/** One correct option. */
export interface McqCard extends CardBase {
  kind: 'mcq';
  options: string[];
  /** Index of the correct option. */
  answer: number;
}

/** One or more correct options; all of them (and only them) must be picked. */
export interface MultiSelectCard extends CardBase {
  kind: 'multi-select';
  options: string[];
  /** Indexes of every correct option (order does not matter). */
  answers: number[];
}

/** Typed numeric answer. */
export interface NumericCard extends CardBase {
  kind: 'numeric';
  answer: number;
  /** Accepted absolute error; 0 / missing = exact. */
  tolerance?: number;
  /** Shown next to the input and the answer, e.g. "ms". */
  unit?: string;
}

/** Self-graded card: `prompt` is the front, `back` the back. */
export interface Flashcard extends CardBase {
  kind: 'flashcard';
  back: string;
}

export type Card = McqCard | MultiSelectCard | NumericCard | Flashcard;

/** Cards that can be graded automatically (quiz, mock test). */
export type QuizCard = McqCard | MultiSelectCard | NumericCard;

export interface Topic {
  id: string;
  name: string;
  description?: string;
  cards: Card[];
  /** Epoch ms. */
  createdAt: number;
}

export interface Deck {
  id: string;
  name: string;
  description: string;
  /** Accent colour (hex), e.g. '#22d3ee'. */
  color: string;
  /** Emoji icon. */
  icon: string;
  topics: Topic[];
  /** Epoch ms. */
  createdAt: number;
  /** Epoch ms of the last change to the deck or its topics/cards. */
  updatedAt?: number;
  /** Shipped example content (can be deleted and restored). */
  isSample?: boolean;
}

// ─── Inputs (ids and timestamps are filled in by the store) ───

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A card as an editor or importer supplies it. */
export type CardInput = DistributiveOmit<Card, 'id' | 'createdAt' | 'updatedAt' | 'tags' | 'difficulty'> & {
  /** Keep a stable id (sample content, imports); a fresh one is made otherwise. */
  id?: string;
  tags?: string[];
  difficulty?: Difficulty;
};

export interface TopicInput {
  id?: string;
  name: string;
  description?: string;
  cards?: CardInput[];
}

export interface DeckInput {
  id?: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  topics?: TopicInput[];
  isSample?: boolean;
}

export type DeckPatch = Partial<Pick<Deck, 'name' | 'description' | 'color' | 'icon'>>;

export type TopicPatch = Partial<Pick<Topic, 'name' | 'description'>>;

// ─── Answers, attempts and review state ───

/** Self-rating of a recall. Quiz answers map correct → 'good', wrong → 'again'. */
export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export type AttemptSource = 'quiz' | 'mock' | 'flashcards' | 'review';

/** One answered card (the store keeps a capped log of these). */
export interface CardAttempt {
  cardId: string;
  deckId: string;
  topicId: string;
  correct: boolean;
  grade: ReviewGrade;
  source: AttemptSource;
  /** Epoch ms. */
  timestamp: number;
  /** Time spent on the card, when measured. */
  durationMs?: number;
}

export interface RecordAttemptInput {
  cardId: string;
  correct: boolean;
  /** Defaults to 'good' when correct and 'again' when not. */
  grade?: ReviewGrade;
  /** Defaults to 'quiz'. */
  source?: AttemptSource;
  durationMs?: number;
  /** Epoch ms; defaults to now. */
  at?: number;
}

/** Spaced-repetition state of one card (SM-2 style scheduling). */
export interface CardReview {
  cardId: string;
  /** Ease factor, 1.3–3.0; starts at 2.5. */
  ease: number;
  /** Current interval in days (0 while (re)learning). */
  intervalDays: number;
  /** Successful reviews in a row. */
  reps: number;
  /** Times the card was forgotten after being learned. */
  lapses: number;
  /** Epoch ms when the card is next due. */
  dueAt: number;
  /** Epoch ms of the last answer. */
  lastReviewedAt: number;
  /** Recent results, oldest first (capped); drives mastery. */
  recent: boolean[];
}

/** Mastery of a deck, a topic or any set of cards. */
export interface Mastery {
  /** 0..1: average card strength; unseen cards count as 0. */
  value: number;
  /** Cards in scope. */
  total: number;
  /** Cards answered at least once. */
  seen: number;
  /** Cards whose strength reached the mastered threshold. */
  mastered: number;
}

/** A card plus where it lives. */
export interface CardLocation {
  card: Card;
  deckId: string;
  deckName: string;
  topicId: string;
  topicName: string;
}

/** A card waiting for review. */
export interface DueCard extends CardLocation {
  /** null for a card that was never answered. */
  review: CardReview | null;
  /** How late the review is, in ms (0 for new cards). */
  overdueMs: number;
}

export interface DueCardsOptions {
  deckId?: string;
  topicId?: string;
  /** Epoch ms to compare due dates against; defaults to now. */
  now?: number;
  /** Include never-answered cards after the due ones (default true). */
  includeNew?: boolean;
  /** Maximum cards returned. */
  limit?: number;
}

// ─── Import / export ───

export const LEARNING_EXPORT_FORMAT = 'warrior-os-learning';

/** JSON file written by exportDecks and read by importDecks. */
export interface LearningExport {
  format: typeof LEARNING_EXPORT_FORMAT;
  version: 1;
  /** ISO timestamp. */
  exportedAt: string;
  decks: Deck[];
  /** Review state of the exported cards, when exported with progress. */
  reviews?: Record<string, CardReview>;
}

export interface ImportOptions {
  /**
   * A deck whose id already exists: 'copy' (default) imports it as a new
   * deck with fresh ids; 'replace' overwrites the existing deck (review
   * state of cards that keep their id survives).
   */
  onConflict?: 'copy' | 'replace';
}

export interface ImportResult {
  ok: boolean;
  decksAdded: number;
  decksReplaced: number;
  cardsImported: number;
  /** Human readable problems (skipped decks/cards, bad JSON). */
  errors: string[];
}
