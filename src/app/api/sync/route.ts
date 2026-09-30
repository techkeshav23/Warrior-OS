// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Owner Sync Route
//
// Mirrors the owner's saved data between their devices through this
// app's own server (no third-party service). Requests carry the device
// credential that POST /api/owner hands out after the owner password
// (src/lib/sync/owner-auth.ts). With no password configured the route
// reports { configured: false } and refuses everything else.
//
//   GET  /api/sync?status=1       → { configured }             (public)
//   GET  /api/sync?since=<rev>    → { rev, entries }           (Bearer)
//   POST /api/sync  { changes }   → { rev, applied, ignored }  (Bearer)
//
// Wrong credentials count toward the owner sign-in rate limit.
// ═══════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server';
import { clientIp } from '@/lib/client-ip';
import {
  MAX_PUSH_BYTES,
  SYNC_KEY_PATTERN,
  isValidEntry,
  type SyncEntry,
} from '@/lib/sync/protocol';
import { applyChanges, readSince } from '@/lib/sync/server-store';
import {
  isOwnerAuthConfigured,
  isRateLimited,
  isValidCredential,
  recordFailure,
} from '@/lib/sync/owner-auth';

// Reads and writes the data file on the server's disk.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** null when the request may proceed, else the error response. */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  if (!(await isOwnerAuthConfigured())) return json({ error: 'not_configured' }, 404);
  const ip = clientIp(req);
  if (isRateLimited(ip)) return json({ error: 'rate_limited' }, 429);
  const header = req.headers.get('authorization') ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (given && (await isValidCredential(given))) return null;
  recordFailure(ip);
  return json({ error: 'unauthorized' }, 401);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  if (params.has('status')) return json({ configured: await isOwnerAuthConfigured() });

  const denied = await authorize(req);
  if (denied) return denied;
  const since = Number(params.get('since') ?? 0);
  try {
    return json(await readSince(Number.isFinite(since) && since > 0 ? since : 0));
  } catch {
    return json({ error: 'storage_error' }, 500);
  }
}

export async function POST(req: NextRequest) {
  const denied = await authorize(req);
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
