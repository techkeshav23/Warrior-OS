// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Reminder Store
// Reminders NEXUS sets ("remind me in 30 minutes", "kal 7 baje gym"),
// fired by ReminderEngine (src/components/nexus/ReminderEngine.tsx).
// Calendar events have their own reminders (useCalendarReminders).
// Persisted as 'warrior-os-reminders' (mirrored by owner sync).
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

export interface Reminder {
  id: string;
  text: string;
  /** When to fire (ms since epoch). */
  dueAt: number;
  createdAt: number;
  /** Set once it has fired (kept a while for "what did you remind me"). */
  firedAt?: number;
}

export const REMINDER_STORAGE_KEY = 'warrior-os-reminders';
const MAX_PENDING = 100;
const MAX_FIRED = 30;
const KEEP_FIRED_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TEXT = 200;

interface ReminderState {
  reminders: Reminder[];

  addReminder: (text: string, dueAt: number) => Reminder | null;
  cancelReminder: (id: string) => boolean;
  markFired: (id: string, at: number) => void;
}

function tidy(list: Reminder[], now: number): Reminder[] {
  const pending = list.filter((r) => r.firedAt === undefined).sort((a, b) => a.dueAt - b.dueAt).slice(0, MAX_PENDING);
  const fired = list
    .filter((r) => r.firedAt !== undefined && now - (r.firedAt ?? 0) < KEEP_FIRED_MS)
    .sort((a, b) => (b.firedAt ?? 0) - (a.firedAt ?? 0))
    .slice(0, MAX_FIRED);
  return [...pending, ...fired];
}

function isReminder(value: unknown): value is Reminder {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.text === 'string' &&
    typeof r.dueAt === 'number' &&
    Number.isFinite(r.dueAt) &&
    typeof r.createdAt === 'number' &&
    (r.firedAt === undefined || typeof r.firedAt === 'number')
  );
}

export const useReminderStore = create<ReminderState>()(
  persist(
    immer((set, get) => ({
      reminders: [],

      addReminder: (text, dueAt) => {
        const clean = text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
        if (!clean || !Number.isFinite(dueAt)) return null;
        const now = Date.now();
        const reminder: Reminder = {
          id: `rem_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          text: clean,
          dueAt,
          createdAt: now,
        };
        set((s) => {
          s.reminders = tidy([...s.reminders, reminder], now);
        });
        return get().reminders.some((r) => r.id === reminder.id) ? reminder : null;
      },
      cancelReminder: (id) => {
        const exists = get().reminders.some((r) => r.id === id && r.firedAt === undefined);
        if (exists) set((s) => void (s.reminders = s.reminders.filter((r) => r.id !== id)));
        return exists;
      },
      markFired: (id, at) =>
        set((s) => {
          const r = s.reminders.find((x) => x.id === id);
          if (r && r.firedAt === undefined) r.firedAt = at;
          s.reminders = tidy(s.reminders, at);
        }),
    })),
    {
      name: REMINDER_STORAGE_KEY,
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ReminderState>;
        return {
          ...current,
          reminders: Array.isArray(p.reminders) ? tidy(p.reminders.filter(isReminder), Date.now()) : current.reminders,
        };
      },
      partialize: (s) => ({ reminders: s.reminders }),
    }
  )
);
