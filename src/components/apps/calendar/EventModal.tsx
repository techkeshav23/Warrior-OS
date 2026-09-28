// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Event Modal
// Add / edit / delete a calendar event: title, date, time (or
// all-day), category (GATE / Project / Personal), colour, repeat
// (none / daily / weekly / monthly, optional end), reminder, notes.
// Editing one day of a recurring series can split that day out.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useId, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { motion } from 'framer-motion';
import { Bell, Check, Clock, Repeat, Trash2, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  CALENDAR_CATEGORY_COLORS,
  MAX_EVENT_NOTES_LENGTH,
  MAX_EVENT_TITLE_LENGTH,
  REMINDER_OPTIONS,
  useCalendarStore,
} from '@/stores/useCalendarStore';
import type {
  CalendarEvent,
  CalendarEventCategory,
  CalendarEventInput,
  CalendarRecurrence,
} from '@/types/calendar';
import { checkCalendarPlannerAchievement } from './calendar-achievements';
import {
  CALENDAR_CATEGORIES,
  EVENT_COLOR_SWATCHES,
  RECURRENCE_OPTIONS,
  describeRecurrence,
  isValidDateKey,
  isValidTime,
  reminderLabel,
} from './calendar-utils';

export type EventModalState =
  | { mode: 'create'; date: string }
  | { mode: 'edit'; eventId: string; occurrenceDate: string };

interface EventModalProps {
  state: EventModalState;
  /** The event being edited (looked up by the parent); null when creating. */
  event: CalendarEvent | null;
  onClose: () => void;
  /** Called with the day the saved event lands on, so the grid can select it. */
  onSaved: (dateKey: string) => void;
}

type EditScope = 'series' | 'single';

interface FormValues {
  title: string;
  date: string;
  allDay: boolean;
  time: string;
  recurrence: CalendarRecurrence;
  recurUntil: string;
  notes: string;
}

interface FormErrors {
  title?: string;
  date?: string;
  time?: string;
  recurUntil?: string;
  notes?: string;
}

const DEFAULT_TIME = '09:00';
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function validateForm(v: FormValues): FormErrors {
  const errors: FormErrors = {};
  const title = v.title.trim();
  if (!title) errors.title = 'Give the event a title.';
  else if (title.length > MAX_EVENT_TITLE_LENGTH) {
    errors.title = `Keep the title within ${MAX_EVENT_TITLE_LENGTH} characters.`;
  }
  if (!isValidDateKey(v.date)) errors.date = 'Pick a valid date.';
  if (!v.allDay && !isValidTime(v.time)) errors.time = 'Pick a start time, or mark the event all-day.';
  if (v.recurrence !== 'none' && v.recurUntil) {
    if (!isValidDateKey(v.recurUntil)) errors.recurUntil = 'Pick a valid end date.';
    else if (isValidDateKey(v.date) && v.recurUntil < v.date) {
      errors.recurUntil = 'The repeat has to end on or after the first day.';
    }
  }
  if (v.notes.trim().length > MAX_EVENT_NOTES_LENGTH) {
    errors.notes = `Keep notes within ${MAX_EVENT_NOTES_LENGTH} characters.`;
  }
  return errors;
}

