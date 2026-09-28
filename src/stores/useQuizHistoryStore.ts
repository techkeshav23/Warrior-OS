// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Quiz History Store
// Records every quiz attempt and exposes recency-weighted
// mastery selectors used by SkillTree, RadarChart, NEXUS, etc.
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

export interface QuizAttempt {
  subject: string;
  topic: string | null;        // null = mixed-subject quiz
  totalQuestions: number;
  correctAnswers: number;
  timestamp: number;
}

interface QuizHistoryStore {
  attempts: QuizAttempt[];

  // Mutations
  recordAttempt: (attempt: Omit<QuizAttempt, 'timestamp'>) => void;
  clearHistory: () => void;

  // Selectors (pure — call from useMemo to memoize)
  getMastery: (subject: string, topic?: string) => number;       // 0..1
  getAttemptCount: (subject: string, topic?: string) => number;
  getRecentAttempts: (subject: string, topic?: string, n?: number) => QuizAttempt[];
}

// Cap stored attempts so localStorage stays bounded under heavy use.
const MAX_ATTEMPTS = 500;

// How many recent attempts feed mastery, and decay weight per step.
const MASTERY_WINDOW = 10;
const RECENCY_DECAY = 0.85;

// Wilson-style confidence dampener: with very few attempts, soft-cap mastery
// so a single lucky perfect quiz doesn't paint a subject "mastered".
function confidenceDampen(rawMastery: number, weightedSamples: number): number {
  const confidence = Math.min(1, weightedSamples / 20); // full confidence at ~20 questions
  return rawMastery * confidence;
}

export const useQuizHistoryStore = create<QuizHistoryStore>()(
  persist(
    immer((set, get) => ({
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

      getMastery: (subject, topic) => {
        const recent = get().getRecentAttempts(subject, topic, MASTERY_WINDOW);
        if (recent.length === 0) return 0;

        let weightedCorrect = 0;
        let weightedTotal = 0;
        // recent[] is newest-first, so index 0 gets weight 1, decays from there.
        for (let i = 0; i < recent.length; i++) {
          const w = RECENCY_DECAY ** i;
          weightedCorrect += recent[i].correctAnswers * w;
          weightedTotal += recent[i].totalQuestions * w;
        }
        if (weightedTotal === 0) return 0;
        const raw = weightedCorrect / weightedTotal;
        return Math.max(0, Math.min(1, confidenceDampen(raw, weightedTotal)));
      },

      getAttemptCount: (subject, topic) => {
        const all = get().attempts;
        return all.filter(
          (a) =>
            a.subject === subject &&
            (topic === undefined || a.topic === topic || a.topic === null)
        ).length;
      },

      getRecentAttempts: (subject, topic, n = MASTERY_WINDOW) => {
        const all = get().attempts;
        const filtered = all
          .filter(
            (a) =>
              a.subject === subject &&
              (topic === undefined || a.topic === topic || a.topic === null)
          )
          .sort((a, b) => b.timestamp - a.timestamp); // newest first
        return filtered.slice(0, n);
      },
    })),
    {
      name: 'warrior-os-quiz-history',
      partialize: (state) => ({ attempts: state.attempts }),
    }
  )
);
