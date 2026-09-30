// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Ghost presence: transport registry + war cry sending
// The presence engine registers the active transport (the offline
// local campfire); UI code sends war cries through here.
// ═══════════════════════════════════════════════════════════

import { useGhostStore, WARCRY_MAX_LENGTH } from '@/stores/useGhostStore';
import type { WarCry } from '@/types/ghost';
import { getSessionWarriorId } from './identity';

export interface GhostTransport {
  kind: 'realtime' | 'local';
  /**
   * True when war cries leave this tab: every online warrior (realtime)
   * or this browser's other open tabs (local, BroadcastChannel).
   */
  broadcasts: boolean;
  /** A unique id for a new war cry (RTDB push key or a local id). */
  createWarCryId: () => string;
  /** Publish a war cry to the other warriors / tabs. */
  publishWarCry: (id: string, message: string) => Promise<void>;
  stop: () => void;
}

let current: GhostTransport | null = null;

export function setGhostTransport(transport: GhostTransport | null): void {
  current = transport;
}

export function getGhostTransport(): GhostTransport | null {
  return current;
}

/**
 * Trim, collapse whitespace, cap at 50 characters (UTF-16 units — the
 * same measure the RTDB rule and the input's maxLength use), never
 * splitting an emoji in half.
 */
export function sanitizeWarCry(message: string): string {
  let out = '';
  for (const ch of Array.from(message.replace(/\s+/g, ' ').trim())) {
    if (out.length + ch.length > WARCRY_MAX_LENGTH) break;
    out += ch;
  }
  return out;
}

export type WarCrySendResult =
  | { ok: true; broadcast: boolean; scope: 'global' | 'tabs' | 'self' }
  | { ok: false; reason: 'empty' | 'cooldown' | 'offline' | 'error'; message: string };

/**
 * Send a war cry: shows on this desktop immediately and, in realtime
 * mode, on every online warrior's desktop. Rate limited to one per 2 min.
 */
export async function sendWarCry(message: string): Promise<WarCrySendResult> {
  const text = sanitizeWarCry(message);
  if (!text) return { ok: false, reason: 'empty', message: 'Write something first.' };
  const store = useGhostStore.getState();
  if (!store.canSendWarCry()) {
    const secs = Math.ceil(store.getWarCryCooldownRemaining() / 1000);
    return { ok: false, reason: 'cooldown', message: `One war cry every 2 minutes. Wait ${secs}s.` };
  }
  const transport = current;
  if (!transport) return { ok: false, reason: 'offline', message: 'Ghost Warriors is not running.' };

  const cry: WarCry = {
    id: transport.createWarCryId(),
    message: text,
    timestamp: new Date().toISOString(),
    anonymousId: store.selfId ?? getSessionWarriorId(),
    isSelf: true,
    isLocalOnly: transport.kind !== 'realtime',
  };
  const global = transport.kind === 'realtime';
  store.addWarCry(cry);
  // Lifetime counters (achievements) only count cries real warriors received.
  store.markWarCrySent(global);
  if (!transport.broadcasts) return { ok: true, broadcast: false, scope: 'self' };
  try {
    await transport.publishWarCry(cry.id, text);
    return { ok: true, broadcast: global, scope: global ? 'global' : 'tabs' };
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      message: `Could not broadcast: ${err instanceof Error ? err.message : 'unknown error'}`,
    };
  }
}
