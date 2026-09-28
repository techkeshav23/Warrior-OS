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
import { ArrowLeftRight, CircleCheck, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
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
      <div className="flex h-6 items-center justify-between gap-2">
        <p className="min-w-0 truncate text-ui text-fg-muted">
          {spec.verb} <span className="tabular font-semibold text-fg">{target}</span> {spec.unit}
        </p>
        <div className="-mr-1 flex shrink-0 items-center opacity-0 transition-opacity duration-120 focus-within:opacity-100 group-hover:opacity-100">
          <IconButton
            icon={ArrowLeftRight}
            size="xs"
            onClick={() => setKind(OTHER_KIND[kind])}
            aria-label={`Switch the daily goal to ${other.verb.toLowerCase()} ${other.unit}`}
            tooltip={`Switch to: ${other.verb} ${other.unit}`}
          />
          <IconButton
            icon={Minus}
            size="xs"
            onClick={() => setTarget(kind, target - spec.step)}
            disabled={target <= spec.min}
            aria-label="Lower daily goal"
          />
          <IconButton
            icon={Plus}
            size="xs"
            onClick={() => setTarget(kind, target + spec.step)}
            disabled={target >= spec.max}
            aria-label="Raise daily goal"
          />
        </div>
      </div>

      <ProgressBar
        value={progress}
        max={target}
        size="md"
        tone={complete ? 'success' : 'accent'}
        glow={complete}
        animated={false}
        aria-label={`Daily goal: ${spec.verb.toLowerCase()} ${target} ${spec.unit}`}
        className="mt-2"
      />

      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        {complete ? (
          <span className="flex shrink-0 items-center gap-1.5 font-medium text-success">
            <CircleCheck size={14} strokeWidth={2} aria-hidden="true" />
            Goal crushed · <span className="tabular">{progress}</span> {spec.shortUnit}
          </span>
        ) : (
          <span className="tabular shrink-0 font-mono text-fg-subtle">
            <span className="text-fg">{progress}</span>/{target} {spec.shortUnit} · {pct}%
          </span>
        )}
        <span className="truncate text-fg-subtle">{detail}</span>
      </div>

      <p className={cn('mt-1 truncate text-xs', habitsToday.total > 0 ? 'text-fg-subtle' : 'text-fg-faint')}>
        {habitsToday.total > 0 ? (
          <>
            Habits <span className="tabular text-fg-muted">{habitsToday.done}/{habitsToday.total}</span> today
          </>
        ) : (
          'No habits yet · add some in Quest Planner'
        )}
      </p>
    </div>
  );
}

export const TargetWidget = memo(TargetWidgetInner);
