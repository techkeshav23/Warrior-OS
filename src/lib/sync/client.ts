// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Owner sync: browser engine
//
// Owner session only. Every saved 'warrior*' localStorage key (except
// the device-only ones below) is mirrored to /api/sync. The engine:
//   1. scans localStorage and stamps each changed key with the time it
//      noticed the change (kept in META_KEY, per device),
//   2. pulls entries other devices pushed since the last revision and
//      applies each one that is newer than the local copy,
//   3. pushes local changes; the server keeps the newest per key.
// The token is saved on this device only (TOKEN_KEY, never synced).
// ═══════════════════════════════════════════════════════════

'use client';

import type {
  SyncEntry,
  SyncPullResponse,
  SyncPushResponse,
} from './protocol';
import { SYNC_KEY_PATTERN } from './protocol';

export const TOKEN_KEY = 'warrior-os-sync-token';
const META_KEY = 'warrior-os-sync-meta';

/** Per-device keys: identity, onboarding, screen layout, caches, sync itself. */
const DEVICE_ONLY = new Set([
  TOKEN_KEY,
  META_KEY,
  'warrior-os-visitor-mode',
  'warrior-os-owner-history',
  'warrior-os-demo-seeded',
  'warrior-os-tour',
  'warrior-os-small-screen-continue',
  'warrior-os-widgets',
  'warrior-os-phantom',
  'warrior-os-ghost-presence',
  'warrior-ghost-session-id',
  'warrior-decay-debug',
  'warrior-command-palette-input',
  'warrior-weather-last',
  'warrior-campfire-pos',
  'warrior-codelab-layout',
  'warrior-glitch-filter',
]);

export function isSyncedKey(key: string): boolean {
  return SYNC_KEY_PATTERN.test(key) && !key.startsWith('warrior:') && !DEVICE_ONLY.has(key);
}

// ─── Status (read by Settings → Account) ───

export type SyncState = 'off' | 'idle' | 'syncing' | 'error';

export interface SyncStatus {
  state: SyncState;
  lastSync: number | null;
  /** Short reason for the last failure. */
  error: string | null;
}

let status: SyncStatus = { state: 'off', lastSync: null, error: null };
const listeners = new Set<() => void>();

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSyncStatus(): SyncStatus {
  return status;
}

const OFF_STATUS: SyncStatus = { state: 'off', lastSync: null, error: null };
export function getServerSyncStatus(): SyncStatus {
  return OFF_STATUS;
}

// ─── Token ───

export function getSyncToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSyncToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: sync stays off.
  }
}

/** Does this server have sync switched on (OWNER_SYNC_TOKEN set)? */
export async function fetchSyncConfigured(): Promise<boolean> {
  try {
    const res = await fetch('/api/sync?status=1', { cache: 'no-store' });
    if (!res.ok) return false;
    return ((await res.json()) as { configured?: unknown }).configured === true;
  } catch {
    return false;
  }
}

