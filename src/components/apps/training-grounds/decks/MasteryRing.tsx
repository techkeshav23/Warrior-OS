// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault: mastery ring
// SVG ring in the deck's colour around its icon.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface MasteryRingProps {
  /** 0..1 */
  value: number;
  color: string;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  title?: string;
}

function MasteryRingInner({ value, color, size = 56, stroke = 4, children, title }: MasteryRingProps) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={title}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        {pct > 0 && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - pct) }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 3px ${color})` }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export const MasteryRing = memo(MasteryRingInner);
