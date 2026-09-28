// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS AI Client
// Browser-side wrapper around POST /api/ai: trims payloads to the
// route's limits, applies a client timeout and normalises every
// success/error shape into one result object.
//
// Offline-first: when the route answers with its rule-based brain
// (no GEMINI_API_KEY) the result is flagged `offline`. When the route
// itself cannot be reached (static hosting, dev server down, no
// network) the same offline brain runs right here in the browser, so
// NEXUS always has a useful answer.
// ═══════════════════════════════════════════════════════════

import { NEXUS_LIMITS, sanitizeWireAction, sanitizeWireActions } from './protocol';
import { offlineNexusReply, NEXUS_OFFLINE_MODEL } from './offline-brain';
import { NEXUS_LINES } from '@/data/nexus-personality';
import type { NexusChatTurn, NexusContext, NexusWireAction } from '@/types/nexus';

const CLIENT_TIMEOUT_MS = 25_000;

export interface NexusAIRequest {
  message: string;
  history: NexusChatTurn[];
  context?: NexusContext;
}

export interface NexusAIResult {
  ok: boolean;
  status: number;
  reply: string;
  command: NexusWireAction | null;
  actions: NexusWireAction[];
  /** Answer came from the rule-based offline brain (server or local) */
  offline: boolean;
  error?: string;
}

/** Run the offline brain in the browser (route unreachable / missing). */
function localOfflineResult(request: NexusAIRequest, status: number, error: string, note: string): NexusAIResult {
  const brain = offlineNexusReply(request.message, request.context ?? null, request.history);
  return {
    ok: true,
    status,
    reply: note ? `${note}\n\n${brain.reply}` : brain.reply,
    command: brain.command,
    actions: brain.actions,
    offline: true,
    error,
  };
}

export async function requestNexusAI(request: NexusAIRequest): Promise<NexusAIResult> {
  const body = {
    message: request.message.slice(0, NEXUS_LIMITS.messageChars),
    history: request.history.slice(-NEXUS_LIMITS.historyTurns).map((t) => ({
      role: t.role,
      content: t.content.slice(0, 2000),
    })),
    ...(request.context ? { context: request.context } : {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  try {
    const resp = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    const reply = typeof data.reply === 'string' && data.reply.trim() ? data.reply : '';
    if (!resp.ok) {
      // Route missing (static export) or legacy "no key" 503 → answer locally.
      if (resp.status === 404 || resp.status === 405 || resp.status === 503) {
        return localOfflineResult(request, resp.status, `http_${resp.status}`, '');
      }
      return {
        ok: false,
        status: resp.status,
        reply: reply || NEXUS_LINES.networkDown,
        command: null,
        actions: [],
        offline: false,
        error: typeof data.error === 'string' ? data.error : `http_${resp.status}`,
      };
    }
    return {
      ok: true,
      status: resp.status,
      reply: reply || 'NEXUS chup ho gaya. Dobara pooch.',
      command: sanitizeWireAction(data.command),
      actions: sanitizeWireActions(data.actions),
      offline: data.offline === true,
    };
  } catch {
    const timedOut = controller.signal.aborted;
    return localOfflineResult(
      request,
      0,
      timedOut ? 'client_timeout' : 'network',
      timedOut ? '_NEXUS server ne time out kiya — offline brain se:_' : '_NEXUS server tak nahi pahunch paaya — offline brain se:_'
    );
  } finally {
    clearTimeout(timer);
  }
}

export interface NexusAIStatus {
  /** Server has a Gemini key */
  configured: boolean;
  model: string;
}

/** Whether the server has a Gemini key configured (GET /api/ai). */
export async function fetchNexusAIStatus(): Promise<NexusAIStatus | null> {
  try {
    const resp = await fetch('/api/ai', { method: 'GET', cache: 'no-store' });
    if (!resp.ok) return resp.status === 404 ? { configured: false, model: NEXUS_OFFLINE_MODEL } : null;
    const data = (await resp.json()) as { configured?: unknown; model?: unknown };
    return {
      configured: data.configured === true,
      model: typeof data.model === 'string' ? data.model : 'gemini',
    };
  } catch {
    return null;
  }
}
