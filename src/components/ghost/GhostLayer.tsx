// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Ghost Layer
// Single desktop overlay wiring up the whole Ghost Warriors feature:
// starts the (simulated) presence engine and renders avatars, the
// campfire, war-cry bubbles, an online counter, and the leaderboard.
//
// Drop <GhostLayer/> once inside the desktop phase of page.tsx.
// The bundled OnlineCounter (bottom-right) toggles the leaderboard.
// A `ghostWarriors` settings toggle (if present) gates rendering.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useState } from 'react';
import { useGhostPresence } from '@/hooks/useGhostPresence';
import { GhostAvatars } from './GhostAvatars';
import { CampfireWidget } from './CampfireWidget';
import { WarCryBubbles } from './WarCrySystem';
import { WarriorLeaderboard } from './WarriorLeaderboard';
import { OnlineCounter } from './OnlineCounter';

interface GhostLayerProps {
  /** When false, the whole layer is hidden (wire to a settings toggle). */
  enabled?: boolean;
  /** Show the built-in floating OnlineCounter. Set false if the Taskbar
   *  mounts its own OnlineCounter to avoid duplicates. */
  showFloatingCounter?: boolean;
}

function GhostLayerInner({ enabled = true, showFloatingCounter = true }: GhostLayerProps) {
  // Presence simulation MUST run so widgets that read the store elsewhere
  // (e.g. a Taskbar OnlineCounter) also get data. Keep the hook mounted.
  useGhostPresence();

  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  if (!enabled) return null;

  return (
    <>
      <GhostAvatars />
      <WarCryBubbles />
      <CampfireWidget />

      {showFloatingCounter && (
        <div
          className="fixed right-3 top-2"
          style={{ zIndex: 'var(--z-taskbar)' }}
        >
          <OnlineCounter onClick={() => setLeaderboardOpen((o) => !o)} />
        </div>
      )}

      <WarriorLeaderboard
        isOpen={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
      />
    </>
  );
}

export const GhostLayer = memo(GhostLayerInner);
