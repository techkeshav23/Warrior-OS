// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Sort Bars (FORGE HUD)
// One sorting frame as a bar chart coloured by state: comparing =
// warning, swapping/writing = danger, pivot/key/min = live accent,
// sorted = success, the rest a quiet ink → plasma gradient.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { AlgoSortFrame } from '@/types/algo';
import { BAR_LABEL_LIMIT } from '@/lib/algorithms/constants';
import { ACCENT, LAB } from './labTheme';
import { StageLegend, type LegendItem } from './LabLayout';

type BarState = 'idle' | 'dim' | 'comparing' | 'swapping' | 'pivot' | 'sorted';

const BAR_CLASS: Record<BarState, string> = {
  idle: 'bg-linear-to-t from-ink-600/70 to-plasma-600/75',
  dim: 'bg-ink-700/80',
  comparing: 'bg-warning shadow-[0_0_14px_-2px_var(--color-warning)]',
  swapping: 'bg-danger shadow-[0_0_14px_-2px_var(--color-danger)]',
  pivot: 'bg-accent shadow-[0_0_14px_-2px_var(--accent)]',
  sorted: 'bg-linear-to-t from-success/45 to-success/85',
};

const LABEL_CLASS: Record<BarState, string> = {
  idle: 'text-fg-subtle',
  dim: 'text-fg-faint',
  comparing: 'text-warning',
  swapping: 'text-danger',
  pivot: 'text-accent',
  sorted: 'text-success',
};

interface SortBarsProps {
  frame: AlgoSortFrame;
  maxValue: number;
  /** Ease bar heights between frames (turned off at high speeds). */
  animate: boolean;
}

function SortBarsInner({ frame, maxValue, animate }: SortBarsProps) {
  const n = frame.array.length;
  const comparing = new Set(frame.comparing);
  const swapping = new Set(frame.swapping);
  const range = frame.range;
  const showLabels = n <= BAR_LABEL_LIMIT;

  const stateOf = (i: number): BarState => {
    if (swapping.has(i)) return 'swapping';
    if (comparing.has(i)) return 'comparing';
    if (frame.pivot === i) return 'pivot';
    if (frame.sorted[i]) return 'sorted';
    if (range && (i < range[0] || i > range[1])) return 'dim';
    return 'idle';
  };

  return (
    <div
      className={cn(
        'relative flex h-full w-full items-end px-3 pb-2',
        showLabels ? 'pt-7' : 'pt-4',
        n > 60 ? 'gap-px' : n > 24 ? 'gap-[3px]' : 'gap-1'
      )}
      role="img"
      aria-label={`Array of ${n} values: ${frame.array.join(', ')}`}
    >
      {/* Quiet horizontal guides at 25 / 50 / 75 % */}
      <div aria-hidden className={cn('pointer-events-none absolute inset-x-3 bottom-2', showLabels ? 'top-7' : 'top-4')}>
        {[0.25, 0.5, 0.75].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${f * 100}%` }} />
        ))}
      </div>
      {frame.array.map((value, i) => {
        const state = stateOf(i);
        return (
          <div
            key={i}
            className={cn(
              'relative min-w-0 flex-1 rounded-t-[3px]',
              BAR_CLASS[state],
              animate && 'transition-[height,background-color,box-shadow] duration-180 ease-out-quint'
            )}
            style={{ height: `${Math.max(1.5, (value / maxValue) * 100)}%` }}
          >
            {showLabels && (
              <span
                className={cn(
                  'tabular absolute inset-x-0 -top-4.5 text-center font-mono text-[10px] leading-none',
                  LABEL_CLASS[state]
                )}
              >
                {value}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const SortBars = memo(SortBarsInner);

const LEGEND: LegendItem[] = [
  { label: 'Comparing', color: LAB.compare },
  { label: 'Swapping / writing', color: LAB.swap },
  { label: 'Pivot / key / min', color: ACCENT },
  { label: 'Sorted', color: LAB.sorted },
  { label: 'Unsorted', color: LAB.plasma[600] },
];

export function SortLegend() {
  return <StageLegend items={LEGEND} />;
}
