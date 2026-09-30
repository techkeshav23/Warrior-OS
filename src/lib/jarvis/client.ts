// ═══════════════════════════════════════════════════════════
// WARRIOR OS — JARVIS agent loop (browser)
//
// Owner sessions on a connected device, when the server has a model
// set up (/api/jarvis). Sends the conversation, runs every tool the
// model calls (executors.ts) and feeds the results back, until the
// model answers in text or the step limit is reached.
// ═══════════════════════════════════════════════════════════

'use client';

import { getVisitorMode } from '@/lib/visitor';
import { getSyncToken } from '@/lib/sync/client';
import { useJarvisStore } from '@/stores/useJarvisStore';
import type { NexusChatTurn } from '@/types/nexus';
import { executeJarvisTool } from './executors';
import {
  JARVIS_ACTION_TOOLS,
  JARVIS_LIMITS,
  type JarvisContent,
  type JarvisPart,
  type JarvisResponse,
} from './tools';

const REQUEST_TIMEOUT_MS = 60_000;

// ─── Availability ───

let status: Promise<boolean> | null = null;

/** Does the server have a model for JARVIS? (asked once per page load) */
export function fetchJarvisConfigured(): Promise<boolean> {
  status ??= fetch('/api/jarvis', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : { configured: false }))
    .then((d: { configured?: unknown }) => d.configured === true)
    .catch(() => {
      status = null; // try again next time
      return false;
    });
  return status;
}

/** Owner session, device connected, and the server has a model. */
export async function isJarvisAvailable(): Promise<boolean> {
  if (getVisitorMode() !== 'owner' || !getSyncToken()) return false;
  return fetchJarvisConfigured();
}

// ─── One user message → final reply ───

export interface JarvisTurn {
  /** null: JARVIS is not usable right now; the caller falls back to NEXUS. */
  reply: string | null;
  /** Short lines for what was changed (notes created, apps opened, …). */
  done: string[];
  error?: string;
}

function localTime(): { now: string; timeZone: string } {
  const d = new Date();
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const local = new Date(d.getTime() + offset * 60_000).toISOString().slice(0, 19);
  return {
    now: `${local}${sign}${pad(offset / 60)}:${pad(offset % 60)}`,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };
}

function doneLine(name: string, args: Record<string, unknown>, result: Record<string, unknown>): string | null {
  if (!JARVIS_ACTION_TOOLS.has(name) || result.ok !== true) return null;
  const a = (key: string) => String(args[key] ?? '').slice(0, 60);
  switch (name) {
    case 'create_note':
      return `Note created: ${a('title')}`;
    case 'append_to_note':
      return `Note updated: ${a('note')}`;
    case 'add_expense':
      return `Expense logged: ${a('amount')} (${a('category')})`;
    case 'add_event':
      return `Event added: ${a('title')} on ${a('date')}`;
    case 'check_habit':
      return `Habit done: ${a('habit')}`;
    case 'create_flashcards':
      return `Flashcards added to ${a('deck')}`;
    case 'add_project':
      return `Project created: ${a('name')}`;
    case 'open_app':
      return `Opened ${a('app')}`;
    case 'start_training':
      return `Started ${a('mode')}${args.deck ? `: ${a('deck')}` : ''}`;
    case 'pomodoro':
      return args.action === 'stop' ? 'Focus timer stopped' : 'Focus timer started';
    case 'set_wallpaper':
      return `Wallpaper: ${a('wallpaper')}`;
    case 'switch_workspace':
      return `Workspace: ${a('workspace')}`;
    case 'remember':
      return 'Remembered';
    case 'forget':
      return 'Forgot one memory';
    default:
      return null;
  }
}

async function callModel(contents: JarvisContent[]): Promise<JarvisResponse | { error: string; status: number }> {
  const token = getSyncToken();
  if (!token) return { error: 'not_connected', status: 401 };
  try {
    const res = await fetch('/api/jarvis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        contents: contents.slice(-JARVIS_LIMITS.maxContents),
        memory: useJarvisStore.getState().memory,
        ...localTime(),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { error: data.error ?? `http_${res.status}`, status: res.status };
    }
    return (await res.json()) as JarvisResponse;
  } catch {
    return { error: 'unreachable', status: 0 };
  }
}

const ERROR_REPLIES: Record<string, string> = {
  owner_only: 'Owner check fail hua (password shayad badla hai). Screen lock karke apne password se unlock kar.',
  not_connected: 'Ye device connect nahi hai. Screen lock karke owner password se unlock kar.',
  rate_limited: 'Thoda ruk — bahut saari requests ho gayi. Ek minute me dobara.',
  upstream_rate_limited: 'Model abhi busy hai (rate limit). Thodi der me dobara pooch.',
  upstream_timeout: 'Model ne time pe jawab nahi diya. Dobara try kar.',
  auth_failed: 'Server ka Google Cloud login set nahi hai (Vertex credentials). DEPLOY.md dekh.',
  upstream_denied: 'Google Cloud ne request mana kar di (permissions / API on hai?).',
  unreachable: 'Server tak nahi pahunch paaya. Internet check kar.',
};

/** Run one owner message through JARVIS. */
export async function runJarvis(message: string, history: NexusChatTurn[]): Promise<JarvisTurn> {
  const contents: JarvisContent[] = history
    .filter((t) => t.content.trim())
    .map((t) => ({ role: t.role === 'user' ? 'user' : 'model', parts: [{ text: t.content }] }));
  contents.push({ role: 'user', parts: [{ text: message }] });
  const done: string[] = [];

  for (let step = 0; step < JARVIS_LIMITS.maxSteps; step++) {
    const result = await callModel(contents);
    if ('error' in result) {
      if (result.error === 'not_configured') return { reply: null, done };
      const reply = ERROR_REPLIES[result.error] ?? `JARVIS me dikkat aayi (${result.error}).`;
      return { reply: done.length ? `${reply}\n\nJo ho chuka: ${done.join(', ')}.` : reply, done, error: result.error };
    }
    const turn = result.content;
    contents.push(turn);
    const calls = turn.parts.filter((p): p is JarvisPart & { functionCall: NonNullable<JarvisPart['functionCall']> } =>
      Boolean(p.functionCall)
    );
    if (!calls.length) {
      const text = turn.parts
        .map((p) => (typeof p.text === 'string' && !p.thought ? p.text : ''))
        .join('')
        .trim();
      return { reply: text || 'Ho gaya.', done };
    }
    const responses: JarvisPart[] = [];
    for (const call of calls) {
      const args = call.functionCall.args ?? {};
      const output = await executeJarvisTool(call.functionCall.name, args);
      const line = doneLine(call.functionCall.name, args, output);
      if (line) done.push(line);
      responses.push({
        functionResponse: {
          name: call.functionCall.name,
          response: output,
          ...(call.functionCall.id ? { id: call.functionCall.id } : {}),
        },
      });
    }
    contents.push({ role: 'user', parts: responses });
  }
  return {
    reply: done.length ? `Kaafi steps ho gaye, yahin rok raha hoon. Ho chuka: ${done.join(', ')}.` : 'Ye kaam lamba ho gaya. Thoda chhota karke bol.',
    done,
    error: 'max_steps',
  };
}
