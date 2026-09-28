// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Cross-feature Event Contract
// Pending-then-dispatch delivery so lazily mounted apps never miss
// a request: the sender writes the detail to sessionStorage under
// 'warrior:pending:<event>' and then dispatches a window CustomEvent.
// Listeners consume the pending key on mount, then listen live.
// All functions are SSR-safe no-ops on the server.
// ═══════════════════════════════════════════════════════════

import type { NexusTone, NexusTrainingMode } from '@/types/nexus';

export const WARRIOR_EVENTS = {
  trainingStart: 'warrior:training-start',
  notesSearch: 'warrior:notes-search',
  nexusSay: 'warrior:nexus-say',
} as const;

/** Legacy event fired by CreatureHatch: detail { message, source }. */
export const LEGACY_NEXUS_EVENT = 'warrior:nexus';

export type WarriorEventName = (typeof WARRIOR_EVENTS)[keyof typeof WARRIOR_EVENTS];

/** detail of 'warrior:training-start' (Training Grounds deep link) */
export interface WarriorTrainingStartDetail {
  /** Free text naming one of the user's decks or topics, e.g. "javascript". */
  subject?: string;
  mode?: NexusTrainingMode;
}

/** detail of 'warrior:notes-search' */
export interface WarriorNotesSearchDetail {
  query: string;
}

/** detail of 'warrior:nexus-say' */
export interface WarriorNexusSayDetail {
  text: string;
  tone?: NexusTone;
}

const PENDING_PREFIX = 'warrior:pending:';

function pendingKey(name: string): string {
  return `${PENDING_PREFIX}${name}`;
}

/** Sender side: persist the detail as pending, then dispatch the live event. */
export function emitWarriorEvent(name: WarriorEventName, detail: object): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(pendingKey(name), JSON.stringify(detail));
  } catch {
    /* storage unavailable (private mode / quota) — live event still fires */
  }
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

/** Listener side: read + remove the pending detail (null when none). */
export function takePendingWarriorEvent(name: WarriorEventName): unknown {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(pendingKey(name));
    if (raw === null) return null;
    window.sessionStorage.removeItem(pendingKey(name));
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** Listener side: drop the pending key after handling a live event. */
export function clearPendingWarriorEvent(name: WarriorEventName): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(pendingKey(name));
  } catch {
    /* ignore */
  }
}

const TONES: readonly NexusTone[] = ['info', 'success', 'warning', 'danger'];

/** Validate an unknown 'warrior:nexus-say' detail. */
export function parseNexusSayDetail(raw: unknown): WarriorNexusSayDetail | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const text = typeof record.text === 'string' ? record.text.trim() : '';
  if (!text) return null;
  const tone =
    typeof record.tone === 'string' && (TONES as readonly string[]).includes(record.tone)
      ? (record.tone as NexusTone)
      : undefined;
  return { text: text.slice(0, 400), tone };
}

/**
 * Convenience sender any feature can use to make NEXUS speak.
 * Equivalent to emitting 'warrior:nexus-say' by hand.
 */
export function nexusSay(text: string, tone: NexusTone = 'info'): void {
  emitWarriorEvent(WARRIOR_EVENTS.nexusSay, { text, tone } satisfies WarriorNexusSayDetail);
}
