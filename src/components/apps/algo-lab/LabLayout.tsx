// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Layout (FORGE HUD)
// The frame every visualizer shares:
//   AppHeader    algorithm name · category + complexity hint · keys
//   Toolbar      dataset / graph / tree inputs (+ an optional sub-bar)
//   body         stage well + narration │ aside (complexity, code)
//   Toolbar      playback transport pinned to the bottom edge
// The aside drops under the stage when the window gets narrow; the
// body scrolls instead of squashing the stage at the minimum size.
// ═══════════════════════════════════════════════════════════

'use client';

import { createContext, memo, useContext, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronRight, GitFork, Swords, ChartColumn, Waypoints } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BEVEL_SUNK, ENGRAVED_LABEL, FOCUS_EDGE, SLOT_FILL } from '@/components/ui/armor';
import { AppHeader, Badge, Kbd, Toolbar } from '@/components/ui';
import type { AlgoCategory, AlgoLabView } from '@/types/algo';
import { ALGO_LAB_SECTIONS } from '@/data/algorithms';

// ─── Chrome context (compact window → algorithm picker in the header) ───

export const LabChromeContext = createContext<{ picker: ReactNode | null }>({ picker: null });

// ─── Category badge ───

const CATEGORY_META: Record<AlgoCategory, { label: string; icon: typeof ChartColumn }> = {
  sorting: { label: 'Sorting', icon: ChartColumn },
  graph: { label: 'Graph', icon: Waypoints },
  tree: { label: 'Tree', icon: GitFork },
};

export function CategoryBadge({ category, label }: { category: AlgoCategory; label?: string }) {
  const meta = CATEGORY_META[category];
  return (
    <Badge tone="neutral" icon={label === 'Race' ? Swords : meta.icon}>
      {label ?? meta.label}
    </Badge>
  );
}

function viewHint(view: AlgoLabView): string | null {
  for (const section of ALGO_LAB_SECTIONS) {
    const entry = section.entries.find((candidate) => candidate.view === view);
    if (entry) return entry.hint;
  }
  return null;
}

// ─── Narration + live metrics ───

type MetricTone = 'default' | 'warning' | 'danger' | 'success' | 'info' | 'ember' | 'accent';

const METRIC_TONE: Record<MetricTone, string> = {
  default: 'text-fg',
  warning: 'text-warning',
  danger: 'text-danger',
  success: 'text-success',
  info: 'text-info',
  ember: 'text-ember-400',
  accent: 'text-accent',
};

/** One live counter: hud-label + tabular mono value. */
export function Stat({ label, value, tone = 'default' }: { label: string; value: ReactNode; tone?: MetricTone }) {
  return (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className={ENGRAVED_LABEL}>{label}</span>
      <span className={cn('tabular font-mono text-ui font-medium', METRIC_TONE[tone])}>{value}</span>
    </span>
  );
}

/** One-line narration of the current step plus optional counters. */
export function StepMessage({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div className="chamfer-sm bevel brushed relative flex min-h-11 shrink-0 flex-wrap items-center gap-x-5 gap-y-1.5 bg-steel-800 py-2 pl-4 pr-3">
      <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 bg-linear-to-b from-ember-300 to-ember-600 shadow-[0_0_8px_var(--color-ember-500)]" />
      <p className="flex min-w-0 flex-1 items-start gap-2 text-ui text-fg-muted" aria-live="polite">
        <ChevronRight size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 select-text">{message}</span>
      </p>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1">{children}</div>}
    </div>
  );
}

// ─── Stage legend ───

export interface LegendItem {
  label: string;
  /** Swatch colour (any CSS colour, including var(--accent)). */
  color: string;
  /** Ring swatch instead of a filled square (graph/tree node states). */
  ring?: boolean;
  dashed?: boolean;
}

