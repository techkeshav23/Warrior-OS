// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Month Grid
// Calendar month view with leading/trailing days, today highlight,
// events as category-tinted chips (wide) or dots (narrow), and keyboard
// navigation (arrows move a day/week, PageUp/PageDown a month,
// Enter adds an event on the focused day)
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { Plus, Repeat } from 'lucide-react';
import { addMonths, format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import type { CalendarOccurrence } from '@/types/calendar';
import { eventColor, formatTime12, formatTimeCompact, shiftDateKey, tintColor, toDateKey } from './calendar-utils';

const MAX_BARS = 3;
const MAX_DOTS = 6;
const NO_OCCURRENCES: readonly CalendarOccurrence[] = [];

// Static class strings so Tailwind can see them: short rows for dots, taller for chips.
const ROW_TEMPLATES: Record<number, string> = {
  4: 'grid-rows-[repeat(4,minmax(3.25rem,1fr))] @xl:grid-rows-[repeat(4,minmax(4.5rem,1fr))]',
  5: 'grid-rows-[repeat(5,minmax(3.25rem,1fr))] @xl:grid-rows-[repeat(5,minmax(4.5rem,1fr))]',
  6: 'grid-rows-[repeat(6,minmax(3.25rem,1fr))] @xl:grid-rows-[repeat(6,minmax(4.5rem,1fr))]',
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
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const firstOfMonth = date.getDate() === 1;
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
        'group relative flex min-w-0 cursor-default flex-col gap-1 overflow-hidden border-b border-r border-line p-1 outline-none last:border-r-0',
        'transition-colors duration-120 ease-out-quint',
        'shadow-[inset_1px_1px_0_rgb(255_255_255/0.03)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
        isSelected
          ? 'bg-accent/[0.07] hover:bg-accent/10'
          : inMonth
            ? cn(weekend && 'bg-steel-950/30', 'hover:bg-surface-hover')
            : 'bg-steel-950/55 hover:bg-surface-2'
      )}
    >
      {/* Today: accent edge along the top */}
      {isToday && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-accent shadow-[0_0_10px_var(--accent)]" />}
      {isSelected && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_45%,transparent),inset_0_-2px_0_var(--accent),inset_0_-14px_16px_-12px_color-mix(in_oklab,var(--accent)_45%,transparent)]"
        />
      )}

      <div className="flex items-center justify-between gap-1">
        <span
          className={cn(
            'tabular flex h-6 min-w-6 items-center justify-center px-1.5 text-xs',
            isToday
              ? 'chamfer-xs bg-linear-to-b from-accent to-accent/80 font-display font-semibold text-accent-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.45),inset_0_-1px_0_rgb(0_0_0/0.35)]'
              : inMonth
                ? cn('font-medium', isSelected ? 'text-fg' : 'text-fg-muted')
                : 'text-fg-faint'
          )}
        >
          {firstOfMonth && !isToday ? format(date, 'd MMM') : date.getDate()}
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
          className="chamfer-xs flex size-5 items-center justify-center text-fg-subtle opacity-0 transition-[opacity,background-color,color] duration-120 hover:bg-surface-active hover:text-accent focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Plus size={13} strokeWidth={2} />
        </button>
      </div>

      {/* Chips when the grid is wide enough */}
      <div className="hidden min-w-0 flex-col gap-0.5 @xl:flex">
        {bars.map((occ) => {
          const color = eventColor(occ.event.color);
          return (
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
                'flex h-4 min-w-0 shrink-0 items-center gap-1 border-l-2 pl-1 pr-2 text-left text-[11px] leading-none text-fg [clip-path:polygon(0_0,calc(100%-5px)_0,100%_50%,calc(100%-5px)_100%,0_100%)]',
                'transition-[filter,background-color] duration-120 hover:brightness-125',
                !inMonth && 'opacity-55'
              )}
              style={{ borderLeftColor: color, background: tintColor(color, occ.event.time ? 14 : 22) }}
            >
              {occ.event.time && (
                <span className="tabular shrink-0 font-mono text-[10px] text-fg-muted">
                  {formatTimeCompact(occ.event.time)}
                </span>
              )}
              <span className="min-w-0 truncate font-medium">{occ.event.title}</span>
              {occ.event.recurrence !== 'none' && (
                <Repeat size={10} strokeWidth={2} className="ml-auto shrink-0 text-fg-subtle" aria-hidden />
              )}
            </button>
          );
        })}
        {hiddenBars > 0 && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(dateKey);
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            className="chamfer-xs tabular self-start px-1 font-mono text-[10px] leading-4 text-fg-subtle transition-colors duration-120 hover:bg-surface-active hover:text-fg"
          >
            +{hiddenBars} more
          </button>
        )}
      </div>

      {/* Dots when narrow */}
      {count > 0 && (
        <div className="flex flex-wrap items-center gap-[3px] px-1 @xl:hidden" aria-hidden="true">
          {occurrences.slice(0, MAX_DOTS).map((occ) => (
            <span key={occ.key} className="size-1.5 rotate-45" style={{ background: eventColor(occ.event.color) }} />
          ))}
          {count > MAX_DOTS && (
            <span className="tabular font-mono text-[9px] leading-none text-fg-subtle">+{count - MAX_DOTS}</span>
          )}
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
    <div className={cn('@container scrollbar-thin flex min-h-0 flex-col overflow-y-auto', className)}>
      <div
        role="grid"
        aria-label={format(parseISO(`${viewMonth}-01`), 'MMMM yyyy')}
        onKeyDown={handleKeyDown}
        className="flex min-h-full flex-1 flex-col"
      >
        <div role="row" className="grid h-8 shrink-0 grid-cols-7 border-b border-line">
          {weekdayLabels.map((label) => (
            <div
              key={label}
              role="columnheader"
              className="flex items-center px-3 font-mono text-2xs font-medium uppercase tracking-[0.14em] text-fg-subtle"
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
