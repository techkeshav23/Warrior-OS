// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NeonBadge Component
// Glowing badge with neon edge effect
// ═══════════════════════════════════════════════════════════

'use client';

import { cn } from '@/lib/utils';

interface NeonBadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
}

const VARIANT_MAP = {
  primary: {
    bg: 'bg-accent-primary/10',
    text: 'text-accent-primary',
    glow: 'var(--accent-primary)',
  },
  secondary: {
    bg: 'bg-accent-secondary/10',
    text: 'text-accent-secondary',
    glow: 'var(--accent-secondary)',
  },
  success: {
    bg: 'bg-accent-success/10',
    text: 'text-accent-success',
    glow: 'var(--accent-success)',
  },
  warning: {
    bg: 'bg-accent-warning/10',
    text: 'text-accent-warning',
    glow: 'var(--accent-warning)',
  },
  danger: {
    bg: 'bg-accent-danger/10',
    text: 'text-accent-danger',
    glow: 'var(--accent-danger)',
  },
};

const SIZE_MAP = {
  sm: 'px-1.5 py-0.5 text-[9px]',
  md: 'px-2 py-0.5 text-[10px]',
  lg: 'px-3 py-1 text-xs',
};

export function NeonBadge({
  children,
  variant = 'primary',
  size = 'md',
  pulse = false,
  className,
}: NeonBadgeProps) {
  const v = VARIANT_MAP[variant];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-mono font-bold uppercase tracking-wider',
        v.bg,
        v.text,
        SIZE_MAP[size],
        pulse && 'animate-pulse',
        className
      )}
      style={{
        boxShadow: `0 0 6px color-mix(in srgb, ${v.glow} 25%, transparent), inset 0 0 6px color-mix(in srgb, ${v.glow} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${v.glow} 19%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}
