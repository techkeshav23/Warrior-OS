// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Quiz History Store
// One row per finished quiz (per topic for mixed quizzes): the
// session log that NEXUS, the creature, dreams, widgets and the
// study streak read. Per-card progress, spaced repetition and deck
// mastery live in useLearningStore.
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

export interface QuizAttempt {
  /** Display name of the quiz subject: the deck name (older rows: a subject name). */
  subject: string;
  topic: string | null;        // null = mixed-topic quiz
  totalQuestions: number;
  correctAnswers: number;
  timestamp: number;
  /** Learning deck / topic ids (rows recorded before decks existed have none). */
  deckId?: string;
  topicId?: string;
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
