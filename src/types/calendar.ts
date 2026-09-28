// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Calendar Types
// Calendar events, recurrence rules and expanded occurrences
// ═══════════════════════════════════════════════════════════

export type CalendarEventCategory = 'study' | 'project' | 'personal';

export type CalendarRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface CalendarEvent {
  id: string;
  title: string;
  /** Day of the event (first day of the series when recurring), local 'yyyy-MM-dd'. */
  date: string;
  /** Local start time 'HH:mm', or null for an all-day event. */
  time: string | null;
  category: CalendarEventCategory;
  /** Hex colour '#rrggbb' used for the event's dot / bar. */
  color: string;
  recurrence: CalendarRecurrence;
  /** Last day a recurring series may occur ('yyyy-MM-dd'); null = no end. */
  recurUntil: string | null;
  /** Days removed from a recurring series ('yyyy-MM-dd'). Empty when not recurring. */
  exceptions: string[];
  /** Minutes before the start time to remind (timed events only); null = no reminder. */
  reminderMinutes: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** The user-editable fields of an event. */
export type CalendarEventInput = Pick<
  CalendarEvent,
  'title' | 'date' | 'time' | 'category' | 'color' | 'recurrence' | 'recurUntil' | 'reminderMinutes' | 'notes'
>;

/**
 * One concrete appearance of an event on one day. Recurring events are
 * expanded into occurrences at render time and are never stored as copies.
 */
export interface CalendarOccurrence {
  /** Stable key `${event.id}@${date}`. */
  key: string;
  /** Day of this occurrence, 'yyyy-MM-dd'. */
  date: string;
  event: CalendarEvent;
}
