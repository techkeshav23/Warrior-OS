// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Heatmap Calendar
// GitHub-style activity calendar for the last 26 weeks (a column per
// week, Monday on top): cards answered plus habits ticked each day,
// on a single-hue plasma scale. Live: it follows new answers, quizzes
// and habit check-ins.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui';
import { useLearningStore } from '@/stores/useLearningStore';
import { useQuizHistoryStore } from '@/stores/useQuizHistoryStore';
import { useHabits, useNow } from '@/components/widgets/hooks';
import { utcDayKey } from '@/components/widgets/widget-data';
import { HEATMAP_WEEKS, buildActivityCalendar, type ActivityCell } from './learning-stats';

/** Plasma single-hue ramp (fixed hue: charts never follow the user accent). */
const LEVEL_CLASS = [
  'bg-steel-900 shadow-[inset_0_1px_0_rgb(0_0_0/0.6)]',
  'bg-plasma-600/35',
  'bg-plasma-500/55',
  'bg-plasma-400/80',
  'bg-plasma-300',
] as const;

const ROW_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''] as const;

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

  const totals = useMemo(() => {
    let cards = 0;
    let ticks = 0;
    for (const week of calendar.weeks) {
      for (const cell of week) {
        cards += cell.cards;
        ticks += cell.habits;
      }
    }
    return { cards, ticks };
  }, [calendar]);

  // Month label on the column where a month begins.
  const monthMarks = calendar.weeks.map((week, i) => {
    const start = week.find((c) => c.key.endsWith('-01'));
    if (start) return format(parseISO(start.key), 'MMM');
    return i === 0 && week[0] ? format(parseISO(week[0].key), 'MMM') : '';
  });
  if (monthMarks[0] && (monthMarks[1] || monthMarks[2])) monthMarks[0] = '';

  return (
    <Card
      eyebrow={`${HEATMAP_WEEKS} weeks`}
      title="Activity"
      role="region"
      aria-label="Activity calendar"
      actions={
        <div className="flex items-center gap-1.5 font-mono text-2xs text-fg-subtle" aria-hidden="true">
          <span className="mr-0.5">Less</span>
          {LEVEL_CLASS.map((cls) => (
            <span key={cls} className={cn('chamfer size-2.5 [--cut:2px]', cls)} />
          ))}
          <span className="ml-0.5">More</span>
        </div>
      }
    >
      <div className="flex flex-col gap-5 @3xl:flex-row @3xl:items-end">
        <div
          className="w-full min-w-0 max-w-[720px]"
          role="img"
          aria-label={`${calendar.activeDays} active days in the last ${HEATMAP_WEEKS} weeks. Hover a day for its cards and habits.`}
        >
          <div
            className="grid grid-flow-col gap-[3px]"
            style={{
              gridTemplateColumns: `auto repeat(${Math.max(calendar.weeks.length, 1)}, minmax(0, 1fr))`,
              gridTemplateRows: 'auto repeat(7, auto)',
            }}
          >
            <span />
            {ROW_LABELS.map((label, i) => (
              <span key={i} className="self-center pr-1.5 font-mono text-[10px] leading-3 text-fg-subtle">
                {label}
              </span>
            ))}
            {calendar.weeks.map((week, wi) => (
              <WeekColumn key={week[0]?.key ?? wi} week={week} month={monthMarks[wi]} todayKey={todayKey} />
            ))}
          </div>
        </div>

        <dl className="grid shrink-0 grid-cols-3 gap-4 @3xl:ml-auto @3xl:grid-cols-1 @3xl:gap-3 @3xl:border-l @3xl:border-line @3xl:pl-5">
          <Stat label="Active days" value={calendar.activeDays} />
          <Stat label="Cards" value={totals.cards} />
          <Stat label="Habit ticks" value={totals.ticks} />
        </dl>
      </div>
    </Card>
  );
}

function WeekColumn({ week, month, todayKey }: { week: ActivityCell[]; month: string; todayKey: string }) {
  return (
    <>
      <span className="h-4 whitespace-nowrap font-mono text-[10px] leading-4 text-fg-subtle">{month}</span>
      {week.map((cell) =>
        cell.future ? (
          <span key={cell.key} className="aspect-square w-full" />
        ) : (
          <span
            key={cell.key}
            title={cellTitle(cell)}
            className={cn(
              'chamfer aspect-square w-full transition-transform duration-120 ease-out-quint [--cut:2.5px] hover:scale-110',
              LEVEL_CLASS[cell.level],
              cell.key === todayKey && 'shadow-[inset_0_0_0_1.5px_var(--color-fg)]'
            )}
          />
        )
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <dt className="hud-label truncate">{label}</dt>
      <dd className="tabular mt-1 font-display text-xl font-semibold leading-none text-fg">{value.toLocaleString()}</dd>
    </div>
  );
}

export const HeatmapCalendar = memo(HeatmapCalendarInner);
