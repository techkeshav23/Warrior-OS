// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Calendar App
// Month view with leading/trailing days, today highlight, prev /
// next / today navigation, events as coloured bars or dots, an
// agenda side panel and the add / edit / delete event modal.
// Recurring events are expanded for the visible range at render
// time; only the series itself is stored.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { eachDayOfInterval, endOfMonth, endOfWeek, format, startOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCalendarStore } from '@/stores/useCalendarStore';
import type { CalendarEventCategory, CalendarOccurrence } from '@/types/calendar';
import { AgendaPanel } from './AgendaPanel';
import { EventModal, type EventModalState } from './EventModal';
import { MonthGrid } from './MonthGrid';
import { checkCalendarPlannerAchievement, plannedEventCount } from './calendar-achievements';
import {
  CALENDAR_CATEGORIES,
  expandOccurrences,
  groupOccurrencesByDate,
  monthStart,
  shiftDateKey,
  shiftMonthKey,
  toDateKey,
} from './calendar-utils';
import { useCalendarReminders } from './useCalendarReminders';

const UPCOMING_DAYS = 14;
const UPCOMING_LIMIT = 8;

function CalendarAppInner() {
  const events = useCalendarStore((s) => s.events);
  const weekStartsOn = useCalendarStore((s) => s.weekStartsOn);
  const eventsPlanned = useCalendarStore((s) => s.eventsPlanned);

  // `now` ticks so the today highlight and "upcoming" stay right past midnight.
  const [now, setNow] = useState(() => Date.now());
  const [viewMonth, setViewMonth] = useState(() => toDateKey(Date.now()).slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(Date.now()));
  const [hiddenCategories, setHiddenCategories] = useState<readonly CalendarEventCategory[]>([]);
  const [modal, setModal] = useState<EventModalState | null>(null);

  const todayKey = toDateKey(now);
  const currentMonthKey = todayKey.slice(0, 7);

  // Reminders also run globally via <CalendarReminders />; dedup is persisted.
  useCalendarReminders();

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Catch up on "Master Planner" if the XP store was not ready when event #10 was made.
  useEffect(() => {
    checkCalendarPlannerAchievement();
  }, []);

  const visibleEvents = useMemo(
    () => (hiddenCategories.length > 0 ? events.filter((e) => !hiddenCategories.includes(e.category)) : events),
    [events, hiddenCategories]
  );

  // Whole weeks covering the month, leading and trailing days included.
  const days = useMemo(() => {
    const first = monthStart(viewMonth);
    return eachDayOfInterval({
      start: startOfWeek(first, { weekStartsOn }),
      end: endOfWeek(endOfMonth(first), { weekStartsOn }),
    }).map((d) => toDateKey(d));
  }, [viewMonth, weekStartsOn]);

  const gridOccurrences = useMemo(
    () => expandOccurrences(visibleEvents, days[0], days[days.length - 1]),
    [visibleEvents, days]
  );
  const occurrencesByDate = useMemo(() => groupOccurrencesByDate(gridOccurrences), [gridOccurrences]);

  const dayOccurrences = useMemo(
    () => expandOccurrences(visibleEvents, selectedDate, selectedDate),
    [visibleEvents, selectedDate]
  );

  // Coming up: the rest of today (unless today is the day on show) plus the next two weeks.
  const nowTime = format(now, 'HH:mm');
  const upcoming = useMemo(() => {
    const includeToday = selectedDate !== todayKey;
    const from = includeToday ? todayKey : shiftDateKey(todayKey, 1);
    return expandOccurrences(visibleEvents, from, shiftDateKey(todayKey, UPCOMING_DAYS))
      .filter((occ) => occ.date !== todayKey || occ.event.time === null || occ.event.time >= nowTime)
      .slice(0, UPCOMING_LIMIT);
  }, [visibleEvents, selectedDate, todayKey, nowTime]);

  // Per-category counts for the month on screen (hidden categories included).
  const monthCounts = useMemo(() => {
    const counts: Record<CalendarEventCategory, number> = { study: 0, project: 0, personal: 0 };
    const lastDay = toDateKey(endOfMonth(monthStart(viewMonth)));
    for (const occ of expandOccurrences(events, `${viewMonth}-01`, lastDay)) counts[occ.event.category] += 1;
    return counts;
  }, [events, viewMonth]);
  const monthTotal = monthCounts.study + monthCounts.project + monthCounts.personal;

  const editingEventId = modal?.mode === 'edit' ? modal.eventId : null;
  const modalEvent = editingEventId ? (events.find((e) => e.id === editingEventId) ?? null) : null;
  // An edit whose event vanished (deleted from another window) simply closes.
  const modalVisible = modal !== null && (modal.mode === 'create' || modalEvent !== null);

  // ─── Navigation ───

  const goToMonth = (monthKey: string) => {
    setViewMonth(monthKey);
    setSelectedDate(monthKey === currentMonthKey ? todayKey : `${monthKey}-01`);
  };

  const goToToday = () => {
    setViewMonth(currentMonthKey);
    setSelectedDate(todayKey);
  };

  /** Select a day, bringing its month on screen. */
  const showDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    const monthKey = dateKey.slice(0, 7);
    if (monthKey !== viewMonth) setViewMonth(monthKey);
  };

  const openCreate = (dateKey: string) => {
    setSelectedDate(dateKey);
    setModal({ mode: 'create', date: dateKey });
  };

  const openOccurrence = (occ: CalendarOccurrence) => {
    showDate(occ.date);
    setModal({ mode: 'edit', eventId: occ.event.id, occurrenceDate: occ.date });
  };

  const toggleCategory = (id: CalendarEventCategory) =>
    setHiddenCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  return (
    <div className="@container relative flex h-full flex-col bg-black/30 text-white">
      {/* ─── Header ─── */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/10 bg-black/20 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-display text-sm font-bold tracking-wider text-white" aria-live="polite">
              {format(monthStart(viewMonth), 'MMMM yyyy').toUpperCase()}
            </h2>
            <p className="truncate text-[11px] text-white/50">
              {monthTotal === 0
                ? 'No events this month'
                : `${monthTotal} ${monthTotal === 1 ? 'event' : 'events'} this month`}
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1" aria-label="Month navigation">
          <button
            type="button"
            onClick={() => goToMonth(shiftMonthKey(viewMonth, -1))}
            className="rounded-md p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToToday}
            className={cn(
              'rounded-md border px-2 py-1 text-[11px] transition-colors',
              viewMonth === currentMonthKey && selectedDate === todayKey
                ? 'border-white/10 text-white/50 hover:bg-white/10'
                : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20'
            )}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => goToMonth(shiftMonthKey(viewMonth, 1))}
            className="rounded-md p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1" role="group" aria-label="Show categories">
            {CALENDAR_CATEGORIES.map((c) => {
              const shown = !hiddenCategories.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  aria-pressed={shown}
                  title={shown ? `Hide ${c.label} events` : `Show ${c.label} events`}
                  className={cn(
                    'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                    shown ? 'text-white/80' : 'border-white/10 text-white/35 line-through'
                  )}
                  style={shown ? { borderColor: `${c.color}66`, background: `${c.color}1a` } : undefined}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: shown ? c.color : 'rgba(255,255,255,0.3)' }}
                  />
                  {c.label}
                  <span className="font-mono text-white/45">{monthCounts[c.id]}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => useCalendarStore.getState().setWeekStartsOn(weekStartsOn === 1 ? 0 : 1)}
            className="rounded-md border border-white/10 px-2 py-0.5 text-[11px] text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            title="Change the first day of the week"
          >
            {weekStartsOn === 1 ? 'Mon first' : 'Sun first'}
          </button>
          <button
            type="button"
            onClick={() => openCreate(selectedDate)}
            className="flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-2.5 py-1 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/30"
          >
            <Plus className="h-3.5 w-3.5" /> New event
          </button>
        </div>
      </header>

      {/* ─── Grid + agenda ─── */}
      <div className="flex min-h-0 flex-1 flex-col @3xl:flex-row">
        <MonthGrid
          className="min-h-0 min-w-0 flex-1"
          days={days}
          viewMonth={viewMonth}
          todayKey={todayKey}
          selectedDate={selectedDate}
          occurrencesByDate={occurrencesByDate}
          onSelectDate={setSelectedDate}
          onNavigateDate={showDate}
          onCreate={openCreate}
          onOpenOccurrence={openOccurrence}
        />
        <AgendaPanel
          className="max-h-[42%] shrink-0 border-t border-white/10 @3xl:max-h-none @3xl:w-72 @3xl:border-l @3xl:border-t-0"
          selectedDate={selectedDate}
          todayKey={todayKey}
          dayOccurrences={dayOccurrences}
          upcoming={upcoming}
          upcomingDays={UPCOMING_DAYS}
          plannedCount={plannedEventCount(eventsPlanned, events.length)}
          onAdd={openCreate}
          onOpen={openOccurrence}
        />
      </div>

      {/* ─── Event modal ─── */}
      <AnimatePresence>
        {modal && modalVisible && (
          <EventModal
            key={modal.mode === 'create' ? `create-${modal.date}` : `edit-${modal.eventId}-${modal.occurrenceDate}`}
            state={modal}
            event={modalEvent}
            onClose={() => setModal(null)}
            onSaved={showDate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export const CalendarApp = memo(CalendarAppInner);
