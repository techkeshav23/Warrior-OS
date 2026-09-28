// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Habit Forge streak hero
// The study streak as the forge's centrepiece: flame mark, day count,
// best run, and the last 14 days as a chain of ember links (today
// dashed until it's lit).
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui';
import { shortDate } from './habit-utils';

export interface ChainLink {
  key: string;
  active: boolean;
  isToday: boolean;
}

interface StreakHeroProps {
  streak: number;
  best: number;
  chain: readonly ChainLink[];
}

const EMBER_CORNERS = {
  '--hud-corner-color': 'color-mix(in oklab, var(--color-ember-400) 55%, transparent)',
} as CSSProperties;

const STREAK_HINT =
  'Days in a row with study activity: quizzes, revisions, planner tasks, habits, routines, notes or 10+ minutes in study apps';

function StreakHeroInner({ streak, best, chain }: StreakHeroProps) {
  const reduceMotion = useReducedMotion();
  const lit = streak > 0;
  const activeCount = chain.filter((c) => c.active).length;
  // Narrow windows show the last 14 links; wide ones the whole chain.
  const recent = chain.slice(-14);
  const recentActive = recent.filter((c) => c.active).length;

  return (
    <Card tone="ember" hud padding="lg" style={EMBER_CORNERS} role="region" aria-label="Study streak">
      <div className="flex flex-col gap-5 @xl:flex-row @xl:items-center @xl:gap-6">
        {/* Flame + count */}
        <div className="flex shrink-0 items-center gap-4" title={STREAK_HINT}>
          <span
            className={cn(
              'relative flex size-14 shrink-0 items-center justify-center rounded-card border',
              lit
                ? 'border-ember-500/40 bg-linear-to-b from-ember-500/25 to-ember-600/5 text-ember-400 shadow-[0_0_28px_-6px_var(--color-ember-500)]'
                : 'border-line-strong bg-ink-800 text-fg-subtle'
            )}
            aria-hidden
          >
            <Flame size={28} strokeWidth={1.75} className={lit ? 'fill-ember-500/25' : undefined} />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-2xs font-medium uppercase tracking-[0.14em] text-ember-300">Study streak</p>
            <p className="mt-1 flex items-baseline gap-2 leading-none">
              <motion.span
                key={streak}
                initial={reduceMotion ? false : { opacity: 0.4, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                className={cn('tabular font-display text-4xl font-semibold', lit ? 'text-ember-400' : 'text-fg-muted')}
              >
                {streak}
              </motion.span>
              <span className="text-sm text-fg-muted">{streak === 1 ? 'day' : 'days'}</span>
            </p>
            <p className="mt-2 text-xs text-fg-subtle">
              Best <span className="tabular font-mono text-fg-muted">{best}</span> {best === 1 ? 'day' : 'days'}
            </p>
          </div>
        </div>

        {/* Chain: the last 14 days, or all of them in wide windows */}
        <div className="min-w-0 flex-1 @xl:border-l @xl:border-line @xl:pl-6">
          <div className="flex items-baseline justify-between gap-3">
            <span className="hud-label">
              Last <span className="@5xl:hidden">{recent.length}</span>
              <span className="hidden @5xl:inline">{chain.length}</span> days
            </span>
            <span className="tabular font-mono text-xs text-fg-muted">
              <span className="@5xl:hidden">
                {recentActive}/{recent.length}
              </span>
              <span className="hidden @5xl:inline">
                {activeCount}/{chain.length}
              </span>{' '}
              lit
            </span>
          </div>
          <ol className="mt-2.5 flex gap-1" aria-label={`${activeCount} of the last ${chain.length} days had study activity`}>
            {chain.map((link, i) => (
              <li
                key={link.key}
                title={`${shortDate(link.key)}${link.isToday ? ' (today)' : ''}: ${link.active ? 'studied' : 'no activity yet'}`}
                className={cn(
                  'h-7 min-w-0 flex-1 rounded-[4px] transition-colors duration-180 ease-out-quint',
                  i < chain.length - recent.length && 'hidden @5xl:block',
                  link.active
                    ? 'bg-linear-to-t from-ember-600 to-ember-400 shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]'
                    : link.isToday
                      ? 'border border-dashed border-ember-500/60 bg-ember-500/5'
                      : 'bg-ink-700/80'
                )}
              />
            ))}
          </ol>
          <div className="mt-1.5 flex justify-between font-mono text-2xs text-fg-subtle">
            <span>
              <span className="@5xl:hidden">{recent.length > 0 ? shortDate(recent[0].key) : ''}</span>
              <span className="hidden @5xl:inline">{chain.length > 0 ? shortDate(chain[0].key) : ''}</span>
            </span>
            <span>Today</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export const StreakHero = memo(StreakHeroInner);
