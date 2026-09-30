// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Ghost presence: offline "local campfire" transport
// The presence source. Two sources, merged:
//   1. REAL presence of this browser's other open Warrior OS tabs,
//      exchanged over a BroadcastChannel (hello / presence heartbeat /
//      bye). Closing a tab removes it within one heartbeat (bye), or
//      after PEER_STALE_MS if the tab crashed. War cries sent in one tab
//      appear in every other open tab.
//   2. Deterministic SIMULATED warriors (./simulation) — flagged
//      isSimulated and tagged "SIM" in the UI.
// Nothing leaves the device. Browser only.
// ═══════════════════════════════════════════════════════════

import type { GhostSelfStats, GhostWarrior, WarCry } from '@/types/ghost';
import type { GhostTransport } from './transport';
import { sanitizeWarCry } from './transport';
import { WARRIOR_ID_PATTERN } from './identity';
import { simulatedWarCries, simulatedWarriors } from './simulation';

const CHANNEL_NAME = 'warrior-os-ghost-presence';
/** Tabs re-announce themselves this often. */
const HEARTBEAT_MS = 10_000;
/** A tab not heard from for this long is considered gone. */
const PEER_STALE_MS = 35_000;
/** Simulation + staleness re-evaluation cadence. */
const TICK_MS = 5_000;

type LocalMessage =
  | { type: 'hello' | 'presence'; tab: string; anonymousId: string; stats: GhostSelfStats; at: number }
  | { type: 'bye'; tab: string }
  | { type: 'warcry'; tab: string; cry: { id: string; message: string; anonymousId: string; timestamp: string } };

interface Peer {
  anonymousId: string;
  stats: GhostSelfStats;
  seenAt: number;
}

export interface LocalPresenceOptions {
  selfId: string;
  getSelfStats: () => GhostSelfStats;
  onWarriors: (warriors: GhostWarrior[]) => void;
  onWarCry: (cry: WarCry) => void;
}

function num(v: unknown, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0;
}

function parseStats(v: unknown): GhostSelfStats {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    studyHoursToday: Math.round(num(o.studyHoursToday, 24) * 10) / 10,
    quizzesToday: Math.round(num(o.quizzesToday, 500)),
    streak: Math.round(num(o.streak, 10_000)),
  };
}

export function isBroadcastChannelSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.BroadcastChannel === 'function';
}

export function startLocalPresence(options: LocalPresenceOptions): GhostTransport {
  const { selfId } = options;
  const tab = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const peers = new Map<string, Peer>();
  let stopped = false;
  let lastCryCheck = Date.now();

  let channel: BroadcastChannel | null = null;
  if (isBroadcastChannelSupported()) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      channel = null;
    }
  }

  const post = (msg: LocalMessage) => {
    try {
      channel?.postMessage(msg);
    } catch {
      /* channel closed / data not cloneable — ignore */
    }
  };

  const announce = (type: 'hello' | 'presence') =>
    post({ type, tab, anonymousId: selfId, stats: options.getSelfStats(), at: Date.now() });

  const emit = () => {
    if (stopped) return;
    const now = Date.now();
    for (const [key, peer] of peers) {
      if (now - peer.seenAt > PEER_STALE_MS) peers.delete(key);
    }
    const rows: GhostWarrior[] = [];
    const seen = new Set<string>();
    for (const peer of peers.values()) {
      // A duplicated tab shares this tab's sessionStorage id → it is "us".
      if (peer.anonymousId === selfId || seen.has(peer.anonymousId)) continue;
      seen.add(peer.anonymousId);
      rows.push({
        anonymousId: peer.anonymousId,
        ...peer.stats,
        isOnline: true,
        lastSeen: new Date(peer.seenAt).toISOString(),
        isLocalTab: true,
      });
    }
    for (const sim of simulatedWarriors(now, selfId)) {
      if (!seen.has(sim.anonymousId)) rows.push(sim);
    }
    options.onWarriors(rows);
  };

  const onMessage = (event: MessageEvent<unknown>) => {
    if (stopped) return;
    const msg = event.data as Partial<LocalMessage> | null;
    if (!msg || typeof msg !== 'object' || typeof msg.tab !== 'string' || msg.tab === tab) return;
    switch (msg.type) {
      case 'hello':
      case 'presence': {
        if (typeof msg.anonymousId !== 'string' || !WARRIOR_ID_PATTERN.test(msg.anonymousId)) return;
        const isNew = !peers.has(msg.tab);
        peers.set(msg.tab, { anonymousId: msg.anonymousId, stats: parseStats(msg.stats), seenAt: Date.now() });
        // Answer a newcomer so it sees us immediately.
        if (msg.type === 'hello') announce('presence');
        if (isNew || msg.type === 'hello') emit();
        break;
      }
      case 'bye':
        if (peers.delete(msg.tab)) emit();
        break;
      case 'warcry': {
        const c = msg.cry;
        if (!c || typeof c.id !== 'string' || typeof c.anonymousId !== 'string') return;
        if (!WARRIOR_ID_PATTERN.test(c.anonymousId)) return;
        const message = typeof c.message === 'string' ? sanitizeWarCry(c.message) : '';
        if (!message) return;
        options.onWarCry({
          id: c.id,
          message,
          anonymousId: c.anonymousId,
          timestamp: typeof c.timestamp === 'string' ? c.timestamp : new Date().toISOString(),
          isSelf: c.anonymousId === selfId,
          isLocalOnly: true,
        });
        break;
      }
      default:
        break;
    }
  };

  channel?.addEventListener('message', onMessage);

  // Closing / navigating away: tell the other tabs right away.
  const onPageHide = () => post({ type: 'bye', tab });
  // Restored from the back/forward cache: re-join the campfire.
  const onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted) announce('hello');
  };
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);

  announce('hello');
  emit();

  const heartbeat = window.setInterval(() => announce('presence'), HEARTBEAT_MS);
  const ticker = window.setInterval(() => {
    const now = Date.now();
    for (const cry of simulatedWarCries(lastCryCheck, now, selfId)) options.onWarCry(cry);
    lastCryCheck = now;
    emit();
  }, TICK_MS);

  return {
    kind: 'local',
    broadcasts: channel !== null,
    createWarCryId: () => `local-${tab}-${Date.now().toString(36)}`,
    publishWarCry: async (id, message) => {
      post({
        type: 'warcry',
        tab,
        cry: { id, message: sanitizeWarCry(message), anonymousId: selfId, timestamp: new Date().toISOString() },
      });
    },
    stop: () => {
      if (stopped) return;
      stopped = true;
      post({ type: 'bye', tab });
      window.clearInterval(heartbeat);
      window.clearInterval(ticker);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      channel?.removeEventListener('message', onMessage);
      channel?.close();
      channel = null;
      peers.clear();
    },
  };
}
