// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Habit Grid (90-day forge map)
// GitHub-style contribution map of the last 90 UTC days: a column per
// week (Monday on top), a single-hue ember scale by the share of
// habits done, month labels, a legend, and three summary numbers.
// ═══════════════════════════════════════════════════════════

'use client';

import { useMemo, memo } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui';
import { utcDayKey } from '@/components/achievements/award';
import type { Habit } from './HabitForgeApp';
import { lastDays, mondayIndex, monthLabel, shortDate } from './habit-utils';

interface Props {
  habits: Habit[];
}

const DAYS = 90;

/** Ember single-hue ramp: 0 = nothing, 4 = (almost) every habit. */
const LEVEL_CLASS = [
  'bg-steel-900 shadow-[inset_0_1px_0_rgb(0_0_0/0.6)]',
  'bg-ember-600/35',
  'bg-ember-500/55',
  'bg-ember-500/80',
  'bg-linear-to-b from-ember-300 to-ember-500',
] as const;

const LEVEL_LABEL = ['No habits', 'Under 25%', '25–49%', '50–79%', '80% or more'] as const;
const ROW_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''] as const;

interface DayCell {
  date: string;
  count: number;
  level: number;
}

function levelFor(count: number, total: number): number {
  if (count === 0) return 0;
  const pct = count / (total || 1);
  if (pct >= 0.8) return 4;
  if (pct >= 0.5) return 3;
  if (pct >= 0.25) return 2;
  return 1;
}

function HabitGridInner({ habits }: Props) {
  const today = utcDayKey();

  const { weeks, stats } = useMemo(() => {
    const total = habits.length;
    const days: DayCell[] = lastDays(today, DAYS).map((date) => {
      const count = habits.filter((h) => h.completions.includes(date)).length;
      return { date, count, level: levelFor(count, total) };
    });

    // Pad the first week so columns start on Monday.
    const lead = days.length > 0 ? mondayIndex(days[0].date) : 0;
    const padded: (DayCell | null)[] = [...Array<null>(lead).fill(null), ...days];
    const columns: (DayCell | null)[][] = [];
    for (let i = 0; i < padded.length; i += 7) columns.push(padded.slice(i, i + 7));

    let checkIns = 0;
    let active = 0;
    let perfect = 0;
    for (const d of days) {
      checkIns += d.count;
      if (d.count > 0) active++;
      if (total > 0 && d.count === total) perfect++;
    }
    const rate = total > 0 ? Math.round((checkIns / (total * days.length)) * 100) : 0;
    return { weeks: columns, stats: { rate, active, perfect } };
  }, [habits, today]);

  // Month label on the column where a month begins (and on the first column,
  // unless a new month starts right after it and the labels would collide).
  const monthMarks = weeks.map((week, i) => {
    const start = week.find((d) => d !== null && d.date.endsWith('-01'));
    if (start) return monthLabel(start.date);
    const first = week.find((d) => d !== null);
    return i === 0 && first ? monthLabel(first.date) : '';
  });
  if (monthMarks[0] && (monthMarks[1] || monthMarks[2])) monthMarks[0] = '';

  return (
    <Card
      eyebrow="Last 90 days"
      title="Forge map"
      actions={
        <div className="flex items-center gap-1.5 font-mono text-2xs text-fg-subtle" aria-hidden>
          <span className="mr-0.5">Less</span>
          {LEVEL_CLASS.map((cls, i) => (
            <span key={cls} title={LEVEL_LABEL[i]} className={cn('chamfer size-2.5 [--cut:2px]', cls)} />
          ))}
          <span className="ml-0.5">More</span>
        </div>
      }
    >
      <div className="flex flex-col gap-5 @2xl:flex-row @2xl:items-end @2xl:justify-between">
        <div
          className="w-full min-w-0 max-w-[440px]"
          role="img"
          aria-label={`${stats.active} of the last ${DAYS} days had at least one habit done. Hover a day for its count.`}
        >
          <div
            className="grid grid-flow-col gap-1"
            style={{
              gridTemplateColumns: `auto repeat(${weeks.length}, minmax(0, 1fr))`,
              gridTemplateRows: 'auto repeat(7, auto)',
            }}
          >
            {/* Row labels column */}
            <span />
            {ROW_LABELS.map((label, i) => (
              <span key={i} className="self-center pr-1.5 font-mono text-[10px] leading-3 text-fg-subtle">
                {label}
              </span>
            ))}
            {weeks.map((week, wi) => (
              <WeekColumn key={wi} week={week} month={monthMarks[wi]} today={today} total={habits.length} />
            ))}
          </div>
        </div>

        <dl className="grid shrink-0 grid-cols-3 gap-4 @2xl:grid-cols-1 @2xl:gap-3 @2xl:border-l @2xl:border-line @2xl:pl-5">
          <Stat label="Completion" value={`${stats.rate}%`} />
          <Stat label="Perfect days" value={stats.perfect} />
          <Stat label="Active days" value={`${stats.active}`} unit={`/ ${DAYS}`} />
        </dl>
      </div>
    </Card>
  );
}

function WeekColumn({
  week,
  month,
  today,
  total,
}: {
  week: (DayCell | null)[];
  month: string;
  today: string;
  total: number;
}) {
  return (
    <>
      <span className="h-4 whitespace-nowrap font-mono text-[10px] leading-4 text-fg-subtle">{month}</span>
      {Array.from({ length: 7 }, (_, i) => {
        const day = week[i];
        if (!day) return <span key={i} className="aspect-square w-full" />;
        return (
          <span
            key={day.date}
            title={`${shortDate(day.date)}: ${day.count}/${total} habits`}
            className={cn(
              'chamfer aspect-square w-full transition-transform duration-120 ease-out-quint [--cut:2.5px] hover:scale-110',
              LEVEL_CLASS[day.level],
              day.date === today && 'shadow-[inset_0_0_0_1.5px_var(--color-ember-100)]'
            )}
          />
        );
      })}
    </>
  );
}

function Stat({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="min-w-0">
      <dt className="hud-label truncate">{label}</dt>
      <dd className="mt-1 flex items-baseline gap-1 leading-none">
        <span className="tabular font-display text-xl font-semibold text-fg">{value}</span>
        {unit && <span className="tabular font-mono text-xs text-fg-subtle">{unit}</span>}
      </dd>
    </div>
  );
}

export const HabitGrid = memo(HabitGridInner);
