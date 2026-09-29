// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS AI Proxy Route (Gemini, free AI Studio tier)
//
// Why a server route at all?
// 1. Keeps the Gemini API key on the server (read per request, sent to
//    Google in a header, never echoed in a response or a log line).
// 2. Injects the NEXUS persona + output protocol server-side so the
//    client cannot tamper with NEXUS's personality.
// 3. Hardens the endpoint: body validation, size caps, per-IP rate
//    limit, upstream timeout and structured JSON output.
//
// POST /api/ai  { message, history?, context? }
//   200 { reply, command, actions, model }
//   400 { error, reply }            malformed / oversized body
//   200 { reply, command, actions, model: 'nexus-offline', offline: true }
//                                   no API key configured, or Gemini
//                                   unreachable → rule-based offline brain
//                                   (lib/nexus/offline-brain.ts)
//   429 { error, reply, retryAfter } local or Gemini rate limit
//   502 { error, reply }            Gemini rejected the key / bad response
// GET  /api/ai → { configured, model, offlineBrain }  (never includes the key)
// ═══════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  NEXUS_OUTPUT_PROTOCOL,
  NEXUS_SYSTEM_PROMPT,
  renderContextBlock,
} from '@/data/nexus-personality';
import {
  NEXUS_GEMINI_MODEL,
  NEXUS_LIMITS,
  NEXUS_RESPONSE_SCHEMA,
  sanitizeWireAction,
  sanitizeWireActions,
} from '@/lib/nexus/protocol';
import { NEXUS_OFFLINE_MODEL, offlineNexusReply } from '@/lib/nexus/offline-brain';
import { clientIp } from '@/lib/client-ip';
import type { NexusChatTurn, NexusContext, NexusWireAction } from '@/types/nexus';

// Edge runtime — fast cold start, low latency for a chat endpoint.
export const runtime = 'edge';

