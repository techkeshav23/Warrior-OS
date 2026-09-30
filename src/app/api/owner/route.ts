// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Owner Sign-in Route
//
// Checks the owner password for the lock screen and hands the device a
// sync credential (src/lib/sync/owner-auth.ts has the full story).
//
//   POST /api/owner { action: 'login', password }
//     → 200 { ok: true, credential }              stored password
//     → 200 { ok: true, mustChange: true }        temporary (env) password
//   POST /api/owner { action: 'change', password, newPassword }
//     → 200 { ok: true, credential }              new password stored
//   401 wrong password · 429 too many wrong tries (per IP)
//   200 { configured: false } when no password exists at all (sync off)
// ═══════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server';
import { clientIp } from '@/lib/client-ip';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  currentCredential,
  isOwnerAuthConfigured,
  isRateLimited,
  recordFailure,
  setOwnerPassword,
  verifyPassword,
} from '@/lib/sync/owner-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 4096;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  // A normal answer (not an error status): most deployments run without sync.
  if (!(await isOwnerAuthConfigured())) return json({ configured: false });
  const ip = clientIp(req);
  if (isRateLimited(ip)) return json({ error: 'rate_limited' }, 429);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'body_too_large' }, 413);
  let body: { action?: unknown; password?: unknown; newPassword?: unknown };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!body || typeof body.password !== 'string') return json({ error: 'invalid_body' }, 400);

  let who: Awaited<ReturnType<typeof verifyPassword>>;
  try {
    who = await verifyPassword(body.password);
  } catch {
    return json({ error: 'storage_error' }, 500);
  }
  if (!who) {
    recordFailure(ip);
    return json({ error: 'wrong_password' }, 401);
  }

  if (body.action === 'login') {
    if (who === 'temporary') return json({ ok: true, mustChange: true });
    return json({ ok: true, credential: await currentCredential() });
  }

  if (body.action === 'change') {
    const next = typeof body.newPassword === 'string' ? body.newPassword.trim() : '';
    if (next.length < MIN_PASSWORD_LENGTH || next.length > MAX_PASSWORD_LENGTH) {
      return json({ error: 'weak_password', min: MIN_PASSWORD_LENGTH }, 400);
    }
    if (next === body.password.trim()) return json({ error: 'same_password' }, 400);
    try {
      return json({ ok: true, credential: await setOwnerPassword(next) });
    } catch {
      return json({ error: 'storage_error' }, 500);
    }
  }

  return json({ error: 'invalid_action' }, 400);
}
