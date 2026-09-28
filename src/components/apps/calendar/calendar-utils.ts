// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Calendar utilities
// Category metadata, recurrence expansion (done at render time; a
// recurring event is stored once and never copied), local date
// and time key helpers, and display formatting
// ═══════════════════════════════════════════════════════════

import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  format,
  getDate,
  getDaysInMonth,
  isAfter,
  isBefore,
  isValid,
  parseISO,
  setDate,
  startOfMonth,
} from 'date-fns';
import { FolderKanban, GraduationCap, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CALENDAR_CATEGORY_COLORS } from '@/stores/useCalendarStore';
import type {
  CalendarEvent,
  CalendarEventCategory,
  CalendarOccurrence,
  CalendarRecurrence,
} from '@/types/calendar';

// ─── Categories, colours, labels ───

export interface CalendarCategoryMeta {
  id: CalendarEventCategory;
  label: string;
  color: string;
  Icon: LucideIcon;
}

export const CALENDAR_CATEGORY_MAP: Record<CalendarEventCategory, CalendarCategoryMeta> = {
  study: { id: 'study', label: 'Study', color: CALENDAR_CATEGORY_COLORS.study, Icon: GraduationCap },
  project: { id: 'project', label: 'Project', color: CALENDAR_CATEGORY_COLORS.project, Icon: FolderKanban },
  personal: { id: 'personal', label: 'Personal', color: CALENDAR_CATEGORY_COLORS.personal, Icon: User },
};

export const CALENDAR_CATEGORIES: readonly CalendarCategoryMeta[] = [
  CALENDAR_CATEGORY_MAP.study,
  CALENDAR_CATEGORY_MAP.project,
  CALENDAR_CATEGORY_MAP.personal,
];

/** Colour choices in the event modal (category defaults first). */
export const EVENT_COLOR_SWATCHES: readonly string[] = [
  '#00f0ff',
  '#7b61ff',
  '#ff3d71',
  '#00e676',
  '#ffab00',
  '#ff6e40',
  '#40c4ff',
  '#e040fb',
];

export const RECURRENCE_OPTIONS: readonly { id: CalendarRecurrence; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

/** "Every Monday", "Monthly on day 31 (last day in shorter months)" … */
export function describeRecurrence(event: CalendarEvent): string {
  const base = parseISO(event.date);
  let text: string;
  switch (event.recurrence) {
    case 'daily':
      text = 'Every day';
      break;
    case 'weekly':
      text = `Every ${format(base, 'EEEE')}`;
      break;
    case 'monthly': {
      const day = getDate(base);
      text = `Monthly on day ${day}${day > 28 ? ' (or the last day)' : ''}`;
      break;
    }
    default:
      return 'Does not repeat';
  }
  return event.recurUntil ? `${text} until ${format(parseISO(event.recurUntil), 'd MMM yyyy')}` : text;
}

/** "At start time", "15 min before", "1 hour before", "1 day before". */
export function reminderLabel(minutes: number): string {
  if (minutes === 0) return 'At start time';
  if (minutes === 1440) return '1 day before';
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} before`;
  }
  return `${minutes} min before`;
}

// ─── Date / time keys ───

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Local day key 'yyyy-MM-dd'. */
export function toDateKey(value: Date | number): string {
  return format(value, 'yyyy-MM-dd');
}

/** True for a real calendar day in 'yyyy-MM-dd' form (rejects 2026-02-31). */
export function isValidDateKey(value: string): boolean {
  if (!DATE_KEY_RE.test(value)) return false;
  const parsed = parseISO(value);
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === value;
}

/** True for a 24-hour 'HH:mm' time. */
export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

/** '18:30' → '6:30 PM' */
export function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** '18:30' → '6:30p' (tight month-grid labels) */
export function formatTimeCompact(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'a' : 'p'}`;
}

/** Local midnight of the first day of a month key 'yyyy-MM'. */
export function monthStart(monthKey: string): Date {
  return parseISO(`${monthKey}-01`);
}

