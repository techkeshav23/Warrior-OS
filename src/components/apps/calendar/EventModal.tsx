// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Event Modal
// Add / edit / delete a calendar event: title, date, time (or
// all-day), category (Study / Project / Personal), colour, repeat
// (none / daily / weekly / monthly, optional end), reminder, notes.
// Editing one day of a recurring series can split that day out.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useId, useRef, useState, type FormEvent } from 'react';
import { Bell, CalendarCog, CalendarPlus, Check, Clock, Repeat, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button, Dialog, IconButton, Input, SegmentedControl, Select, Switch, Textarea } from '@/components/ui';
import {
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
  CATEGORY_COLOR,
  EVENT_COLOR_SWATCHES,
  RECURRENCE_OPTIONS,
  describeRecurrence,
  eventColor,
  isCategoryDefaultColor,
  isValidDateKey,
  isValidTime,
  reminderLabel,
  tintColor,
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
  const titleRef = useRef<HTMLInputElement>(null);
  const occurrenceDate = state.mode === 'edit' ? state.occurrenceDate : state.date;
  const isRecurringEdit = event !== null && event.recurrence !== 'none';

  const [title, setTitle] = useState(() => event?.title ?? '');
  const [scope, setScope] = useState<EditScope>('series');
  const [date, setDate] = useState(() => (event ? event.date : occurrenceDate));
  const [allDay, setAllDay] = useState(() => (event ? event.time === null : false));
  const [time, setTime] = useState(() => event?.time ?? DEFAULT_TIME);
  const [category, setCategory] = useState<CalendarEventCategory>(() => event?.category ?? 'study');
  const [color, setColor] = useState(() => (event ? eventColor(event.color) : CATEGORY_COLOR.study));
  const [colorTouched, setColorTouched] = useState(() =>
    event ? !isCategoryDefaultColor(event.color, event.category) : false
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
    if (!colorTouched) setColor(CATEGORY_COLOR[next]);
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
    color: HEX_RE.test(color) ? color : CATEGORY_COLOR[category],
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

  const colorLabelId = `${ids}-color-label`;
  const allDayId = `${ids}-allday`;

  return (
    <Dialog
      open
      onClose={onClose}
      title={event ? 'Edit event' : 'New event'}
      description={
        event
          ? isRecurringEdit
            ? `Part of a repeating series · ${occurrenceLabel}`
            : occurrenceLabel
          : `Plan something for ${occurrenceLabel}.`
      }
      icon={event ? CalendarCog : CalendarPlus}
      iconTone="accent"
      size="md"
      initialFocus={titleRef}
      footer={
        event && confirmingDelete ? (
          <div className="flex w-full flex-wrap items-center gap-2" role="group" aria-label="Confirm delete">
            <p className="mr-auto flex items-center gap-2 text-ui text-fg">
              <Trash2 size={16} strokeWidth={1.75} className="text-danger" aria-hidden />
              {isRecurringEdit ? 'Delete which events?' : `Delete “${event.title}”?`}
            </p>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
              Keep it
            </Button>
            {isRecurringEdit && (
              <Button variant="danger" onClick={deleteOccurrence}>
                Only {occurrenceLabel}
              </Button>
            )}
            <Button variant="danger" onClick={deleteSeries}>
              {isRecurringEdit ? 'Entire series' : 'Delete event'}
            </Button>
          </div>
        ) : (
          <div className="flex w-full items-center gap-2">
            {event && (
              <IconButton
                icon={Trash2}
                variant="ghost-danger"
                aria-label="Delete event"
                tooltip
                onClick={() => setConfirmingDelete(true)}
              />
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" form={`${ids}-form`} leadingIcon={Check}>
                {event ? 'Save' : 'Add event'}
              </Button>
            </div>
          </div>
        )
      }
    >
      <form id={`${ids}-form`} onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Series vs single day (recurring events opened from a day) */}
        {isRecurringEdit && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-fg-muted">Apply changes to</p>
            <SegmentedControl
              fullWidth
              aria-label="Apply changes to"
              value={scope}
              onChange={switchScope}
              options={[
                { value: 'series', label: 'Whole series' },
                { value: 'single', label: `Only ${occurrenceLabel}` },
              ]}
            />
            {scope === 'series' && (
              <p className="text-xs text-fg-subtle">
                Changes apply to every day in this series. Pick “Only {occurrenceLabel}” to change just that day.
              </p>
            )}
          </div>
        )}

        {/* Title */}
        <Input
          ref={titleRef}
          id={`${ids}-title`}
          label="Title"
          size="lg"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MAX_EVENT_TITLE_LENGTH}
          autoComplete="off"
          placeholder="Deep-work block, sprint review, gym..."
          error={visible.title}
        />

        {/* Date + time */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            id={`${ids}-date`}
            type="date"
            label={effectiveRecurrence !== 'none' ? 'Starts on' : 'Date'}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={visible.date}
            className="tabular"
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={`${ids}-time`} className="text-xs font-medium text-fg-muted">
                Time
              </label>
              <span className="flex items-center gap-1.5">
                <label htmlFor={allDayId} className="cursor-pointer text-xs text-fg-muted">
                  All day
                </label>
                <Switch id={allDayId} size="sm" checked={allDay} onCheckedChange={setAllDay} />
              </span>
            </div>
            <Input
              id={`${ids}-time`}
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={allDay}
              leadingIcon={Clock}
              error={visible.time}
              className="tabular"
            />
          </div>
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-fg-muted">Category</p>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Category">
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
                    'armor-plate chamfer-sm focus-ring flex h-9 items-center justify-center gap-2 text-ui font-medium',
                    'transition-[filter,color] duration-120 ease-out-quint',
                    active ? 'text-fg' : 'text-fg-muted hover:brightness-120 hover:text-fg'
                  )}
                  style={
                    active
                      ? {
                          backgroundColor: tintColor(c.color, 16),
                          boxShadow: `inset 0 0 0 1px ${tintColor(c.color, 55)}, inset 0 -2px 0 ${c.color}`,
                        }
                      : undefined
                  }
                >
                  <Icon size={16} strokeWidth={1.75} style={{ color: c.color }} aria-hidden />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Colour */}
        <div className="space-y-1.5">
          <p id={colorLabelId} className="text-xs font-medium text-fg-muted">
            Colour
          </p>
          <div role="radiogroup" aria-labelledby={colorLabelId} className="flex flex-wrap items-center gap-2">
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
                    'chamfer-xs focus-ring flex size-7 items-center justify-center transition-transform duration-120 ease-out-quint hover:scale-110',
                    active
                      ? 'shadow-[inset_0_0_0_2px_var(--color-fg),inset_0_0_0_3px_rgb(0_0_0/0.5)]'
                      : 'shadow-[inset_0_1px_0_rgb(255_255_255/0.35),inset_0_-1px_0_rgb(0_0_0/0.45)]'
                  )}
                  style={{ background: swatch }}
                >
                  {active && <Check size={12} strokeWidth={3} className="text-ink-950" aria-hidden />}
                </button>
              );
            })}
            <label
              className="armor-plate chamfer-sm relative ml-1 flex h-7 cursor-pointer items-center gap-1.5 px-2.5 text-xs text-fg-muted transition-[filter,color] duration-120 hover:brightness-120 hover:text-fg focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-accent"
              title="Custom colour"
            >
              <span className="chamfer size-3 [--cut:2px]" style={{ background: color }} aria-hidden />
              Custom
              <input
                type="color"
                value={HEX_RE.test(color) ? color : CATEGORY_COLOR.study}
                onChange={(e) => pickColor(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Custom colour"
              />
            </label>
          </div>
        </div>

        {/* Repeat */}
        {scope === 'series' && (
          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
              <Repeat size={14} strokeWidth={1.75} aria-hidden /> Repeat
            </p>
            <SegmentedControl
              fullWidth
              aria-label="Repeat"
              value={recurrence}
              onChange={setRecurrence}
              options={RECURRENCE_OPTIONS.map((opt) => ({ value: opt.id, label: opt.label }))}
            />
            {recurrence !== 'none' && (
              <div className="flex items-end gap-2 pt-1.5">
                <Input
                  id={`${ids}-until`}
                  type="date"
                  size="sm"
                  label="Until"
                  value={recurUntil}
                  min={isValidDateKey(date) ? date : undefined}
                  onChange={(e) => setRecurUntil(e.target.value)}
                  error={visible.recurUntil}
                  wrapperClassName="max-w-48"
                  className="tabular"
                />
                {recurUntil && (
                  <Button size="sm" variant="ghost" onClick={() => setRecurUntil('')}>
                    No end
                  </Button>
                )}
              </div>
            )}
            {recurrencePreview && (
              <p className="flex items-center gap-1.5 text-xs text-fg-muted">
                <Repeat size={12} strokeWidth={1.75} className="text-accent" aria-hidden />
                {recurrencePreview}
              </p>
            )}
          </div>
        )}

        {/* Reminder */}
        <Select
          id={`${ids}-reminder`}
          label={
            <span className="flex items-center gap-1.5">
              <Bell size={14} strokeWidth={1.75} aria-hidden /> Reminder
            </span>
          }
          value={allDay || reminder === null ? 'none' : String(reminder)}
          onValueChange={(value) => setReminder(value === 'none' ? null : Number(value))}
          disabled={allDay}
          hint={
            allDay ? 'Add a start time to get a reminder.' : 'NEXUS reminds you while Warrior OS is open in this browser.'
          }
          options={[
            { value: 'none', label: 'No reminder' },
            ...REMINDER_OPTIONS.map((minutes) => ({ value: String(minutes), label: reminderLabel(minutes) })),
          ]}
        />

        {/* Notes */}
        <Textarea
          id={`${ids}-notes`}
          label="Notes"
          labelAside="Optional"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={MAX_EVENT_NOTES_LENGTH}
          rows={2}
          resizable={false}
          placeholder="Agenda, links, what to bring..."
          error={visible.notes}
        />
      </form>
    </Dialog>
  );
}

export const EventModal = memo(EventModalInner);
