// ═══════════════════════════════════════════════════════════
// WARRIOR OS — JARVIS Route (owner-only agent brain)
//
// One model turn per request. The browser runs the loop: it sends the
// conversation, gets the model's next turn back; when that turn calls
// tools, the browser runs them (src/lib/jarvis/executors.ts), appends
// the results and calls again, until the model answers in text.
//
// Owner only: requests carry the device credential from POST /api/owner
// (the same one owner sync uses). Guests keep the regular NEXUS route.
// The persona, rules and tool list are fixed here, server side.
//
//   GET  /api/jarvis → { configured, provider, model }
//   POST /api/jarvis { contents, memory?, now?, timeZone? }  (Bearer)
//     200 { content, model }
//     401 not the owner · 429 rate limited · 502/504 model trouble
// ═══════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server';
import { OWNER } from '@/config/owner';
import { clientIp } from '@/lib/client-ip';
import { isRateLimited, isValidCredential, recordFailure } from '@/lib/sync/owner-auth';
import {
  JARVIS_LIMITS,
  JARVIS_TOOLS,
  JARVIS_TOOL_NAMES,
  type JarvisContent,
  type JarvisMemoryFact,
  type JarvisPart,
} from '@/lib/jarvis/tools';
import { JarvisUpstreamError, generateContent, jarvisModel, jarvisProvider } from '@/lib/jarvis/google';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUESTS_PER_MIN = 40;
const buckets = new Map<string, number[]>();
const MAX_TEXT = 20_000;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
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

// ─── Validation ───

function cleanPart(raw: unknown): JarvisPart | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const part = raw as JarvisPart;
  if (typeof part.text === 'string') return { ...part, text: part.text.slice(0, MAX_TEXT) };
  if (part.functionCall && typeof part.functionCall.name === 'string') {
    return JARVIS_TOOL_NAMES.has(part.functionCall.name) ? part : null;
  }
  if (part.functionResponse && typeof part.functionResponse.name === 'string') {
    if (!JARVIS_TOOL_NAMES.has(part.functionResponse.name)) return null;
    const response = part.functionResponse.response;
    if (!response || typeof response !== 'object' || JSON.stringify(response).length > 40_000) {
      return { functionResponse: { ...part.functionResponse, response: { ok: false, error: 'result_too_large' } } };
    }
    return part;
  }
  return null;
}

function cleanContents(raw: unknown): JarvisContent[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: JarvisContent[] = [];
  for (const item of raw.slice(-JARVIS_LIMITS.maxContents)) {
    if (!item || typeof item !== 'object') return null;
    const { role, parts } = item as { role?: unknown; parts?: unknown };
    if ((role !== 'user' && role !== 'model') || !Array.isArray(parts)) return null;
    const clean = parts.map(cleanPart).filter((p): p is JarvisPart => p !== null);
    if (clean.length) out.push({ role, parts: clean });
  }
  // The conversation must open with the owner, not a tool result or model turn.
  while (out.length && (out[0].role !== 'user' || out[0].parts.some((p) => p.functionResponse))) out.shift();
  return out.length ? out : null;
}

function cleanMemory(raw: unknown): JarvisMemoryFact[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m): m is JarvisMemoryFact =>
        !!m && typeof m === 'object' && typeof (m as JarvisMemoryFact).id === 'string' && typeof (m as JarvisMemoryFact).fact === 'string'
    )
    .slice(-JARVIS_LIMITS.maxMemory)
    .map((m) => ({ id: m.id.slice(0, 40), fact: m.fact.slice(0, 300), createdAt: String(m.createdAt ?? '').slice(0, 40) }));
}

// ─── Persona ───

