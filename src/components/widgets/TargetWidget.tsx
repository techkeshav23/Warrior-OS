// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Today's Target Widget
// Daily question goal with live progress from the quiz history
// store, plus today's accuracy and Habit Forge check-ins. Hitting
// the goal once per day awards a small XP bonus, makes NEXUS cheer
// and unlocks the "Target Crushed" achievement.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CircleCheck, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuizHistoryStore } from '@/stores/useQuizHistoryStore';
import { useXPStore } from '@/stores/useXPStore';
import { nexusSay, unlockAchievementWhenReady } from './os-events';
import { TARGET_MAX, TARGET_MIN, TARGET_STEP, useWidgetStore } from './useWidgetStore';
import { habitsDoneOn, questionsOn, type HabitSnapshot } from './widget-data';

export const TARGET_ACHIEVEMENT_ID = 'target-crushed';
export const DAILY_TARGET_XP = 25;

interface TargetWidgetProps {
  habits: HabitSnapshot[];
  /** Current UTC day key (YYYY-MM-DD) */
  dayKey: string;
}

function TargetWidgetInner({ habits, dayKey }: TargetWidgetProps) {
  const attempts = useQuizHistoryStore((s) => s.attempts);
  const target = useWidgetStore((s) => s.dailyQuestionTarget);
  const setTarget = useWidgetStore((s) => s.setDailyQuestionTarget);
  const everCrushed = useWidgetStore((s) => s.lastCelebratedDay !== null);

  const { solved, correct } = useMemo(() => questionsOn(attempts, dayKey), [attempts, dayKey]);
  const habitsToday = useMemo(() => habitsDoneOn(habits, dayKey), [habits, dayKey]);

  const complete = solved >= target;
  const pct = Math.min(100, Math.round((solved / target) * 100));
  const accuracy = solved > 0 ? Math.round((correct / solved) * 100) : null;

  // Celebrate the first time today's goal is reached (once per UTC day).
  useEffect(() => {
    if (!dayKey || solved < target) return;
    const widgets = useWidgetStore.getState();
    if (widgets.lastCelebratedDay === dayKey) return;
    widgets.markCelebrated(dayKey);
    useXPStore.getState().addXP(DAILY_TARGET_XP, 'daily-target');
    nexusSay(
      `All targets crushed! ${solved} questions today. You're a machine. +${DAILY_TARGET_XP} XP`,
      'success'
    );
  }, [dayKey, solved, target]);

  // First crushed day ever → achievement (waits for the list to be seeded).
  useEffect(() => {
    if (!everCrushed) return;
    return unlockAchievementWhenReady(TARGET_ACHIEVEMENT_ID);
  }, [everCrushed]);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-text-primary">
          Solve <span className="font-mono font-semibold text-accent-primary">{target}</span> GATE questions
        </p>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={() => setTarget(target - TARGET_STEP)}
            disabled={target <= TARGET_MIN}
            aria-label="Lower daily target"
            className="rounded p-0.5 text-text-secondary hover:bg-white/10 hover:text-text-primary disabled:opacity-30 focus-ring"
          >
            <Minus className="h-3 w-3" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setTarget(target + TARGET_STEP)}
            disabled={target >= TARGET_MAX}
            aria-label="Raise daily target"
            className="rounded p-0.5 text-text-secondary hover:bg-white/10 hover:text-text-primary disabled:opacity-30 focus-ring"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-label="Today's question target"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(solved, target)}
      >
        <motion.div
          className={cn('h-full rounded-full', complete ? 'bg-accent-success' : 'bg-accent-primary')}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22 }}
          style={{ boxShadow: complete ? '0 0 10px rgba(0,230,118,0.6)' : '0 0 8px rgba(0,240,255,0.35)' }}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between font-mono text-[10px]">
        {complete ? (
          <span className="flex items-center gap-1 text-accent-success">
            <CircleCheck className="h-3 w-3" aria-hidden="true" />
            Target crushed · {solved}
          </span>
        ) : (
          <span className="text-text-secondary">
            <span className="text-text-primary">{solved}</span>/{target} · {pct}%
          </span>
        )}
        <span className="text-text-secondary">{accuracy === null ? 'no quiz yet' : `${accuracy}% acc`}</span>
      </div>

      <p className="mt-0.5 truncate font-mono text-[10px] text-text-secondary">
        {habitsToday.total > 0
          ? `Habits ${habitsToday.done}/${habitsToday.total} today`
          : 'No habits yet · add some in Habit Forge'}
      </p>
    </div>
  );
}

export const TargetWidget = memo(TargetWidgetInner);
