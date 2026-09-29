// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Biometric Cloud Sync (optional)
// Mirrors the hourly biometric aggregates to Firestore at
//   users/{uid}/biometrics/{YYYY-MM-DD}  →  { day, hours: { "15": {...} } }
// ONLY when Firebase is configured (NEXT_PUBLIC_FIREBASE_* env) and a
// signed-in user exists in an owner session (guest sessions hold demo
// data and never sync). Firebase is imported lazily, every failure is
// swallowed, and after an error sync switches itself off for the
// session — the local history (localStorage) is always the source of
// truth, so the OS works identically offline or without keys.
// Only hourly averages of timing statistics ever leave the device.
// ═══════════════════════════════════════════════════════════

import { useBiometricsStore } from '@/stores/useBiometricsStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { isFirebaseConfigured } from '@/lib/auth';
import { getVisitorMode } from '@/lib/visitor';
import type { BiometricSnapshot } from '@/types/biometrics';

const SYNC_EVERY_MS = 15 * 60_000;
const FIRST_SYNC_DELAY_MS = 30_000;

/** True when the public Firebase config is present in the bundle. */
export function isBiometricCloudSyncAvailable(): boolean {
  return isFirebaseConfigured();
}

export type CloudSyncState = 'idle' | 'syncing' | 'synced' | 'paused';

export interface CloudSyncStatus {
  state: CloudSyncState;
  /** Epoch ms of the last successful upload this session. */
  lastSyncAt: number | null;
}

let status: CloudSyncStatus = { state: 'idle', lastSyncAt: null };
const listeners = new Set<() => void>();

function setStatus(next: Partial<CloudSyncStatus>): void {
  status = { ...status, ...next };
  for (const l of listeners) l();
}

/** useSyncExternalStore pair for showing sync state (Settings → Account). */
export function subscribeCloudSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function getCloudSyncStatus(): CloudSyncStatus {
  return status;
}

/** Bucket key (uid|day|hour) → samples count already uploaded (this session). */
const uploaded = new Map<string, number>();
let disabled = false;
let inFlight = false;

/** Per account, so signing in as someone else uploads their copy too. */
function bucketKey(uid: string, s: BiometricSnapshot): string {
  return `${uid}|${s.day ?? ''}|${s.hour}`;
}

function currentUid(): string | null {
  if (getVisitorMode() !== 'owner') return null;
  const user = useAuthStore.getState().user;
  return user && typeof user.uid === 'string' && user.uid.length > 0 ? user.uid : null;
}

/**
 * Upload changed hourly buckets. Never throws. `retry` (a user's "Sync now")
 * clears the switch-off left by an earlier failure.
 */
export async function syncBiometricHistory(retry = false): Promise<void> {
  if (retry && !inFlight) disabled = false;
  if (disabled || inFlight || typeof window === 'undefined') return;
  if (!isBiometricCloudSyncAvailable() || !navigator.onLine) return;
  const uid = currentUid();
  if (!uid) return;

  const changed = useBiometricsStore
    .getState()
    .hourly.filter((s) => s.day && uploaded.get(bucketKey(uid, s)) !== (s.samples ?? 1));
  if (changed.length === 0) return;

  inFlight = true;
  setStatus({ state: 'syncing' });
  try {
    const [{ db }, fs] = await Promise.all([import('@/lib/firebase'), import('firebase/firestore')]);
    const byDay = new Map<string, BiometricSnapshot[]>();
    for (const s of changed) {
      const list = byDay.get(s.day as string) ?? [];
      list.push(s);
      byDay.set(s.day as string, list);
    }
    for (const [day, snaps] of byDay) {
      const hours: Record<string, unknown> = {};
      for (const s of snaps) {
        hours[String(s.hour)] = {
          timestamp: s.timestamp,
          samples: s.samples ?? 1,
          state: s.state,
          metrics: s.metrics,
        };
      }
      await fs.setDoc(
        fs.doc(db, 'users', uid, 'biometrics', day),
        { day, hours, updatedAt: fs.serverTimestamp() },
        { merge: true }
      );
      for (const s of snaps) uploaded.set(bucketKey(uid, s), s.samples ?? 1);
    }
    setStatus({ state: 'synced', lastSyncAt: Date.now() });
  } catch {
    // Misconfigured project, rules, or offline — stay local-only this session.
    disabled = true;
    setStatus({ state: 'paused' });
  } finally {
    inFlight = false;
  }
}

/** Start periodic background sync. Returns a stop function. No-op without config. */
export function startBiometricCloudSync(): () => void {
  if (typeof window === 'undefined' || !isBiometricCloudSyncAvailable()) return () => {};
  const run = () => void syncBiometricHistory();
  const first = window.setTimeout(run, FIRST_SYNC_DELAY_MS);
  const id = window.setInterval(run, SYNC_EVERY_MS);
  const onHide = () => {
    if (document.visibilityState === 'hidden') run();
  };
  document.addEventListener('visibilitychange', onHide);
  return () => {
    window.clearTimeout(first);
    window.clearInterval(id);
    document.removeEventListener('visibilitychange', onHide);
  };
}
