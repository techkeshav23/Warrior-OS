// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Streak Board
// Study streak with a flame: a UTC day counts when you studied at
// all (cards, quizzes, habits, routines, notes, focused time), the
// same rule the streak achievements and the terminal use. The habit
// streak from the desktop widget sits beside it, over a 28-day chain.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui';
import { collectStudyDays } from '@/components/achievements/study-streak';
import { currentStreak, longestStreak } from '@/components/achievements/day-streak';
import { useAchievementProgressStore } from '@/components/achievements/progress-store';
import { useLearningStore } from '@/stores/useLearningStore';
import { useQuizHistoryStore } from '@/stores/useQuizHistoryStore';
import { useHabits, useNow } from '@/components/widgets/hooks';
import { computeStreak, utcDayKey } from '@/components/widgets/widget-data';
import { shiftDayKey } from './learning-stats';

/** Habits, routines and notes live in localStorage: re-read on this beat too. */
const STREAK_REFRESH_MS = 30_000;
/** Days in the chain under the numbers. */
const CHAIN_DAYS = 28;

interface StudyStreak {
  current: number;
  longest: number;
  /** Last CHAIN_DAYS days, oldest first: '1' studied, '0' not. */
  recent: string;
}

function readStudyStreak(): StudyStreak {
  const days = collectStudyDays();
  const current = currentStreak(days);
  const today = utcDayKey(Date.now());
  let recent = '';
  for (let i = CHAIN_DAYS - 1; i >= 0; i--) recent += days.has(shiftDayKey(today, -i)) ? '1' : '0';
  return { current, longest: Math.max(current, longestStreak(days)), recent };
}

/** The OS-wide study streak, kept fresh while the board is open. */
function useStudyStreak(): StudyStreak {
  const [streak, setStreak] = useState(readStudyStreak);

  useEffect(() => {
    const refresh = () => {
      const next = readStudyStreak();
      setStreak((prev) =>
        prev.current === next.current && prev.longest === next.longest && prev.recent === next.recent ? prev : next
      );
    };
    const unsubscribers = [
      useQuizHistoryStore.subscribe(refresh),
      useAchievementProgressStore.subscribe(refresh),
      useLearningStore.subscribe((state, prev) => {
        if (state.attempts !== prev.attempts) refresh();
      }),
    ];
    const timer = window.setInterval(refresh, STREAK_REFRESH_MS);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return streak;
}

function StreakBoardInner() {
  const { current, longest, recent } = useStudyStreak();
  const habits = useHabits();
  const now = useNow(60_000);
  const reduceMotion = useReducedMotion();
  const dayKey = utcDayKey(now);
  const habitStreak = useMemo(
    () => computeStreak(habits, Date.parse(`${dayKey}T12:00:00Z`)).current,
    [habits, dayKey]
  );
  const lit = current > 0;
  const litDays = [...recent].filter((c) => c === '1').length;

  return (
    <Card tone="ember" padding="md" role="region" aria-label="Study streak" className="h-full">
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className={cn(
            'chamfer flex size-12 shrink-0 items-center justify-center [--cut:10px]',
            lit
              ? 'bg-[radial-gradient(circle_at_50%_70%,var(--color-ember-500)_0%,var(--color-ember-700)_45%,var(--color-steel-900)_80%)] text-ember-100 shadow-[inset_0_1px_0_rgb(255_220_190/0.35),inset_0_-2px_0_var(--color-ember-300)]'
              : 'bg-linear-to-b from-steel-950 to-steel-900 text-fg-subtle shadow-[inset_0_1px_0_rgb(0_0_0/0.7),inset_0_-1px_0_rgb(255_255_255/0.07)]'
          )}
        >
          <Flame size={22} strokeWidth={1.75} className={lit ? 'fill-ember-300/40' : undefined} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="engraved font-display text-2xs font-semibold uppercase tracking-[0.18em] text-ember-300">Study streak</p>
          <p className="mt-1.5 flex items-baseline gap-1.5 leading-none">
            <motion.span
              key={current}
              className={cn('tabular font-display text-3xl font-semibold', lit ? 'text-ember-400' : 'text-fg-muted')}
              initial={reduceMotion ? false : { opacity: 0.4, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            >
              {current}
            </motion.span>
            <span className="text-sm text-fg-muted">{current === 1 ? 'day' : 'days'}</span>
          </p>
        </div>
        <dl className="flex shrink-0 gap-4 text-right">
          <div>
            <dt className="hud-label">Best</dt>
            <dd className="tabular mt-1 font-mono text-sm font-medium text-fg">{longest}d</dd>
          </div>
          <div>
            <dt className="hud-label">Habits</dt>
            <dd className="tabular mt-1 font-mono text-sm font-medium text-fg">{habitStreak}d</dd>
          </div>
        </dl>
      </div>

      <ol
        className="mt-4 flex gap-[2px]"
        aria-label={`${litDays} of the last ${CHAIN_DAYS} days had study activity`}
      >
        {[...recent].map((c, i) => (
          <li
            key={i}
            className={cn(
              'h-3 min-w-0 flex-1 [clip-path:polygon(3px_0,100%_0,calc(100%-3px)_100%,0_100%)]',
              c === '1'
                ? 'bg-linear-to-t from-ember-700 via-ember-500 to-ember-300'
                : i === CHAIN_DAYS - 1
                  ? 'animate-pulse-soft bg-ember-500/15 shadow-[inset_0_-2px_0_var(--color-ember-500)]'
                  : 'bg-steel-900 shadow-[inset_0_1px_0_rgb(0_0_0/0.7)]'
            )}
          />
        ))}
      </ol>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs">
        <span className="truncate text-fg-subtle">
          {lit ? 'Keep going. Every day counts.' : 'Answer a card, tick a habit or write a note to light it up.'}
        </span>
        <span className="tabular shrink-0 font-mono text-2xs text-fg-subtle">{CHAIN_DAYS} days</span>
      </div>
    </Card>
  );
}

export const StreakBoard = memo(StreakBoardInner);
