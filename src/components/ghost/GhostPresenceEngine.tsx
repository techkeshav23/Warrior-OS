// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Ghost Presence Engine
// On login (desktop mount) generates this session's anonymous
// Warrior#XXXX id and publishes presence — {studyHoursToday,
// quizzesToday, streak, lastActive} at /presence/{id} with
// onDisconnect().remove() — listens to every warrior's presence and
// refreshes every 5 minutes. Falls back to a labelled simulation when
// no Realtime Database URL is configured. Renders nothing.
// ═══════════════════════════════════════════════════════════

'use client';

import { useGhostPresence } from '@/hooks/useGhostPresence';

interface GhostPresenceEngineProps {
  /** Wire to the ghostWarriors setting; false disconnects immediately. */
  enabled?: boolean;
}

export function GhostPresenceEngine({ enabled = true }: GhostPresenceEngineProps) {
  useGhostPresence(enabled);
  return null;
}
