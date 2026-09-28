// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS AI Proxy Route (Gemini)
//
// Why a server route at all? Two reasons:
// 1. Hides the Gemini API key from the browser (NEXT_PUBLIC_* would leak it).
// 2. Lets us inject the system prompt + OS context server-side so the client
//    can't tamper with NEXUS's personality.
// ═══════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  NEXUS_SYSTEM_PROMPT,
  renderContextBlock,
} from '@/data/nexus-personality';
import type { NexusContext } from '@/types/nexus';

// Edge runtime — fast cold start, low latency for a chat endpoint.
export const runtime = 'edge';

// Free-tier fast model. Stable + cheap enough to leave on indefinitely.
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface ChatTurn {
  role: 'user' | 'nexus';
  content: string;
}

interface RequestBody {
  /** Most recent user message — required */
  message: string;
  /** Up to 8 previous turns for short-term context */
  history?: ChatTurn[];
  /** Live OS state */
  context?: Partial<NexusContext>;
}

const DEFAULT_CONTEXT: NexusContext = {
  openApps: [],
  currentWorkspace: 'study',
  timeOfDay: 'morning',
  userLevel: 1,
  currentStreak: 0,
  idleMinutes: 0,
  studyHoursToday: 0,
};

export async function POST(req: Request) {
  // Read key at request time (Edge env semantics) instead of module init,
  // so a swapped .env doesn't require a server restart.
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_key') {
    return NextResponse.json(
      {
        error: 'gemini_key_missing',
        reply:
          'NEXUS offline hai. .env.local mein NEXT_PUBLIC_GEMINI_API_KEY set kar — aistudio.google.com se free key mil jaayegi.',
      },
      { status: 503 }
    );
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.message || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'missing_message' }, { status: 400 });
  }

  // Cap message + history length to keep call cost predictable.
  const message = body.message.slice(0, 2000);
  const history = (body.history ?? []).slice(-8);
  const context: NexusContext = { ...DEFAULT_CONTEXT, ...(body.context ?? {}) };

  // Gemini's `contents` array is an alternating user/model conversation.
  // System instruction goes in its own top-level field, not in contents.
  const contents = [
    ...history.map((t) => ({
      role: t.role === 'nexus' ? 'model' : 'user',
      parts: [{ text: t.content }],
    })),
    {
      role: 'user',
      parts: [
        { text: renderContextBlock(context) },
        { text: message },
      ],
    },
  ];

  const payload = {
    system_instruction: { parts: [{ text: NEXUS_SYSTEM_PROMPT }] },
    contents,
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 512,
    },
    // Loosen safety only to the standard "block none of the obvious harms"
    // baseline — NEXUS is a study assistant, not a content moderator.
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  let geminiResp: Response;
  try {
    geminiResp = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json(
      { error: 'fetch_failed', detail: msg, reply: 'Network gir gaya. Thodi der mein try kar.' },
      { status: 502 }
    );
  }

  if (!geminiResp.ok) {
    const text = await geminiResp.text().catch(() => '');
    return NextResponse.json(
      {
        error: 'gemini_error',
        status: geminiResp.status,
        detail: text.slice(0, 500),
        reply:
          geminiResp.status === 429
            ? 'Free tier rate limit hit. 1 min wait kar.'
            : 'NEXUS abhi reply nahi de paaya. Dobara try kar.',
      },
      { status: geminiResp.status === 429 ? 429 : 502 }
    );
  }

  const data: unknown = await geminiResp.json().catch(() => ({}));
  const reply = extractReply(data);

  return NextResponse.json({ reply });
}

/**
 * Gemini's response envelope is verbose. Pull out the first text candidate
 * defensively — schemas drift across SDK versions.
 */
function extractReply(data: unknown): string {
  if (!data || typeof data !== 'object') return 'NEXUS chup ho gaya.';
  const d = data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string' || text.trim().length === 0) return 'NEXUS chup ho gaya.';
  return text.trim();
}
