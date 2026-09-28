// ═══════════════════════════════════════════════════════════
// WARRIOR OS — ProgressBar (FORGE HUD kit)
// Linear progress: continuous (default) or segmented HUD cells.
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
  const glowShadow = glow ? `0 0 10px color-mix(in srgb, ${fill} 45%, transparent)` : undefined;

  return (
    <div className={cn('w-full min-w-0', className)}>
      {(label != null || showValue || valueLabel != null) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label != null && <span className="truncate text-xs text-fg-muted">{label}</span>}
          {(showValue || valueLabel != null) && (
            <span className="tabular ml-auto font-mono text-xs text-fg">{valueLabel ?? `${Math.round(pct)}%`}</span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(Math.max(value, 0), max)}
        aria-label={aria['aria-label'] ?? (typeof label === 'string' ? label : undefined)}
        className={cn('w-full', segments ? 'flex gap-0.5' : 'overflow-hidden rounded-full bg-ink-600/70', HEIGHT[size])}
      >
        {segments ? (
          Array.from({ length: segments }, (_, i) => {
            const cell = Math.min(Math.max((pct / 100) * segments - i, 0), 1);
            return (
              <span key={i} className="relative h-full flex-1 overflow-hidden rounded-[2px] bg-ink-600/70">
                {cell > 0 && (
                  <span
                    className="absolute inset-y-0 left-0 transition-[width] duration-260 ease-out-quint"
                    style={{ width: `${cell * 100}%`, background: fill, boxShadow: glowShadow }}
                  />
                )}
              </span>
            );
          })
        ) : (
          <motion.div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, color-mix(in srgb, ${fill} 70%, transparent), ${fill})`,
              boxShadow: glowShadow,
            }}
            initial={animated ? { width: 0 } : false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: animated ? 0.7 : 0, ease: EASE }}
          />
        )}
      </div>
    </div>
  );
}
