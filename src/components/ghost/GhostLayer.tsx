// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Ghost Layer
// Single desktop overlay wiring up Ghost Warriors: the presence engine
// (local campfire + a labelled simulation), walking ghost avatars,
// the campfire, war-cry bubbles, an online counter and the leaderboard.
//
// Drop <GhostLayer enabled={ghostWarriors} /> once in the desktop phase.
// When the Taskbar mounts <OnlineCounter/> in its tray, pass
// showFloatingCounter={false} (the leaderboard then opens above the tray).
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { GhostPresenceEngine } from './GhostPresenceEngine';
import { GhostAvatars } from './GhostAvatars';
import { CampfireWidget } from './CampfireWidget';
import { WarCryBubbles } from './WarCrySystem';
import { WarriorLeaderboard } from './WarriorLeaderboard';
import { OnlineCounter } from './OnlineCounter';
import { WorkspaceLayer } from './WorkspaceLayer';

interface GhostLayerProps {
  /** When false, presence disconnects and the whole layer is hidden. */
  enabled?: boolean;
  /** Show the built-in floating OnlineCounter (top-right). */
  showFloatingCounter?: boolean;
}

function GhostLayerInner({ enabled = true, showFloatingCounter = true }: GhostLayerProps) {
  return (
    <>
      <GhostPresenceEngine enabled={enabled} />
      {enabled && (
        <>
          {/* Desktop-level: above the icons, below the app windows */}
          <WorkspaceLayer>
            <GhostAvatars />
            <CampfireWidget />
          </WorkspaceLayer>
          <WarCryBubbles />
          {showFloatingCounter && (
            <div className="fixed right-3 top-2" style={{ zIndex: 'var(--z-taskbar)' }}>
              <div className="armor-window p-0.5 [--cut:8px]">
                <OnlineCounter />
              </div>
            </div>
          )}
          <WarriorLeaderboard anchor={showFloatingCounter ? 'top' : 'bottom'} />
        </>
      )}
    </>
  );
}

export const GhostLayer = memo(GhostLayerInner);
