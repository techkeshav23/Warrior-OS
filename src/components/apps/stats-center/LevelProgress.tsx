// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Level Progress Insignia
// A forged octagonal rank insignia: a gold heat line runs around the
// cut rim as the warrior closes on the next level, the level number is
// struck into the sunk face and rank chevrons stack under it.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useXPStore } from '@/stores/useXPStore';
import { MAX_LEVEL, levelProgress, levelTitle } from '@/components/effects/effects-utils';

interface LevelProgressProps {
  size?: number;
}

/** Corner cut of a regular octagon, as a share of its width. */
const OCT = 1 / (2 + Math.SQRT2);
const STROKE = 5;

/** Octagon path inset by `i`, starting top-centre so progress runs clockwise from 12 o'clock. */
function octagon(size: number, i: number): string {
  const s = size - i * 2;
  const c = s * OCT;
  const m = size / 2;
  return `M${m} ${i}H${i + s - c}L${i + s} ${i + c}V${i + s - c}L${i + s - c} ${i + s}H${i + c}L${i} ${i + s - c}V${i + c}L${i + c} ${i}Z`;
}

/** Rank chevrons: one per third of the ladder, at least one. */
function chevronCount(level: number): number {
  return Math.max(1, Math.min(3, Math.ceil((level / MAX_LEVEL) * 3)));
}

function LevelProgressInner({ size = 88 }: LevelProgressProps) {
  // Derive from primitives: store getter calls during render can be
  // memoised into stale values by the React Compiler.
  const xp = useXPStore((s) => s.xp);
  const level = useXPStore((s) => s.level);
  const reduceMotion = useReducedMotion();
  const progress = Math.min(100, Math.max(0, levelProgress(xp, level)));
  const rim = octagon(size, STROKE / 2);
  const face = size - STROKE * 2 - 6;
  const chevrons = chevronCount(level);

  return (
    <div
      className="relative shrink-0 drop-shadow-[0_0_14px_color-mix(in_oklab,var(--color-gold)_22%,transparent)] lite:drop-shadow-none"
      style={{ width: size, height: size }}
      title={`${levelTitle(level)} · ${Math.round(progress)}% of the way to the next level`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      aria-label={`Level ${level} progress`}
    >
      <svg width={size} height={size} className="absolute inset-0" aria-hidden>
        <path d={rim} fill="none" strokeWidth={STROKE} stroke="var(--color-steel-900)" strokeLinejoin="miter" />
        <motion.path
          d={rim}
          fill="none"
          strokeWidth={STROKE}
          strokeLinejoin="miter"
          stroke="var(--color-gold)"
          pathLength={1}
          strokeDasharray="1 1"
          initial={false}
          animate={{ strokeDashoffset: 1 - progress / 100 }}
          transition={{ duration: reduceMotion ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      {/* Sunk steel face with the level struck into it */}
      <div
        className="chamfer absolute flex flex-col items-center justify-center bg-linear-to-b from-steel-850 to-steel-950 shadow-[inset_0_1px_0_rgb(0_0_0/0.7),inset_0_2px_8px_rgb(0_0_0/0.5),inset_0_-1px_0_rgb(255_255_255/0.07)]"
        style={{ inset: STROKE + 3, '--cut': `${Math.round(face * OCT)}px` } as CSSProperties}
      >
        <span className="engraved font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">Level</span>
        <span className="tabular font-display text-2xl font-semibold leading-none text-fg">{level}</span>
        <span className="mt-1 flex flex-col items-center -space-y-0.5" aria-hidden>
          {Array.from({ length: chevrons }, (_, i) => (
            <svg key={i} width={14} height={4} viewBox="0 0 14 4">
              <path d="M0 0L7 3.2L14 0V0.9L7 4L0 0.9Z" fill="var(--color-gold)" />
            </svg>
          ))}
        </span>
      </div>
    </div>
  );
}

export const LevelProgress = memo(LevelProgressInner);
