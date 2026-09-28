// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Training Grounds Answer Grading
// One correctness rule, grade scale and display helpers shared by
// the Quiz Engine, Mock Test and Question Bank
// ═══════════════════════════════════════════════════════════

import type { CardKind, Difficulty, NumericCard, QuizCard } from '@/types/learning';

/** MCQ: option index · multi-select: option indexes · numeric: typed text. */
export type UserAnswer = number | number[] | string;

/** How one question ended up after grading. */
export type AnswerStatus = 'correct' | 'wrong' | 'skipped';

/** An empty numeric input or an empty selection counts as not attempted. */
export function isAnswered(answer: UserAnswer | undefined): boolean {
  if (answer === undefined) return false;
  if (typeof answer === 'number') return true;
  if (Array.isArray(answer)) return answer.length > 0;
  return answer.trim() !== '';
}

/** Typed text → number: "2.50" is 2.5, "1,000" is 1000, "−3" is -3; a trailing unit ("120 ms") is ignored. */
function parseNumeric(card: NumericCard, answer: string | number): number | null {
  let text = String(answer).trim().replace(/−/g, '-');
  const unit = card.unit?.trim().toLowerCase();
  if (unit && text.toLowerCase().endsWith(unit)) text = text.slice(0, text.length - unit.length).trim();
  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) text = text.replace(/,/g, '');
  if (text === '') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
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
      const given = parseNumeric(card, answer);
      if (given === null) return false;
      return Math.abs(given - card.answer) <= (card.tolerance ?? 0) + 1e-9;
    }
  }
}

export function answerStatus(card: QuizCard, answer: UserAnswer | undefined): AnswerStatus {
  if (!isAnswered(answer)) return 'skipped';
  return isAnswerCorrect(card, answer) ? 'correct' : 'wrong';
}

/** Toggle one option in a multi-select answer. */
export function toggleOption(answer: UserAnswer | undefined, option: number): number[] {
  const current = Array.isArray(answer) ? answer : [];
  return current.includes(option)
    ? current.filter((i) => i !== option)
    : [...current, option].sort((a, b) => a - b);
}

/**
 * Keyboard answering: "1"…"9" pick options 1-9 and "0" the tenth (MCQ
 * selects, multi-select toggles). Null when the key means nothing here.
 */
export function answerFromKey(card: QuizCard, answer: UserAnswer | undefined, key: string): UserAnswer | null {
  if (card.kind === 'numeric' || !/^[0-9]$/.test(key)) return null;
  const option = key === '0' ? 9 : Number(key) - 1;
  if (option >= card.options.length) return null;
  return card.kind === 'mcq' ? option : toggleOption(answer, option);
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
    case 'numeric': {
      const text = String(answer).trim();
      return card.unit && !text.toLowerCase().endsWith(card.unit.toLowerCase()) ? `${text} ${card.unit}` : text;
    }
  }
}

// ─── Grade scale ───

export type LetterGrade = 'S' | 'A+' | 'A' | 'B' | 'C';

/** Minimum percentage per grade, best first. */
const GRADE_SCALE: readonly { grade: LetterGrade; min: number; color: string }[] = [
  { grade: 'S', min: 95, color: 'text-yellow-300' },
  { grade: 'A+', min: 85, color: 'text-green-300' },
  { grade: 'A', min: 75, color: 'text-green-400' },
  { grade: 'B', min: 60, color: 'text-cyan-400' },
  { grade: 'C', min: Number.NEGATIVE_INFINITY, color: 'text-orange-400' },
];

export function letterGrade(pct: number): { grade: LetterGrade; color: string } {
  const step = GRADE_SCALE.find((g) => pct >= g.min) ?? GRADE_SCALE[GRADE_SCALE.length - 1];
  return { grade: step.grade, color: step.color };
}

/** 0..100, 0 when there is nothing to divide by. */
export function percent(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

// ─── Shared helpers ───

/**
 * Time on screen per card. `leave(cardId)` books the time since the last
 * mark to that card (null: to nobody) and restarts the clock. Hold one in
 * useState and call it from handlers only.
 */
export interface Stopwatch {
  reset: (at: number) => void;
  leave: (cardId: string | null, at: number) => void;
  snapshot: () => Record<string, number>;
}

export function createStopwatch(): Stopwatch {
  let markedAt = 0;
  let spent: Record<string, number> = {};
  return {
    reset: (at) => {
      markedAt = at;
      spent = {};
    },
    leave: (cardId, at) => {
      if (cardId) spent[cardId] = (spent[cardId] ?? 0) + Math.max(0, at - markedAt);
      markedAt = at;
    },
    snapshot: () => ({ ...spent }),
  };
}

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Countdown text: "04:05", or "1:04:05" from an hour up. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h > 0 ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Elapsed time as words: "45s", "3m 05s", "1h 02m". */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/** Marks with at most two decimals: 12, 11.75, −0.33. */
export function formatMarks(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0$/, '');
}

export const KIND_LABELS: Readonly<Record<CardKind, string>> = {
  mcq: 'MCQ',
  'multi-select': 'Multi-select',
  numeric: 'Numeric',
  flashcard: 'Flashcard',
};

/** Chip colours per difficulty. */
export const DIFFICULTY_STYLES: Readonly<Record<Difficulty, string>> = {
  easy: 'bg-green-500/20 text-green-300',
  medium: 'bg-yellow-500/20 text-yellow-300',
  hard: 'bg-red-500/20 text-red-300',
};
