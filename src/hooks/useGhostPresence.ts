// ═══════════════════════════════════════════════════════════
// WARRIOR OS — useGhostPresence Hook
// Runs anonymous multiplayer presence while `enabled`:
//   • Firebase Realtime Database when NEXT_PUBLIC_FIREBASE_DATABASE_URL
//     is set — /presence/{id} with onDisconnect().remove(), heartbeat
//     every 5 minutes, entries older than 10 minutes ignored.
//   • Otherwise a local simulation that the UI labels as simulated.
// Mount ONCE (GhostPresenceEngine does). Other components read the
// ghost store directly.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useMemo } from 'react';
import { useGhostStore } from '@/stores/useGhostStore';
import { startGhostPresence } from '@/lib/ghost-presence';
import type { GhostPresenceMode, GhostWarrior } from '@/types/ghost';

export interface UseGhostPresenceResult {
  mode: GhostPresenceMode;
  onlineCount: number;
  warriors: GhostWarrior[];
  selfId: string | null;
}

export function useGhostPresence(enabled: boolean = true): UseGhostPresenceResult {
  const mode = useGhostStore((s) => s.mode);
  const warriors = useGhostStore((s) => s.onlineWarriors);
  const selfId = useGhostStore((s) => s.selfId);

  // Presence lives exactly as long as the feature is enabled + mounted;
  // turning it off removes this warrior from the database.
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    return startGhostPresence();
  }, [enabled]);

  const onlineCount = useMemo(() => warriors.filter((w) => w.isOnline).length, [warriors]);
  return { mode, onlineCount, warriors, selfId };
}
