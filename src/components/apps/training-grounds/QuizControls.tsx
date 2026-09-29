// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Quiz Controls
// Building blocks shared by the Quiz Engine, Mock Test and Question
// Bank (FORGE HUD): settings rows, difficulty / status marks, the
// question palette, the graded score hero, review rows, key hints
// and the inline "submit anyway?" bar.
// ═══════════════════════════════════════════════════════════

'use client';

import { Fragment, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, CircleCheck, CircleMinus, CircleX, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Card, Kbd, ProgressBar, ProgressRing, type ProgressTone } from '@/components/ui';
import { EASE_OUT_QUINT } from '@/styles/tokens';
import type { Difficulty } from '@/types/learning';
import { DIFFICULTY_TONE, type AnswerStatus, type GradeTone, type LetterGrade } from './grading';
import { masteryColor } from './practice/mastery';

// ─── Settings row ───

/** Label + hint on the left, the control on the right; stacks in narrow windows. */
export function SettingRow({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 py-3.5 first:pt-0 last:pb-0 @xl:flex-row @xl:items-center @xl:justify-between @xl:gap-6">
      <div className="min-w-0">
        <p className="text-ui font-medium text-fg">{label}</p>
        {hint != null && <p className="mt-0.5 text-xs text-fg-subtle">{hint}</p>}
      </div>
      <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** Tab header: lucide icon tile, title, one line of copy, optional actions. */
export function TabHeader({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="armor-plate chamfer-sm mt-0.5 flex size-9 shrink-0 items-center justify-center text-accent [--cut-tr:0px] [--cut-bl:0px]">
          <Icon size={18} strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold tracking-wide text-fg">{title}</h3>
          {description != null && <p className="mt-0.5 max-w-prose text-ui text-fg-muted">{description}</p>}
        </div>
      </div>
      {actions != null && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

// ─── Deck picker ───

interface DeckPickCardProps {
  /** The deck's emoji (user content) or any node. */
  icon: ReactNode;
  name: string;
  meta: ReactNode;
  /** 0..1 mastery meter; omit for no meter. */
  mastery?: number;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/** Selectable deck tile: icon, name, meta line, a check and an optional mastery meter. */
export function DeckPickCard({ icon, name, meta, mastery, selected, disabled = false, onClick }: DeckPickCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'focus-ring armor-panel chamfer-md flex min-w-0 flex-col gap-3 p-3.5 text-left',
        'transition-[background-color,box-shadow] duration-120 ease-out-quint disabled:cursor-not-allowed disabled:opacity-45',
        selected
          ? 'ember-edge bg-[color-mix(in_oklab,var(--accent)_10%,rgb(34_40_48/0.6))]'
          : 'hover:bg-steel-750/80 active:bg-steel-800'
      )}
    >
      <span className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            'flex size-9 shrink-0 items-center justify-center chamfer-sm bg-steel-950/70 bevel text-lg',
            selected ? 'text-accent' : 'text-fg-muted'
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ui font-medium text-fg" title={name}>
            {name}
          </span>
          <span className="block truncate text-xs text-fg-subtle tabular">{meta}</span>
        </span>
        <span
          aria-hidden
          className={cn(
            'flex size-5 shrink-0 items-center justify-center chamfer-xs [--cut:3px] transition-colors duration-120',
            selected ? 'bg-accent text-accent-fg' : 'border border-steel-500 bg-steel-950/80 text-transparent'
          )}
        >
          <Check size={12} strokeWidth={3} />
        </span>
      </span>
      {mastery !== undefined && (
        <ProgressBar
          value={Math.round(mastery * 100)}
          size="sm"
          label="Mastery"
          showValue
          animated={false}
          color={masteryColor(mastery)}
        />
      )}
    </button>
  );
}

// ─── Marks ───

export function DifficultyBadge({ difficulty, size = 'sm' }: { difficulty: Difficulty; size?: 'sm' | 'md' }) {
  return (
    <Badge tone={DIFFICULTY_TONE[difficulty]} size={size}>
      {difficulty}
    </Badge>
  );
}

export const STATUS_META: Readonly<Record<AnswerStatus, { icon: LucideIcon; label: string; text: string }>> = {
  correct: { icon: CircleCheck, label: 'Correct', text: 'text-success' },
  wrong: { icon: CircleX, label: 'Wrong', text: 'text-danger' },
  skipped: { icon: CircleMinus, label: 'Not answered', text: 'text-fg-subtle' },
};

/** Correct / wrong / skipped glyph (icon + accessible label, never colour alone). */
export function StatusIcon({ status, size = 16 }: { status: AnswerStatus; size?: number }) {
  const { icon: Icon, label, text } = STATUS_META[status];
  return <Icon size={size} strokeWidth={1.75} className={cn('shrink-0', text)} aria-label={label} role="img" />;
}

/** Tone for an accuracy percentage: ≥75 success, ≥50 warning, below danger. */
export function accuracyTone(pct: number): ProgressTone {
  return pct >= 75 ? 'success' : pct >= 50 ? 'warning' : 'danger';
}

/** 0..100 meter coloured by accuracy. */
export function AccuracyBar({ pct, className, label }: { pct: number; className?: string; label?: string }) {
  return (
    <ProgressBar
      value={Math.max(0, Math.min(100, pct))}
      size="sm"
      tone={accuracyTone(pct)}
      animated={false}
      className={className}
      aria-label={label ?? `${Math.round(pct)}%`}
    />
  );
}

// ─── Question palette ───

export type PaletteState = 'current' | 'correct' | 'wrong' | 'answered' | 'marked' | 'empty';

const PALETTE_STYLES: Readonly<Record<PaletteState, string>> = {
  current: 'bg-linear-to-b from-ember-300 via-accent to-ember-600 font-semibold text-accent-fg shadow-[inset_0_1px_0_rgb(255_240_220/0.7),inset_0_-1px_0_rgb(90_25_0/0.7)]',
  correct: 'bg-success/14 text-success ring-1 ring-inset ring-success/30 hover:bg-success/22',
  wrong: 'bg-danger/14 text-danger ring-1 ring-inset ring-danger/30 hover:bg-danger/22',
  answered: 'bg-accent/14 text-accent ring-1 ring-inset ring-accent/30 hover:bg-accent/22',
  marked: 'bg-warning/14 text-warning ring-1 ring-inset ring-warning/35 hover:bg-warning/22',
  empty: 'bg-steel-950/70 text-fg-subtle shadow-[inset_0_1px_0_rgb(0_0_0/0.7),inset_0_-1px_0_rgb(255_255_255/0.06)] ring-1 ring-inset ring-line hover:bg-steel-750 hover:text-fg',
};

const PALETTE_WORDS: Readonly<Record<PaletteState, string>> = {
  current: 'current',
  correct: 'correct',
  wrong: 'wrong',
  answered: 'answered',
  marked: 'marked for review',
  empty: 'not answered',
};

/** One numbered square of the question palette. */
export function PaletteButton({
  index,
  state,
  onClick,
  size = 'md',
}: {
  index: number;
  state: PaletteState;
  onClick: () => void;
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Question ${index + 1}`}
      aria-current={state === 'current' ? 'step' : undefined}
      title={`Question ${index + 1}: ${PALETTE_WORDS[state]}`}
      className={cn(
        'focus-ring shrink-0 chamfer-xs [--cut:4px] font-mono tabular transition-[background-color,color,box-shadow] duration-120 ease-out-quint',
        size === 'sm' ? 'size-6 text-[10px]' : 'size-7 text-2xs',
        PALETTE_STYLES[state]
      )}
    >
      {index + 1}
    </button>
  );
}

/** Small legend swatch for the palette states. */
export function PaletteLegend({ items }: { items: readonly PaletteState[] }) {
  const swatch: Readonly<Record<PaletteState, string>> = {
    current: 'bg-accent',
    correct: 'bg-success/60',
    wrong: 'bg-danger/60',
    answered: 'bg-accent/45',
    marked: 'bg-warning/60',
    empty: 'bg-ink-600',
  };
  return (
    <span className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-fg-subtle">
      {items.map((state) => (
        <span key={state} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn('size-2.5 chamfer-xs [--cut:2px]', swatch[state])} />
          <span className="first-letter:uppercase">{PALETTE_WORDS[state]}</span>
        </span>
      ))}
    </span>
  );
}

// ─── Score hero ───

const GRADE_RING: Readonly<Record<GradeTone, { tone?: ProgressTone; color?: string }>> = {
  gold: { tone: 'gold' },
  ember: { tone: 'ember' },
  accent: { tone: 'accent' },
  neutral: { color: 'var(--color-fg-subtle)' },
};

interface ScoreHeroProps {
  grade: LetterGrade;
  gradeColor: string;
  tone: GradeTone;
  /** 0..100 */
  pct: number;
  eyebrow: ReactNode;
  title: ReactNode;
  meta: ReactNode;
  badges?: ReactNode;
  footnote?: ReactNode;
}

/** Graded result: a ring filled to the score with the letter grade inside. */
export function ScoreHero({ grade, gradeColor, tone, pct, eyebrow, title, meta, badges, footnote }: ScoreHeroProps) {
  const reduceMotion = useReducedMotion();
  const earned = tone === 'gold' || tone === 'ember';
  return (
    <Card hud padding="lg" tone={earned ? 'ember' : 'default'}>
      <div className="flex flex-col items-center gap-5 text-center @xl:flex-row @xl:items-center @xl:text-left">
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.42, ease: EASE_OUT_QUINT }}
          className="shrink-0"
        >
          <ProgressRing value={pct} size={116} strokeWidth={6} glow={earned} {...GRADE_RING[tone]}>
            <span className={cn('font-display text-4xl font-bold leading-none', gradeColor, earned && 'text-glow-sm')}>
              {grade}
            </span>
            <span className="mt-1.5 font-mono text-2xs text-fg-subtle tabular">{Math.round(pct)}%</span>
          </ProgressRing>
        </motion.div>
        <div className="min-w-0 flex-1">
          <div className="hud-label">{eyebrow}</div>
          <h3 className="mt-1.5 font-display text-xl font-semibold tracking-wide text-fg tabular">{title}</h3>
          <p className="mt-1 text-ui text-fg-muted">{meta}</p>
          {badges != null && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 @xl:justify-start">{badges}</div>
          )}
          {footnote != null && <p className="mt-2 text-xs text-fg-subtle">{footnote}</p>}
        </div>
      </div>
    </Card>
  );
}

// ─── Review rows ───

interface ReviewRowProps {
  index: number;
  status: AnswerStatus;
  prompt: string;
  /** Characters of the prompt shown in the row. */
  preview: number;
  /** Right side of the row (time, marks). */
  meta?: ReactNode;
  /** Extra marks after the prompt (e.g. a "marked" badge). */
  flags?: ReactNode;
  children: ReactNode;
}

/** One graded question: a collapsible row that opens onto the full breakdown. */
export function ReviewRow({ index, status, prompt, preview, meta, flags, children }: ReviewRowProps) {
  const text = prompt.length > preview ? `${prompt.slice(0, preview)}…` : prompt;
  return (
    <details className="group/review [&_summary::-webkit-details-marker]:hidden">
      <summary
        className="focus-ring-inset flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2 transition-colors duration-120 ease-out-quint hover:bg-surface-hover"
        title={prompt}
      >
        <StatusIcon status={status} />
        <span className="w-8 shrink-0 font-mono text-xs text-fg-subtle tabular">Q{index + 1}</span>
        <span className="min-w-0 flex-1 truncate text-ui text-fg">{text}</span>
        {flags}
        {meta != null && <span className="hidden shrink-0 font-mono text-xs text-fg-subtle tabular @md:inline">{meta}</span>}
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          aria-hidden
          className="shrink-0 text-fg-subtle transition-transform duration-180 ease-out-quint group-open/review:rotate-180"
        />
      </summary>
      <div className="space-y-3 border-t border-black/40 bg-steel-950/45 px-4 py-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]">{children}</div>
    </details>
  );
}

// ─── Key hints ───

export interface KeyHint {
  keys: readonly string[];
  label: string;
  /** Render the two keys as a range (1–9). */
  range?: boolean;
}

export function KeyHints({ items, className }: { items: readonly KeyHint[]; className?: string }) {
  return (
    <p className={cn('flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-fg-subtle', className)}>
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center gap-0.5">
            {item.keys.map((k, i) => (
              <Fragment key={k}>
                {i > 0 && <span className="px-0.5 text-fg-faint">{item.range ? '–' : '/'}</span>}
                <Kbd size="sm">{k}</Kbd>
              </Fragment>
            ))}
          </span>
          {item.label}
        </span>
      ))}
    </p>
  );
}

// ─── Inline confirm ───

/** Warning bar with its own actions, e.g. "3 unanswered: submit anyway?". */
export function ConfirmBar({ children, actions }: { children: ReactNode; actions: ReactNode }) {
  return (
    <div
      role="alert"
      className="relative flex animate-rise-in flex-wrap items-center gap-x-3 gap-y-2 chamfer-md bg-warning/10 px-4 py-3 ring-1 ring-inset ring-warning/25 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-warning"
    >
      <TriangleAlert size={16} strokeWidth={1.75} className="shrink-0 text-warning" aria-hidden />
      <p className="min-w-0 flex-1 text-ui text-fg">{children}</p>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </div>
  );
}
