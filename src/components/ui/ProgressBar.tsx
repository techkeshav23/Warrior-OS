// ═══════════════════════════════════════════════════════════
// WARRIOR OS — ProgressBar Component
// Linear progress with glow and animated fill
// ═══════════════════════════════════════════════════════════

'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;        // 0-100
  max?: number;
  label?: string;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: string;       // CSS color
  glow?: boolean;
  animated?: boolean;
  className?: string;
}

const sizeMap = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
} as const;

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
  size = 'md',
  color = 'var(--accent-primary)',
  glow = true,
  animated = true,
  className,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1">
          {label && (
            <span className="text-xs text-text-secondary font-mono">{label}</span>
          )}
          {showValue && (
            <span className="text-xs text-text-muted font-mono">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          'w-full rounded-full overflow-hidden bg-white/5',
          sizeMap[size]
        )}
      >
        <motion.div
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            boxShadow: glow ? `0 0 8px ${color}40` : undefined,
          }}
          initial={animated ? { width: 0 } : { width: `${percentage}%` }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: animated ? 0.8 : 0, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}
