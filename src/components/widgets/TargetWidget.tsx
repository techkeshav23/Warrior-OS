// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Daily Goal Widget
// One editable goal for the day: review N cards (any answered card
// in Training Grounds counts: quiz, mock test or flashcard review) or
// focus N minutes (tracked study time or finished NEXUS focus
// sessions, whichever is higher, so nothing counts twice). Also shows
// today's accuracy or focus sessions and the habit check-ins. Hitting
// the goal once per day awards a small XP bonus, makes NEXUS cheer
// and unlocks the "Target Crushed" achievement.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, CircleCheck, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAchievementProgressStore } from '@/components/achievements/progress-store';
import { useLearningStore } from '@/stores/useLearningStore';
import { useNexusStore } from '@/stores/useNexusStore';
import { useXPStore } from '@/stores/useXPStore';
import { nexusSay, unlockAchievementWhenReady } from './os-events';
import { DAILY_GOALS, useWidgetStore, type DailyGoalKind } from './useWidgetStore';
import { cardsAnsweredOn, habitsDoneOn, type HabitSnapshot } from './widget-data';

export const TARGET_ACHIEVEMENT_ID = 'target-crushed';
export const DAILY_TARGET_XP = 25;

interface TargetWidgetProps {
  habits: HabitSnapshot[];
  /** Current UTC day key (YYYY-MM-DD) */
  dayKey: string;
}

const OTHER_KIND: Record<DailyGoalKind, DailyGoalKind> = { cards: 'focus', focus: 'cards' };

function TargetWidgetInner({ habits, dayKey }: TargetWidgetProps) {
  const kind = useWidgetStore((s) => s.dailyGoalKind);
  const target = useWidgetStore((s) => s.dailyGoalTargets[s.dailyGoalKind]);
  const setKind = useWidgetStore((s) => s.setDailyGoalKind);
  const setTarget = useWidgetStore((s) => s.setDailyGoalTarget);
  const everCrushed = useWidgetStore((s) => s.lastCelebratedDay !== null);

  // Card answers (every source) and today's focus minutes, as primitives or stable arrays.
  const attempts = useLearningStore((s) => s.attempts);
  const studyMinutes = useAchievementProgressStore((s) => s.studyMinutesByDay[dayKey] ?? 0);
  const timerMinutes = useNexusStore((s) => (s.pomodoro.dayKey === dayKey ? s.pomodoro.focusMinutesToday : 0));
  const sessions = useNexusStore((s) => (s.pomodoro.dayKey === dayKey ? s.pomodoro.completedToday : 0));

  const cards = useMemo(() => cardsAnsweredOn(attempts, dayKey), [attempts, dayKey]);
  const habitsToday = useMemo(() => habitsDoneOn(habits, dayKey), [habits, dayKey]);

  const spec = DAILY_GOALS[kind];
  const other = DAILY_GOALS[OTHER_KIND[kind]];
  const progress = kind === 'cards' ? cards.answered : Math.max(studyMinutes, timerMinutes);
  const complete = progress >= target;
  const pct = Math.min(100, Math.round((progress / target) * 100));
  const accuracy = cards.answered > 0 ? Math.round((cards.correct / cards.answered) * 100) : null;

  // Celebrate the first time today's goal is reached (once per UTC day, whichever kind).
  useEffect(() => {
    if (!dayKey || progress < target) return;
    const widgets = useWidgetStore.getState();
    if (widgets.lastCelebratedDay === dayKey) return;
    widgets.markCelebrated(dayKey);
    useXPStore.getState().addXP(DAILY_TARGET_XP, 'daily-target');
    nexusSay(
      `Daily goal crushed! ${progress} ${spec.unit} today. Discipline machine. +${DAILY_TARGET_XP} XP`,
      'success'
    );
  }, [dayKey, progress, target, spec.unit]);

  // First crushed day ever → achievement (waits for the list to be seeded).
  useEffect(() => {
    if (!everCrushed) return;
    return unlockAchievementWhenReady(TARGET_ACHIEVEMENT_ID);
  }, [everCrushed]);

  const detail =
    kind === 'cards'
      ? accuracy === null
        ? 'no cards yet'
        : `${accuracy}% acc`
      : sessions > 0
        ? `${sessions} focus ${sessions === 1 ? 'session' : 'sessions'}`
        : progress > 0
          ? 'tracked study time'
          : 'no focus yet';

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-text-primary">
          {spec.verb} <span className="font-mono font-semibold text-accent-primary">{target}</span> {spec.unit}
        </p>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={() => setKind(OTHER_KIND[kind])}
            aria-label={`Switch the daily goal to ${other.verb.toLowerCase()} ${other.unit}`}
            title={`Switch to: ${other.verb} ${other.unit}`}
            className="rounded p-0.5 text-text-secondary hover:bg-white/10 hover:text-text-primary focus-ring"
          >
            <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setTarget(kind, target - spec.step)}
            disabled={target <= spec.min}
            aria-label="Lower daily goal"
            className="rounded p-0.5 text-text-secondary hover:bg-white/10 hover:text-text-primary disabled:opacity-30 focus-ring"
          >
            <Minus className="h-3 w-3" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setTarget(kind, target + spec.step)}
            disabled={target >= spec.max}
            aria-label="Raise daily goal"
            className="rounded p-0.5 text-text-secondary hover:bg-white/10 hover:text-text-primary disabled:opacity-30 focus-ring"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-label={`Daily goal: ${spec.verb.toLowerCase()} ${target} ${spec.unit}`}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(progress, target)}
      >
        <motion.div
          className={cn('h-full rounded-full', complete ? 'bg-accent-success' : 'bg-accent-primary')}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22 }}
          style={{ boxShadow: complete ? '0 0 10px rgba(0,230,118,0.6)' : '0 0 8px rgba(0,240,255,0.35)' }}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 font-mono text-[10px]">
        {complete ? (
          <span className="flex shrink-0 items-center gap-1 text-accent-success">
            <CircleCheck className="h-3 w-3" aria-hidden="true" />
            Goal crushed · {progress} {spec.shortUnit}
          </span>
        ) : (
          <span className="shrink-0 text-text-secondary">
            <span className="text-text-primary">{progress}</span>/{target} {spec.shortUnit} · {pct}%
          </span>
        )}
        <span className="truncate text-text-secondary">{detail}</span>
      </div>

      <p className="mt-0.5 truncate font-mono text-[10px] text-text-secondary">
        {habitsToday.total > 0
          ? `Habits ${habitsToday.done}/${habitsToday.total} today`
          : 'No habits yet · add some in Quest Planner'}
      </p>
    </div>
  );
}

export const TargetWidget = memo(TargetWidgetInner);
