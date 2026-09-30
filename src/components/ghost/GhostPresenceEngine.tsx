// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Ghost Presence Engine
// On login (desktop mount) generates this session's anonymous
// Warrior#XXXX id and runs the offline local campfire (other open tabs
// over BroadcastChannel + SIM-labelled warriors). Renders nothing.
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
