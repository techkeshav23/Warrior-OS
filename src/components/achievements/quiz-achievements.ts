// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Quiz Achievements
// GATE quiz / mock test completion → first-quiz, quiz-streak-5,
// perfect-quiz, all-subjects, quiz-master (+ history back-fill)
// ═══════════════════════════════════════════════════════════

import { useQuizHistoryStore, type QuizAttempt } from '@/stores/useQuizHistoryStore';
import { getAvailableSubjects } from '@/data/gate-questions';
import { checkStudyHourAchievements, unlock, type WiredAchievementId } from './award';
import { useAchievementProgressStore } from './progress-store';
import { recordStudyAction } from './study-streak';

/** "Knowledge Streak": correct answers in a row within one quiz. */
export const ANSWER_STREAK_TARGET = 5;
/** "Perfect Score": 100% on a quiz with at least this many questions. */
export const PERFECT_QUIZ_MIN_QUESTIONS = 10;
/** "Quiz Grandmaster": quizzes + mock tests completed. */
export const QUIZ_MASTER_TARGET = 100;

/** QuizEngine records every row of one quiz within a few ms of each other. */
const SAME_QUIZ_WINDOW_MS = 1000;

export interface QuizCompletion {
  kind: 'quiz' | 'mock';
  /** Subject of a single-subject quiz or mock; null for a mixed mock. */
  subject: string | null;
  /** Per question, in the order shown: answered correctly? */
  results: readonly boolean[];
  /** Questions the user answered, right or wrong. */
  answered: number;
}

/** Longest run of consecutive correct answers. */
export function longestCorrectRun(results: readonly boolean[]): number {
  let best = 0;
  let run = 0;
  for (const ok of results) {
    run = ok ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

export interface HistoricQuiz {
  subject: string;
  totalQuestions: number;
  correctAnswers: number;
}

/**
 * Rebuild whole quizzes from quiz-history rows. A mixed-topic quiz is stored
 * as one row per topic, all written in the same instant, so rows of the same
 * subject recorded within SAME_QUIZ_WINDOW_MS belong to one quiz.
 */
export function groupAttemptsIntoQuizzes(attempts: readonly QuizAttempt[]): HistoricQuiz[] {
  const sorted = attempts
    .filter((a) => Number.isFinite(a.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  const quizzes: HistoricQuiz[] = [];
  let lastTimestamp = Number.NEGATIVE_INFINITY;
  for (const a of sorted) {
    const current = quizzes[quizzes.length - 1];
    if (current && current.subject === a.subject && a.timestamp - lastTimestamp <= SAME_QUIZ_WINDOW_MS) {
      current.totalQuestions += a.totalQuestions;
      current.correctAnswers += a.correctAnswers;
    } else {
      quizzes.push({
        subject: a.subject,
        totalQuestions: a.totalQuestions,
        correctAnswers: a.correctAnswers,
      });
    }
    lastTimestamp = a.timestamp;
  }
  return quizzes;
}

/** Every GATE subject in the question bank has at least one completed quiz. */
export function allSubjectsCovered(): boolean {
  const required = getAvailableSubjects();
  if (required.length === 0) return false;
  const seen = new Set<string>(useAchievementProgressStore.getState().subjectsQuizzed);
  for (const a of useQuizHistoryStore.getState().attempts) seen.add(a.subject);
  return required.every((s) => seen.has(s));
}

/**
 * Call once when a quiz or mock test is submitted. For kind 'quiz' call it
 * after QuizEngine has written the attempt to useQuizHistoryStore.
 */
export function recordQuizCompletion(completion: QuizCompletion): void {
  // A blank submission is not a completed quiz.
  if (completion.answered === 0 || completion.results.length === 0) return;

  const progress = useAchievementProgressStore.getState();
  let completed: number;
  if (progress.quizzesCompleted === null) {
    // First count ever: back-fill from history. QuizEngine has already written
    // this quiz there; mock tests are never written to history.
    const fromHistory = groupAttemptsIntoQuizzes(useQuizHistoryStore.getState().attempts).length;
    completed = completion.kind === 'quiz' ? Math.max(1, fromHistory) : fromHistory + 1;
  } else {
    completed = progress.quizzesCompleted + 1;
  }
  progress.setQuizzesCompleted(completed);
  if (completion.subject) progress.addQuizSubject(completion.subject);

  unlock('first-quiz');
  if (longestCorrectRun(completion.results) >= ANSWER_STREAK_TARGET) unlock('quiz-streak-5');
  const correct = completion.results.filter(Boolean).length;
  if (completion.results.length >= PERFECT_QUIZ_MIN_QUESTIONS && correct === completion.results.length) {
    unlock('perfect-quiz');
  }
  if (completed >= QUIZ_MASTER_TARGET) unlock('quiz-master');
  if (allSubjectsCovered()) unlock('all-subjects');
  checkStudyHourAchievements();
  // Today counts for the study streak (mock tests included).
  recordStudyAction();
}

/**
 * Achievements the saved quiz history had already earned before the triggers
 * existed. Also back-fills the quiz counter the first time it runs.
 */
export function quizAchievementsFromHistory(): WiredAchievementId[] {
  const quizzes = groupAttemptsIntoQuizzes(useQuizHistoryStore.getState().attempts);
  const progress = useAchievementProgressStore.getState();
  if (progress.quizzesCompleted === null) progress.setQuizzesCompleted(quizzes.length);
  const completed = useAchievementProgressStore.getState().quizzesCompleted ?? 0;

  const ids: WiredAchievementId[] = [];
  if (completed > 0) ids.push('first-quiz');
  if (
    quizzes.some(
      (q) => q.totalQuestions >= PERFECT_QUIZ_MIN_QUESTIONS && q.correctAnswers === q.totalQuestions
    )
  ) {
    ids.push('perfect-quiz');
  }
  if (allSubjectsCovered()) ids.push('all-subjects');
  if (completed >= QUIZ_MASTER_TARGET) ids.push('quiz-master');
  return ids;
}
