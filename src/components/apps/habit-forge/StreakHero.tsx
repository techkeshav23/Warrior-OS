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
import { BEVEL_SUNK, ENGRAVED_LABEL, SLOT_FILL } from '@/components/ui/armor';
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

// A forged plaque: bigger rivets set further in, a heavier cut.
const PLAQUE = { '--rivet-inset': '9px', '--cut': '12px' } as CSSProperties;

// Chain links are slanted forged segments.
const LINK_CUT = '[clip-path:polygon(4px_0,100%_0,calc(100%-4px)_100%,0_100%)]';

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
    <Card tone="ember" rivets padding="lg" style={PLAQUE} role="region" aria-label="Study streak">
      <div className="flex flex-col gap-5 @xl:flex-row @xl:items-center @xl:gap-6">
        {/* Flame + count */}
        <div className="flex shrink-0 items-center gap-4" title={STREAK_HINT}>
          <span
            className={cn(
              'chamfer relative flex size-16 shrink-0 items-center justify-center [--cut:14px]',
              lit
                ? 'bg-[radial-gradient(circle_at_50%_70%,var(--color-ember-500)_0%,var(--color-ember-700)_45%,var(--color-steel-900)_80%)] text-ember-100 shadow-[inset_0_1px_0_rgb(255_220_190/0.35),inset_0_-2px_0_var(--color-ember-300)]'
                : cn(SLOT_FILL, BEVEL_SUNK, 'text-fg-subtle')
            )}
            aria-hidden
          >
            <Flame size={30} strokeWidth={1.75} className={lit ? 'fill-ember-300/40 drop-shadow-[0_0_6px_var(--color-ember-400)]' : undefined} />
          </span>
          <div className="min-w-0">
            <p className={cn(ENGRAVED_LABEL, 'text-ember-300')}>Study streak</p>
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
            <span className={ENGRAVED_LABEL}>
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
                  'h-7 min-w-0 flex-1 transition-colors duration-180 ease-out-quint',
                  LINK_CUT,
                  i < chain.length - recent.length && 'hidden @5xl:block',
                  link.active
                    ? 'bg-linear-to-t from-ember-700 via-ember-500 to-ember-300 shadow-[inset_0_1px_0_rgb(255_240_220/0.5)]'
                    : link.isToday
                      ? 'animate-pulse-soft bg-ember-500/15 shadow-[inset_0_-2px_0_var(--color-ember-500)]'
                      : cn(SLOT_FILL, BEVEL_SUNK)
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
