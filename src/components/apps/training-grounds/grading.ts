// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Training Grounds Answer Grading
// One correctness rule shared by the Quiz Engine and Mock Test
// ═══════════════════════════════════════════════════════════

import type { QuizCard } from '@/types/learning';

/** MCQ: option index · multi-select: option indexes · numeric: typed text. */
export type UserAnswer = number | number[] | string;

/** An empty numeric input or an empty selection counts as not attempted. */
export function isAnswered(answer: UserAnswer | undefined): boolean {
  if (answer === undefined) return false;
  if (typeof answer === 'number') return true;
  if (Array.isArray(answer)) return answer.length > 0;
  return answer.trim() !== '';
}

/** Numeric answers compare as numbers ("2.50" matches 2.5) within the card's tolerance. */
export function isAnswerCorrect(card: QuizCard, answer: UserAnswer | undefined): boolean {
  if (answer === undefined || !isAnswered(answer)) return false;
  switch (card.kind) {
    case 'mcq':
      return answer === card.answer;
    case 'multi-select': {
      if (!Array.isArray(answer)) return false;
      const picked = new Set(answer);
      return picked.size === card.answers.length && card.answers.every((i) => picked.has(i));
    }
    case 'numeric': {
      if (typeof answer !== 'string' && typeof answer !== 'number') return false;
      const given = Number(String(answer).trim());
      if (!Number.isFinite(given)) return false;
      return Math.abs(given - card.answer) <= (card.tolerance ?? 0) + 1e-9;
    }
  }
}

/** Toggle one option in a multi-select answer. */
export function toggleOption(answer: UserAnswer | undefined, option: number): number[] {
  const current = Array.isArray(answer) ? answer : [];
  return current.includes(option)
    ? current.filter((i) => i !== option)
    : [...current, option].sort((a, b) => a - b);
}

/** What the user answered, as display text. */
export function describeAnswer(card: QuizCard, answer: UserAnswer | undefined): string {
  if (answer === undefined || !isAnswered(answer)) return 'Not answered';
  switch (card.kind) {
    case 'mcq':
      return typeof answer === 'number' ? card.options[answer] ?? '—' : '—';
    case 'multi-select':
      return Array.isArray(answer)
        ? answer
            .map((i) => card.options[i])
            .filter(Boolean)
            .join(', ')
        : '—';
    case 'numeric':
      return `${String(answer).trim()}${card.unit ? ` ${card.unit}` : ''}`;
  }
}
