// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Streak Board
// Study streak with a flame: a UTC day counts when you studied at
// all (cards, quizzes, habits, routines, notes, focused time), the
// same rule the streak achievements and the terminal use. The habit
// streak from the desktop widget sits beside it.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { collectStudyDays } from '@/components/achievements/study-streak';
import { currentStreak, longestStreak } from '@/components/achievements/day-streak';
import { useAchievementProgressStore } from '@/components/achievements/progress-store';
import { useLearningStore } from '@/stores/useLearningStore';
import { useQuizHistoryStore } from '@/stores/useQuizHistoryStore';
import { useHabits, useNow } from '@/components/widgets/hooks';
import { computeStreak, utcDayKey } from '@/components/widgets/widget-data';

/** Habits, routines and notes live in localStorage: re-read on this beat too. */
const STREAK_REFRESH_MS = 30_000;

interface StudyStreak {
  current: number;
  longest: number;
}

function readStudyStreak(): StudyStreak {
  const days = collectStudyDays();
  const current = currentStreak(days);
  return { current, longest: Math.max(current, longestStreak(days)) };
}

/** The OS-wide study streak, kept fresh while the board is open. */
function useStudyStreak(): StudyStreak {
  const [streak, setStreak] = useState(readStudyStreak);

  useEffect(() => {
    const refresh = () => {
      const next = readStudyStreak();
      setStreak((prev) => (prev.current === next.current && prev.longest === next.longest ? prev : next));
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
  const { current, longest } = useStudyStreak();
  const habits = useHabits();
  const now = useNow(60_000);
  const dayKey = utcDayKey(now);
  const habitStreak = useMemo(
    () => computeStreak(habits, Date.parse(`${dayKey}T12:00:00Z`)).current,
    [habits, dayKey]
  );

  return (
    <div className="p-4 rounded-xl border border-orange-500/20 bg-gradient-to-r from-orange-500/10 to-red-500/10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-orange-400/60">Study streak</p>
          <div className="flex items-baseline gap-2">
            <motion.span
              className="text-4xl font-black text-orange-300"
              key={current}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
            >
              {current}
            </motion.span>
            <span className="text-sm text-orange-400/60">{current === 1 ? 'day' : 'days'}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/40">Best</p>
          <p className="text-lg font-bold text-white/60">{longest}d</p>
          <p className="text-[10px] text-white/35">Habits {habitStreak}d</p>
        </div>
        <motion.span
          className="text-4xl"
          aria-hidden="true"
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          🔥
        </motion.span>
      </div>
      <p className="text-[10px] text-orange-400/40 mt-2">
        {current > 0
          ? 'Keep going! Every day counts.'
          : 'Answer a card, tick a habit or write a note to light it up.'}
      </p>
    </div>
  );
}

export const StreakBoard = memo(StreakBoardInner);
