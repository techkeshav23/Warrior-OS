// ═══════════════════════════════════════════════════════════
// WARRIOR OS — ProgressRing (FORGED ARMOR kit)
// Segmented circular gauge in a steel bezel, forged-number readout (or custom children).
//   <ProgressRing value={72} size={96} label="FOCUS" />
//   <ProgressRing value={xpPct} tone="gold"><span>LV 7</span></ProgressRing>
// ═══════════════════════════════════════════════════════════

'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PROGRESS_COLOR, type ProgressTone } from './ProgressBar';

interface ProgressRingProps {
  /** 0–100 */
  value: number;
  size?: number;
  strokeWidth?: number;
  tone?: ProgressTone;
  /** Any CSS color; overrides tone. */
  color?: string;
  trackColor?: string;
  /** hud-label under the value. */
  label?: string;
  showValue?: boolean;
  /** Custom center content (replaces value + label). */
  children?: ReactNode;
  glow?: boolean;
  className?: string;
}

export function ProgressRing({
  value,
  size = 80,
  strokeWidth,
  tone = 'accent',
  color,
  trackColor = 'var(--color-ink-600, #243044)',
  label,
  showValue = true,
  children,
  glow = false,
  className,
}: ProgressRingProps) {
  const clamped = Math.min(Math.max(value, 0), 100);
  const stroke = strokeWidth ?? Math.max(3, Math.round(size / 18));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const fill = color ?? PROGRESS_COLOR[tone];
  const valueSize = size >= 96 ? 'text-xl' : size >= 64 ? 'text-base' : 'text-xs';

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        {/* Steel bezel + sunk track */}
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 0.5} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth={1} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} opacity={0.55} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={fill}
          strokeWidth={stroke}
          strokeLinecap="butt"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={glow ? { filter: `drop-shadow(0 0 4px color-mix(in srgb, ${fill} 60%, transparent))` } : undefined}
        />
        {/* Segment marks cut through the ring (24 plates) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-ink-950, #04060b)"
          strokeWidth={stroke + 1}
          strokeDasharray={`1.5 ${circumference / 24 - 1.5}`}
          opacity={0.85}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children ??
          (showValue && (
            <>
              <span className={cn('tabular font-display font-bold leading-none text-fg [text-shadow:0_1px_0_rgb(0_0_0/0.8)]', valueSize)}>
                {Math.round(clamped)}
                <span className="ml-px text-[0.6em] text-fg-muted">%</span>
              </span>
              {label && size >= 64 && <span className="hud-label mt-1.5 !text-[10px]">{label}</span>}
            </>
          ))}
      </div>
    </div>
  );
}
