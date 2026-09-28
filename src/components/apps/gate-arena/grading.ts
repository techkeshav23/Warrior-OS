// ═══════════════════════════════════════════════════════════
// WARRIOR OS — GATE Answer Grading
// One correctness rule shared by the Quiz Engine and Mock Test
// ═══════════════════════════════════════════════════════════

import type { Question } from '@/types/gate';

/** MCQ answers are option indexes; numerical answers are typed text. */
export type UserAnswer = number | string;

/** An empty numerical input counts as not attempted. */
export function isAnswered(answer: UserAnswer | undefined): boolean {
  if (answer === undefined) return false;
  return typeof answer === 'number' || answer.trim() !== '';
}

/** Numerical answers compare as numbers, so "2.50" matches 2.5. */
export function isAnswerCorrect(question: Question, answer: UserAnswer | undefined): boolean {
  if (!isAnswered(answer)) return false;
  const given = String(answer).trim();
  if (question.type === 'numerical') {
    const givenNumber = Number(given);
    const expectedNumber = Number(question.answer);
    if (given !== '' && Number.isFinite(givenNumber) && Number.isFinite(expectedNumber)) {
      return Math.abs(givenNumber - expectedNumber) < 1e-9;
    }
  }
  return given === String(question.answer);
}
