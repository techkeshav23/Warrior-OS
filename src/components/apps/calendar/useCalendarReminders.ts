// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Calendar reminders
// Delivers event reminders through NEXUS ('warrior:nexus-say').
// Used by the Calendar window and by the global <CalendarReminders />
// drop-in; the persisted remindedKeys list makes every reminder
// fire once even when both are mounted.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { useCalendarStore } from '@/stores/useCalendarStore';
import type { CalendarOccurrence } from '@/types/calendar';
import { CALENDAR_CATEGORY_MAP, expandOccurrences, toDateKey } from './calendar-utils';

const CHECK_EVERY_MS = 20_000;
/** A missed reminder is still delivered up to this long after the event starts. */
const LATE_GRACE_MS = 5 * 60_000;
/** Longest reminder lead time offered is one day. */
const MAX_LEAD_DAYS = 1;

const NEXUS_SAY_EVENT = 'warrior:nexus-say';

/** Cross-feature contract: park the detail in sessionStorage, then dispatch the live event. */
function nexusSay(text: string): void {
  if (typeof window === 'undefined') return;
  const detail = { text, tone: 'info' as const };
  try {
    window.sessionStorage.setItem(`warrior:pending:${NEXUS_SAY_EVENT}`, JSON.stringify(detail));
  } catch {
    // sessionStorage can be unavailable (privacy mode / quota); the live event still fires.
  }
  window.dispatchEvent(new CustomEvent(NEXUS_SAY_EVENT, { detail }));
}

/** Identity of one delivered reminder; editing the time or lead re-arms it. */
export function reminderKey(eventId: string, date: string, time: string, minutes: number): string {
  return `${eventId}@${date}T${time}~${minutes}`;
}

function reminderText(occ: CalendarOccurrence, startMs: number, nowMs: number, todayKey: string): string {
  const label = CALENDAR_CATEGORY_MAP[occ.event.category].label;
  const at = format(startMs, 'h:mm a');
  const tomorrow = occ.date !== todayKey ? ' tomorrow' : '';
  const minutesLeft = Math.round((startMs - nowMs) / 60_000);
  const prefix = `Reminder (${label}): ${occ.event.title}`;
  if (minutesLeft <= 0) return `${prefix} is starting now, ${at}.`;
  if (minutesLeft < 60) return `${prefix} starts in ${minutesLeft} min, at ${at}${tomorrow}.`;
  const hours = Math.floor(minutesLeft / 60);
  const rest = minutesLeft % 60;
  return `${prefix} starts in ${hours} h${rest ? ` ${rest} min` : ''}, at ${at}${tomorrow}.`;
}

/** Deliver every reminder that is due at `nowMs` and not yet delivered. */
export function deliverDueReminders(nowMs: number): void {
  const { events } = useCalendarStore.getState();
  const withReminders = events.filter((e) => e.time !== null && e.reminderMinutes !== null);
  if (withReminders.length === 0) return;

  const todayKey = toDateKey(nowMs);
  const today = parseISO(todayKey);
  // Yesterday covers the grace window just after midnight; the far end covers 1-day leads.
  const occurrences = expandOccurrences(
    withReminders,
    toDateKey(addDays(today, -1)),
    toDateKey(addDays(today, MAX_LEAD_DAYS + 1))
  );

  for (const occ of occurrences) {
    const { time, reminderMinutes } = occ.event;
    if (time === null || reminderMinutes === null) continue;
    const startMs = parseISO(`${occ.date}T${time}`).getTime();
    const fireAtMs = startMs - reminderMinutes * 60_000;
    if (nowMs < fireAtMs || nowMs > startMs + LATE_GRACE_MS) continue;

    const key = reminderKey(occ.event.id, occ.date, time, reminderMinutes);
    const store = useCalendarStore.getState();
    if (store.remindedKeys.includes(key)) continue;
    store.markReminded(key, todayKey);
    nexusSay(reminderText(occ, startMs, nowMs, todayKey));
  }
}

/** Checks for due reminders now and every 20 s while mounted. */
export function useCalendarReminders(): void {
  useEffect(() => {
    deliverDueReminders(Date.now());
    const id = window.setInterval(() => deliverDueReminders(Date.now()), CHECK_EVERY_MS);
    return () => window.clearInterval(id);
  }, []);
}