function systemPrompt(memory: JarvisMemoryFact[], now: string, timeZone: string): string {
  const facts = memory.length
    ? memory.map((m) => `- [${m.id}] ${m.fact}`).join('\n')
    : '- (nothing yet)';
  return `You are NEXUS, the AI core of WARRIOR OS — ${OWNER.name}'s personal operating system in the browser. You are to ${OWNER.shortName} what JARVIS is to Tony Stark: calm, sharp, loyal, a step ahead, with dry wit. You are talking to ${OWNER.shortName}, the owner, right now.

NOW: ${now} (${timeZone}).

WHAT YOU CAN DO: you have tools that read ${OWNER.shortName}'s real data in this OS (notes, flashcard decks and due cards, habits, calendar, expenses, projects, stats) and tools that act (create notes and flashcards, log expenses, add events, tick habits, open apps, start study sessions, focus timer, wallpaper, workspaces) plus a long-term memory.

RULES:
- Facts about ${OWNER.shortName}'s data come from tools, never from guesses. Call get_overview first for "today", planning or progress questions. Never invent notes, decks, numbers or events.
- When asked to do something, do it with the tools (several calls are fine), then confirm in one short line what you did. Ask before anything ambiguous or large (e.g. more than 30 flashcards, or overwriting).
- Use remember when ${OWNER.shortName} shares a lasting fact (goals, exam dates, preferences, routines). Never store passwords, keys or other secrets.
- Language: mirror ${OWNER.shortName}. Default to Hinglish (Romanized Hindi + English tech terms) unless ${OWNER.shortName} writes in English.
- Keep it short: 1–3 sentences unless asked for an explanation, a plan or a quiz. Replies may be read aloud, so avoid tables and long lists unless asked. Markdown is fine for code.
- No emojis. Never say "as an AI". Be direct, not sycophantic; push like a mentor when ${OWNER.shortName} slacks.
- Quizzing in chat: ask one question at a time from get_due_cards, wait for the answer, then judge it.

MEMORY (things ${OWNER.shortName} told you before; ids for forget):
${facts}`;
}

// ─── Handlers ───

export async function GET() {
  const provider = jarvisProvider();
  return json({ configured: provider !== null, provider, model: provider ? jarvisModel() : null });
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
  if (!jarvisProvider()) return json({ error: 'not_configured' }, 503);
  if (!takeToken(ip)) return json({ error: 'rate_limited' }, 429);

  const raw = await req.text();
  if (raw.length > JARVIS_LIMITS.maxBodyChars) return json({ error: 'body_too_large' }, 413);
  let body: { contents?: unknown; memory?: unknown; now?: unknown; timeZone?: unknown };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const contents = cleanContents(body.contents);
  if (!contents) return json({ error: 'invalid_contents' }, 400);
  const now = typeof body.now === 'string' ? body.now.slice(0, 40) : new Date().toISOString();
  const timeZone = typeof body.timeZone === 'string' ? body.timeZone.slice(0, 60) : 'UTC';

  try {
    const data = await generateContent({
      systemInstruction: { parts: [{ text: systemPrompt(cleanMemory(body.memory), now, timeZone) }] },
      contents,
      tools: [{ functionDeclarations: JARVIS_TOOLS }],
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
      generationConfig: { temperature: 0.6, maxOutputTokens: 4096 },
    });
    const candidate = (data.candidates as { content?: JarvisContent; finishReason?: string }[] | undefined)?.[0];
    const parts = (candidate?.content?.parts ?? []).filter(
      (p) => typeof p.text === 'string' || (p.functionCall && JARVIS_TOOL_NAMES.has(p.functionCall.name))
    );
    if (!parts.length) {
      const blocked = candidate?.finishReason && candidate.finishReason !== 'STOP';
      parts.push({ text: blocked ? 'Is pe jawab nahi de sakta.' : 'Hmm, kuch jawab nahi bana. Dobara pooch.' });
    }
    return json({ content: { role: 'model', parts }, model: jarvisModel() });
  } catch (err) {
    if (err instanceof JarvisUpstreamError) return json({ error: err.message }, err.status);
    return json({ error: 'upstream_error' }, 502);
  }
}
