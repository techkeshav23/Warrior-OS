'use client';

// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Reminder Engine
// Renders nothing. Fires the reminders NEXUS set (useReminderStore):
// a NEXUS message (toast + nudge feed), the reply voice when voice
// replies are on, and a system notification while the tab is hidden.
// Checks every 15 s and whenever the tab comes back; reminders that
// came due while the OS was closed fire on the next visit, marked late.
// Owner sessions only: reminders are the owner's.
// ═══════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { getVisitorMode } from '@/lib/visitor';
import { nexusSay } from '@/lib/nexus/events';
import { speakNexus } from '@/lib/nexus/speech';
import { useReminderStore, type Reminder } from '@/stores/useReminderStore';

const CHECK_EVERY_MS = 15_000;
/** Later than this counts as missed and says when it was due. */
const LATE_AFTER_MS = 2 * 60_000;

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function fire(reminder: Reminder, now: number) {
  useReminderStore.getState().markFired(reminder.id, now);
  const lateBy = now - reminder.dueAt;
  const when =
    lateBy > 12 * 60 * 60_000 ? dayFormat.format(reminder.dueAt) : timeFormat.format(reminder.dueAt);
  const text = lateBy > LATE_AFTER_MS ? `Reminder (missed, ${when}): ${reminder.text}` : `Reminder: ${reminder.text}`;
  nexusSay(text, 'warning');
  speakNexus(text);
  try {
    if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Warrior OS', { body: text, tag: reminder.id });
    }
  } catch {
    // System notifications unavailable: the in-OS message still shows.
  }
}

export function ReminderEngine() {
  useEffect(() => {
    if (getVisitorMode() !== 'owner') return;
    const tick = () => {
      const now = Date.now();
      const due = useReminderStore
        .getState()
        .reminders.filter((r) => r.firedAt === undefined && r.dueAt <= now)
        .sort((a, b) => a.dueAt - b.dueAt);
      // One at a time keeps several missed reminders from talking over each other.
      if (due.length) fire(due[0], now);
    };
    tick();
    const timer = window.setInterval(tick, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return null;
}
