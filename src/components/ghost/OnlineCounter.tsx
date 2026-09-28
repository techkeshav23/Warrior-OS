// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Online Counter
// System-tray-style badge showing live warrior count with a subtle
// pulse. Click opens the leaderboard. Tooltip on hover.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { useGhostStore } from '@/stores/useGhostStore';
import { cn } from '@/lib/utils';

interface OnlineCounterProps {
  onClick?: () => void;
  className?: string;
}

function OnlineCounterInner({ onClick, className }: OnlineCounterProps) {
  const onlineCount = useGhostStore((s) => s.getOnlineCount());

  return (
    <button
      onClick={onClick}
      title={`${onlineCount} Warrior${onlineCount === 1 ? '' : 's'} studying right now`}
      className={cn(
        'group relative flex items-center gap-1.5 rounded-lg px-2 py-1 text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary focus-ring',
        className
      )}
      aria-label={`${onlineCount} warriors online. Open leaderboard.`}
    >
      <span className="relative flex items-center">
        <Users size={14} className="text-accent-primary" />
        <motion.span
          className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-accent-success"
          animate={{ opacity: [1, 0.3, 1], scale: [1, 1.4, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </span>
      <span className="font-mono text-xs tabular-nums">{onlineCount}</span>
    </button>
  );
}

export const OnlineCounter = memo(OnlineCounterInner);
