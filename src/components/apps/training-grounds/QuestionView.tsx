// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Question View
// One quiz card (MCQ, multi-select, numeric) with its answer input.
// `reveal` grades it: inputs lock, options are marked right / wrong /
// missed and the explanation shows. `showKey` is the answer key
// alone (no user answer). Shared by Quiz, Mock Test and Question Bank.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, type ReactNode } from 'react';
import { Check, CircleCheck, CircleMinus, CircleX, KeyRound, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Kbd } from '@/components/ui';
import { cardAnswerText } from '@/stores/useLearningStore';
import type { QuizCard } from '@/types/learning';
import { answerStatus, toggleOption, type UserAnswer } from './grading';

type OptionState = 'idle' | 'picked' | 'right' | 'wrong' | 'missed' | 'dim';

/** Row surface per state (border + fill + text). */
const OPTION_STYLES: Record<OptionState, string> = {
  idle:
    'border-line bg-surface-2 text-fg-muted hover:border-line-strong hover:bg-surface-hover hover:text-fg active:bg-surface-active',
  picked: 'border-accent/55 bg-accent/10 text-fg shadow-[inset_2px_0_0_var(--accent)]',
  right: 'border-success/40 bg-success/10 text-fg',
  wrong: 'border-danger/40 bg-danger/10 text-fg',
  missed: 'border-dashed border-success/45 bg-transparent text-fg-muted',
  dim: 'border-line bg-transparent text-fg-subtle',
};

/** Leading cap (letter or checkbox) per state. */
const CAP_STYLES: Record<OptionState, string> = {
  idle: 'border-line-strong bg-ink-850 text-fg-muted group-hover/opt:border-fg-faint group-hover/opt:text-fg',
  picked: 'border-accent bg-accent text-accent-fg',
  right: 'border-success bg-success text-ink-950',
  wrong: 'border-danger bg-danger text-ink-950',
  missed: 'border-success/60 bg-transparent text-success',
  dim: 'border-line bg-transparent text-fg-faint',
};

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
  /** lg = the focused question of a running quiz / test. */
  size?: 'md' | 'lg';
  /** Show the 1–9 / 0 key caps (only where the caller wires those keys). */
  keyHints?: boolean;
}

