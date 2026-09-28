// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Streak Widget (FORGE HUD)
// Ember flame + current habit streak in days, computed from Habit
// Forge (Stats Center shows the same number as its habit streak), and
// a segmented meter toward the next streak badge. The flame's glow
// breathes faster as the streak grows; it goes cold at 0.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProgressBar } from '@/components/ui/ProgressBar';

/** Primitive props so memo() skips the minute-tick re-renders. */
interface StreakWidgetProps {
  current: number;
  longest: number;
  doneToday: boolean;
}

/** Streak badges (matches the streak achievements) + a long-haul mark. */
const MILESTONES = [3, 7, 30, 100, 365] as const;

function pulseSeconds(days: number): number {
  if (days >= 30) return 1.4;
  if (days >= 7) return 1.9;
  if (days >= 3) return 2.3;
  return 2.8;
}

function StreakWidgetInner({ current, longest, doneToday }: StreakWidgetProps) {
  const lit = current > 0;
  const reduceMotion = useReducedMotion();
  const next = MILESTONES.find((m) => m > current) ?? null;
  const prev = [...MILESTONES].reverse().find((m) => m <= current) ?? 0;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'relative flex size-10 shrink-0 items-center justify-center rounded-card border',
            lit ? 'border-ember-500/35 bg-ember-500/10 text-ember-400' : 'border-line-strong bg-ink-850 text-fg-faint'
          )}
        >
          {lit && !reduceMotion && (
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 rounded-card"
              style={{ boxShadow: '0 0 18px -2px var(--color-ember-500)' }}
              animate={{ opacity: [0.25, 0.7, 0.25] }}
              transition={{ duration: pulseSeconds(current), repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <Flame size={20} strokeWidth={1.75} aria-hidden="true" fill="currentColor" fillOpacity={lit ? 0.22 : 0} className="relative" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-1.5">
            <span
              className={cn(
                'tabular font-display text-2xl font-semibold leading-none',
                lit ? 'text-ember-300' : 'text-fg-muted'
              )}
            >
              {current}
            </span>
            <span className="text-xs text-fg-muted">{current === 1 ? 'day' : 'days'}</span>
          </p>
          <p className="mt-1 truncate text-xs text-fg-subtle">
            {lit
              ? doneToday
                ? 'Today counted'
                : 'Keep it alive today'
              : longest > 0
                ? 'Streak cold'
                : 'Tick a habit to ignite'}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="hud-label">Best</p>
          <p className="tabular mt-1 font-mono text-xs text-fg-muted">{longest}d</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2.5">
        <ProgressBar
          value={next ? current - prev : 1}
          max={next ? next - prev : 1}
          segments={next ? Math.min(next - prev, 10) : 10}
          size="sm"
          tone="ember"
          animated={false}
          aria-label={next ? `Streak progress toward the ${next}-day badge` : 'Every streak badge earned'}
          className="flex-1"
        />
        <span className="tabular shrink-0 font-mono text-2xs text-fg-subtle">
          {next ? `${current}/${next}d` : 'All badges'}
        </span>
      </div>
    </div>
  );
}

export const StreakWidget = memo(StreakWidgetInner);
