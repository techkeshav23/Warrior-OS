// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Phantom Dissolve
// Ethereal pixel-block particle scatter when a phantom expires.
// Renders a grid of small blocks that drift outward + fade.
// ═══════════════════════════════════════════════════════════

'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Phantom } from '@/types/phantom';

interface PhantomDissolveProps {
  phantom: Phantom;
  /** Called once the dissolve animation completes */
  onComplete: (id: string) => void;
}

interface Particle {
  key: number;
  left: number;
  top: number;
  size: number;
  dx: number;
  dy: number;
  delay: number;
}

const COLS = 6;
const ROWS = 5;

function PhantomDissolveInner({ phantom, onComplete }: PhantomDissolveProps) {
  const { size, accent } = phantom;

  const particles = useMemo<Particle[]>(() => {
    const cellW = size.width / COLS;
    const cellH = size.height / ROWS;
    const cx = size.width / 2;
    const cy = size.height / 2;
    const list: Particle[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const px = c * cellW;
        const py = r * cellH;
        // Scatter outward from the center, ethereal + slow.
        const vx = px + cellW / 2 - cx;
        const vy = py + cellH / 2 - cy;
        const mag = Math.hypot(vx, vy) || 1;
        const spread = 40 + Math.random() * 60;
        list.push({
          key: r * COLS + c,
          left: px,
          top: py,
          size: Math.min(cellW, cellH) * 0.8,
          dx: (vx / mag) * spread + (Math.random() - 0.5) * 30,
          dy: (vy / mag) * spread - 20 + (Math.random() - 0.5) * 30,
          delay: Math.random() * 0.4,
        });
      }
    }
    return list;
  }, [size.width, size.height]);

  return (
    <div
      className="pointer-events-none absolute"
      style={{ width: size.width, height: size.height, left: 0, top: 0 }}
    >
      {particles.map((p) => (
        <motion.div
          key={p.key}
          className="absolute rounded-sm"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            background: accent,
            boxShadow: `0 0 6px ${accent}`,
          }}
          initial={{ opacity: 0.55, x: 0, y: 0, scale: 1 }}
          animate={{ opacity: 0, x: p.dx, y: p.dy, scale: 0.3 }}
          transition={{ duration: 1.6, delay: p.delay, ease: 'easeOut' }}
          onAnimationComplete={
            // fire onComplete once, from the first particle only
            p.key === 0 ? () => onComplete(phantom.id) : undefined
          }
        />
      ))}
    </div>
  );
}

export const PhantomDissolve = PhantomDissolveInner;
