// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Calendar Store
// Calendar events (recurring ones stored once, expanded at render
// time), grid preference and delivered-reminder bookkeeping.
// Persisted to localStorage; nothing touches the network.
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { generateId } from '@/lib/utils';
import type {
  CalendarEvent,
  CalendarEventCategory,
  CalendarEventInput,
  CalendarRecurrence,
} from '@/types/calendar';

export const MAX_EVENT_TITLE_LENGTH = 80;
export const MAX_EVENT_NOTES_LENGTH = 300;
/** Stored-event cap so localStorage stays bounded. */
export const MAX_STORED_EVENTS = 2_000;
/** Reminder lead times offered by the event modal, in minutes. */
export const REMINDER_OPTIONS: readonly number[] = [0, 5, 10, 15, 30, 60, 1440];

/** Default colour per category (also the first swatches in the picker). */
export const CALENDAR_CATEGORY_COLORS: Record<CalendarEventCategory, string> = {
  study: '#00f0ff',
  project: '#7b61ff',
  personal: '#ff3d71',
};

const CATEGORY_IDS: readonly CalendarEventCategory[] = ['study', 'project', 'personal'];
const RECURRENCE_IDS: readonly CalendarRecurrence[] = ['none', 'daily', 'weekly', 'monthly'];
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
/** Delivered-reminder keys older than this many days are forgotten. */
const REMINDER_MEMORY_DAYS = 3;

// ─── Normalising ───

function normalizeInput(input: CalendarEventInput): CalendarEventInput {
  const category = CATEGORY_IDS.includes(input.category) ? input.category : 'personal';
  const recurrence = RECURRENCE_IDS.includes(input.recurrence) ? input.recurrence : 'none';
  const time = input.time && TIME_RE.test(input.time) ? input.time : null;
  const recurUntil =
    recurrence !== 'none' && input.recurUntil && DATE_KEY_RE.test(input.recurUntil) && input.recurUntil >= input.date
      ? input.recurUntil
      : null;
  const reminderMinutes =
    time !== null && input.reminderMinutes !== null && REMINDER_OPTIONS.includes(input.reminderMinutes)
      ? input.reminderMinutes
      : null;
  return {
    title: input.title.trim().slice(0, MAX_EVENT_TITLE_LENGTH),
    date: input.date,
    time,
    category,
    color: HEX_RE.test(input.color) ? input.color.toLowerCase() : CALENDAR_CATEGORY_COLORS[category],
    recurrence,
    recurUntil,
    reminderMinutes,
    notes: input.notes.trim().slice(0, MAX_EVENT_NOTES_LENGTH),
  };
}

// ─── Persisted-state sanitising (guards against hand-edited / corrupt storage) ───

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeEvent(raw: unknown): CalendarEvent | null {
  if (!isRecord(raw)) return null;
  const { id, title, date, time, category, color, recurrence, recurUntil, exceptions, reminderMinutes, notes, createdAt, updatedAt } = raw;
  if (typeof id !== 'string' || !id) return null;
  if (typeof title !== 'string' || !title.trim()) return null;
  if (typeof date !== 'string' || !DATE_KEY_RE.test(date)) return null;
  const clean = normalizeInput({
    title,
    date,
    time: typeof time === 'string' ? time : null,
    category: category as CalendarEventCategory,
    color: typeof color === 'string' ? color : '',
    recurrence: recurrence as CalendarRecurrence,
    recurUntil: typeof recurUntil === 'string' ? recurUntil : null,
    reminderMinutes: typeof reminderMinutes === 'number' ? reminderMinutes : null,
    notes: typeof notes === 'string' ? notes : '',
  });
  const created = typeof createdAt === 'string' ? createdAt : `${date}T00:00:00.000Z`;
  return {
    id,
    ...clean,
    exceptions:
      clean.recurrence !== 'none' && Array.isArray(exceptions)
        ? exceptions.filter((d): d is string => typeof d === 'string' && DATE_KEY_RE.test(d))
        : [],
    createdAt: created,
    updatedAt: typeof updatedAt === 'string' ? updatedAt : created,
  };
}

// ─── Persisted-state migration ───

/** v1: the old exam category became 'study'. */
const STORE_VERSION = 1;
/** Category ids written by older versions → their current id. */
const LEGACY_CATEGORY_IDS: ReadonlyMap<string, CalendarEventCategory> = new Map([['gate', 'study']]);

function migrateLegacyCategories(events: unknown): unknown {
  if (!Array.isArray(events)) return events;
  return events.map((raw: unknown) => {
    if (!isRecord(raw) || typeof raw.category !== 'string') return raw;
    const renamed = LEGACY_CATEGORY_IDS.get(raw.category);
    return renamed ? { ...raw, category: renamed } : raw;
  });
}

// ─── Store ───

type CalendarPersisted = Pick<CalendarStore, 'events' | 'eventsPlanned' | 'weekStartsOn' | 'remindedKeys'>;

interface CalendarStore {
  events: CalendarEvent[];
  /** Events the user has planned (monotonic: deleting one does not lower it). */
  eventsPlanned: number;
  /** First column of the month grid: 0 = Sunday, 1 = Monday. */
  weekStartsOn: 0 | 1;
  /** Reminder keys already delivered, `${eventId}@${date}T${time}~${minutes}`. */
  remindedKeys: string[];

