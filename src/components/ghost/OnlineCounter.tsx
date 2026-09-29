// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Online Counter
// System-tray button: live warrior count with a status dot (success =
// live, warning = offline campfire, faint = connecting; it breathes
// softly while connected). Click → toggles the leaderboard. Tooltip:
// "47 Warriors studying right now". Shows an Offline badge (and says
// so in the tooltip) in local mode. Renders nothing while disabled.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo } from 'react';
import { Users } from 'lucide-react';
import { useGhostStore } from '@/stores/useGhostStore';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface OnlineCounterProps {
  /** Defaults to toggling the ghost store's leaderboard. */
  onClick?: () => void;
  className?: string;
}

function OnlineCounterInner({ onClick, className }: OnlineCounterProps) {
  const warriors = useGhostStore((s) => s.onlineWarriors);
  const mode = useGhostStore((s) => s.mode);
  const toggleLeaderboard = useGhostStore((s) => s.toggleLeaderboard);
  const leaderboardOpen = useGhostStore((s) => s.leaderboardOpen);
  const onlineCount = useMemo(() => warriors.filter((w) => w.isOnline).length, [warriors]);

  if (mode === 'disabled') return null;

  const simulated = mode === 'local';
  const connecting = mode === 'connecting';
  const tabs = warriors.filter((w) => w.isOnline && w.isLocalTab).length;
  const title = connecting
    ? 'Connecting to Ghost Warriors…'
    : simulated
      ? `${onlineCount} Warriors at the offline campfire (${tabs} other tab${tabs === 1 ? '' : 's'}, rest simulated)`
      : `${onlineCount} Warrior${onlineCount === 1 ? '' : 's'} studying right now`;

  return (
    <button
      type="button"
      onClick={onClick ?? toggleLeaderboard}
      title={title}
      aria-expanded={onClick ? undefined : leaderboardOpen}
      className={cn(
        'chamfer-xs group relative flex h-8 items-center gap-1.5 px-2 focus-ring',
        'transition-colors duration-120 ease-out-quint',
        leaderboardOpen && !onClick
          ? 'bg-surface-active text-fg'
          : 'text-fg-muted hover:bg-surface-hover hover:text-fg active:bg-surface-active',
        className
      )}
      aria-label={`${title}. Open leaderboard.`}
    >
      <span className="relative flex">
        <Users size={16} strokeWidth={1.75} aria-hidden />
        <span
          aria-hidden
          className={cn(
            'absolute -right-0.5 -top-0.5 size-1.5 rounded-full ring-2 ring-ink-900',
            connecting ? 'bg-fg-faint' : simulated ? 'bg-warning' : 'bg-success motion-safe:animate-pulse-soft'
          )}
        />
      </span>
      <span className="min-w-[2ch] text-left font-mono text-xs font-medium tabular">{connecting ? '…' : onlineCount}</span>
      {simulated && (
        <Badge tone="warning" size="sm">
          Offline
        </Badge>
      )}
    </button>
  );
}

export const OnlineCounter = memo(OnlineCounterInner);
