// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NeonBadge (legacy API)
// Thin wrapper over the kit's <Badge>; new code should use Badge.
// ═══════════════════════════════════════════════════════════

'use client';

import { Badge, type Tone } from './Badge';

interface NeonBadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
}

const TONE: Record<NonNullable<NeonBadgeProps['variant']>, Tone> = {
  primary: 'accent',
  secondary: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

/** @deprecated Use `<Badge tone=… />`. */
export function NeonBadge({ children, variant = 'primary', size = 'md', pulse = false, className }: NeonBadgeProps) {
  return (
    <Badge tone={TONE[variant]} size={size === 'sm' ? 'sm' : 'md'} dot={pulse} pulse={pulse} className={className}>
      {children}
    </Badge>
  );
}