/** Check a token against the server: 'ok', 'wrong' or 'unreachable'. */
export async function checkSyncToken(token: string): Promise<'ok' | 'wrong' | 'unreachable'> {
  try {
    const res = await fetch('/api/sync?since=0&probe=1', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return 'ok';
    return res.status === 401 || res.status === 429 ? 'wrong' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}

// ─── Local change tracking ───

interface Meta {
  rev: number;
  /** A sync round has completed on this device. */
  joined?: boolean;
  /** h: value hash, t: change time, p: not yet on the server. */
  keys: Record<string, { h: string; t: number; p?: boolean }>;
}

function readMeta(): Meta {
  try {
    const parsed = JSON.parse(localStorage.getItem(META_KEY) ?? '') as Partial<Meta>;
    if (parsed && typeof parsed.rev === 'number' && parsed.keys && typeof parsed.keys === 'object') {
      return { rev: parsed.rev, joined: parsed.joined === true, keys: parsed.keys };
    }
  } catch {
    // Missing or unreadable: start fresh (every local key counts as unsynced).
  }
  return { rev: 0, keys: {} };
}

function writeMeta(meta: Meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Storage full: the next scan re-detects the same changes.
  }
}

/** FNV-1a, enough to notice that a value changed. */
function hash(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(36)}:${value.length}`;
}

/** Stamp local changes since the last scan; returns the changed keys. */
function scan(meta: Meta, now: number): string[] {
  const changed: string[] = [];
  const present = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !isSyncedKey(key)) continue;
    present.add(key);
    const h = hash(localStorage.getItem(key) ?? '');
    const known = meta.keys[key];
    if (!known || known.h !== h) {
      // Before this device first syncs, t 0 lets the server's copy win.
      meta.keys[key] = { h, t: known || meta.joined ? now : 0, p: true };
      changed.push(key);
    }
  }
  for (const key of Object.keys(meta.keys)) {
    if (!present.has(key) && meta.keys[key].h !== 'deleted') {
      meta.keys[key] = { h: 'deleted', t: now, p: true };
      changed.push(key);
    }
  }
  return changed;
}

// ─── One sync round ───

let running: Promise<void> | null = null;

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function round(token: string, refresh: (keys: string[]) => Promise<void>): Promise<void> {
  const meta = readMeta();
  scan(meta, Date.now());

  // Pull: apply what other devices changed, when it is newer here.
  const pullRes = await fetch(`/api/sync?since=${meta.rev}`, {
    cache: 'no-store',
    headers: authHeaders(token),
  });
  if (!pullRes.ok) throw new Error(pullRes.status === 401 ? 'wrong_token' : `pull_${pullRes.status}`);
  const pulled = (await pullRes.json()) as SyncPullResponse;
  const applied: string[] = [];
  for (const [key, entry] of Object.entries(pulled.entries)) {
    if (!isSyncedKey(key)) continue;
    const local = meta.keys[key];
    if (local && local.t >= entry.t) continue;
    try {
      if (entry.v === null) localStorage.removeItem(key);
      else localStorage.setItem(key, entry.v);
    } catch {
      continue; // Storage full: keep the local copy.
    }
    meta.keys[key] = { h: entry.v === null ? 'deleted' : hash(entry.v), t: entry.t };
    applied.push(key);
  }
  meta.rev = Math.max(meta.rev, pulled.rev);
  writeMeta(meta);
  if (applied.length) {
    await refresh(applied);
    // Stores may re-save what they loaded; stamp that as already synced.
    const after = readMeta();
    for (const key of applied) {
      const raw = localStorage.getItem(key);
      if (raw !== null && after.keys[key]) after.keys[key].h = hash(raw);
    }
    writeMeta(after);
  }

  // Push: local changes the server has not seen.
  const current = readMeta();
  const changes: Record<string, SyncEntry> = {};
  for (const [key, stamp] of Object.entries(current.keys)) {
    if (!stamp.p) continue;
    // t 0 (never synced, not on the server): the oldest possible change.
    const t = stamp.t || 1;
    changes[key] = { v: stamp.h === 'deleted' ? null : localStorage.getItem(key), t };
  }
  if (Object.keys(changes).length === 0) return;
  const pushRes = await fetch('/api/sync', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ changes }),
  });
  if (!pushRes.ok) throw new Error(pushRes.status === 401 ? 'wrong_token' : `push_${pushRes.status}`);
  const pushed = (await pushRes.json()) as SyncPushResponse;
  const m = readMeta();
  for (const key of pushed.applied) {
    // Same stamp as the server, so the next pull skips our own change.
    if (m.keys[key]) m.keys[key] = { ...m.keys[key], t: changes[key].t, p: false };
  }
  // Ignored keys are older than the server copy; the next pull brings it.
  for (const key of pushed.ignored) {
    if (m.keys[key]) m.keys[key] = { ...m.keys[key], t: 0, p: false };
  }
  writeMeta(m);
}

/** Run one sync round now (rounds never overlap). */
export function syncNow(refresh: (keys: string[]) => Promise<void>): Promise<void> {
  if (running) return running;
  const token = getSyncToken();
  if (!token) {
    setStatus({ state: 'off', error: null });
    return Promise.resolve();
  }
  setStatus({ state: 'syncing' });
  running = round(token, refresh)
    .then(() => {
      const meta = readMeta();
      if (!meta.joined) writeMeta({ ...meta, joined: true });
      setStatus({ state: 'idle', lastSync: Date.now(), error: null });
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'unreachable';
      setStatus({ state: 'error', error: message === 'Failed to fetch' ? 'unreachable' : message });
    })
    .finally(() => {
      running = null;
    });
  return running;
}

/** Forget this device's sync state (on disconnect). */
export function resetSyncState(): void {
  try {
    localStorage.removeItem(META_KEY);
  } catch {
    // Nothing to clear.
  }
  setStatus({ state: 'off', lastSync: null, error: null });
}
