// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Layout
// Header, toolbar, visualization stage, footer and the info column
// (pseudocode + complexity). Container queries move the info
// column below the stage when the window gets narrow.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { AlgoCategory } from '@/types/algo';

const CATEGORY_STYLE: Record<AlgoCategory, { label: string; className: string }> = {
  sorting: { label: 'Sorting', className: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300' },
  graph: { label: 'Graph', className: 'border-violet-400/30 bg-violet-400/10 text-violet-300' },
  tree: { label: 'Tree', className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' },
};

export function CategoryBadge({ category, label }: { category: AlgoCategory; label?: string }) {
  const style = CATEGORY_STYLE[category];
  return (
    <span className={cn('shrink-0 rounded-full border px-2 py-px text-[10px] font-medium', style.className)}>
      {label ?? style.label}
    </span>
  );
}

/** One-line narration of the current step plus optional counters. */
export function StepMessage({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-[2.25rem] flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5">
      <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-white/85" aria-live="polite">
        <span className="mr-1.5 text-cyan-400" aria-hidden>
          ›
        </span>
        {message}
      </p>
      {children && <div className="flex shrink-0 items-center gap-3 font-mono text-[11px] text-white/60">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <span className="whitespace-nowrap">
      {label} <span className={cn('tabular-nums text-white/90', className)}>{value}</span>
    </span>
  );
}

interface LabLayoutProps {
  title: string;
  subtitle: string;
  category: AlgoCategory;
  badgeLabel?: string;
  /** Inputs above the stage (dataset, graph tools, tree operations). */
  toolbar?: ReactNode;
  stage: ReactNode;
  /** Narration and playback controls under the stage. */
  footer?: ReactNode;
  /** Top of the info column (usually the pseudocode). */
  code: ReactNode;
  /** Bottom of the info column (usually the complexity card). */
  details: ReactNode;
  onStageKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  stageLabel?: string;
}

function LabLayoutInner({
  title,
  subtitle,
  category,
  badgeLabel,
  toolbar,
  stage,
  footer,
  code,
  details,
  onStageKeyDown,
  stageLabel = 'Visualization',
}: LabLayoutProps) {
  return (
    // The lab only scrolls when the window is shorter than the grid's minimum
    // height, so the stage never collapses at the smallest window size.
    <div className="@container/lab flex h-full min-h-0 flex-col overflow-y-auto" onKeyDown={onStageKeyDown}>
      <header className="flex shrink-0 items-start gap-3 px-4 pb-2 pt-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold tracking-wide text-white">{title}</h2>
            <CategoryBadge category={category} label={badgeLabel} />
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-white/55">{subtitle}</p>
        </div>
      </header>

      {toolbar && <div className="shrink-0 px-4 pb-2">{toolbar}</div>}

      <div
        className={cn(
          'grid min-h-[31rem] flex-1 gap-2 px-3 pb-3',
          'grid-cols-1 grid-rows-[minmax(12rem,1fr)_auto_minmax(0,9rem)]',
          '@3xl/lab:min-h-[20rem] @3xl/lab:grid-cols-[minmax(0,1fr)_17rem] @3xl/lab:grid-rows-[minmax(0,1fr)_auto]'
        )}
      >
        <section
          tabIndex={0}
          aria-label={stageLabel}
          className="@container/stage relative min-h-0 min-w-0 overflow-hidden rounded-lg border border-white/10 bg-black/35 outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/50"
        >
          {stage}
        </section>

        <div className="flex min-w-0 flex-col gap-2 @3xl/lab:col-start-1 @3xl/lab:row-start-2">{footer}</div>

        <aside className="@container/info min-h-0 min-w-0 @3xl/lab:col-start-2 @3xl/lab:row-span-2 @3xl/lab:row-start-1">
          <div className="flex h-full min-h-0 flex-col gap-2 @lg/info:flex-row">
            <div className="min-h-0 flex-1 @lg/info:min-w-0">{code}</div>
            <div className="max-h-[46%] min-h-0 shrink-0 overflow-y-auto rounded-lg @lg/info:max-h-none @lg/info:w-[42%]">
              {details}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export const LabLayout = memo(LabLayoutInner);