const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${NEXUS_GEMINI_MODEL}:generateContent`;
const UPSTREAM_TIMEOUT_MS = 20_000;
const RATE_LIMIT_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_TRACKED = 5_000;

// ─── Per-IP sliding-window rate limit (in-memory, per instance; IP from lib/client-ip) ───

const rateBuckets = new Map<string, number[]>();

function takeRateToken(key: string, now: number): { ok: true } | { ok: false; retryAfterSec: number } {
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const recent = (rateBuckets.get(key) ?? []).filter((t) => t > cutoff);
  if (recent.length >= RATE_LIMIT_REQUESTS) {
    rateBuckets.set(key, recent);
    const retryAfterSec = Math.max(1, Math.ceil((recent[0] + RATE_LIMIT_WINDOW_MS - now) / 1000));
    return { ok: false, retryAfterSec };
  }
  recent.push(now);
  rateBuckets.set(key, recent);
  if (rateBuckets.size > RATE_LIMIT_MAX_TRACKED) {
    for (const [k, stamps] of rateBuckets) {
      if (stamps.every((t) => t <= cutoff)) rateBuckets.delete(k);
    }
  }
  return { ok: true };
}

// ─── Responses ───

function json(status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  });
}

function badRequest(error: string, reply: string) {
  return json(400, { error, reply });
}

/** Treat empty values and `.env` placeholders ("your_...") as "no key". */
function usableKey(raw: string | undefined): string | null {
  const key = raw?.trim();
  if (!key || key.toLowerCase().startsWith('your_')) return null;
  return key;
}

/** Remove anything key-shaped from upstream text before it reaches a response. */
function scrubSecrets(text: string, apiKey: string): string {
  return text
    .split(apiKey)
    .join('[redacted]')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[redacted]')
    .replace(/key=[^&\s"']+/gi, 'key=[redacted]')
    .slice(0, 240);
}

/** 200 reply from the rule-based offline brain (no key / Gemini unreachable). */
function offlineResponse(
  message: string,
  context: Partial<NexusContext> | null,
  history: NexusChatTurn[],
  reason: 'no_key' | 'upstream_unreachable' | 'upstream_timeout'
) {
  const brain = offlineNexusReply(message, context, history);
  const note =
    reason === 'no_key'
      ? ''
      : reason === 'upstream_timeout'
        ? '_Gemini ne time pe jawab nahi diya — offline brain se:_\n\n'
        : '_Gemini tak nahi pahunch paaya — offline brain se:_\n\n';
  return json(200, {
    reply: clipReply(`${note}${brain.reply}`),
    command: brain.command,
    actions: brain.actions,
    model: NEXUS_OFFLINE_MODEL,
    offline: true,
    reason,
  });
}

// ─── Request validation ───

type ParsedBody =
  | { ok: true; message: string; history: NexusChatTurn[]; context: Partial<NexusContext> | null }
  | { ok: false; error: string; reply: string };

const TIMES_OF_DAY: ReadonlyArray<NexusContext['timeOfDay']> = [
  'morning',
  'afternoon',
  'evening',
  'night',
  'late-night',
];

function finiteNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, value));
}

function shortString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function sanitizeContext(raw: Record<string, unknown>): Partial<NexusContext> {
  const ctx: Partial<NexusContext> = {};
  if (Array.isArray(raw.openApps)) {
    ctx.openApps = raw.openApps
      .filter((a): a is string => typeof a === 'string')
      .map((a) => a.slice(0, 40))
      .slice(0, 12);
  }
  const workspace = shortString(raw.currentWorkspace, 20);
  if (workspace) ctx.currentWorkspace = workspace;
  if (typeof raw.timeOfDay === 'string' && (TIMES_OF_DAY as readonly string[]).includes(raw.timeOfDay)) {
    ctx.timeOfDay = raw.timeOfDay as NexusContext['timeOfDay'];
  }
  const level = finiteNumber(raw.userLevel, 1, 100);
  if (level !== undefined) ctx.userLevel = Math.round(level);
  const streak = finiteNumber(raw.currentStreak, 0, 10_000);
  if (streak !== undefined) ctx.currentStreak = Math.round(streak);
  const idle = finiteNumber(raw.idleMinutes, 0, 100_000);
  if (idle !== undefined) ctx.idleMinutes = Math.round(idle);
  const hours = finiteNumber(raw.studyHoursToday, 0, 24);
  if (hours !== undefined) ctx.studyHoursToday = hours;
  const lastQuiz = finiteNumber(raw.lastQuizScore, 0, 100);
  if (lastQuiz !== undefined) ctx.lastQuizScore = lastQuiz;
  const localTime = shortString(raw.localTime, 16);
  if (localTime) ctx.localTime = localTime;
  if (raw.visitor === 'owner' || raw.visitor === 'guest') ctx.visitor = raw.visitor;
  if (Array.isArray(raw.decks)) {
    ctx.decks = raw.decks
      .filter((d): d is string => typeof d === 'string')
      .map((d) => d.replace(/\s+/g, ' ').trim().slice(0, 60))
      .filter(Boolean)
      .slice(0, 12);
  }
  const due = finiteNumber(raw.dueCards, 0, 1_000_000);
  if (due !== undefined) ctx.dueCards = Math.round(due);
  const focusDeck = shortString(raw.focusDeck, 60);
  if (focusDeck) ctx.focusDeck = focusDeck;
  const summary = shortString(raw.summary, NEXUS_LIMITS.contextChars);
  if (summary) ctx.summary = summary;
  return ctx;
}

function parseBody(raw: unknown): ParsedBody {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'invalid_body', reply: 'Request ka format galat hai.' };
  }
  const body = raw as Record<string, unknown>;

  if (typeof body.message !== 'string' || body.message.trim().length === 0) {
    return { ok: false, error: 'missing_message', reply: 'Kuch likh to sahi.' };
  }
  const message = body.message.trim();
  if (message.length > NEXUS_LIMITS.messageChars) {
    return {
      ok: false,
      error: 'message_too_long',
      reply: `Message bahut lamba hai — max ${NEXUS_LIMITS.messageChars} characters.`,
    };
  }

  let history: NexusChatTurn[] = [];
  if (body.history !== undefined) {
    if (!Array.isArray(body.history)) {
      return { ok: false, error: 'invalid_history', reply: 'Chat history ka format galat hai.' };
    }
    for (const turn of body.history) {
      if (
        !turn ||
        typeof turn !== 'object' ||
        ((turn as NexusChatTurn).role !== 'user' && (turn as NexusChatTurn).role !== 'nexus') ||
        typeof (turn as NexusChatTurn).content !== 'string'
      ) {
        return { ok: false, error: 'invalid_history', reply: 'Chat history ka format galat hai.' };
      }
    }
    history = (body.history as NexusChatTurn[])
      .slice(-NEXUS_LIMITS.historyTurns)
      .map((t) => ({ role: t.role, content: t.content.slice(0, NEXUS_LIMITS.historyTurnChars) }))
      .filter((t) => t.content.trim().length > 0);
  }

  let context: Partial<NexusContext> | null = null;
  if (body.context !== undefined && body.context !== null) {
    if (typeof body.context !== 'object' || Array.isArray(body.context)) {
      return { ok: false, error: 'invalid_context', reply: 'OS context ka format galat hai.' };
    }
    if (JSON.stringify(body.context).length > NEXUS_LIMITS.contextChars) {
      return {
        ok: false,
        error: 'context_too_large',
        reply: `OS context ${NEXUS_LIMITS.contextChars} characters se bada hai.`,
      };
    }
    context = sanitizeContext(body.context as Record<string, unknown>);
  }

  return { ok: true, message, history, context };
}

// ─── Gemini payload + response ───

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
}

function buildContents(history: NexusChatTurn[], message: string, contextBlock: string): GeminiContent[] {
  const contents: GeminiContent[] = [];
  for (const turn of history) {
    const role: GeminiContent['role'] = turn.role === 'nexus' ? 'model' : 'user';
    if (contents.length === 0 && role === 'model') continue; // conversations must open with the user
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts.push({ text: turn.content });
    else contents.push({ role, parts: [{ text: turn.content }] });
  }
  const finalParts: GeminiPart[] = contextBlock ? [{ text: contextBlock }, { text: message }] : [{ text: message }];
  const last = contents[contents.length - 1];
  if (last && last.role === 'user') last.parts.push(...finalParts);
  else contents.push({ role: 'user', parts: finalParts });
  return contents;
}

interface StructuredReply {
  reply: string;
  command: NexusWireAction | null;
  actions: NexusWireAction[];
}

function clipReply(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > NEXUS_LIMITS.replyChars ? `${trimmed.slice(0, NEXUS_LIMITS.replyChars - 1)}…` : trimmed;
}

/** Recover the "reply" string from JSON that was cut off (MAX_TOKENS). */
function salvageReply(text: string): string | null {
  const match = /"reply"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(text);
  if (!match) return null;
  let body = match[1];
  for (let i = 0; i < 3; i++) {
    try {
      return JSON.parse(`"${body}"`) as string;
    } catch {
      body = body.slice(0, -1); // drop a dangling escape and retry
    }
  }
  return null;
}

function extractStructuredReply(data: GeminiResponse): StructuredReply {
  const empty: StructuredReply = { reply: '', command: null, actions: [] };
  const candidate = data.candidates?.[0];
  if (!candidate) {
    return {
      ...empty,
      reply: data.promptFeedback?.blockReason
        ? 'Ye message safety filter mein atak gaya. Dusre shabdon mein pooch.'
        : 'NEXUS chup ho gaya. Dobara pooch.',
    };
  }

  const text = (candidate.content?.parts ?? [])
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('')
    .trim();

  if (!text) {
    return {
      ...empty,
      reply:
        candidate.finishReason === 'SAFETY'
          ? 'Iska jawab safety filter ne rok diya. Sawaal rephrase kar.'
          : 'NEXUS chup ho gaya. Dobara pooch.',
    };
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      const reply = typeof record.reply === 'string' ? clipReply(record.reply) : '';
      if (reply) {
        return {
          reply,
          command: sanitizeWireAction(record.command),
          actions: sanitizeWireActions(record.actions),
        };
      }
    }
  } catch {
    const salvaged = salvageReply(text);
    if (salvaged) return { ...empty, reply: clipReply(`${salvaged}…`) };
    // Model ignored JSON mode — show the raw text rather than nothing.
    if (!text.startsWith('{')) return { ...empty, reply: clipReply(text) };
  }
  return { ...empty, reply: 'NEXUS ka jawab samajh nahi aaya. Dobara pooch.' };
}

// ─── Handlers ───

export async function GET() {
  // Key read at request time, inside the handler; only a boolean leaves the server.
  const apiKey = usableKey(process.env.GEMINI_API_KEY);
  return json(200, {
    configured: apiKey !== null,
    model: apiKey !== null ? NEXUS_GEMINI_MODEL : NEXUS_OFFLINE_MODEL,
    offlineBrain: true,
  });
}

export async function POST(req: Request) {
  const now = Date.now();

  // 1. Rate limit (cheap, before any work).
  const limit = takeRateToken(clientIp(req), now);
  if (!limit.ok) {
    return json(
      429,
      {
        error: 'rate_limited',
        retryAfter: limit.retryAfterSec,
        reply: `Thoda ruk — ek minute mein max ${RATE_LIMIT_REQUESTS} messages. ${limit.retryAfterSec}s baad try kar.`,
      },
      { 'Retry-After': String(limit.retryAfterSec) }
    );
  }

  // 2. Body: size cap, JSON parse, schema validation.
  const declaredLength = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > NEXUS_LIMITS.bodyChars) {
    return badRequest('body_too_large', 'Request bahut badi hai.');
  }
  let rawText: string;
  try {
    rawText = await req.text();
  } catch {
    return badRequest('invalid_body', 'Request body padh nahi paaya.');
  }
  if (rawText.length > NEXUS_LIMITS.bodyChars) {
    return badRequest('body_too_large', 'Request bahut badi hai.');
  }
  let rawBody: unknown;
  try {
    rawBody = JSON.parse(rawText);
  } catch {
    return badRequest('invalid_json', 'Request JSON galat hai.');
  }
  const parsed = parseBody(rawBody);
  if (!parsed.ok) return badRequest(parsed.error, parsed.reply);

  // 3. Key — read inside the handler so a swapped env needs no rebuild of module state.
  //    No key is not an error: the rule-based offline brain answers instead.
  //    Server-only variable: a NEXT_PUBLIC_ key would be inlined into the client bundle.
  const apiKey = usableKey(process.env.GEMINI_API_KEY);
  if (!apiKey) return offlineResponse(parsed.message, parsed.context, parsed.history, 'no_key');

  // 4. Upstream call with a hard timeout.
  const contextBlock = parsed.context ? renderContextBlock(parsed.context) : '';
  const payload = {
    systemInstruction: { parts: [{ text: `${NEXUS_SYSTEM_PROMPT}\n\n${NEXUS_OUTPUT_PROTOCOL}` }] },
    contents: buildContents(parsed.history, parsed.message, contextBlock),
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
      responseSchema: NEXUS_RESPONSE_SCHEMA,
      // Flash: no hidden "thinking" tokens — faster replies, whole budget for the answer.
      thinkingConfig: { thinkingBudget: 0 },
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    let upstream: Response;
    try {
      upstream = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch {
      const timedOut = controller.signal.aborted;
      return offlineResponse(
        parsed.message,
        parsed.context,
        parsed.history,
        timedOut ? 'upstream_timeout' : 'upstream_unreachable'
      );
    }

    if (!upstream.ok) {
      const errorText = await upstream.text().catch(() => '');
      let upstreamMessage = '';
      try {
        const parsedError = JSON.parse(errorText) as { error?: { message?: string } };
        upstreamMessage = parsedError.error?.message ?? '';
      } catch {
        upstreamMessage = errorText;
      }
      const detail = scrubSecrets(upstreamMessage, apiKey);

      if (upstream.status === 429) {
        return json(
          429,
          {
            error: 'upstream_rate_limited',
            retryAfter: 60,
            reply: 'Gemini free-tier limit hit ho gayi. Ek minute ruk, fir pooch.',
          },
          { 'Retry-After': '60' }
        );
      }
      const keyProblem =
        upstream.status === 401 || upstream.status === 403 || /api key/i.test(upstreamMessage);
      return json(502, {
        error: 'upstream_error',
        status: upstream.status,
        detail,
        reply: keyProblem
          ? 'Gemini ne API key reject kar di. Server ka GEMINI_API_KEY check kar.'
          : 'NEXUS abhi reply nahi de paaya. Dobara try kar.',
      });
    }

    let data: GeminiResponse;
    try {
      data = (await upstream.json()) as GeminiResponse;
    } catch {
      const timedOut = controller.signal.aborted;
      return json(502, {
        error: timedOut ? 'upstream_timeout' : 'upstream_bad_response',
        reply: timedOut
          ? 'Gemini ne 20 second mein jawab nahi diya. Dobara try kar.'
          : 'Gemini ka response toota hua aaya. Dobara try kar.',
      });
    }

    const structured = extractStructuredReply(data);
    return json(200, {
      reply: structured.reply,
      command: structured.command,
      actions: structured.actions,
      model: NEXUS_GEMINI_MODEL,
    });
  } finally {
    clearTimeout(timer);
  }
}
