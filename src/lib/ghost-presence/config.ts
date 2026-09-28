// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Ghost presence: configuration
// Realtime presence activates only when NEXT_PUBLIC_FIREBASE_DATABASE_URL
// is set to a real RTDB URL. No API key is read or needed: the Realtime
// Database accepts unauthenticated connections governed by the rules.
// ═══════════════════════════════════════════════════════════

/** Heartbeat: presence is re-written at most once every 5 minutes. */
export const PRESENCE_UPDATE_MS = 5 * 60 * 1000;
/** Presence entries older than this are ignored (crashed / stale clients). */
export const PRESENCE_STALE_MS = 10 * 60 * 1000;
/** Incoming war cries older than this (e.g. on first load) are not shown. */
export const WARCRY_FRESH_MS = 60 * 1000;
/** War cries older than this may be pruned by any client. */
export const WARCRY_PRUNE_AFTER_MS = 60 * 60 * 1000;
/** Upper bound on presence rows downloaded. */
export const PRESENCE_QUERY_LIMIT = 200;

/**
 * The configured database URL, or null when missing / a placeholder.
 * `process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL` is inlined at build time.
 */
export function getGhostDatabaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  if (!raw) return null;
  const url = raw.trim();
  if (!url || url.startsWith('your_') || !/^https:\/\/\S+$/.test(url)) return null;
  return url.replace(/\/+$/, '');
}

export function isRealtimePresenceConfigured(): boolean {
  return getGhostDatabaseUrl() !== null;
}
