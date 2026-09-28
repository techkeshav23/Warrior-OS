// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Sort Bars
// Renders one sorting frame as a bar chart coloured by state:
// comparing yellow, swapping red, sorted green, pivot/key purple
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { AlgoSortFrame } from '@/types/algo';
import { BAR_LABEL_LIMIT } from '@/lib/algorithms/constants';

type BarState = 'idle' | 'dim' | 'comparing' | 'swapping' | 'pivot' | 'sorted';

const BAR_CLASS: Record<BarState, string> = {
  idle: 'bg-cyan-500/55',
  dim: 'bg-cyan-500/20',
  comparing: 'bg-yellow-300 shadow-[0_0_10px_rgba(253,224,71,0.55)]',
  swapping: 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]',
  pivot: 'bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.5)]',
  sorted: 'bg-emerald-400/85',
};

const LABEL_CLASS: Record<BarState, string> = {
  idle: 'text-white/55',
  dim: 'text-white/30',
  comparing: 'text-yellow-200',
  swapping: 'text-rose-300',
  pivot: 'text-violet-300',
  sorted: 'text-emerald-300',
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
      className={cn('flex h-full w-full items-end px-2 pb-1', showLabels ? 'pt-6' : 'pt-3', n > 60 ? 'gap-px' : 'gap-0.5')}
      role="img"
      aria-label={`Array of ${n} values: ${frame.array.join(', ')}`}
    >
      {frame.array.map((value, i) => {
        const state = stateOf(i);
        return (
          <div
            key={i}
            className={cn(
              'relative min-w-0 flex-1 rounded-t-[3px]',
              BAR_CLASS[state],
              animate && 'transition-[height,background-color] duration-150 ease-out'
            )}
            style={{ height: `${Math.max(1.5, (value / maxValue) * 100)}%` }}
          >
            {showLabels && (
              <span
                className={cn(
                  'absolute inset-x-0 -top-4 text-center font-mono text-[9.5px] leading-none tabular-nums',
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

const LEGEND: { label: string; className: string }[] = [
  { label: 'Comparing', className: 'bg-yellow-300' },
  { label: 'Swapping / writing', className: 'bg-rose-500' },
  { label: 'Pivot / key / min', className: 'bg-violet-400' },
  { label: 'Sorted', className: 'bg-emerald-400' },
  { label: 'Unsorted', className: 'bg-cyan-500/60' },
];

export function SortLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pb-2 text-[10.5px] text-white/60">
      {LEGEND.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-sm', item.className)} aria-hidden />
          {item.label}
        </span>
      ))}
    </div>
  );
}
