// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Agenda Panel
// The selected day's events (click to edit), the next two weeks at
// a glance, and progress towards the Master Planner achievement
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { Bell, CalendarCheck2, CalendarPlus, CalendarRange, Repeat, Trophy } from 'lucide-react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button, EmptyState, ProgressBar } from '@/components/ui';
import type { CalendarOccurrence } from '@/types/calendar';
import { CALENDAR_PLANNER_TARGET } from './calendar-achievements';
import { CALENDAR_CATEGORY_MAP, eventColor, formatTime12 } from './calendar-utils';

interface AgendaPanelProps {
  className?: string;
  selectedDate: string;
  todayKey: string;
  dayOccurrences: readonly CalendarOccurrence[];
  upcoming: readonly CalendarOccurrence[];
  upcomingDays: number;
  plannedCount: number;
  onAdd: (dateKey: string) => void;
  onOpen: (occ: CalendarOccurrence) => void;
}

function relativeDayLabel(dateKey: string, todayKey: string): string {
  const diff = differenceInCalendarDays(parseISO(dateKey), parseISO(todayKey));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return format(parseISO(dateKey), 'EEEE');
}

interface OccurrenceRowProps {
  occ: CalendarOccurrence;
  showDate?: boolean;
  onOpen: (occ: CalendarOccurrence) => void;
}

const OccurrenceRow = memo(function OccurrenceRow({ occ, showDate = false, onOpen }: OccurrenceRowProps) {
  const { event } = occ;
  const meta = CALENDAR_CATEGORY_MAP[event.category];
  const color = eventColor(event.color);
  return (
    <button
      type="button"
      onClick={() => onOpen(occ)}
      className="chamfer-sm focus-ring-inset group/occ flex w-full items-stretch gap-3 px-2 py-2 text-left transition-colors duration-120 ease-out-quint hover:bg-surface-hover active:bg-surface-active"
      aria-label={`${event.title}, ${showDate ? `${format(parseISO(occ.date), 'EEEE d MMMM')}, ` : ''}${
        event.time ? formatTime12(event.time) : 'all day'
      }, ${meta.label}. Edit`}
    >
      {/* Time column */}
      <span className="tabular w-16 shrink-0 pt-px font-mono text-xs leading-5 text-fg-muted">
        {showDate ? (
          <>
            <span className="block text-fg">{format(parseISO(occ.date), 'd MMM')}</span>
            <span className="block text-2xs leading-4 text-fg-subtle">{format(parseISO(occ.date), 'EEE')}</span>
          </>
        ) : event.time ? (
          formatTime12(event.time)
        ) : (
          'All day'
        )}
      </span>
      <span className="w-[3px] shrink-0 [clip-path:polygon(0_0,100%_3px,100%_calc(100%-3px),0_100%)]" style={{ background: color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-ui font-medium text-fg" title={event.title}>
          {event.title}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-subtle">
          {showDate && <span className="tabular font-mono">{event.time ? formatTime12(event.time) : 'All day'}</span>}
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rotate-45" style={{ background: meta.color }} aria-hidden />
            {meta.label}
          </span>
          {event.recurrence !== 'none' && <Repeat size={12} strokeWidth={1.75} aria-hidden />}
          {event.time && event.reminderMinutes !== null && <Bell size={12} strokeWidth={1.75} aria-hidden />}
        </span>
        {event.notes && (
          <span className="mt-0.5 block truncate text-xs text-fg-subtle" title={event.notes}>
            {event.notes}
          </span>
        )}
      </span>
    </button>
  );
});

function AgendaPanelInner({
  className,
  selectedDate,
  todayKey,
  dayOccurrences,
  upcoming,
  upcomingDays,
  plannedCount,
  onAdd,
  onOpen,
}: AgendaPanelProps) {
  const selected = parseISO(selectedDate);
  const isPast = selectedDate < todayKey;
  const isToday = selectedDate === todayKey;

  return (
    <aside aria-label="Agenda" className={cn('scrollbar-thin flex min-h-0 flex-col overflow-y-auto bg-ink-950/25', className)}>
      {/* Selected day */}
      <div className="border-b border-line px-3 pb-3 pt-4">
        <div className="flex items-start justify-between gap-2 px-2">
          <div className="min-w-0">
            <p
              className={cn(
                'font-mono text-2xs font-medium uppercase tracking-[0.14em]',
                isToday ? 'text-accent' : 'text-fg-subtle'
              )}
            >
              {relativeDayLabel(selectedDate, todayKey)}
            </p>
            <p className="mt-0.5 truncate text-base font-semibold text-fg">{format(selected, 'd MMMM yyyy')}</p>
          </div>
          <Button size="sm" variant="secondary" leadingIcon={CalendarPlus} onClick={() => onAdd(selectedDate)}>
            Add
          </Button>
        </div>

        <div className="mt-3 space-y-0.5">
          {dayOccurrences.length === 0 ? (
            <EmptyState
              size="sm"
              grid={false}
              icon={isPast ? CalendarCheck2 : CalendarRange}
              title={isPast ? 'Nothing was planned' : 'Nothing planned'}
              description={isPast ? 'This day had no events.' : 'Double-click a day or press Add.'}
            />
          ) : (
            dayOccurrences.map((occ) => <OccurrenceRow key={occ.key} occ={occ} onOpen={onOpen} />)
          )}
        </div>
      </div>

      {/* Upcoming */}
      <div className="flex-1 px-3 py-4">
        <p className="hud-label mb-2 px-2">Coming up · next {upcomingDays} days</p>
        {upcoming.length === 0 ? (
          <p className="px-2 text-xs text-fg-subtle">Nothing on the horizon. Plan something worth showing up for.</p>
        ) : (
          <div className="space-y-0.5">
            {upcoming.map((occ) => (
              <OccurrenceRow key={occ.key} occ={occ} showDate onOpen={onOpen} />
            ))}
          </div>
        )}
      </div>

      {/* Achievement progress */}
      {plannedCount < CALENDAR_PLANNER_TARGET && (
        <div className="border-t border-line px-5 py-3">
          <div className="mb-2 flex items-center justify-between text-xs text-fg-muted">
            <span className="flex items-center gap-1.5">
              <Trophy size={14} strokeWidth={1.75} className="text-gold" aria-hidden /> Master Planner
            </span>
            <span className="tabular font-mono text-fg-subtle">
              {plannedCount}/{CALENDAR_PLANNER_TARGET}
            </span>
          </div>
          <ProgressBar
            value={plannedCount}
            max={CALENDAR_PLANNER_TARGET}
            segments={CALENDAR_PLANNER_TARGET}
            tone="gold"
            size="sm"
            aria-label="Master Planner progress"
          />
        </div>
      )}
    </aside>
  );
}

export const AgendaPanel = memo(AgendaPanelInner);
