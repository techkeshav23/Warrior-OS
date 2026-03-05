// ═══════════════════════════════════════════════════════════
// WARRIOR OS — ProgressRing Component
// Circular progress indicator with SVG
// ═══════════════════════════════════════════════════════════

'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ProgressRingProps {
  value: number;       // 0-100
  size?: number;       // px
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  showValue?: boolean;
  className?: string;
}

export function ProgressRing({
  value,
  size = 80,
  strokeWidth = 4,
  color = 'var(--accent-primary)',
  trackColor = 'rgba(255,255,255,0.05)',
  label,
  showValue = true,
  className,
}: ProgressRingProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedValue / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      {/* Center text */}
      {showValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-sm font-mono font-bold"
            style={{ color }}
          >
            {Math.round(clampedValue)}%
          </span>
          {label && (
            <span className="text-[8px] font-mono text-text-muted mt-0.5">
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
