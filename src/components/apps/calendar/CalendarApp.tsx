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
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { eachDayOfInterval, endOfMonth, endOfWeek, format, startOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button, IconButton, SegmentedControl, Toolbar, ToolbarSpacer } from '@/components/ui';
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
  tintColor,
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

  const onToday = viewMonth === currentMonthKey && selectedDate === todayKey;

  return (
    <div className="@container relative flex h-full flex-col text-fg">
      {/* ─── Header: month title, navigation, primary action ─── */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight text-fg" aria-live="polite">
            {format(monthStart(viewMonth), 'MMMM')}{' '}
            <span className="tabular font-normal text-fg-muted">{format(monthStart(viewMonth), 'yyyy')}</span>
          </h2>
          <p className="hud-label mt-0.5 truncate">
            {monthTotal === 0
              ? 'No events this month'
              : `${monthTotal} ${monthTotal === 1 ? 'event' : 'events'} this month`}
          </p>
        </div>

        <nav className="flex items-center gap-1" aria-label="Month navigation">
          <IconButton
            icon={ChevronLeft}
            size="sm"
            aria-label="Previous month"
            tooltip
            onClick={() => goToMonth(shiftMonthKey(viewMonth, -1))}
          />
          <Button size="sm" variant="secondary" onClick={goToToday} disabled={onToday}>
            Today
          </Button>
          <IconButton
            icon={ChevronRight}
            size="sm"
            aria-label="Next month"
            tooltip
            onClick={() => goToMonth(shiftMonthKey(viewMonth, 1))}
          />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="primary" leadingIcon={Plus} onClick={() => openCreate(selectedDate)}>
            New event
          </Button>
        </div>
      </header>

      {/* ─── Toolbar: category filters, week start ─── */}
      <Toolbar aria-label="Calendar view" className="gap-2 px-5">
        <span className="hud-label mr-1 hidden @2xl:inline">Show</span>
        <div className="scrollbar-none flex min-w-0 items-center gap-1.5 overflow-x-auto" role="group" aria-label="Show categories">
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
                  'chamfer-xs focus-ring inline-flex h-7 shrink-0 items-center gap-1.5 pl-2 pr-2.5 text-xs font-medium',
                  'transition-[background-color,box-shadow,color,filter] duration-120 ease-out-quint',
                  shown
                    ? 'text-fg hover:brightness-115'
                    : 'bg-steel-950 text-fg-subtle shadow-[inset_0_1px_0_rgb(0_0_0/0.7),inset_0_-1px_0_rgb(255_255_255/0.06)] hover:text-fg-muted'
                )}
                style={
                  shown
                    ? {
                        background: `linear-gradient(to bottom, ${tintColor(c.color, 20)}, ${tintColor(c.color, 8)})`,
                        boxShadow: `inset 0 1px 0 ${tintColor(c.color, 45)}, inset 0 -2px 0 ${c.color}`,
                      }
                    : undefined
                }
              >
                <span
                  className={cn('size-2 rotate-45 transition-colors duration-120', !shown && 'bg-fg-faint')}
                  style={shown ? { background: c.color } : undefined}
                  aria-hidden
                />
                <span className={shown ? undefined : 'line-through decoration-fg-faint'}>{c.label}</span>
                <span className={cn('tabular font-mono text-2xs', shown ? 'text-fg-muted' : 'text-fg-faint')}>
                  {monthCounts[c.id]}
                </span>
              </button>
            );
          })}
        </div>
        <ToolbarSpacer />
        <span className="hud-label hidden @xl:inline">Week starts</span>
        <SegmentedControl
          size="sm"
          aria-label="First day of the week"
          value={weekStartsOn === 1 ? 'mon' : 'sun'}
          onChange={(v) => useCalendarStore.getState().setWeekStartsOn(v === 'mon' ? 1 : 0)}
          options={[
            { value: 'mon', label: 'Mon' },
            { value: 'sun', label: 'Sun' },
          ]}
        />
      </Toolbar>

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
          className="max-h-[42%] shrink-0 border-t border-line @3xl:max-h-none @3xl:w-72 @3xl:border-l @3xl:border-t-0"
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
      {modal && modalVisible && (
        <EventModal
          key={modal.mode === 'create' ? `create-${modal.date}` : `edit-${modal.eventId}-${modal.occurrenceDate}`}
          state={modal}
          event={modalEvent}
          onClose={() => setModal(null)}
          onSaved={showDate}
        />
      )}
    </div>
  );
}

export const CalendarApp = memo(CalendarAppInner);
