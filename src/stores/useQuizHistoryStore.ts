// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Quiz History Store
// One row per finished quiz (per topic for mixed quizzes): the
// session log that NEXUS, the creature, dreams, widgets and the
// study streak read. Per-card progress, spaced repetition and deck
// mastery live in useLearningStore.
//
// Rows saved before decks existed ("legacy" rows) have no deckId and
// name subjects that match no deck. They still count for totals,
// streaks and per-day numbers; per-deck / per-subject displays drop
// them with deckAttempts() (or isDeckAttempt).
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

export interface QuizAttempt {
  /** Display name of the quiz: the deck name (legacy rows: a subject name). */
  subject: string;
  topic: string | null;        // null = mixed-topic quiz
  totalQuestions: number;
  correctAnswers: number;
  timestamp: number;
  /** Learning deck / topic ids (legacy rows have none). */
  deckId?: string;
  topicId?: string;
  /** A "retry wrong ones" round: the answers had just been shown. */
  retry?: boolean;
}

/** A row recorded against a learning deck. */
export type DeckQuizAttempt = QuizAttempt & { deckId: string };

/** True for rows written by a deck quiz; false for legacy subject rows. */
export function isDeckAttempt(attempt: QuizAttempt): attempt is DeckQuizAttempt {
  return typeof attempt.deckId === 'string' && attempt.deckId !== '';
}

/**
 * Deck rows only, for per-deck / per-subject displays (weakest deck,
 * accuracy by deck…). Returns a new array: call it in useMemo or a
 * handler, never straight from a store selector.
 */
export function deckAttempts(attempts: readonly QuizAttempt[]): DeckQuizAttempt[] {
  return attempts.filter(isDeckAttempt);
}

interface QuizHistoryStore {
  attempts: QuizAttempt[];

  // Mutations
  recordAttempt: (attempt: Omit<QuizAttempt, 'timestamp'>) => void;
  clearHistory: () => void;
}

// Cap stored attempts so localStorage stays bounded under heavy use.
const MAX_ATTEMPTS = 500;

export const useQuizHistoryStore = create<QuizHistoryStore>()(
  persist(
    immer((set) => ({
      attempts: [],

      recordAttempt: (attempt) =>
        set((state) => {
          state.attempts.push({ ...attempt, timestamp: Date.now() });
          if (state.attempts.length > MAX_ATTEMPTS) {
            state.attempts.splice(0, state.attempts.length - MAX_ATTEMPTS);
          }
        }),

      clearHistory: () =>
        set((state) => {
          state.attempts = [];
        }),
    })),
    {
      name: 'warrior-os-quiz-history',
      partialize: (state) => ({ attempts: state.attempts }),
    }
  )
);
