// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Ghost Avatars
// Translucent warrior figures that walk slowly across the desktop
// bottom. Count = min(onlineCount, 10). Fade in/out on join/leave.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGhostStore } from '@/stores/useGhostStore';
import { cn } from '@/lib/utils';

const MAX_AVATARS = 10;

interface WalkerConfig {
  id: string;
  duration: number; // seconds to cross
  delay: number;
  bottom: number;   // px above the taskbar
  direction: 1 | -1;
  hue: number;
}

/** A single translucent walking warrior sprite. */
function GhostWalker({ config }: { config: WalkerConfig }) {
  const { duration, delay, bottom, direction, hue } = config;

  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{ bottom }}
      initial={{ opacity: 0 }}
      animate={{
        opacity: [0, 0.15, 0.15, 0],
        left: direction === 1 ? ['-5%', '105%'] : ['105%', '-5%'],
      }}
      exit={{ opacity: 0 }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'linear',
        opacity: { duration, delay, repeat: Infinity, times: [0, 0.1, 0.9, 1] },
      }}
    >
      <div
        className={cn('relative', direction === -1 && 'scale-x-[-1]')}
        style={{ width: 20, height: 30 }}
      >
        {/* body */}
        <motion.svg
          viewBox="0 0 20 30"
          width={20}
          height={30}
          style={{ filter: `drop-shadow(0 0 4px hsla(${hue},100%,70%,0.6))` }}
          animate={{ y: [0, -1.5, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* head */}
          <circle cx="10" cy="5" r="3.5" fill={`hsla(${hue},90%,75%,0.9)`} />
          {/* torso */}
          <rect x="7" y="8" width="6" height="10" rx="2" fill={`hsla(${hue},80%,65%,0.85)`} />
          {/* legs (animated stride) */}
          <motion.line
            x1="8.5" y1="18" x2="7" y2="27"
            stroke={`hsla(${hue},80%,60%,0.85)`} strokeWidth="1.6" strokeLinecap="round"
            animate={{ x2: [7, 9, 7] }}
            transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.line
            x1="11.5" y1="18" x2="13" y2="27"
            stroke={`hsla(${hue},80%,60%,0.85)`} strokeWidth="1.6" strokeLinecap="round"
            animate={{ x2: [13, 11, 13] }}
            transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* sword hint */}
          <line x1="13" y1="10" x2="16" y2="6" stroke={`hsla(${hue},100%,80%,0.7)`} strokeWidth="1" strokeLinecap="round" />
        </motion.svg>
      </div>
    </motion.div>
  );
}

function GhostAvatarsInner() {
  const onlineCount = useGhostStore((s) => s.getOnlineCount());

  const walkers = useMemo<WalkerConfig[]>(() => {
    const n = Math.min(onlineCount, MAX_AVATARS);
    return Array.from({ length: n }, (_, i) => ({
      id: `walker-${i}`,
      duration: 30 + (i % 5) * 8,       // 30-62s crossing
      delay: (i * 3.7) % 12,
      bottom: 56 + (i % 4) * 10,        // above taskbar, staggered rows
      direction: i % 2 === 0 ? 1 : -1,
      hue: 180 + ((i * 37) % 120),      // cyan → purple → pink range
    }));
  }, [onlineCount]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 overflow-hidden"
      style={{ height: 140, zIndex: 'var(--z-desktop)' }}
      aria-hidden
    >
      <AnimatePresence>
        {walkers.map((w) => (
          <GhostWalker key={w.id} config={w} />
        ))}
      </AnimatePresence>
    </div>
  );
}

export const GhostAvatars = memo(GhostAvatarsInner);
