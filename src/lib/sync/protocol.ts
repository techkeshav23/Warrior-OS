// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Owner sync: shared protocol (client + server)
//
// The owner's localStorage keys are mirrored to this app's own server
// (/api/sync, stored on the VM's disk). Each key is one entry with its
// raw string value and the time it last changed; the newer change wins.
// A deleted key travels as a tombstone (v: null).
// ═══════════════════════════════════════════════════════════

export interface SyncEntry {
  /** Raw localStorage value, or null when the key was removed. */
  v: string | null;
  /** When the value last changed (ms since epoch). */
  t: number;
}

/** GET /api/sync?since=N → entries changed after revision N. */
export interface SyncPullResponse {
  rev: number;
  entries: Record<string, SyncEntry>;
}

/** POST /api/sync body. */
export interface SyncPushBody {
  changes: Record<string, SyncEntry>;
}

/** POST /api/sync → which changes the server kept (older ones are ignored). */
export interface SyncPushResponse {
  rev: number;
  applied: string[];
  ignored: string[];
}

export const SYNC_KEY_PATTERN = /^warrior[a-z0-9:._-]{0,80}$/i;
/** One value (a whole persisted store) may be up to 2 MB. */
export const MAX_VALUE_LENGTH = 2 * 1024 * 1024;
/** A push body may be up to 8 MB (localStorage itself is ~5 MB). */
export const MAX_PUSH_BYTES = 8 * 1024 * 1024;

export function isValidEntry(value: unknown): value is SyncEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  const okValue = e.v === null || (typeof e.v === 'string' && e.v.length <= MAX_VALUE_LENGTH);
  return okValue && typeof e.t === 'number' && Number.isFinite(e.t) && e.t > 0;
}
