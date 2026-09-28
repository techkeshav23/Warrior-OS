// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Agenda Panel
// The selected day's events (click to edit), the next two weeks at
// a glance, and progress towards the Master Planner achievement
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { Bell, CalendarPlus, Repeat, Trophy } from 'lucide-react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import type { CalendarOccurrence } from '@/types/calendar';
import { CALENDAR_PLANNER_TARGET } from './calendar-achievements';
import { CALENDAR_CATEGORY_MAP, formatTime12 } from './calendar-utils';

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
  return (
    <button
      type="button"
      onClick={() => onOpen(occ)}
      className="flex w-full items-stretch gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none"
      aria-label={`${event.title}, ${showDate ? `${format(parseISO(occ.date), 'EEEE d MMMM')}, ` : ''}${
        event.time ? formatTime12(event.time) : 'all day'
      }, ${meta.label}. Edit`}
    >
      <span className="w-1 shrink-0 rounded-full" style={{ background: event.color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-white/90">{event.title}</span>
        <span className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-white/50">
          {showDate && <span>{format(parseISO(occ.date), 'EEE d MMM')} ·</span>}
          <span>{event.time ? formatTime12(event.time) : 'All day'}</span>
          <span style={{ color: meta.color }}>{meta.label}</span>
          {event.recurrence !== 'none' && <Repeat className="h-3 w-3 text-white/40" aria-hidden="true" />}
          {event.time && event.reminderMinutes !== null && (
            <Bell className="h-3 w-3 text-white/40" aria-hidden="true" />
          )}
        </span>
        {event.notes && <span className="block truncate text-[11px] text-white/40">{event.notes}</span>}
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

  return (
    <aside aria-label="Agenda" className={cn('flex min-h-0 flex-col overflow-y-auto bg-black/15', className)}>
      {/* Selected day */}
      <div className="border-b border-white/10 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={cn(
                'text-[11px] font-semibold uppercase tracking-wider',
                selectedDate === todayKey ? 'text-cyan-300' : 'text-white/50'
              )}
            >
              {relativeDayLabel(selectedDate, todayKey)}
            </p>
            <p className="truncate text-sm font-semibold text-white">{format(selected, 'd MMMM yyyy')}</p>
          </div>
          <button
            type="button"
            onClick={() => onAdd(selectedDate)}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-200 transition-colors hover:bg-cyan-500/20"
          >
            <CalendarPlus className="h-3.5 w-3.5" /> Add
          </button>
        </div>

        <div className="mt-2 space-y-0.5">
          {dayOccurrences.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-center text-[11px] text-white/45">
              {isPast ? 'Nothing was planned for this day.' : 'Nothing planned. Double-click a day or press Add.'}
            </p>
          ) : (
            dayOccurrences.map((occ) => <OccurrenceRow key={occ.key} occ={occ} onOpen={onOpen} />)
          )}
        </div>
      </div>

      {/* Upcoming */}
      <div className="flex-1 p-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">
          Coming up · next {upcomingDays} days
        </p>
        {upcoming.length === 0 ? (
          <p className="text-[11px] text-white/40">No upcoming events.</p>
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
        <div className="border-t border-white/10 px-3 py-2">
          <div className="flex items-center justify-between text-[11px] text-white/50">
            <span className="flex items-center gap-1">
              <Trophy className="h-3 w-3 text-amber-300" /> Master Planner
            </span>
            <span className="font-mono">
              {plannedCount}/{CALENDAR_PLANNER_TARGET}
            </span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-amber-300/80"
              style={{ width: `${(plannedCount / CALENDAR_PLANNER_TARGET) * 100}%` }}
            />
          </div>
        </div>
      )}
    </aside>
  );
}

export const AgendaPanel = memo(AgendaPanelInner);
