// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault: mastery ring
// Hairline-track ring in the deck's hue around its emoji. A mastered
// deck (≥ 80%) earns a soft glow; nothing else glows.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MASTERED_THRESHOLD } from '@/stores/useLearningStore';
import { EASE_OUT_QUINT } from '@/styles/tokens';
import { deckHue } from './deck-ui';

interface MasteryRingProps {
  /** 0..1 */
  value: number;
  /** Deck colour (stored hex; mapped onto the palette). */
  color: string;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  /** Hover text and accessible name, e.g. "58% mastery". */
  title?: string;
}

function MasteryRingInner({ value, color, size = 56, stroke = 4, children, title }: MasteryRingProps) {
  const reduce = useReducedMotion();
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const hue = deckHue(color);
  const glow = pct >= MASTERED_THRESHOLD;

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      title={title}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-ink-600)"
          strokeOpacity={0.75}
          strokeWidth={stroke}
        />
        {pct > 0 && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={hue}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={reduce ? false : { strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - pct) }}
            transition={{ duration: 0.9, ease: EASE_OUT_QUINT }}
            style={glow ? { filter: `drop-shadow(0 0 4px color-mix(in srgb, ${hue} 60%, transparent))` } : undefined}
          />
        )}
      </svg>
      {/* Inner well keeps the emoji off the ring. */}
      <div
        className="relative flex items-center justify-center rounded-full bg-ink-850/80 inset-shadow-[0_1px_0_rgb(255_255_255/0.05)]"
        style={{ width: size - stroke * 2 - 6, height: size - stroke * 2 - 6 }}
      >
        {children}
      </div>
    </div>
  );
}

export const MasteryRing = memo(MasteryRingInner);
