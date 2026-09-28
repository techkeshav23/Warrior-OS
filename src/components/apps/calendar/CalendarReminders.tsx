// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Calendar Reminders (global drop-in)
// Mount once in the desktop phase so event reminders reach NEXUS
// even while the Calendar window is closed. Renders nothing.
// ═══════════════════════════════════════════════════════════

'use client';

import { useCalendarReminders } from './useCalendarReminders';

export function CalendarReminders() {
  useCalendarReminders();
  return null;
}
