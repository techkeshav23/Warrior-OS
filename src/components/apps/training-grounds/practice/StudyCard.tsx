// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Study Card
// The flip card, the Again / Hard / Good / Easy bar and the grade
// breakdown shared by Review (Training Grounds) and the Flashcards app
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, Kbd, type Tone } from '@/components/ui';
import { EASE_OUT_QUINT, resolveAccent } from '@/styles/tokens';
import { cardAnswerText } from '@/stores/useLearningStore';
import type { Card, CardKind, ReviewGrade } from '@/types/learning';

export { Kbd };

/** Grade tones: danger → warning → success → info, always paired with the label (never colour alone). */
export interface GradeMeta {
  grade: ReviewGrade;
  label: string;
  /** Key that picks it (see use-study-keys). */
  key: string;
  /** Swatch / segment colour (a token CSS variable). */
  color: string;
  /** Kit tone of the grade. */
  tone: Extract<Tone, 'danger' | 'warning' | 'success' | 'info'>;
  button: string;
}

export const GRADE_META: readonly GradeMeta[] = [
  {
    grade: 'again',
    label: 'Again',
    key: '1',
    color: 'var(--color-danger)',
    tone: 'danger',
    button: 'border-danger/30 bg-danger/8 text-danger hover:border-danger/55 hover:bg-danger/15 active:bg-danger/20',
  },
  {
    grade: 'hard',
    label: 'Hard',
    key: '2',
    color: 'var(--color-warning)',
    tone: 'warning',
    button: 'border-warning/30 bg-warning/8 text-warning hover:border-warning/55 hover:bg-warning/15 active:bg-warning/20',
  },
  {
    grade: 'good',
    label: 'Good',
    key: '3',
    color: 'var(--color-success)',
    tone: 'success',
    button: 'border-success/30 bg-success/8 text-success hover:border-success/55 hover:bg-success/15 active:bg-success/20',
  },
  {
    grade: 'easy',
    label: 'Easy',
    key: '4',
    color: 'var(--color-info)',
    tone: 'info',
    button: 'border-info/30 bg-info/8 text-info hover:border-info/55 hover:bg-info/15 active:bg-info/20',
  },
];

export const REVIEW_GRADES: readonly ReviewGrade[] = GRADE_META.map((g) => g.grade);

const KIND_LABELS: Readonly<Record<CardKind, string>> = {
  mcq: 'Multiple choice',
  'multi-select': 'Multi-select',
  numeric: 'Numeric',
  flashcard: 'Flashcard',
};

function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/** Badge tone for the card's queue state ("New", "Due", "Overdue 3d", "Second try"). */
function badgeTone(badge: string): Tone {
  if (badge.startsWith('Overdue')) return 'danger';
  if (badge === 'Due') return 'warning';
  if (badge === 'Second try') return 'ember';
  return 'neutral';
}

// ─── Flip card ───

function Answer({ card }: { card: Card }) {
  switch (card.kind) {
    case 'mcq':
      return (
        <p className="whitespace-pre-wrap break-words text-base font-semibold leading-relaxed text-fg @md:text-lg">
          <span className="mr-2 font-mono text-sm text-success">{optionLetter(card.answer)}</span>
          {card.options[card.answer]}
        </p>
      );
    case 'multi-select':
      return (
        <ul className="space-y-1.5 text-left">
          {card.answers.map((i) => (
            <li key={i} className="break-words text-sm font-semibold text-fg">
              <span className="mr-2 font-mono text-xs text-success">{optionLetter(i)}</span>
              {card.options[i]}
            </li>
          ))}
        </ul>
      );
    default: {
      const text = cardAnswerText(card);
      // Long flashcard backs read as prose, short answers as a headline.
      return text.length > 90 ? (
        <p className="max-w-prose whitespace-pre-wrap break-words text-left text-sm font-medium leading-relaxed text-fg @md:text-base">
          {text}
        </p>
      ) : (
        <p className="whitespace-pre-wrap break-words text-base font-semibold leading-relaxed text-fg @md:text-lg">{text}</p>
      );
    }
  }
}

