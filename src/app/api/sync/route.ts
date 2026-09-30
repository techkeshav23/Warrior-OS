// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Owner Sync Route
//
// Mirrors the owner's saved data between their devices through this
// app's own server (no third-party service). Locked by one secret:
// OWNER_SYNC_TOKEN (server-only env). Without it the route reports
// { configured: false } and refuses everything else.
//
//   GET  /api/sync?status=1         → { configured }            (public)
//   GET  /api/sync?since=<rev>      → { rev, entries }          (Bearer token)
//   POST /api/sync  { changes }     → { rev, applied, ignored } (Bearer token)
//
// Wrong tokens are rate limited per client IP.
// ═══════════════════════════════════════════════════════════

import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { clientIp } from '@/lib/client-ip';
import {
  MAX_PUSH_BYTES,
  SYNC_KEY_PATTERN,
  isValidEntry,
  type SyncEntry,
} from '@/lib/sync/protocol';
import { applyChanges, readSince } from '@/lib/sync/server-store';

// Reads and writes the data file on the server's disk.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FAIL_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 10;
const MAX_TRACKED_IPS = 5000;
const failures = new Map<string, number[]>();

const NO_STORE = { 'Cache-Control': 'no-store' };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function configuredToken(): string | null {
  const token = process.env.OWNER_SYNC_TOKEN?.trim();
  return token && token.length >= 16 ? token : null;
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function recentFailures(ip: string, now: number): number[] {
  const list = (failures.get(ip) ?? []).filter((at) => now - at < FAIL_WINDOW_MS);
  if (list.length) failures.set(ip, list);
  else failures.delete(ip);
  return list;
}

/** null when the request may proceed, else the error response. */
function authorize(req: NextRequest): NextResponse | null {
  const token = configuredToken();
  if (!token) return json({ error: 'not_configured' }, 404);
  const ip = clientIp(req);
  const now = Date.now();
  if (recentFailures(ip, now).length >= MAX_FAILS) return json({ error: 'rate_limited' }, 429);

  const header = req.headers.get('authorization') ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (given && timingSafeEqual(digest(given), digest(token))) return null;

  if (failures.size >= MAX_TRACKED_IPS && !failures.has(ip)) {
    const oldest = failures.keys().next().value;
    if (oldest !== undefined) failures.delete(oldest);
  }
  failures.set(ip, [...recentFailures(ip, now), now]);
  return json({ error: 'unauthorized' }, 401);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  if (params.has('status')) return json({ configured: configuredToken() !== null });

  const denied = authorize(req);
  if (denied) return denied;
  const since = Number(params.get('since') ?? 0);
  try {
    return json(await readSince(Number.isFinite(since) && since > 0 ? since : 0));
  } catch {
    return json({ error: 'storage_error' }, 500);
  }
}

export async function POST(req: NextRequest) {
  const denied = authorize(req);
  if (denied) return denied;

  const raw = await req.text();
  if (raw.length > MAX_PUSH_BYTES) return json({ error: 'body_too_large' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const changes = (body as { changes?: unknown } | null)?.changes;
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    return json({ error: 'invalid_body' }, 400);
  }
  const clean: Record<string, SyncEntry> = {};
  for (const [key, entry] of Object.entries(changes as Record<string, unknown>)) {
    if (!SYNC_KEY_PATTERN.test(key) || !isValidEntry(entry)) return json({ error: 'invalid_entry', key }, 400);
    clean[key] = { v: entry.v, t: entry.t };
  }
  try {
    return json(await applyChanges(clean));
  } catch (err) {
    const full = err instanceof Error && err.message === 'sync_store_full';
    return json({ error: full ? 'storage_full' : 'storage_error' }, full ? 507 : 500);
  }
}
