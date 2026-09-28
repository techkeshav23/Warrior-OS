// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Ghost presence: Firebase Realtime Database adapter
//   /presence/{connectionId} = { anonymousId, studyHoursToday,
//                                quizzesToday, streak, lastActive }
//     • written on connect, removed by onDisconnect().remove()
//     • refreshed at most once every 5 minutes (heartbeat)
//     • readers ignore entries whose lastActive is > 10 minutes old
//   /warcries/{pushId} = { anonymousId, message (≤ 50 chars), timestamp }
// firebase/app + firebase/database are imported lazily, only when
// NEXT_PUBLIC_FIREBASE_DATABASE_URL is configured. No API key is used.
// ═══════════════════════════════════════════════════════════

import type { GhostSelfStats, GhostWarrior, WarCry } from '@/types/ghost';
import type { GhostTransport } from './transport';
import { sanitizeWarCry } from './transport';
import { WARRIOR_ID_PATTERN } from './identity';
import {
  PRESENCE_QUERY_LIMIT,
  PRESENCE_STALE_MS,
  PRESENCE_UPDATE_MS,
  WARCRY_FRESH_MS,
  WARCRY_PRUNE_AFTER_MS,
  getGhostDatabaseUrl,
} from './config';

const APP_NAME = 'warrior-os-ghost-warriors';

export interface RealtimePresenceOptions {
  selfId: string;
  getSelfStats: () => GhostSelfStats;
  onWarriors: (warriors: GhostWarrior[]) => void;
  onWarCry: (cry: WarCry) => void;
  /** Connection state changes + readable errors (e.g. rules denied). */
  onStatus: (connected: boolean, error: string | null) => void;
}

// Active realtime sessions sharing the one Database instance; the socket
// is only taken offline when the last one stops (StrictMode / HMR safe).
let activeSessions = 0;

function clampNum(v: unknown, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return Math.min(max, Math.max(min, n));
}

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === 'string' ? err : 'unknown error';
}

/** Validate + normalise one presence row; null when invalid or stale. */
function parsePresence(value: unknown, serverNow: number, selfId: string): GhostWarrior | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.anonymousId !== 'string' || !WARRIOR_ID_PATTERN.test(v.anonymousId)) return null;
  const last = typeof v.lastActive === 'number' ? v.lastActive : Number.NaN;
  if (!Number.isFinite(last) || serverNow - last > PRESENCE_STALE_MS) return null;
  return {
    anonymousId: v.anonymousId,
    studyHoursToday: Math.round(clampNum(v.studyHoursToday, 0, 24) * 10) / 10,
    quizzesToday: Math.round(clampNum(v.quizzesToday, 0, 500)),
    streak: Math.round(clampNum(v.streak, 0, 10_000)),
    isOnline: true,
    lastSeen: new Date(last).toISOString(),
    isSelf: v.anonymousId === selfId,
  };
}

/** One row per warrior (a duplicated tab shares an id) — keep the best stats. */
function mergeById(rows: GhostWarrior[]): GhostWarrior[] {
  const byId = new Map<string, GhostWarrior>();
  for (const row of rows) {
    const prev = byId.get(row.anonymousId);
    if (!prev) {
      byId.set(row.anonymousId, row);
      continue;
    }
    byId.set(row.anonymousId, {
      ...prev,
      studyHoursToday: Math.max(prev.studyHoursToday, row.studyHoursToday),
      quizzesToday: Math.max(prev.quizzesToday, row.quizzesToday),
      streak: Math.max(prev.streak, row.streak),
      lastSeen: prev.lastSeen > row.lastSeen ? prev.lastSeen : row.lastSeen,
    });
  }
  return [...byId.values()];
}

/**
 * Connect to Firebase RTDB presence. Resolves with a transport once the
 * SDK is loaded and listeners are attached; rejects when the database
 * URL is missing or the SDK fails to load.
 */
