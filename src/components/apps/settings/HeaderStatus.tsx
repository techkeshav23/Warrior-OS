// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Settings header status
// The right side of each tab's AppHeader: one quiet live readout (or
// action) per tab, so the state of a page reads before its body does.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { Bot } from 'lucide-react';
import { Badge, Button, type Tone } from '@/components/ui';
import { useLiteModeStatus } from '@/lib/lite-mode';
import { getVisitorMode } from '@/lib/visitor';
import { isFirebaseConfigured } from '@/lib/auth';
import { useAuthStore } from '@/stores/useAuthStore';
import { useDecayStore } from '@/stores/useDecayStore';
import { useNexusStore } from '@/stores/useNexusStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { DECAY_STAGE_NAMES } from '@/components/decay/DecayTrayTimer';
import type { SettingsTabId } from './parts';

const DECAY_TONE: readonly Tone[] = ['success', 'warning', 'warning', 'warning', 'danger', 'danger'];

function PerformanceStatus() {
  const { active, device } = useLiteModeStatus();
  if (!device) return <Badge>Checking</Badge>;
  return active ? (
    <Badge tone="accent" dot>
      Lite mode
    </Badge>
  ) : (
    <Badge tone="success" dot>
      Full effects
    </Badge>
  );
}

function DecayStatus() {
  const enabled = useDecayStore((s) => s.enabled);
  const stage = useDecayStore((s) => s.decayStage);
  if (!enabled) return <Badge>Decay off</Badge>;
  const i = Math.max(0, Math.min(5, stage));
  return (
    <Badge tone={DECAY_TONE[i]} dot>
      {DECAY_STAGE_NAMES[i]}
    </Badge>
  );
}

function SoundStatus() {
  const sound = useSettingsStore((s) => s.soundEnabled);
  const music = useSettingsStore((s) => s.musicEnabled);
  if (sound || music) return null;
  return <Badge>Muted</Badge>;
}

function WorkspaceStatus() {
  const name = useWorkspaceStore((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId)?.name);
  if (!name) return null;
  return (
    <Badge tone="accent" dot>
      {name}
    </Badge>
  );
}

function AccountStatus() {
  const signedIn = useAuthStore((s) => s.isAuthenticated && s.user !== null);
  const [mode] = useState(getVisitorMode);
  // No Firebase config, or not the owner session: there is nothing to sign in to.
  if (!isFirebaseConfigured() || mode !== 'owner') return <Badge>Local only</Badge>;
  return signedIn ? (
    <Badge tone="success" dot>
      Signed in
    </Badge>
  ) : (
    <Badge>Not signed in</Badge>
  );
}

function SessionStatus() {
  // Settings only renders client-side, so the stored mode is read once here.
  const [mode] = useState(getVisitorMode);
  if (mode === 'guest') return <Badge tone="info">Guest</Badge>;
  if (mode === 'owner') return <Badge tone="accent">Owner</Badge>;
  return <Badge>Not remembered</Badge>;
}

export function HeaderStatus({ tab }: { tab: SettingsTabId }) {
  switch (tab) {
    case 'performance':
      return <PerformanceStatus />;
    case 'living':
      return <DecayStatus />;
    case 'sounds':
      return <SoundStatus />;
    case 'workspaces':
      return <WorkspaceStatus />;
    case 'nexus':
      return (
        <Button size="sm" leadingIcon={Bot} onClick={() => useNexusStore.getState().setOpen(true)}>
          Open NEXUS
        </Button>
      );
    case 'account':
      return <AccountStatus />;
    case 'showcase':
      return <SessionStatus />;
    default:
      return null;
  }
}
