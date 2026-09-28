// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Study Card
// The flip card, the Again / Hard / Good / Easy bar and the grade
// breakdown shared by Review (Training Grounds) and the Flashcards app
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cardAnswerText } from '@/stores/useLearningStore';
import type { Card, CardKind, ReviewGrade } from '@/types/learning';

/** Grade colours: validated for dark surfaces (adjacent pairs stay apart under colour-blindness, with the legend's labels as backup). */
export interface GradeMeta {
  grade: ReviewGrade;
  label: string;
  /** Key that picks it (see use-study-keys). */
  key: string;
  /** Swatch / segment colour. */
  color: string;
  button: string;
}

export const GRADE_META: readonly GradeMeta[] = [
  {
    grade: 'again',
    label: 'Again',
    key: '1',
    color: '#e5485f',
    button: 'bg-rose-500/15 border-rose-500/30 text-rose-200 hover:bg-rose-500/25',
  },
  {
    grade: 'hard',
    label: 'Hard',
    key: '2',
    color: '#c98209',
    button: 'bg-amber-500/15 border-amber-500/30 text-amber-200 hover:bg-amber-500/25',
  },
  {
    grade: 'good',
    label: 'Good',
    key: '3',
    color: '#10a37f',
    button: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/25',
  },
  {
    grade: 'easy',
    label: 'Easy',
    key: '4',
    color: '#5b6cf5',
    button: 'bg-indigo-500/15 border-indigo-400/30 text-indigo-200 hover:bg-indigo-500/25',
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

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex min-w-[1.25rem] items-center justify-center rounded border border-white/15 bg-white/5 px-1 font-mono text-[10px] leading-4 text-white/50',
        className
      )}
    >
      {children}
    </kbd>
  );
}

// ─── Flip card ───

function Answer({ card }: { card: Card }) {
  switch (card.kind) {
    case 'mcq':
      return (
        <p className="text-base font-semibold text-white/90 leading-relaxed whitespace-pre-wrap break-words">
          <span className="mr-2 text-white/40">{optionLetter(card.answer)}.</span>
          {card.options[card.answer]}
        </p>
      );
    case 'multi-select':
      return (
        <ul className="space-y-1 text-left">
          {card.answers.map((i) => (
            <li key={i} className="text-sm font-semibold text-white/90 break-words">
              <span className="mr-2 text-white/40">{optionLetter(i)}.</span>
              {card.options[i]}
            </li>
          ))}
        </ul>
      );
    default:
      return (
        <p className="text-base font-semibold text-white/90 leading-relaxed whitespace-pre-wrap break-words">
          {cardAnswerText(card)}
        </p>
      );
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
  'col-start-1 row-start-1 flex min-h-[220px] flex-col rounded-2xl border border-t-2 bg-slate-950/70 p-5 shadow-[0_0_40px_-18px_rgba(34,211,238,0.45)]';

/**
 * Both faces share one grid cell, so the card is as tall as its longer side.
 * Remount it per card (key) so a new card never animates back from its answer.
 */
function FlipCardInner({ card, flipped, onFlip, caption, accent = '#22d3ee', badge }: FlipCardProps) {
  const hasOptions = card.kind === 'mcq' || card.kind === 'multi-select';
  return (
    <div className="w-full" style={{ perspective: 1400 }}>
      <motion.div
        role="button"
        tabIndex={0}
        data-flip-card="true"
        aria-label={flipped ? 'Answer side. Press Space to see the question.' : 'Question side. Press Space to see the answer.'}
        onClick={onFlip}
        initial={false}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 26 }}
        style={{ transformStyle: 'preserve-3d' }}
        className="grid cursor-pointer select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
      >
        {/* Front */}
        <div
          className={cn(FACE, 'border-white/10 bg-gradient-to-br from-cyan-500/10 via-slate-900/40 to-purple-500/10')}
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', borderTopColor: accent }}
          aria-hidden={flipped}
        >
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider">
            <span className="truncate text-white/40">{caption}</span>
            <span className="flex flex-shrink-0 items-center gap-1.5">
              {badge && <span className="rounded bg-white/10 px-1.5 py-0.5 text-white/60">{badge}</span>}
              <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-cyan-300/80">{KIND_LABELS[card.kind]}</span>
            </span>
          </div>
          <div className="flex flex-1 flex-col justify-center py-4">
            <p className="text-center text-lg font-semibold leading-relaxed text-white whitespace-pre-wrap break-words">
              {card.prompt}
            </p>
            {hasOptions && (
              <ul className="mx-auto mt-4 space-y-1 text-sm text-white/60">
                {card.options.map((option, i) => (
                  <li key={i} className="break-words">
                    <span className="mr-2 text-white/35">{optionLetter(i)}.</span>
                    {option}
                  </li>
                ))}
              </ul>
            )}
            {card.kind === 'numeric' && (
              <p className="mt-3 text-center text-xs text-white/40">
                Numeric answer{card.unit ? ` in ${card.unit}` : ''}
              </p>
            )}
          </div>
          <p className="text-center text-[10px] text-white/30">
            Click or <Kbd>Space</Kbd> to flip
          </p>
        </div>

        {/* Back */}
        <div
          className={cn(FACE, 'border-purple-400/20 bg-gradient-to-br from-purple-500/15 via-slate-900/40 to-cyan-500/10')}
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            borderTopColor: accent,
          }}
          aria-hidden={!flipped}
        >
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider">
            <span className="text-purple-300/70">Answer</span>
            <span className="truncate text-white/30">{caption}</span>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
            <p className="max-h-24 overflow-y-auto text-xs text-white/40 whitespace-pre-wrap break-words">{card.prompt}</p>
            <Answer card={card} />
            {card.explanation && (
              <p className="border-t border-white/10 pt-3 text-xs leading-relaxed text-white/55 whitespace-pre-wrap break-words">
                {card.explanation}
              </p>
            )}
          </div>
          <p className="text-center text-[10px] text-white/30">
            How well did you know it? <Kbd>1</Kbd>–<Kbd>4</Kbd>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export const FlipCard = memo(FlipCardInner);

