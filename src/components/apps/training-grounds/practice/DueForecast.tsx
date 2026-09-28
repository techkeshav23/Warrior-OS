// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Due Forecast
// Reviews due per day for the next week: one series, so one colour
// and no legend; counts ride the bar caps, the full date is on hover.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { DAY_MS, relativeDayLabel, shortDateLabel, weekdayLabel } from './schedule';

interface DueForecastProps {
  /** Due count per day; index 0 is today (overdue included). */
  counts: readonly number[];
  /** 00:00 UTC of today. */
  todayStart: number;
  /** Never-answered cards waiting, mentioned beside the title. */
  newCount?: number;
  className?: string;
}

/** Tallest bar uses this share of the plot, leaving room for its cap label. */
const MAX_BAR = 82;

function DueForecastInner({ counts, todayStart, newCount = 0, className }: DueForecastProps) {
  const max = Math.max(1, ...counts);
  const total = counts.reduce((sum, n) => sum + n, 0);
  const days = counts.map((count, i) => {
    const ms = todayStart + i * DAY_MS;
    return {
      count,
      ms,
      short: i === 0 ? 'Today' : weekdayLabel(ms),
      full: `${relativeDayLabel(ms, todayStart)}, ${shortDateLabel(ms)}`,
    };
  });
  const summary = days.map((d) => `${d.full}: ${d.count}`).join('; ');

  return (
    <figure className={cn('rounded-xl border border-white/10 bg-white/[0.03] p-4', className)}>
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold text-white/75">Reviews due · next {counts.length} days</span>
        <span className="text-[11px] text-white/40 tabular-nums">
          {total} scheduled{newCount > 0 ? ` · ${newCount} new waiting` : ''}
        </span>
      </figcaption>

      <div className="mt-3 flex h-24 items-stretch gap-2 border-b border-white/10" role="img" aria-label={`Reviews due. ${summary}`}>
        {days.map((day, i) => {
          const height = (day.count / max) * MAX_BAR;
          return (
            <div key={day.ms} className="group relative flex flex-1 items-end justify-center">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ duration: 0.5, delay: i * 0.04, ease: 'easeOut' }}
                className={cn(
                  'w-full max-w-[24px] rounded-t-[4px] transition-colors',
                  i === 0 ? 'bg-cyan-300 group-hover:bg-cyan-200' : 'bg-cyan-400/70 group-hover:bg-cyan-300'
                )}
              />
              {day.count > 0 && (
                <span
                  className="pointer-events-none absolute inset-x-0 text-center text-[10px] text-white/65 tabular-nums"
                  style={{ bottom: `calc(${height}% + 3px)` }}
                >
                  {day.count}
                </span>
              )}
              <span
                className={cn(
                  'pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-md border border-white/10 bg-slate-950/95 px-2 py-1 text-[10px] text-white/60 opacity-0 shadow-lg transition-opacity group-hover:opacity-100',
                  i === 0 ? 'left-0' : i === days.length - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                )}
              >
                <span className="font-semibold text-white">{day.count}</span> due · {day.full}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2">
        {days.map((day, i) => (
          <span
            key={day.ms}
            className={cn('flex-1 text-center text-[10px]', i === 0 ? 'font-semibold text-white/80' : 'text-white/40')}
          >
            {day.short}
          </span>
        ))}
      </div>
    </figure>
  );
}

export const DueForecast = memo(DueForecastInner);
