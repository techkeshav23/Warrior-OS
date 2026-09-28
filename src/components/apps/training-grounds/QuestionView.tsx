// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Question View
// One quiz card (MCQ, multi-select, numeric) with its answer input.
// `reveal` grades it: inputs lock, options are marked right / wrong /
// missed and the explanation shows. `showKey` is the answer key
// alone (no user answer). Shared by Quiz, Mock Test and Question Bank.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { cardAnswerText } from '@/stores/useLearningStore';
import type { QuizCard } from '@/types/learning';
import { answerStatus, toggleOption, type UserAnswer } from './grading';

type OptionState = 'idle' | 'picked' | 'right' | 'wrong' | 'missed' | 'dim';

const OPTION_STYLES: Record<OptionState, string> = {
  idle: 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10',
  picked: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
  right: 'bg-green-500/20 border-green-500/40 text-green-300',
  wrong: 'bg-red-500/20 border-red-500/40 text-red-300',
  missed: 'bg-green-500/5 border-dashed border-green-500/40 text-green-300/80',
  dim: 'bg-white/[0.03] border-white/5 text-white/40',
};

const OPTION_MARKS: Partial<Record<OptionState, string>> = { right: '✓', wrong: '✗', missed: 'missed' };

interface QuestionViewProps {
  card: QuizCard;
  answer?: UserAnswer;
  /** Omit for a read-only view. */
  onAnswer?: (answer: UserAnswer) => void;
  /** Grade the answer: lock inputs, mark options, show the verdict and explanation. */
  reveal?: boolean;
  /** Answer key only (no user answer): correct options marked, answer and explanation shown. */
  showKey?: boolean;
  /** The caller already shows the prompt. */
  hidePrompt?: boolean;
  /** Focus the numeric input when it mounts. */
  autoFocus?: boolean;
}

function QuestionViewInner({
  card,
  answer,
  onAnswer,
  reveal = false,
  showKey = false,
  hidePrompt = false,
  autoFocus = false,
}: QuestionViewProps) {
  const graded = reveal && !showKey;
  const locked = reveal || showKey || !onAnswer;
  const status = answerStatus(card, answer);

  const optionState = (i: number): OptionState => {
    if (card.kind === 'numeric') return 'idle';
    const right = card.kind === 'mcq' ? i === card.answer : card.answers.includes(i);
    if (showKey) return right ? 'right' : 'dim';
    const picked = card.kind === 'mcq' ? answer === i : Array.isArray(answer) && answer.includes(i);
    if (!graded) return picked ? 'picked' : 'idle';
    if (right) return picked || card.kind === 'mcq' ? 'right' : 'missed';
    return picked ? 'wrong' : 'dim';
  };

  const pick = (i: number) => {
    if (locked || !onAnswer || card.kind === 'numeric') return;
    onAnswer(card.kind === 'mcq' ? i : toggleOption(answer, i));
  };

  return (
    <div className="space-y-4">
      {!hidePrompt && (
        <p className="text-white font-medium text-sm leading-relaxed whitespace-pre-wrap">{card.prompt}</p>
      )}

      {card.kind !== 'numeric' && (
        <div className="space-y-2">
          {card.kind === 'multi-select' && !locked && (
            <p className="text-[11px] text-white/40">Pick every correct option.</p>
          )}
          {card.options.map((opt, i) => {
            const state = optionState(i);
            const mark = OPTION_MARKS[state];
            const picked = state === 'picked' || state === 'right' || state === 'wrong';
            return (
              <button
                key={i}
                type="button"
                data-quiz-option
                onClick={() => pick(i)}
                disabled={locked}
                aria-pressed={locked ? undefined : picked}
                className={cn(
                  'w-full p-3 rounded-lg text-sm text-left border transition-all flex items-start gap-2 disabled:cursor-default',
                  OPTION_STYLES[state]
                )}
              >
                <span className="text-white/40 shrink-0">
                  {card.kind === 'mcq' ? `${String.fromCharCode(65 + i)}.` : state === 'idle' || state === 'dim' || state === 'missed' ? '☐' : '☑'}
                </span>
                <span className="flex-1 whitespace-pre-wrap">{opt}</span>
                {mark && <span className="shrink-0 text-xs opacity-80">{mark}</span>}
              </button>
            );
          })}
        </div>
      )}

      {card.kind === 'numeric' && !showKey && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            placeholder="Enter a number…"
            aria-label="Your answer"
            value={typeof answer === 'string' || typeof answer === 'number' ? String(answer) : ''}
            onChange={(e) => onAnswer?.(e.target.value)}
            disabled={locked}
            autoFocus={autoFocus && !locked}
            className={cn(
              'flex-1 p-3 bg-white/5 border rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50 disabled:opacity-80',
              graded && status === 'correct'
                ? 'border-green-500/40'
                : graded && status === 'wrong'
                ? 'border-red-500/40'
                : 'border-white/10'
            )}
          />
          {card.unit && <span className="text-sm text-white/50">{card.unit}</span>}
        </div>
      )}

      {graded && (
        <div
          className={cn(
            'p-3 rounded-lg border text-xs space-y-1',
            status === 'correct'
              ? 'bg-green-500/10 border-green-500/20'
              : status === 'wrong'
              ? 'bg-red-500/10 border-red-500/20'
              : 'bg-white/5 border-white/10'
          )}
        >
          <p
            className={cn(
              'font-semibold',
              status === 'correct' ? 'text-green-300' : status === 'wrong' ? 'text-red-300' : 'text-white/60'
            )}
          >
            {status === 'correct' ? '✓ Correct' : status === 'wrong' ? '✗ Not quite' : '— Not answered'}
          </p>
          {status !== 'correct' && (
            <p className="text-white/70">
              <span className="text-green-400 font-medium">Answer:</span> {cardAnswerText(card)}
            </p>
          )}
          {card.explanation && <p className="text-white/50 whitespace-pre-wrap">{card.explanation}</p>}
        </div>
      )}

      {showKey && (
        <div className="p-3 rounded-lg border border-green-500/20 bg-green-500/10 text-xs space-y-1">
          <p className="text-white/70">
            <span className="text-green-400 font-medium">Answer:</span> {cardAnswerText(card)}
          </p>
          {card.explanation && <p className="text-white/50 whitespace-pre-wrap">{card.explanation}</p>}
        </div>
      )}
    </div>
  );
}

export const QuestionView = memo(QuestionViewInner);