// ─── Controls ───

export function RevealButton({ onReveal }: { onReveal: () => void }) {
  return (
    <button
      type="button"
      onClick={onReveal}
      className="mx-auto flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-white/80 transition-all hover:bg-white/10"
    >
      <Eye className="h-4 w-4" />
      Show answer
      <Kbd>Space</Kbd>
    </button>
  );
}

interface GradeBarProps {
  onGrade: (grade: ReviewGrade) => void;
  /** Next-review interval per grade, e.g. { good: '3d' }. */
  previews?: Partial<Record<ReviewGrade, string>>;
}

export function GradeBar({ onGrade, previews }: GradeBarProps) {
  return (
    <div className="grid w-full grid-cols-4 gap-2" role="group" aria-label="Rate your recall">
      {GRADE_META.map((g) => (
        <motion.button
          key={g.grade}
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={() => onGrade(g.grade)}
          className={cn(
            'flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-sm font-semibold transition-colors',
            g.button
          )}
        >
          <span>{g.label}</span>
          <span className="flex items-center gap-1 text-[10px] font-normal text-white/50">
            <Kbd className="text-white/60">{g.key}</Kbd>
            {previews?.[g.grade] && <span>{previews[g.grade]}</span>}
          </span>
        </motion.button>
      ))}
    </div>
  );
}

// ─── Session breakdown ───

/** Stacked bar of grades (2px gaps between segments) with a counted legend. */
export function GradeSummary({ counts }: { counts: Readonly<Record<ReviewGrade, number>> }) {
  const total = REVIEW_GRADES.reduce((sum, g) => sum + counts[g], 0);
  if (total === 0) return null;
  return (
    <div className="space-y-2">
      <div
        className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full"
        role="img"
        aria-label={GRADE_META.map((g) => `${g.label} ${counts[g.grade]}`).join(', ')}
      >
        {GRADE_META.filter((g) => counts[g.grade] > 0).map((g) => (
          <motion.div
            key={g.grade}
            initial={{ flexGrow: 0 }}
            animate={{ flexGrow: counts[g.grade] }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="h-full min-w-[4px] basis-0"
            style={{ backgroundColor: g.color }}
            title={`${g.label}: ${counts[g.grade]}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
        {GRADE_META.map((g) => (
          <span key={g.grade} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: g.color }} />
            {g.label}
            <span className="font-semibold text-white/85 tabular-nums">{counts[g.grade]}</span>
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
