// ═══════════════════════════════════════════════════════════
// WARRIOR OS — ProgressBar (FORGED ARMOR kit)
// Linear progress in a sunk steel slot, filled with forge heat (cold →
// tone → white-hot tip), with segment marks; or discrete skewed cells.
//   <ProgressBar value={62} label="Daily goal" showValue />
//   <ProgressBar value={7} max={10} segments={10} tone="ember" />  // streak cells
// `color` (any CSS color) still works and overrides `tone`.
// ═══════════════════════════════════════════════════════════

'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type ProgressTone = 'accent' | 'ember' | 'success' | 'warning' | 'danger' | 'info' | 'gold';

/** CSS colors per tone (token vars with brief fallbacks). */
export const PROGRESS_COLOR: Record<ProgressTone, string> = {
  accent: 'var(--accent, #2fd6f5)',
  ember: 'var(--color-ember-400, #ff8a3d)',
  success: 'var(--color-success, #3ddc97)',
  warning: 'var(--color-warning, #f5c04a)',
  danger: 'var(--color-danger, #ff5470)',
  info: 'var(--color-info, #6aa8ff)',
  gold: 'var(--color-gold, #f5c04a)',
};

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: ReactNode;
  showValue?: boolean;
  /** Custom value text (replaces the percentage). */
  valueLabel?: ReactNode;
  /** sm 4px · md 6px · lg 8px */
  size?: 'sm' | 'md' | 'lg';
  tone?: ProgressTone;
  /** Any CSS color; overrides tone. */
  color?: string;
  /** Soft glow on the fill (use for live / hero meters only). */
  glow?: boolean;
  /** Animate from 0 on mount. */
  animated?: boolean;
  /** Draw N discrete cells instead of a continuous bar. */
  segments?: number;
  className?: string;
  'aria-label'?: string;
}

const HEIGHT = { sm: 'h-1', md: 'h-1.5', lg: 'h-2' } as const;
const EASE = [0.16, 1, 0.3, 1] as const;

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
  valueLabel,
  size = 'md',
  tone = 'accent',
  color,
  glow = false,
  animated = true,
  segments,
  className,
  ...aria
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min(Math.max((value / max) * 100, 0), 100) : 0;
  const fill = color ?? PROGRESS_COLOR[tone];
  const glowShadow = glow ? `0 0 10px color-mix(in srgb, ${fill} 55%, transparent)` : undefined;
  // Forge heat: cold metal → the tone → a white-hot tip at the leading edge.
  const heat =
    !color && tone === 'ember'
      ? 'linear-gradient(90deg, #4a1204, var(--color-ember-600, #d4520b) 40%, var(--color-ember-400, #ff8a3d) 82%, #ffe6cc)'
      : `linear-gradient(90deg, color-mix(in srgb, ${fill} 30%, #0a0a0a), ${fill} 80%, color-mix(in srgb, ${fill} 50%, #fff))`;

  return (
    <div className={cn('w-full min-w-0', className)}>
      {(label != null || showValue || valueLabel != null) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label != null && (
            <span className="engraved truncate font-display text-2xs font-semibold uppercase tracking-[0.14em] text-fg-muted">{label}</span>
          )}
          {(showValue || valueLabel != null) && (
            <span className="tabular ml-auto font-display text-xs font-semibold text-fg">{valueLabel ?? `${Math.round(pct)}%`}</span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(Math.max(value, 0), max)}
        aria-label={aria['aria-label'] ?? (typeof label === 'string' ? label : undefined)}
        className={cn(
          'w-full',
          segments
            ? 'flex gap-[3px] px-0.5'
            : 'relative chamfer [--cut:3px] overflow-hidden bg-linear-to-b from-[#05070a] to-[#141920] shadow-[inset_0_1px_0_rgb(0_0_0/0.8),inset_0_-1px_0_rgb(255_255_255/0.1)]',
          HEIGHT[size]
        )}
      >
        {segments ? (
          Array.from({ length: segments }, (_, i) => {
            const cell = Math.min(Math.max((pct / 100) * segments - i, 0), 1);
            return (
              <span
                key={i}
                className="relative h-full flex-1 -skew-x-[24deg] overflow-hidden bg-white/[0.06] shadow-[inset_0_1px_0_rgb(0_0_0/0.6)]"
              >
                {cell > 0 && (
                  <span
                    className="absolute inset-y-0 left-0 transition-[width] duration-260 ease-out-quint"
                    style={{
                      width: `${cell * 100}%`,
                      // Each lit cell is hotter than the last: the run ends white-hot.
                      background:
                        !color && tone === 'ember'
                          ? `color-mix(in srgb, #ffe6cc ${Math.round((i / Math.max(1, segments - 1)) * 45)}%, ${i < segments / 3 ? 'var(--color-ember-600, #d4520b)' : 'var(--color-ember-400, #ff8a3d)'})`
                          : `color-mix(in srgb, #fff ${Math.round((i / Math.max(1, segments - 1)) * 30)}%, ${fill})`,
                      boxShadow: glowShadow,
                    }}
                  />
                )}
              </span>
            );
          })
        ) : (
          <motion.div
            className="relative h-full"
            style={{ background: heat, boxShadow: glowShadow }}
            initial={animated ? { width: 0 } : false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: animated ? 0.7 : 0, ease: EASE }}
          />
        )}
        {!segments && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_calc(10%-1px),rgb(0_0_0/0.5)_calc(10%-1px),rgb(0_0_0/0.5)_10%)]"
          />
        )}
      </div>
    </div>
  );
}
