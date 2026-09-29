// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Due Forecast
// Reviews due per day for the next week: one series (viz-1), so no
// legend; counts ride the bar caps, hairline gridlines, 11px mono
// ticks and an armor-popover tooltip with the full date on hover/focus.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EASE_OUT_QUINT } from '@/styles/tokens';
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
const MAX_BAR = 78;
const SERIES = 'var(--color-viz-1)';

/** A friendly top gridline: 1, 2, 5, 10, 20, 50… at or above `max`. */
function niceCeil(max: number): number {
  if (max <= 4) return Math.max(1, max);
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 5, 10]) if (step * pow >= max) return step * pow;
  return 10 * pow;
}

function DueForecastInner({ counts, todayStart, newCount = 0, className }: DueForecastProps) {
  const reduceMotion = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const top = niceCeil(Math.max(1, ...counts));
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
  const gridlines = top % 2 === 0 ? [1, 0.5] : [1];

  return (
    <figure className={cn('armor-panel chamfer-md p-4', className)}>
      <figcaption className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <span className="min-w-0">
          <span className="engraved block font-display text-2xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">Next {counts.length} days</span>
          <span className="mt-1 block text-sm font-semibold text-fg">Reviews due</span>
        </span>
        <span className="font-mono text-xs text-fg-subtle tabular">
          <span className="text-fg">{total}</span> scheduled
          {newCount > 0 ? (
            <>
              {' · '}
              <span className="text-fg">{newCount}</span> new waiting
            </>
          ) : null}
        </span>
      </figcaption>

      <div className="relative mt-4 font-mono">
        {/* Plot */}
        <div className="relative ml-7 h-28" role="img" aria-label={`Reviews due. ${summary}`}>
          {gridlines.map((g) => (
            <div
              key={g}
              aria-hidden
              className="absolute inset-x-0 border-t border-line"
              style={{ bottom: `${g * MAX_BAR}%` }}
            >
              <span className="absolute -left-7 w-5 -translate-y-1/2 text-right text-2xs text-fg-subtle tabular">
                {Math.round(top * g)}
              </span>
            </div>
          ))}
          <div aria-hidden className="absolute inset-x-0 bottom-0 border-t border-line-strong" />
          {total === 0 && (
            <div className="absolute inset-x-0 top-1/3 flex items-center justify-center gap-1.5 font-sans text-xs text-fg-subtle">
              <CalendarClock size={14} strokeWidth={1.75} aria-hidden />
              Nothing scheduled this week
            </div>
          )}
          <div className="absolute inset-0 flex items-stretch gap-2">
            {days.map((day, i) => {
              const height = (day.count / top) * MAX_BAR;
              const active = hover === i;
              return (
                <div
                  key={day.ms}
                  className="relative flex flex-1 items-end justify-center"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                >
                  {active && <div aria-hidden className="absolute inset-y-0 -inset-x-1 chamfer-xs bg-surface-hover" />}
                  <motion.div
                    initial={reduceMotion ? false : { height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: 0.5, delay: reduceMotion ? 0 : i * 0.035, ease: EASE_OUT_QUINT }}
                    className="relative w-full max-w-7 chamfer [--cut:4px] [--cut-bl:0px] [--cut-br:0px] transition-opacity duration-120"
                    style={{
                      background: SERIES,
                      opacity: day.count === 0 ? 0 : i === 0 || active ? 1 : 0.62,
                      boxShadow: i === 0 && day.count > 0 ? '0 0 16px -4px var(--color-viz-1)' : undefined,
                    }}
                  />
                  {day.count > 0 && (
                    <span
                      className={cn(
                        'pointer-events-none absolute inset-x-0 text-center text-2xs tabular',
                        i === 0 || active ? 'text-fg' : 'text-fg-muted'
                      )}
                      style={{ bottom: `calc(${height}% + 4px)` }}
                    >
                      {day.count}
                    </span>
                  )}
                  {active && (
                    <div
                      role="tooltip"
                      className={cn(
                        'armor-popover chamfer-sm pointer-events-none absolute bottom-full z-10 mb-2 animate-scale-in whitespace-nowrap px-3 py-2 text-xs',
                        i === 0 ? 'left-0' : i === days.length - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                      )}
                    >
                      <div className="hud-label mb-1">{day.full}</div>
                      <div className="flex items-center gap-2">
                        <span aria-hidden className="size-2 rounded-full" style={{ background: SERIES }} />
                        <span className="font-sans text-fg-muted">Due</span>
                        <span className="ml-auto pl-3 text-fg tabular">{day.count}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Ticks */}
        <div className="ml-7 mt-2 flex gap-2">
          {days.map((day, i) => (
            <span
              key={day.ms}
              className={cn('flex-1 truncate text-center text-2xs', i === 0 ? 'font-medium text-fg' : 'text-fg-subtle')}
            >
              {day.short}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}

export const DueForecast = memo(DueForecastInner);
