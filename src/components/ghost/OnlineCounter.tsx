// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Online Counter
// System-tray badge: live warrior count with a subtle pulse. Click →
// toggles the leaderboard. Tooltip: "47 Warriors studying right now".
// Shows an OFFLINE tag (and says so in the tooltip) in local mode.
// Renders nothing while Ghost Warriors is disabled.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { useGhostStore } from '@/stores/useGhostStore';
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
  const onlineCount = useMemo(() => warriors.filter((w) => w.isOnline).length, [warriors]);

  if (mode === 'disabled') return null;

  const simulated = mode === 'local';
  const tabs = warriors.filter((w) => w.isOnline && w.isLocalTab).length;
  const title =
    mode === 'connecting'
      ? 'Connecting to Ghost Warriors…'
      : simulated
        ? `${onlineCount} Warriors at the offline campfire (${tabs} other tab${tabs === 1 ? '' : 's'}, rest simulated)`
        : `${onlineCount} Warrior${onlineCount === 1 ? '' : 's'} studying right now`;

  return (
    <button
      type="button"
      onClick={onClick ?? toggleLeaderboard}
      title={title}
      className={cn(
        'group relative flex h-8 items-center gap-1.5 rounded-lg px-2 text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary focus-ring',
        className
      )}
      aria-label={`${title}. Open leaderboard.`}
    >
      <span className="relative flex items-center">
        <Users size={14} className={simulated ? 'text-accent-warning' : 'text-accent-primary'} />
        <motion.span
          className={cn(
            'absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full',
            mode === 'connecting' ? 'bg-text-muted' : simulated ? 'bg-accent-warning' : 'bg-accent-success'
          )}
          animate={{ opacity: [1, 0.3, 1], scale: [1, 1.4, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </span>
      <span className="font-mono text-xs tabular-nums">{mode === 'connecting' ? '…' : onlineCount}</span>
      {simulated && <span className="rounded bg-accent-warning/15 px-1 font-mono text-[8px] text-accent-warning">OFFLINE</span>}
    </button>
  );
}

export const OnlineCounter = memo(OnlineCounterInner);