/** Month key moved by delta months. */
export function shiftMonthKey(monthKey: string, delta: number): string {
  return format(addMonths(monthStart(monthKey), delta), 'yyyy-MM');
}

// ─── Recurrence expansion ───

/** Days (local midnights) on which one event occurs inside [rangeStart, rangeEnd]. */
function occurrenceDays(event: CalendarEvent, rangeStart: Date, rangeEnd: Date): Date[] {
  const base = parseISO(event.date);
  if (!isValid(base)) return [];

  let last = rangeEnd;
  if (event.recurrence !== 'none' && event.recurUntil) {
    const until = parseISO(event.recurUntil);
    if (isValid(until) && isBefore(until, last)) last = until;
  }
  if (isAfter(base, last)) return [];

  const days: Date[] = [];
  switch (event.recurrence) {
    case 'none': {
      if (!isBefore(base, rangeStart)) days.push(base);
      break;
    }
    case 'daily': {
      let day = isBefore(base, rangeStart) ? rangeStart : base;
      while (!isAfter(day, last)) {
        days.push(day);
        day = addDays(day, 1);
      }
      break;
    }
    case 'weekly': {
      let day = base;
      if (isBefore(day, rangeStart)) {
        day = addWeeks(base, Math.ceil(differenceInCalendarDays(rangeStart, base) / 7));
      }
      while (!isAfter(day, last)) {
        days.push(day);
        day = addWeeks(day, 1);
      }
      break;
    }
    case 'monthly': {
      // Day 29–31 series fall on the last day of shorter months.
      const dayOfMonth = getDate(base);
      let month = startOfMonth(isBefore(base, rangeStart) ? rangeStart : base);
      while (!isAfter(month, last)) {
        const day = setDate(month, Math.min(dayOfMonth, getDaysInMonth(month)));
        if (!isBefore(day, base) && !isBefore(day, rangeStart) && !isAfter(day, last)) days.push(day);
        month = addMonths(month, 1);
      }
      break;
    }
  }
  return days;
}

/** Orders occurrences by day, then all-day first, then start time, then title. */
export function compareOccurrences(a: CalendarOccurrence, b: CalendarOccurrence): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const at = a.event.time;
  const bt = b.event.time;
  if (at !== bt) {
    if (at === null) return -1;
    if (bt === null) return 1;
    return at < bt ? -1 : 1;
  }
  return a.event.title.localeCompare(b.event.title);
}

/**
 * Every occurrence of the given events between two day keys (inclusive),
 * sorted. Recurring series are expanded here and skipped days removed.
 */
export function expandOccurrences(
  events: readonly CalendarEvent[],
  startKey: string,
  endKey: string
): CalendarOccurrence[] {
  const rangeStart = parseISO(startKey);
  const rangeEnd = parseISO(endKey);
  if (!isValid(rangeStart) || !isValid(rangeEnd) || isAfter(rangeStart, rangeEnd)) return [];

  const out: CalendarOccurrence[] = [];
  for (const event of events) {
    const skipped = event.exceptions.length > 0 ? new Set(event.exceptions) : null;
    for (const day of occurrenceDays(event, rangeStart, rangeEnd)) {
      const date = toDateKey(day);
      if (skipped?.has(date)) continue;
      out.push({ key: `${event.id}@${date}`, date, event });
    }
  }
  out.sort(compareOccurrences);
  return out;
}

/** Buckets sorted occurrences by day key. */
export function groupOccurrencesByDate(list: readonly CalendarOccurrence[]): Map<string, CalendarOccurrence[]> {
  const map = new Map<string, CalendarOccurrence[]>();
  for (const occ of list) {
    const bucket = map.get(occ.date);
    if (bucket) bucket.push(occ);
    else map.set(occ.date, [occ]);
  }
  return map;
}

/** Day key shifted by a number of days. */
export function shiftDateKey(dateKey: string, days: number): string {
  return toDateKey(addDays(parseISO(dateKey), days));
}