function EventModalInner({ state, event, onClose, onSaved }: EventModalProps) {
  const ids = useId();
  const occurrenceDate = state.mode === 'edit' ? state.occurrenceDate : state.date;
  const isRecurringEdit = event !== null && event.recurrence !== 'none';

  const [title, setTitle] = useState(() => event?.title ?? '');
  const [scope, setScope] = useState<EditScope>('series');
  const [date, setDate] = useState(() => (event ? event.date : occurrenceDate));
  const [allDay, setAllDay] = useState(() => (event ? event.time === null : false));
  const [time, setTime] = useState(() => event?.time ?? DEFAULT_TIME);
  const [category, setCategory] = useState<CalendarEventCategory>(() => event?.category ?? 'gate');
  const [color, setColor] = useState(() => event?.color ?? CALENDAR_CATEGORY_COLORS.gate);
  const [colorTouched, setColorTouched] = useState(() =>
    event ? event.color !== CALENDAR_CATEGORY_COLORS[event.category] : false
  );
  const [recurrence, setRecurrence] = useState<CalendarRecurrence>(() => event?.recurrence ?? 'none');
  const [recurUntil, setRecurUntil] = useState(() => event?.recurUntil ?? '');
  const [reminder, setReminder] = useState<number | null>(() => event?.reminderMinutes ?? null);
  const [notes, setNotes] = useState(() => event?.notes ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Splitting one day out of a series turns that day into a one-off event.
  const effectiveRecurrence: CalendarRecurrence = scope === 'single' ? 'none' : recurrence;
  const errors = validateForm({ title, date, allDay, time, recurrence: effectiveRecurrence, recurUntil, notes });
  const visible: FormErrors = submitted ? errors : {};
  const hasErrors = Object.keys(errors).length > 0;

  const occurrenceLabel = isValidDateKey(occurrenceDate) ? format(parseISO(occurrenceDate), 'EEE d MMM') : occurrenceDate;
  const recurrencePreview =
    effectiveRecurrence !== 'none' && isValidDateKey(date)
      ? describeRecurrence({
          id: 'preview',
          title,
          date,
          time: null,
          category,
          color,
          recurrence: effectiveRecurrence,
          recurUntil: recurUntil && isValidDateKey(recurUntil) ? recurUntil : null,
          exceptions: [],
          reminderMinutes: null,
          notes: '',
          createdAt: '',
          updatedAt: '',
        })
      : null;

  const switchScope = (next: EditScope) => {
    if (!event) return;
    setScope(next);
    setDate(next === 'single' ? occurrenceDate : event.date);
    setConfirmingDelete(false);
  };

  const pickCategory = (next: CalendarEventCategory) => {
    setCategory(next);
    if (!colorTouched) setColor(CALENDAR_CATEGORY_COLORS[next]);
  };

  const pickColor = (next: string) => {
    setColor(next);
    setColorTouched(true);
  };

  const buildInput = (): CalendarEventInput => ({
    title: title.trim(),
    date,
    time: allDay ? null : time,
    category,
    color: HEX_RE.test(color) ? color : CALENDAR_CATEGORY_COLORS[category],
    recurrence: effectiveRecurrence,
    recurUntil: effectiveRecurrence !== 'none' && recurUntil ? recurUntil : null,
    reminderMinutes: allDay ? null : reminder,
    notes: notes.trim(),
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    if (hasErrors) return;
    const input = buildInput();
    const store = useCalendarStore.getState();
    if (event) {
      if (scope === 'single' && event.recurrence !== 'none') {
        store.skipOccurrence(event.id, occurrenceDate);
        store.addEvent(input, { countAsPlanned: false });
      } else {
        store.updateEvent(event.id, input);
      }
    } else {
      store.addEvent(input);
      checkCalendarPlannerAchievement();
    }
    // A repeating series edited from one of its days stays on that day; anything
    // else (new event, one-off, split-out day) jumps to where the event now is.
    const stillRepeatsHere = event !== null && scope === 'series' && effectiveRecurrence !== 'none';
    onSaved(stillRepeatsHere ? occurrenceDate : input.date);
    onClose();
  };

  const deleteSeries = () => {
    if (!event) return;
    useCalendarStore.getState().deleteEvent(event.id);
    onClose();
  };

  const deleteOccurrence = () => {
    if (!event) return;
    useCalendarStore.getState().skipOccurrence(event.id, occurrenceDate);
    onClose();
  };

  const onDialogKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  };

  const onBackdropMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const fieldBase =
    'w-full rounded-lg border bg-black/30 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={onBackdropMouseDown}
      onKeyDown={onDialogKeyDown}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-heading`}
        initial={{ y: 20, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 12, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[rgba(12,12,20,0.96)] shadow-[0_16px_60px_rgba(0,0,0,0.55)]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 id={`${ids}-heading`} className="font-display text-xs font-bold uppercase tracking-wider text-white">
            {event ? 'Edit event' : 'New event'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {/* Series vs single day (recurring events opened from a day) */}
            {isRecurringEdit && (
              <div>
                <p className="mb-1 text-[11px] text-white/60">Apply changes to</p>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-black/30 p-1">
                  {(
                    [
                      { id: 'series', label: 'Whole series' },
                      { id: 'single', label: `Only ${occurrenceLabel}` },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => switchScope(opt.id)}
                      aria-pressed={scope === opt.id}
                      className={cn(
                        'truncate rounded-md px-2 py-1 text-xs transition-colors',
                        scope === opt.id ? 'bg-cyan-500/20 text-cyan-200' : 'text-white/55 hover:bg-white/5'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Title */}
            <div>
              <label htmlFor={`${ids}-title`} className="mb-1 block text-[11px] text-white/60">
                Title
              </label>
              <input
                id={`${ids}-title`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={MAX_EVENT_TITLE_LENGTH}
                autoFocus
                autoComplete="off"
                placeholder="Mock test, sprint review, gym..."
                aria-invalid={visible.title ? true : undefined}
                className={cn(fieldBase, 'px-3 py-2 text-base', visible.title ? 'border-red-500/50' : 'border-white/10')}
              />
              {visible.title && <p className="mt-1 text-[11px] text-red-300">{visible.title}</p>}
            </div>

            {/* Date + time */}
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <label htmlFor={`${ids}-date`} className="mb-1 block text-[11px] text-white/60">
                  {effectiveRecurrence !== 'none' ? 'Starts on' : 'Date'}
                </label>
                <input
                  id={`${ids}-date`}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  aria-invalid={visible.date ? true : undefined}
                  className={cn(fieldBase, 'px-2 py-[7px]', visible.date ? 'border-red-500/50' : 'border-white/10')}
                />
                {visible.date && <p className="mt-1 text-[11px] text-red-300">{visible.date}</p>}
              </div>
              <div className="min-w-0">
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor={`${ids}-time`} className="flex items-center gap-1 text-[11px] text-white/60">
                    <Clock className="h-3 w-3" /> Time
                  </label>
                  <label className="flex cursor-pointer items-center gap-1 text-[11px] text-white/60">
                    <input
                      type="checkbox"
                      checked={allDay}
                      onChange={(e) => setAllDay(e.target.checked)}
                      className="h-3 w-3 accent-cyan-400"
                    />
                    All day
                  </label>
                </div>
                <input
                  id={`${ids}-time`}
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={allDay}
                  aria-invalid={visible.time ? true : undefined}
                  className={cn(fieldBase, 'px-2 py-[7px]', visible.time ? 'border-red-500/50' : 'border-white/10')}
                />
                {visible.time && <p className="mt-1 text-[11px] text-red-300">{visible.time}</p>}
              </div>
            </div>
            {event && scope === 'series' && isRecurringEdit && (
              <p className="-mt-1 text-[11px] text-white/45">
                Changes apply to every day in this series. Pick “Only {occurrenceLabel}” to change just that day.
              </p>
            )}

            {/* Category */}
            <div>
              <p className="mb-1 text-[11px] text-white/60">Category</p>
              <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Category">
                {CALENDAR_CATEGORIES.map((c) => {
                  const Icon = c.Icon;
                  const active = category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pickCategory(c.id)}
                      aria-pressed={active}
                      className={cn(
                        'flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition-colors',
                        active ? 'text-white' : 'border-white/10 text-white/55 hover:bg-white/5'
                      )}
                      style={active ? { borderColor: `${c.color}99`, background: `${c.color}24` } : undefined}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: c.color }} />
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Colour */}
            <div>
              <p id={`${ids}-color-label`} className="mb-1 text-[11px] text-white/60">
                Colour
              </p>
              <div
                role="radiogroup"
                aria-labelledby={`${ids}-color-label`}
                className="flex flex-wrap items-center gap-1.5"
              >
                {EVENT_COLOR_SWATCHES.map((swatch) => {
                  const active = color.toLowerCase() === swatch;
                  return (
                    <button
                      key={swatch}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={`Colour ${swatch}`}
                      onClick={() => pickColor(swatch)}
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-transform hover:scale-110',
                        active ? 'border-white' : 'border-transparent'
                      )}
                      style={{ background: swatch }}
                    >
                      {active && <Check className="h-3 w-3 text-black" />}
                    </button>
                  );
                })}
                <label
                  className="relative flex h-6 cursor-pointer items-center gap-1 rounded-full border border-white/15 px-2 text-[10px] text-white/60 hover:bg-white/5"
                  title="Custom colour"
                >
                  <span className="h-3 w-3 rounded-full border border-white/30" style={{ background: color }} />
                  Custom
                  <input
                    type="color"
                    value={HEX_RE.test(color) ? color : '#00f0ff'}
                    onChange={(e) => pickColor(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="Custom colour"
                  />
                </label>
              </div>
            </div>

            {/* Repeat */}
            {scope === 'series' && (
              <div>
                <p className="mb-1 flex items-center gap-1 text-[11px] text-white/60">
                  <Repeat className="h-3 w-3" /> Repeat
                </p>
                <div className="grid grid-cols-4 gap-1 rounded-lg border border-white/10 bg-black/30 p-1" role="group" aria-label="Repeat">
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setRecurrence(opt.id)}
                      aria-pressed={recurrence === opt.id}
                      className={cn(
                        'rounded-md py-1 text-xs transition-colors',
                        recurrence === opt.id ? 'bg-cyan-500/20 text-cyan-200' : 'text-white/55 hover:bg-white/5'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {recurrence !== 'none' && (
                  <div className="mt-2 flex items-center gap-2">
                    <label htmlFor={`${ids}-until`} className="shrink-0 text-[11px] text-white/60">
                      Until
                    </label>
                    <input
                      id={`${ids}-until`}
                      type="date"
                      value={recurUntil}
                      min={isValidDateKey(date) ? date : undefined}
                      onChange={(e) => setRecurUntil(e.target.value)}
                      aria-invalid={visible.recurUntil ? true : undefined}
                      className={cn(
                        fieldBase,
                        'px-2 py-1 text-xs',
                        visible.recurUntil ? 'border-red-500/50' : 'border-white/10'
                      )}
                    />
                    {recurUntil && (
                      <button
                        type="button"
                        onClick={() => setRecurUntil('')}
                        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-white/50 hover:bg-white/10 hover:text-white"
                      >
                        No end
                      </button>
                    )}
                  </div>
                )}
                {visible.recurUntil && <p className="mt-1 text-[11px] text-red-300">{visible.recurUntil}</p>}
                {recurrencePreview && <p className="mt-1 text-[11px] text-cyan-200/70">{recurrencePreview}</p>}
              </div>
            )}

            {/* Reminder */}
            <div>
              <label htmlFor={`${ids}-reminder`} className="mb-1 flex items-center gap-1 text-[11px] text-white/60">
                <Bell className="h-3 w-3" /> Reminder
              </label>
              <select
                id={`${ids}-reminder`}
                value={allDay || reminder === null ? 'none' : String(reminder)}
                onChange={(e) => {
                  const value = e.target.value;
                  setReminder(value === 'none' ? null : Number(value));
                }}
                disabled={allDay}
                className={cn(fieldBase, 'border-white/10 px-2 py-1.5')}
              >
                <option value="none" className="bg-[#111118]">
                  No reminder
                </option>
                {REMINDER_OPTIONS.map((minutes) => (
                  <option key={minutes} value={String(minutes)} className="bg-[#111118]">
                    {reminderLabel(minutes)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-white/40">
                {allDay
                  ? 'Add a start time to get a reminder.'
                  : 'NEXUS reminds you while Warrior OS is open in this browser.'}
              </p>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor={`${ids}-notes`} className="mb-1 block text-[11px] text-white/60">
                Notes <span className="text-white/35">(optional)</span>
              </label>
              <textarea
                id={`${ids}-notes`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={MAX_EVENT_NOTES_LENGTH}
                rows={2}
                placeholder="Syllabus, links, what to bring..."
                className={cn(fieldBase, 'resize-none px-3 py-2', visible.notes ? 'border-red-500/50' : 'border-white/10')}
              />
              {visible.notes && <p className="mt-1 text-[11px] text-red-300">{visible.notes}</p>}
            </div>
          </div>

          {/* Delete confirmation */}
          {event && confirmingDelete && (
            <div className="shrink-0 border-t border-red-500/20 bg-red-500/10 px-4 py-2.5">
              <p className="text-xs text-red-200">
                {isRecurringEdit ? 'Delete which events?' : `Delete “${event.title}”?`}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {isRecurringEdit && (
                  <button
                    type="button"
                    onClick={deleteOccurrence}
                    className="rounded-md border border-red-400/40 bg-red-500/15 px-2 py-1 text-xs text-red-200 hover:bg-red-500/25"
                  >
                    Only {occurrenceLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={deleteSeries}
                  className="rounded-md border border-red-400/40 bg-red-500/25 px-2 py-1 text-xs font-semibold text-red-100 hover:bg-red-500/35"
                >
                  {isRecurringEdit ? 'Entire series' : 'Delete event'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-md px-2 py-1 text-xs text-white/60 hover:bg-white/10"
                >
                  Keep it
                </button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex shrink-0 items-center gap-2 border-t border-white/10 px-4 py-3">
            {event && !confirmingDelete && (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-red-300/80 transition-colors hover:bg-red-500/10 hover:text-red-200"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/30"
              >
                <Check className="h-3.5 w-3.5" />
                {event ? 'Save' : 'Add event'}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

export const EventModal = memo(EventModalInner);
