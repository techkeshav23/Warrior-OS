// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Month Grid
// Calendar month view with leading/trailing days, today highlight,
// events as coloured bars (wide) or dots (narrow), and keyboard
// navigation (arrows move a day/week, PageUp/PageDown a month,
// Enter adds an event on the focused day)
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { Plus, Repeat } from 'lucide-react';
import { addMonths, format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import type { CalendarOccurrence } from '@/types/calendar';
import { formatTime12, formatTimeCompact, shiftDateKey, toDateKey } from './calendar-utils';

const MAX_BARS = 3;
const MAX_DOTS = 6;
const NO_OCCURRENCES: readonly CalendarOccurrence[] = [];

// Static class strings so Tailwind can see them: short rows for dots, taller for bars.
const ROW_TEMPLATES: Record<number, string> = {
  4: 'grid-rows-[repeat(4,minmax(3.25rem,1fr))] @xl:grid-rows-[repeat(4,minmax(5.5rem,1fr))]',
  5: 'grid-rows-[repeat(5,minmax(3.25rem,1fr))] @xl:grid-rows-[repeat(5,minmax(5.5rem,1fr))]',
  6: 'grid-rows-[repeat(6,minmax(3.25rem,1fr))] @xl:grid-rows-[repeat(6,minmax(5.5rem,1fr))]',
};

// ─── One day cell ───

interface DayCellProps {
  id: string;
  dateKey: string;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  occurrences: readonly CalendarOccurrence[];
  onSelect: (dateKey: string) => void;
  onCreate: (dateKey: string) => void;
  onOpen: (occ: CalendarOccurrence) => void;
}

const DayCell = memo(function DayCell({
  id,
  dateKey,
  inMonth,
  isToday,
  isSelected,
  occurrences,
  onSelect,
  onCreate,
  onOpen,
}: DayCellProps) {
  const date = parseISO(dateKey);
  const count = occurrences.length;
  const bars = occurrences.slice(0, MAX_BARS);
  const hiddenBars = count - bars.length;
  const label =
    `${format(date, 'EEEE d MMMM yyyy')}${isToday ? ', today' : ''}` +
    (count > 0 ? `, ${count} ${count === 1 ? 'event' : 'events'}` : '');

  return (
    <div
      role="gridcell"
      id={id}
      tabIndex={isSelected ? 0 : -1}
      aria-selected={isSelected}
      aria-label={label}
      onClick={() => onSelect(dateKey)}
      onDoubleClick={() => onCreate(dateKey)}
      className={cn(
        'group relative flex min-w-0 cursor-default flex-col gap-0.5 overflow-hidden border-b border-r border-white/[0.06] p-1 outline-none transition-colors',
        'focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-cyan-400/70',
        inMonth ? 'hover:bg-white/[0.04]' : 'bg-black/25 hover:bg-white/[0.03]',
        isSelected && 'bg-cyan-500/[0.08] hover:bg-cyan-500/[0.1]'
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs',
            isToday
              ? 'bg-cyan-400 font-bold text-black shadow-[0_0_12px_rgba(0,240,255,0.5)]'
              : inMonth
                ? 'text-white/85'
                : 'text-white/30',
            isSelected && !isToday && 'ring-1 ring-cyan-400/60'
          )}
        >
          {date.getDate()}
        </span>
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Add event on ${format(date, 'd MMMM')}`}
          title="Add event"
          onClick={(e) => {
            e.stopPropagation();
            onCreate(dateKey);
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          className="rounded p-0.5 text-white/40 opacity-0 transition-opacity hover:bg-white/10 hover:text-cyan-300 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Bars when the grid is wide enough */}
      <div className="hidden min-w-0 flex-col gap-0.5 @xl:flex">
        {bars.map((occ) => (
          <button
            key={occ.key}
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onOpen(occ);
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            title={`${occ.event.time ? formatTime12(occ.event.time) : 'All day'} · ${occ.event.title}`}
            className={cn(
              'flex min-w-0 items-center gap-1 rounded-[3px] border-l-2 px-1 text-left text-[10px] leading-4 text-white/90 transition-[filter] hover:brightness-125',
              !inMonth && 'opacity-60'
            )}
            style={{ borderLeftColor: occ.event.color, background: `${occ.event.color}29` }}
          >
            {occ.event.time && (
              <span className="shrink-0 font-mono text-white/60">{formatTimeCompact(occ.event.time)}</span>
            )}
            <span className="min-w-0 truncate">{occ.event.title}</span>
            {occ.event.recurrence !== 'none' && <Repeat className="h-2.5 w-2.5 shrink-0 text-white/45" />}
          </button>
        ))}
        {hiddenBars > 0 && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(dateKey);
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            className="px-1 text-left text-[10px] text-white/50 hover:text-white"
          >
            +{hiddenBars} more
          </button>
        )}
      </div>

      {/* Dots when narrow */}
      {count > 0 && (
        <div className="flex flex-wrap items-center gap-0.5 px-0.5 @xl:hidden" aria-hidden="true">
          {occurrences.slice(0, MAX_DOTS).map((occ) => (
            <span key={occ.key} className="h-1.5 w-1.5 rounded-full" style={{ background: occ.event.color }} />
          ))}
          {count > MAX_DOTS && <span className="text-[9px] leading-none text-white/50">+{count - MAX_DOTS}</span>}
        </div>
      )}
    </div>
  );
});

// ─── Grid ───

interface MonthGridProps {
  className?: string;
  /** Every day shown, leading and trailing days included, whole weeks. */
  days: readonly string[];
  viewMonth: string;
  todayKey: string;
  selectedDate: string;
  occurrencesByDate: ReadonlyMap<string, CalendarOccurrence[]>;
  onSelectDate: (dateKey: string) => void;
  /** Keyboard navigation target; the parent switches month when needed. */
  onNavigateDate: (dateKey: string) => void;
  onCreate: (dateKey: string) => void;
  onOpenOccurrence: (occ: CalendarOccurrence) => void;
}

function MonthGridInner({
  className,
  days,
  viewMonth,
  todayKey,
  selectedDate,
  occurrencesByDate,
  onSelectDate,
  onNavigateDate,
  onCreate,
  onOpenOccurrence,
}: MonthGridProps) {
  const gridId = useId();
  const focusAfterNavRef = useRef(false);

  // After keyboard navigation, move focus to the newly selected cell
  // (it may only exist after the month switched and the grid re-rendered).
  useEffect(() => {
    if (!focusAfterNavRef.current) return;
    focusAfterNavRef.current = false;
    document.getElementById(`${gridId}-${selectedDate}`)?.focus();
  }, [gridId, selectedDate, days]);

  const weeks: (readonly string[])[] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const weekdayLabels = days.slice(0, 7).map((d) => format(parseISO(d), 'EEE'));

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.target instanceof HTMLElement) || e.target.getAttribute('role') !== 'gridcell') return;
    let next: string | null = null;
    switch (e.key) {
      case 'ArrowLeft':
        next = shiftDateKey(selectedDate, -1);
        break;
      case 'ArrowRight':
        next = shiftDateKey(selectedDate, 1);
        break;
      case 'ArrowUp':
        next = shiftDateKey(selectedDate, -7);
        break;
      case 'ArrowDown':
        next = shiftDateKey(selectedDate, 7);
        break;
      case 'PageUp':
        next = toDateKey(addMonths(parseISO(selectedDate), -1));
        break;
      case 'PageDown':
        next = toDateKey(addMonths(parseISO(selectedDate), 1));
        break;
      case 'Enter':
        e.preventDefault();
        onCreate(selectedDate);
        return;
      default:
        return;
    }
    e.preventDefault();
    focusAfterNavRef.current = true;
    onNavigateDate(next);
  };

  return (
    <div className={cn('@container flex min-h-0 flex-col overflow-y-auto', className)}>
      <div
        role="grid"
        aria-label={format(parseISO(`${viewMonth}-01`), 'MMMM yyyy')}
        onKeyDown={handleKeyDown}
        className="flex min-h-full flex-1 flex-col"
      >
        <div role="row" className="grid shrink-0 grid-cols-7 border-b border-white/10 bg-black/10">
          {weekdayLabels.map((label) => (
            <div
              key={label}
              role="columnheader"
              className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-white/45"
            >
              {label}
            </div>
          ))}
        </div>
        <div role="rowgroup" className={cn('grid flex-1', ROW_TEMPLATES[weeks.length] ?? ROW_TEMPLATES[6])}>
          {weeks.map((week) => (
            <div role="row" key={week[0]} className="grid min-h-0 grid-cols-7">
              {week.map((dateKey) => (
                <DayCell
                  key={dateKey}
                  id={`${gridId}-${dateKey}`}
                  dateKey={dateKey}
                  inMonth={dateKey.startsWith(viewMonth)}
                  isToday={dateKey === todayKey}
                  isSelected={dateKey === selectedDate}
                  occurrences={occurrencesByDate.get(dateKey) ?? NO_OCCURRENCES}
                  onSelect={onSelectDate}
                  onCreate={onCreate}
                  onOpen={onOpenOccurrence}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const MonthGrid = memo(MonthGridInner);
