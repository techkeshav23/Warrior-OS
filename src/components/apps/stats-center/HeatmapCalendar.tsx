// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Heatmap Calendar
// GitHub-style activity calendar for the last 26 weeks (a column per
// week, Monday on top): cards answered plus habits ticked each day.
// Live: it follows new answers, quizzes and habit check-ins.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useLearningStore } from '@/stores/useLearningStore';
import { useQuizHistoryStore } from '@/stores/useQuizHistoryStore';
import { useHabits, useNow } from '@/components/widgets/hooks';
import { utcDayKey } from '@/components/widgets/widget-data';
import { HEATMAP_WEEKS, buildActivityCalendar, type ActivityCell } from './learning-stats';

const LEVEL_CLASS = ['bg-white/5', 'bg-cyan-700/35', 'bg-cyan-600/50', 'bg-cyan-500/70', 'bg-cyan-400'] as const;

function cellTitle(cell: ActivityCell): string {
  const day = format(parseISO(cell.key), 'EEE, d MMM yyyy');
  if (cell.cards + cell.habits === 0) return `${day}: no activity`;
  const parts: string[] = [];
  if (cell.cards > 0) parts.push(`${cell.cards} ${cell.cards === 1 ? 'card' : 'cards'}`);
  if (cell.habits > 0) parts.push(`${cell.habits} ${cell.habits === 1 ? 'habit' : 'habits'}`);
  return `${day}: ${parts.join(' · ')}`;
}

function HeatmapCalendarInner() {
  const habits = useHabits();
  const cardAttempts = useLearningStore((s) => s.attempts);
  const quizAttempts = useQuizHistoryStore((s) => s.attempts);
  const now = useNow(60_000);
  const todayKey = utcDayKey(now);

  const calendar = useMemo(
    () => buildActivityCalendar(habits, cardAttempts, quizAttempts, todayKey),
    [habits, cardAttempts, quizAttempts, todayKey]
  );

  return (
    <section className="p-4 rounded-xl border border-white/10 bg-black/20" aria-label="Activity calendar">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="text-xs text-white/60">Activity · {HEATMAP_WEEKS} weeks</p>
        <p className="text-[10px] text-white/40">
          {calendar.activeDays} active {calendar.activeDays === 1 ? 'day' : 'days'}
        </p>
      </div>

      <div
        className="flex gap-[2px]"
        role="img"
        aria-label={`${calendar.activeDays} active days in the last ${HEATMAP_WEEKS} weeks. Hover a day for its cards and habits.`}
      >
        {calendar.weeks.map((week) => (
          <div key={week[0]?.key} className="flex flex-col gap-[2px]">
            {week.map((cell) =>
              cell.future ? (
                <div key={cell.key} className="h-2.5 w-2.5" />
              ) : (
                <div
                  key={cell.key}
                  title={cellTitle(cell)}
                  className={cn(
                    'h-2.5 w-2.5 rounded-[2px]',
                    LEVEL_CLASS[cell.level],
                    cell.key === todayKey && 'ring-1 ring-white/40'
                  )}
                />
              )
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-white/35" aria-hidden="true">
        <span className="mr-0.5">Less</span>
        {LEVEL_CLASS.map((cls) => (
          <span key={cls} className={cn('h-2.5 w-2.5 rounded-[2px]', cls)} />
        ))}
        <span className="ml-0.5">More</span>
      </div>
    </section>
  );
}

export const HeatmapCalendar = memo(HeatmapCalendarInner);