export function StageLegend({ items, note }: { items: LegendItem[]; note?: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-3 py-2 text-xs text-fg-muted">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn('size-2.5 shrink-0', item.ring && 'rounded-full border-2')}
            style={
              item.ring
                ? { borderColor: item.color, borderStyle: item.dashed ? 'dashed' : 'solid' }
                : { backgroundColor: item.color }
            }
          />
          {item.label}
        </span>
      ))}
      {note != null && <span className="text-fg-subtle">{note}</span>}
    </div>
  );
}

// ─── Layout ───

interface LabLayoutProps {
  view: AlgoLabView;
  title: string;
  category: AlgoCategory;
  badgeLabel?: string;
  /** Controls in the 40px toolbar under the header. */
  toolbar?: ReactNode;
  /** Optional row under the toolbar (custom input, selection editor, hints). */
  subbar?: ReactNode;
  stage: ReactNode;
  /** Stage without its own border (it holds its own cards, e.g. race lanes). */
  bareStage?: boolean;
  /** Narration row under the stage. */
  narration?: ReactNode;
  /** Right column (complexity, pseudocode, tips). */
  aside: ReactNode;
  /** Playback transport pinned to the bottom. */
  playback?: ReactNode;
  onStageKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  stageLabel?: string;
  /** Show the Space / arrow-key hints in the header. */
  keyHints?: boolean;
}

function LabLayoutInner({
  view,
  title,
  category,
  badgeLabel,
  toolbar,
  subbar,
  stage,
  bareStage = false,
  narration,
  aside,
  playback,
  onStageKeyDown,
  stageLabel = 'Visualization',
  keyHints = true,
}: LabLayoutProps) {
  const { picker } = useContext(LabChromeContext);
  const hint = viewHint(view);
  const categoryLabel = CATEGORY_META[category].label;
  // Compare Mode leads with "Race"; everything else with its category.
  const lead = view === 'compare' && badgeLabel ? badgeLabel : categoryLabel;

  return (
    <div className="@container/lab flex h-full min-h-0 flex-col" onKeyDown={onStageKeyDown}>
      <AppHeader
        title={title}
        subtitle={hint ? `${lead} · ${hint}` : lead}
        actions={
          <>
            {keyHints && (
              <span className="hidden items-center gap-1.5 text-xs text-fg-subtle @3xl/lab:flex" aria-hidden>
                <Kbd size="sm">Space</Kbd>
                <span>play</span>
                <Kbd size="sm">←</Kbd>
                <Kbd size="sm">→</Kbd>
                <span>step</span>
              </span>
            )}
            {picker}
            {!picker && <CategoryBadge category={category} label={badgeLabel} />}
          </>
        }
      />

      {toolbar != null && (
        <Toolbar aria-label={`${title} controls`} className="scrollbar-none overflow-x-auto">
          <div className="flex min-w-max flex-1 items-center gap-2">{toolbar}</div>
        </Toolbar>
      )}
      {subbar}

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div
          className={cn(
            'grid min-h-full grid-cols-1 gap-4 p-4',
            '@3xl/lab:h-full @3xl/lab:min-h-[22rem] @3xl/lab:grid-cols-[minmax(0,1fr)_18.5rem]'
          )}
        >
          <div className="flex min-h-[21rem] min-w-0 flex-col gap-3 @3xl/lab:min-h-0">
            <section
              tabIndex={0}
              aria-label={stageLabel}
              className={cn(
                '@container/stage relative flex min-h-[14rem] min-w-0 flex-1 flex-col overflow-hidden',
                FOCUS_EDGE,
                !bareStage && cn('chamfer-md [--cut:12px] [--cut-tr:4px] [--cut-bl:4px]', SLOT_FILL, BEVEL_SUNK)
              )}
            >
              {stage}
            </section>
            {narration}
          </div>

          <aside className="flex min-h-0 min-w-0 flex-col gap-3">{aside}</aside>
        </div>
      </div>

      {playback}
    </div>
  );
}

export const LabLayout = memo(LabLayoutInner);