  /**
   * Adds an event. `countAsPlanned: false` is used when an edit splits one
   * day out of a recurring series, which is not a newly planned event.
   */
  addEvent: (input: CalendarEventInput, options?: { countAsPlanned?: boolean }) => CalendarEvent;
  /** Edits an event (a recurring event's whole series). */
  updateEvent: (id: string, input: CalendarEventInput) => void;
  /** Removes an event (its whole series) and returns it, or null if missing. */
  deleteEvent: (id: string) => CalendarEvent | null;
  /** Removes a single day from a recurring series. */
  skipOccurrence: (id: string, date: string) => void;
  setWeekStartsOn: (day: 0 | 1) => void;
  /** Records a delivered reminder; forgets keys older than a few days. */
  markReminded: (key: string, todayKey: string) => void;
}

export const useCalendarStore = create<CalendarStore>()(
  persist(
    immer((set, get) => ({
      events: [],
      eventsPlanned: 0,
      weekStartsOn: 1,
      remindedKeys: [],

      addEvent: (input, options) => {
        const clean = normalizeInput(input);
        const stamp = new Date().toISOString();
        const event: CalendarEvent = {
          id: generateId('evt'),
          ...clean,
          exceptions: [],
          createdAt: stamp,
          updatedAt: stamp,
        };
        set((s) => {
          s.events.push(event);
          if (s.events.length > MAX_STORED_EVENTS) {
            s.events.splice(0, s.events.length - MAX_STORED_EVENTS);
          }
          if (options?.countAsPlanned !== false) s.eventsPlanned += 1;
        });
        return event;
      },

      updateEvent: (id, input) => {
        const clean = normalizeInput(input);
        const stamp = new Date().toISOString();
        set((s) => {
          const target = s.events.find((e) => e.id === id);
          if (!target) return;
          Object.assign(target, clean);
          // Skipped days only mean something for a series that still repeats.
          if (clean.recurrence === 'none') target.exceptions = [];
          target.updatedAt = stamp;
        });
      },

      deleteEvent: (id) => {
        const existing = get().events.find((e) => e.id === id);
        if (!existing) return null;
        set((s) => {
          s.events = s.events.filter((e) => e.id !== id);
        });
        return existing;
      },

      skipOccurrence: (id, date) =>
        set((s) => {
          const target = s.events.find((e) => e.id === id);
          if (!target || target.recurrence === 'none' || !DATE_KEY_RE.test(date)) return;
          if (!target.exceptions.includes(date)) target.exceptions.push(date);
          target.updatedAt = new Date().toISOString();
        }),

      setWeekStartsOn: (day) =>
        set((s) => {
          s.weekStartsOn = day;
        }),

      markReminded: (key, todayKey) =>
        set((s) => {
          if (!s.remindedKeys.includes(key)) s.remindedKeys.push(key);
          // Keys embed their occurrence day right after '@'; drop stale ones.
          const cutoff = new Date(`${todayKey}T00:00:00`);
          cutoff.setDate(cutoff.getDate() - REMINDER_MEMORY_DAYS);
          const y = cutoff.getFullYear();
          const m = String(cutoff.getMonth() + 1).padStart(2, '0');
          const d = String(cutoff.getDate()).padStart(2, '0');
          const cutoffKey = `${y}-${m}-${d}`;
          s.remindedKeys = s.remindedKeys.filter((k) => {
            const day = k.slice(k.indexOf('@') + 1, k.indexOf('@') + 11);
            return day >= cutoffKey;
          });
        }),
    })),
    {
      name: 'warrior-os-calendar',
      version: STORE_VERSION,
      // v0 → v1 renames legacy categories; `merge` below validates everything else.
      migrate: (persisted, version) =>
        (version < 1 && isRecord(persisted)
          ? { ...persisted, events: migrateLegacyCategories(persisted.events) }
          : persisted) as CalendarPersisted,
      partialize: (state): CalendarPersisted => ({
        events: state.events,
        eventsPlanned: state.eventsPlanned,
        weekStartsOn: state.weekStartsOn,
        remindedKeys: state.remindedKeys,
      }),
      merge: (persisted, current) => {
        if (!isRecord(persisted)) return current;
        const rawEvents = persisted.events;
        const events = Array.isArray(rawEvents)
          ? rawEvents.map(sanitizeEvent).filter((e): e is CalendarEvent => e !== null)
          : current.events;
        const planned = persisted.eventsPlanned;
        const eventsPlanned =
          typeof planned === 'number' && Number.isFinite(planned) && planned >= 0
            ? Math.floor(planned)
            : current.eventsPlanned;
        const weekStart = persisted.weekStartsOn;
        const weekStartsOn: 0 | 1 = weekStart === 0 ? 0 : weekStart === 1 ? 1 : current.weekStartsOn;
        const reminded = persisted.remindedKeys;
        const remindedKeys = Array.isArray(reminded)
          ? reminded.filter((k): k is string => typeof k === 'string')
          : current.remindedKeys;
        return { ...current, events, eventsPlanned, weekStartsOn, remindedKeys };
      },
    }
  )
);