interface FlipCardProps {
  card: Card;
  flipped: boolean;
  onFlip: () => void;
  /** Caption above the prompt, e.g. "Deck · Topic". */
  caption?: string;
  /** Deck colour for the top edge. */
  accent?: string;
  /** Small badge next to the kind, e.g. "New" or "Overdue 2d". */
  badge?: string;
}

// No backdrop-filter on the faces: it breaks backface-visibility in some browsers.
const FACE =
  'hud-corners relative col-start-1 row-start-1 flex min-h-[240px] min-w-0 flex-col rounded-card border border-line-strong bg-ink-850 p-5 shadow-e2 inset-shadow-[0_1px_0_rgb(255_255_255/0.05)]';

const HIDDEN_FACE = { backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' } as const;

/**
 * Both faces share one grid cell, so the card is as tall as its longer side.
 * Remount it per card (key) so a new card never animates back from its answer.
 * Reduced motion: the faces cross-fade instead of turning in 3D.
 */
function FlipCardInner({ card, flipped, onFlip, caption, accent, badge }: FlipCardProps) {
  const reduceMotion = useReducedMotion();
  const hasOptions = card.kind === 'mcq' || card.kind === 'multi-select';
  const edge = accent ? resolveAccent(accent) : 'var(--accent)';
  const edgeBar = (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-8 top-0 h-0.5 rounded-b-full opacity-90"
      style={{ background: edge, boxShadow: `0 0 12px ${edge}` }}
    />
  );
  return (
    <div className="@container w-full" style={reduceMotion ? undefined : { perspective: 1400 }}>
      <motion.div
        role="button"
        tabIndex={0}
        data-flip-card="true"
        aria-label={flipped ? 'Answer side. Press Space to see the question.' : 'Question side. Press Space to see the answer.'}
        onClick={onFlip}
        initial={false}
        animate={{ rotateY: flipped && !reduceMotion ? 180 : 0 }}
        transition={{ duration: 0.5, ease: EASE_OUT_QUINT }}
        style={{ transformStyle: 'preserve-3d' }}
        className="focus-ring grid w-full cursor-pointer select-none grid-cols-[minmax(0,1fr)] rounded-card"
      >
        {/* Front */}
        <div
          className={cn(FACE, reduceMotion && 'transition-opacity duration-180', reduceMotion && flipped && 'invisible opacity-0')}
          style={reduceMotion ? undefined : HIDDEN_FACE}
          aria-hidden={flipped}
        >
          {edgeBar}
          <div className="flex items-center justify-between gap-2">
            <span className="hud-label min-w-0 truncate" title={caption}>
              {caption}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {badge && (
                <Badge size="sm" tone={badgeTone(badge)}>
                  {badge}
                </Badge>
              )}
              <Badge size="sm" tone="accent">
                {KIND_LABELS[card.kind]}
              </Badge>
            </span>
          </div>
          <div className="flex flex-1 flex-col justify-center py-5">
            <p className="whitespace-pre-wrap break-words text-center text-base font-semibold leading-relaxed text-fg @md:text-lg">
              {card.prompt}
            </p>
            {hasOptions && (
              <ul className="mx-auto mt-4 w-full max-w-md space-y-1.5 text-ui text-fg-muted">
                {card.options.map((option, i) => (
                  <li key={i} className="flex gap-2.5 break-words">
                    <span className="mt-px w-3 shrink-0 font-mono text-xs text-fg-subtle">{optionLetter(i)}</span>
                    <span className="min-w-0">{option}</span>
                  </li>
                ))}
              </ul>
            )}
            {card.kind === 'numeric' && (
              <p className="mt-3 text-center text-xs text-fg-subtle">Numeric answer{card.unit ? ` in ${card.unit}` : ''}</p>
            )}
          </div>
          <p className="flex items-center justify-center gap-1.5 text-xs text-fg-subtle">
            Click or <Kbd size="sm">Space</Kbd> to flip
          </p>
        </div>

        {/* Back */}
        <div
          className={cn(FACE, reduceMotion && 'transition-opacity duration-180', reduceMotion && !flipped && 'invisible opacity-0')}
          style={reduceMotion ? undefined : { ...HIDDEN_FACE, transform: 'rotateY(180deg)' }}
          aria-hidden={!flipped}
        >
          {edgeBar}
          <div className="flex items-center justify-between gap-2">
            <span className="hud-label shrink-0 text-success">Answer</span>
            <span className="hud-label min-w-0 truncate" title={caption}>
              {caption}
            </span>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-5 text-center">
            <p className="scrollbar-thin max-h-24 overflow-y-auto whitespace-pre-wrap break-words text-xs text-fg-subtle">
              {card.prompt}
            </p>
            <Answer card={card} />
            {card.explanation && (
              <p className="max-w-prose whitespace-pre-wrap break-words border-t border-line pt-3 text-ui leading-relaxed text-fg-muted">
                {card.explanation}
              </p>
            )}
          </div>
          <p className="flex items-center justify-center gap-1.5 text-xs text-fg-subtle">
            How well did you know it? <Kbd size="sm">1</Kbd>–<Kbd size="sm">4</Kbd>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export const FlipCard = memo(FlipCardInner);

// ─── Controls ───

/** The session's one primary action while the question side is up. */
export function RevealButton({ onReveal }: { onReveal: () => void }) {
  return (
    <Button variant="primary" size="lg" leadingIcon={Eye} onClick={onReveal} className="min-w-48">
      Show answer
      <span aria-hidden className="ml-1.5 rounded-[5px] bg-accent-fg/12 px-1.5 py-px font-mono text-2xs">
        Space
      </span>
    </Button>
  );
}

interface GradeBarProps {
  onGrade: (grade: ReviewGrade) => void;
  /** Next-review interval per grade, e.g. { good: '3d' }. */
  previews?: Partial<Record<ReviewGrade, string>>;
  /** sm = one-line buttons without key hints (inline practice). */
  size?: 'sm' | 'md';
}

export function GradeBar({ onGrade, previews, size = 'md' }: GradeBarProps) {
  return (
    <div className="grid w-full grid-cols-4 gap-2" role="group" aria-label="Rate your recall">
      {GRADE_META.map((g) => (
        <button
          key={g.grade}
          type="button"
          onClick={() => onGrade(g.grade)}
          aria-keyshortcuts={size === 'md' ? g.key : undefined}
          className={cn(
            'focus-ring flex min-w-0 items-center justify-center rounded-control border font-semibold',
            'transition-[background-color,border-color,transform] duration-120 ease-out-quint active:translate-y-px',
            size === 'sm' ? 'h-8 px-2 text-xs' : 'min-h-14 flex-col gap-1 px-2 py-2 text-ui',
            g.button
          )}
        >
          <span>{g.label}</span>
          {size === 'md' && (
            <span className="flex items-center gap-1.5 text-2xs font-normal text-fg-muted">
              <Kbd size="sm">{g.key}</Kbd>
              {previews?.[g.grade] && <span className="font-mono tabular">{previews[g.grade]}</span>}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Session breakdown ───

/** Stacked bar of grades (2px gaps between segments) with a counted legend. */
export function GradeSummary({ counts }: { counts: Readonly<Record<ReviewGrade, number>> }) {
  const reduceMotion = useReducedMotion();
  const total = REVIEW_GRADES.reduce((sum, g) => sum + counts[g], 0);
  if (total === 0) return null;
  return (
    <div className="space-y-3">
      <div
        className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={GRADE_META.map((g) => `${g.label} ${counts[g.grade]}`).join(', ')}
      >
        {GRADE_META.filter((g) => counts[g.grade] > 0).map((g) => (
          <motion.div
            key={g.grade}
            initial={reduceMotion ? false : { flexGrow: 0 }}
            animate={{ flexGrow: counts[g.grade] }}
            transition={{ duration: 0.6, ease: EASE_OUT_QUINT }}
            className="h-full min-w-1 basis-0"
            style={{ backgroundColor: g.color }}
            title={`${g.label}: ${counts[g.grade]}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-fg-muted">
        {GRADE_META.map((g) => (
          <span key={g.grade} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: g.color }} />
            {g.label}
            <span className="font-mono font-medium text-fg tabular">{counts[g.grade]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Count grades in a result list. */
export function countGrades(results: readonly { grade: ReviewGrade }[]): Record<ReviewGrade, number> {
  const counts: Record<ReviewGrade, number> = { again: 0, hard: 0, good: 0, easy: 0 };
  for (const r of results) counts[r.grade] += 1;
  return counts;
}
