// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Orb
// The tour's speaker avatar: a glowing core inside a slowly turning
// scanner ring. `still` (reduced motion) freezes both.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';

// Plasma scanner arc fading into violet (plasma-400 → viz-3), and a
// plasma core lit from the top-left.
const RING =
  'conic-gradient(from 0deg, rgba(47, 214, 245, 0) 0deg, rgba(47, 214, 245, 0.95) 150deg, rgba(167, 139, 250, 0.8) 250deg, rgba(47, 214, 245, 0) 360deg)';
const RING_MASK = 'radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1.5px))';
const CORE = 'radial-gradient(circle at 35% 30%, #e6fbff 0%, #7ce7fb 30%, #10b8d8 62%, #0b3a4a 100%)';

interface NexusOrbProps {
  /** Freeze the animation (prefers-reduced-motion). */
  still?: boolean;
  size?: number;
}

function NexusOrbInner({ still = false, size = 36 }: NexusOrbProps) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: RING, WebkitMaskImage: RING_MASK, maskImage: RING_MASK }}
        animate={still ? { rotate: 0 } : { rotate: 360 }}
        transition={still ? { duration: 0 } : { duration: 7, ease: 'linear', repeat: Infinity }}
      />
      <motion.span
        className="absolute rounded-full"
        style={{
          inset: Math.round(size * 0.18),
          background: CORE,
          boxShadow: '0 0 14px rgba(47, 214, 245, 0.45), inset 0 0 6px rgba(255, 255, 255, 0.3)',
        }}
        animate={still ? { scale: 1 } : { scale: [1, 1.06, 1] }}
        transition={still ? { duration: 0 } : { duration: 2.6, ease: 'easeInOut', repeat: Infinity }}
      />
    </div>
  );
}

export const NexusOrb = memo(NexusOrbInner);
