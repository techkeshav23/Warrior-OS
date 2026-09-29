// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Ghost Avatars
// Tiny translucent warrior figures (20×30 px, ~15% opacity, cool
// on-palette tints; you walk in Plasma) walking
// slowly across the bottom of the desktop. One per online warrior,
// max 10. Each warrior gets a stable pseudo-random path (baseline,
// speed, direction, wander) derived from its id. Pure CSS animation
// (transform only) — fade in when a warrior joins, out when it leaves.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGhostStore } from '@/stores/useGhostStore';
import type { GhostWarrior } from '@/types/ghost';
import { FG, PLASMA, VIZ } from '@/styles/tokens';

/** Walker tints: cool, on-palette spirits; you are Plasma. */
const WALKER_TINTS = [PLASMA[300], VIZ[2], VIZ[5], FG.muted, PLASMA[500]] as const;

const MAX_AVATARS = 10;

const KEYFRAMES = `
@keyframes wos-ghost-walk-ltr { from { transform: translate3d(-40px,0,0); } to { transform: translate3d(calc(100vw + 40px),0,0); } }
@keyframes wos-ghost-walk-rtl { from { transform: translate3d(calc(100vw + 40px),0,0); } to { transform: translate3d(-40px,0,0); } }
@keyframes wos-ghost-wander { 0%, 100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(0,-9px,0); } }
@keyframes wos-ghost-bob { 0%, 100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(0,-1.5px,0); } }
@keyframes wos-ghost-leg-a { 0%, 100% { transform: rotate(14deg); } 50% { transform: rotate(-14deg); } }
@keyframes wos-ghost-leg-b { 0%, 100% { transform: rotate(-14deg); } 50% { transform: rotate(14deg); } }
`;

interface WalkerConfig {
  id: string;
  duration: number; // seconds to cross the screen
  delay: number; // negative → already mid-walk when it appears
  bottom: number; // px above the viewport bottom (above the taskbar)
  direction: 'ltr' | 'rtl';
  color: string;
  wander: number; // seconds per wander cycle
  simulated: boolean;
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function configFor(w: GhostWarrior): WalkerConfig {
  const h = hashId(w.anonymousId);
  const r = (shift: number) => ((h >>> shift) & 0xff) / 255;
  const duration = 38 + r(0) * 34; // 38–72s crossing
  return {
    id: w.anonymousId,
    duration,
    delay: -r(8) * duration,
    bottom: 54 + Math.round(r(16) * 42),
    direction: r(24) > 0.5 ? 'ltr' : 'rtl',
    color: w.isSelf ? PLASMA[400] : WALKER_TINTS[Math.floor(r(4) * WALKER_TINTS.length) % WALKER_TINTS.length],
    wander: 7 + r(12) * 7,
    simulated: Boolean(w.isSimulated),
  };
}

/** A single translucent walking warrior sprite. */
function GhostWalker({ config }: { config: WalkerConfig }) {
  const { duration, delay, bottom, direction, color, wander, simulated } = config;
  // Simulated warriors walk a little fainter than real ones.
  const body = `color-mix(in oklab, ${color} ${simulated ? 70 : 88}%, var(--color-fg))`;
  const limb = `color-mix(in oklab, ${color} ${simulated ? 60 : 80}%, var(--color-ink-950))`;
  return (
    <motion.div
      className="pointer-events-none absolute left-0"
      style={{ bottom }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.4, ease: 'easeInOut' }}
    >
      <div style={{ animation: `wos-ghost-walk-${direction} ${duration}s linear ${delay}s infinite` }}>
        <div style={{ animation: `wos-ghost-wander ${wander}s ease-in-out infinite` }}>
          <div
            style={{
              width: 20,
              height: 30,
              opacity: simulated ? 0.13 : 0.17,
              transform: direction === 'rtl' ? 'scaleX(-1)' : undefined,
              filter: `drop-shadow(0 0 4px ${color})`,
            }}
          >
            <svg viewBox="0 0 20 30" width={20} height={30} style={{ animation: 'wos-ghost-bob 0.62s ease-in-out infinite', overflow: 'visible' }}>
              <circle cx="10" cy="5" r="3.5" fill={body} />
              <rect x="7" y="8" width="6" height="10" rx="2" fill={body} />
              <g style={{ transformOrigin: '9px 18px', animation: 'wos-ghost-leg-a 0.62s ease-in-out infinite' }}>
                <line x1="9" y1="18" x2="9" y2="27" stroke={limb} strokeWidth="1.8" strokeLinecap="round" />
              </g>
              <g style={{ transformOrigin: '11px 18px', animation: 'wos-ghost-leg-b 0.62s ease-in-out infinite' }}>
                <line x1="11" y1="18" x2="11" y2="27" stroke={limb} strokeWidth="1.8" strokeLinecap="round" />
              </g>
              <line x1="13" y1="10" x2="16.5" y2="5.5" stroke={color} strokeWidth="1" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function GhostAvatarsInner() {
  const warriors = useGhostStore((s) => s.onlineWarriors);

  const walkers = useMemo<WalkerConfig[]>(
    () =>
      warriors
        .filter((w) => w.isOnline)
        .slice(0, MAX_AVATARS)
        .map(configFor),
    [warriors]
  );

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 overflow-hidden"
      style={{ height: 150, zIndex: 'var(--z-desktop)' }}
      aria-hidden
    >
      <style>{KEYFRAMES}</style>
      <AnimatePresence>
        {walkers.map((w) => (
          <GhostWalker key={w.id} config={w} />
        ))}
      </AnimatePresence>
    </div>
  );
}

export const GhostAvatars = memo(GhostAvatarsInner);