export async function connectRealtimePresence(options: RealtimePresenceOptions): Promise<GhostTransport> {
  const url = getGhostDatabaseUrl();
  if (!url) throw new Error('NEXT_PUBLIC_FIREBASE_DATABASE_URL is not configured');

  const [appSdk, db] = await Promise.all([import('firebase/app'), import('firebase/database')]);
  const app = appSdk.getApps().find((a) => a.name === APP_NAME) ?? appSdk.initializeApp({ databaseURL: url }, APP_NAME);
  const database = db.getDatabase(app);
  activeSessions += 1;
  db.goOnline(database);

  const { selfId } = options;
  let serverOffset = 0;
  const serverNow = () => Date.now() + serverOffset;
  const unsubscribers: (() => void)[] = [];
  let stopped = false;

  unsubscribers.push(
    db.onValue(db.ref(database, '.info/serverTimeOffset'), (snap) => {
      const v = snap.val();
      serverOffset = typeof v === 'number' ? v : 0;
    })
  );

  // ── Our presence row (one per connection) ──
  const presenceRoot = db.ref(database, 'presence');
  const myRef = db.push(presenceRoot); // key only — nothing written yet
  const payload = () => {
    const s = options.getSelfStats();
    return {
      anonymousId: selfId,
      studyHoursToday: Math.round(clampNum(s.studyHoursToday, 0, 24) * 10) / 10,
      quizzesToday: Math.round(clampNum(s.quizzesToday, 0, 500)),
      streak: Math.round(clampNum(s.streak, 0, 10_000)),
      lastActive: db.serverTimestamp(),
    };
  };

  unsubscribers.push(
    db.onValue(db.ref(database, '.info/connected'), (snap) => {
      if (stopped) return;
      if (snap.val() !== true) {
        options.onStatus(false, null);
        return;
      }
      // Register cleanup first, then announce ourselves.
      db.onDisconnect(myRef)
        .remove()
        .then(() => db.set(myRef, payload()))
        .then(() => {
          if (!stopped) options.onStatus(true, null);
        })
        .catch((err: unknown) => {
          if (!stopped) options.onStatus(false, `Presence write refused: ${errorText(err)}`);
        });
    })
  );

  // Heartbeat: at most one write per 5 minutes.
  const heartbeat = setInterval(() => {
    if (stopped) return;
    db.update(myRef, payload()).catch(() => undefined);
  }, PRESENCE_UPDATE_MS);

  // ── Everyone's presence ──
  let latest: Record<string, unknown> = {};
  const emit = () => {
    if (stopped) return;
    const now = serverNow();
    const rows: GhostWarrior[] = [];
    for (const value of Object.values(latest)) {
      const w = parsePresence(value, now, selfId);
      if (w) rows.push(w);
    }
    options.onWarriors(mergeById(rows));
  };
  unsubscribers.push(
    db.onValue(
      db.query(presenceRoot, db.orderByChild('lastActive'), db.limitToLast(PRESENCE_QUERY_LIMIT)),
      (snap) => {
        const v = snap.val();
        latest = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
        emit();
      },
      (err) => options.onStatus(false, `Presence read refused: ${errorText(err)}`)
    )
  );
  // Re-apply the 10-minute staleness filter even when nothing changes.
  const staleSweep = setInterval(emit, 60_000);

  // ── War cries ──
  const cryRoot = db.ref(database, 'warcries');
  const ownCryIds = new Set<string>();
  unsubscribers.push(
    db.onChildAdded(
      db.query(cryRoot, db.orderByChild('timestamp'), db.limitToLast(10)),
      (snap) => {
        const key = snap.key;
        if (!key || ownCryIds.has(key)) return;
        const v = snap.val() as Record<string, unknown> | null;
        if (!v) return;
        const ts = typeof v.timestamp === 'number' ? v.timestamp : Number.NaN;
        if (!Number.isFinite(ts) || serverNow() - ts > WARCRY_FRESH_MS) return;
        if (typeof v.anonymousId !== 'string' || !WARRIOR_ID_PATTERN.test(v.anonymousId)) return;
        const message = typeof v.message === 'string' ? sanitizeWarCry(v.message) : '';
        if (!message) return;
        options.onWarCry({
          id: key,
          message,
          timestamp: new Date(ts).toISOString(),
          anonymousId: v.anonymousId,
          isSelf: v.anonymousId === selfId,
        });
      },
      () => undefined
    )
  );

  // Best-effort pruning of war cries older than an hour (allowed by the rules).
  db.get(db.query(cryRoot, db.orderByChild('timestamp'), db.endAt(Date.now() - WARCRY_PRUNE_AFTER_MS), db.limitToFirst(25)))
    .then((snap) => {
      snap.forEach((child) => {
        db.remove(child.ref).catch(() => undefined);
      });
    })
    .catch(() => undefined);

  return {
    kind: 'realtime',
    broadcasts: true,
    createWarCryId: () => {
      const key = db.push(cryRoot).key ?? `cry-${Date.now().toString(36)}`;
      ownCryIds.add(key);
      return key;
    },
    publishWarCry: async (id, message) => {
      const text = sanitizeWarCry(message);
      await db.set(db.ref(database, `warcries/${id}`), {
        anonymousId: selfId,
        message: text,
        timestamp: db.serverTimestamp(),
      });
    },
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearInterval(heartbeat);
      clearInterval(staleSweep);
      unsubscribers.forEach((u) => u());
      activeSessions = Math.max(0, activeSessions - 1);
      db.onDisconnect(myRef).cancel().catch(() => undefined);
      db.remove(myRef)
        .catch(() => undefined)
        .finally(() => {
          if (activeSessions === 0) db.goOffline(database);
        });
    },
  };
}
