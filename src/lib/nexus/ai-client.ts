// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS AI Client
// Browser-side wrapper around POST /api/ai: trims payloads to the
// route's limits, applies a client timeout and normalises every
// success/error shape into one result object.
// ═══════════════════════════════════════════════════════════

import { NEXUS_LIMITS, sanitizeWireAction, sanitizeWireActions } from './protocol';
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
  /** Route reported no API key (503) */
  offline: boolean;
  error?: string;
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
      return {
        ok: false,
        status: resp.status,
        reply: reply || NEXUS_LINES.networkDown,
        command: null,
        actions: [],
        offline: resp.status === 503,
        error: typeof data.error === 'string' ? data.error : `http_${resp.status}`,
      };
    }
    return {
      ok: true,
      status: resp.status,
      reply: reply || 'NEXUS chup ho gaya. Dobara pooch.',
      command: sanitizeWireAction(data.command),
      actions: sanitizeWireActions(data.actions),
      offline: false,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      reply: controller.signal.aborted ? 'NEXUS ne time out kar diya. Dobara try kar.' : NEXUS_LINES.networkDown,
      command: null,
      actions: [],
      offline: false,
      error: controller.signal.aborted ? 'client_timeout' : 'network',
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Whether the server has a Gemini key configured (GET /api/ai). */
export async function fetchNexusAIStatus(): Promise<{ configured: boolean; model: string } | null> {
  try {
    const resp = await fetch('/api/ai', { method: 'GET', cache: 'no-store' });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { configured?: unknown; model?: unknown };
    return {
      configured: data.configured === true,
      model: typeof data.model === 'string' ? data.model : 'gemini',
    };
  } catch {
    return null;
  }
}
