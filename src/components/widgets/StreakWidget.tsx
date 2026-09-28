// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Streak Widget
// Pulsing flame + current streak in days, computed from Habit
// Forge with the same rule as Stats Center's StreakBoard. The flame
// burns hotter (faster pulse) as the streak grows and goes cold at 0.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/** Primitive props so memo() skips the minute-tick re-renders. */
interface StreakWidgetProps {
  current: number;
  longest: number;
  doneToday: boolean;
}

function pulseSeconds(days: number): number {
  if (days >= 30) return 0.9;
  if (days >= 7) return 1.2;
  if (days >= 3) return 1.5;
  return 1.9;
}

function StreakWidgetInner({ current, longest, doneToday }: StreakWidgetProps) {
  const lit = current > 0;

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
        {lit && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-1 rounded-full bg-orange-500/30 blur-md"
            animate={{ opacity: [0.35, 0.8, 0.35], scale: [0.9, 1.15, 0.9] }}
            transition={{ duration: pulseSeconds(current), repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <motion.span
          aria-hidden="true"
          className={cn('relative text-3xl leading-none', !lit && 'grayscale opacity-40')}
          animate={lit ? { scale: [1, 1.12, 1], rotate: [0, -4, 4, 0] } : { scale: 1, rotate: 0 }}
          transition={lit ? { duration: pulseSeconds(current), repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
        >
          🔥
        </motion.span>
      </div>

      <div className="min-w-0">
        <p className="flex items-baseline gap-1.5">
          <span
            className={cn(
              'font-display text-3xl font-bold tabular-nums leading-none',
              lit ? 'text-orange-300' : 'text-text-secondary'
            )}
          >
            {current}
          </span>
          <span className="font-mono text-xs text-orange-200/70">{current === 1 ? 'day' : 'days'}</span>
        </p>
        <p className="mt-1 truncate font-mono text-[10px] text-text-secondary">
          {lit
            ? doneToday
              ? `Today counted · best ${longest}d`
              : `Keep it alive today · best ${longest}d`
            : longest > 0
              ? `Streak cold · best ${longest}d`
              : 'Tick a habit to ignite'}
        </p>
      </div>
    </div>
  );
}

export const StreakWidget = memo(StreakWidgetInner);
