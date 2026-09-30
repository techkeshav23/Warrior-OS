// ═══════════════════════════════════════════════════════════
// WARRIOR OS — JARVIS Voice Route (owner-only text-to-speech)
//
// Turns a NEXUS reply into natural speech with Google Cloud
// Text-to-Speech, using the same Google Cloud login as JARVIS on
// Vertex AI (VERTEX_PROJECT + service account). Without it the browser
// keeps its built-in voice.
//
//   GET  /api/voice → { configured, voice }
//   POST /api/voice { text }  (Bearer owner credential)
//     200 audio/mpeg · 401 not the owner · 429 rate limited · 502 TTS error
// ═══════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server';
import { clientIp } from '@/lib/client-ip';
import { isRateLimited, isValidCredential, recordFailure } from '@/lib/sync/owner-auth';
import { googleAccessToken, vertexProject } from '@/lib/jarvis/google';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const DEFAULT_VOICE = 'en-IN-Neural2-B';
const MAX_CHARS = 1200;
const REQUESTS_PER_MIN = 30;
const buckets = new Map<string, number[]>();

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function voiceName(): string {
  return process.env.JARVIS_VOICE?.trim() || DEFAULT_VOICE;
}

function takeToken(ip: string): boolean {
  const now = Date.now();
  const recent = (buckets.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= REQUESTS_PER_MIN) return false;
  recent.push(now);
  buckets.set(ip, recent);
  if (buckets.size > 1000) buckets.delete(buckets.keys().next().value as string);
  return true;
}

export async function GET() {
  const configured = vertexProject() !== null && process.env.JARVIS_VOICE?.trim() !== 'off';
  return json({ configured, voice: configured ? voiceName() : null });
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (isRateLimited(ip)) return json({ error: 'rate_limited' }, 429);
  const header = req.headers.get('authorization') ?? '';
  const credential = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!credential || !(await isValidCredential(credential))) {
    recordFailure(ip);
    return json({ error: 'owner_only' }, 401);
  }
  const project = vertexProject();
  if (!project) return json({ error: 'not_configured' }, 503);
  if (!takeToken(ip)) return json({ error: 'rate_limited' }, 429);

  let text = '';
  try {
    const body = (await req.json()) as { text?: unknown };
    text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_CHARS) : '';
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!text) return json({ error: 'empty_text' }, 400);

  const voice = voiceName();
  // "en-IN-Neural2-B" → language "en-IN".
  const languageCode = voice.split('-').slice(0, 2).join('-');
  try {
    const res = await fetch(TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await googleAccessToken()}`,
      },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode, name: voice },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1.05 },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return json({ error: `tts_${res.status}` }, 502);
    const data = (await res.json()) as { audioContent?: string };
    if (!data.audioContent) return json({ error: 'tts_empty' }, 502);
    return new NextResponse(Buffer.from(data.audioContent, 'base64'), {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    });
  } catch {
    return json({ error: 'tts_unreachable' }, 502);
  }
}