function Verdict({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'success' | 'danger' | 'neutral';
  icon: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        'space-y-1.5 rounded-control px-3.5 py-3 ring-1 ring-inset',
        tone === 'success' && 'bg-success/8 ring-success/20',
        tone === 'danger' && 'bg-danger/8 ring-danger/20',
        tone === 'neutral' && 'bg-surface-2 ring-line'
      )}
    >
      {title != null && (
        <p
          className={cn(
            'flex items-center gap-2 text-ui font-semibold',
            tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-fg-muted'
          )}
        >
          {icon}
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function AnswerLine({ card, bare = false }: { card: QuizCard; bare?: boolean }) {
  return (
    <p className="select-text text-ui text-fg">
      {!bare && <span className="mr-2 font-mono text-2xs font-medium uppercase tracking-[0.12em] text-success">Answer</span>}
      {cardAnswerText(card)}
    </p>
  );
}

function Explanation({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="select-text whitespace-pre-wrap text-ui leading-relaxed text-fg-muted">{text}</p>;
}

function QuestionViewInner({
  card,
  answer,
  onAnswer,
  reveal = false,
  showKey = false,
  hidePrompt = false,
  autoFocus = false,
  size = 'md',
  keyHints = false,
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
    <div className={size === 'lg' ? 'space-y-5' : 'space-y-4'}>
      {!hidePrompt && (
        <p
          className={cn(
            'select-text whitespace-pre-wrap font-medium text-fg',
            size === 'lg' ? 'text-base leading-relaxed @2xl:text-lg @2xl:leading-relaxed' : 'text-sm leading-relaxed'
          )}
        >
          {card.prompt}
        </p>
      )}

      {card.kind !== 'numeric' && (
        <div className="space-y-2">
          {card.kind === 'multi-select' && !locked && (
            <p className="hud-label">Pick every correct option</p>
          )}
          {card.options.map((opt, i) => {
            const state = optionState(i);
            const multi = card.kind === 'multi-select';
            const picked = state === 'picked' || state === 'right' || state === 'wrong';
            const key = i < 9 ? String(i + 1) : i === 9 ? '0' : null;
            return (
              <button
                key={i}
                type="button"
                data-quiz-option
                onClick={() => pick(i)}
                disabled={locked}
                aria-pressed={locked ? undefined : picked}
                className={cn(
                  'group/opt focus-ring flex w-full items-start gap-3 rounded-control border text-left',
                  'transition-[background-color,border-color,color,box-shadow] duration-120 ease-out-quint disabled:cursor-default',
                  size === 'lg' ? 'min-h-11 px-3.5 py-2.5 text-sm' : 'min-h-10 px-3 py-2 text-ui',
                  OPTION_STYLES[state]
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-px flex size-5.5 shrink-0 items-center justify-center border font-mono text-2xs font-semibold transition-colors duration-120 ease-out-quint',
                    multi ? 'rounded-[5px]' : 'rounded-full',
                    CAP_STYLES[state]
                  )}
                >
                  {multi ? (
                    picked || state === 'missed' ? (
                      <Check size={12} strokeWidth={3} />
                    ) : null
                  ) : (
                    String.fromCharCode(65 + i)
                  )}
                </span>
                <span className="min-w-0 flex-1 select-text whitespace-pre-wrap break-words pt-px">{opt}</span>
                {state === 'right' && <Check size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-success" aria-label="Correct option" />}
                {state === 'wrong' && <X size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-danger" aria-label="Your pick, wrong" />}
                {state === 'missed' && (
                  <span className="mt-0.5 shrink-0 font-mono text-2xs uppercase tracking-[0.1em] text-success">Missed</span>
                )}
                {!locked && keyHints && key && (
                  <Kbd size="sm" className="mt-0.5 opacity-70 transition-opacity duration-120 group-hover/opt:opacity-100">
                    {key}
                  </Kbd>
                )}
              </button>
            );
          })}
        </div>
      )}

      {card.kind === 'numeric' && !showKey && (
        <div className="flex max-w-md items-center gap-3">
          <input
            type="text"
            inputMode="decimal"
            placeholder="Enter a number"
            aria-label="Your answer"
            value={typeof answer === 'string' || typeof answer === 'number' ? String(answer) : ''}
            onChange={(e) => onAnswer?.(e.target.value)}
            disabled={locked}
            autoFocus={autoFocus && !locked}
            aria-invalid={graded && status === 'wrong' ? true : undefined}
            className={cn(
              'h-10 w-full min-w-0 rounded-control border bg-ink-950/55 px-3.5 font-mono text-sm text-fg tabular placeholder:font-sans placeholder:text-fg-subtle',
              'outline-none transition-[border-color,box-shadow] duration-120 ease-out-quint focus:border-accent/70 focus:ring-3 focus:ring-accent/15 disabled:cursor-default',
              graded && status === 'correct'
                ? 'border-success/50 bg-success/8'
                : graded && status === 'wrong'
                  ? 'border-danger/50 bg-danger/8'
                  : 'border-line-strong hover:border-fg-faint'
            )}
          />
          {card.unit && <span className="shrink-0 font-mono text-ui text-fg-muted">{card.unit}</span>}
        </div>
      )}

      {graded && (
        <Verdict
          tone={status === 'correct' ? 'success' : status === 'wrong' ? 'danger' : 'neutral'}
          icon={
            status === 'correct' ? (
              <CircleCheck size={16} strokeWidth={1.75} aria-hidden />
            ) : status === 'wrong' ? (
              <CircleX size={16} strokeWidth={1.75} aria-hidden />
            ) : (
              <CircleMinus size={16} strokeWidth={1.75} aria-hidden />
            )
          }
          title={status === 'correct' ? 'Correct' : status === 'wrong' ? 'Not quite' : 'Not answered'}
        >
          {status !== 'correct' && <AnswerLine card={card} />}
          <Explanation text={card.explanation} />
        </Verdict>
      )}

      {showKey && (
        <Verdict tone="success" icon={<KeyRound size={16} strokeWidth={1.75} aria-hidden />} title="Answer key">
          <AnswerLine card={card} bare />
          <Explanation text={card.explanation} />
        </Verdict>
      )}
    </div>
  );
}

export const QuestionView = memo(QuestionViewInner);
