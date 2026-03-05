// ═══════════════════════════════════════════════════════════
// WARRIOR OS — GlassPanel Component
// Glassmorphism container with configurable blur and glow
// ═══════════════════════════════════════════════════════════

'use client';

import { type ReactNode, type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'dark' | 'glow';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  blur?: number;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  border?: boolean;
  hoverGlow?: boolean;
}

const paddingMap = {
  none: '',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
} as const;

const roundedMap = {
  sm: 'rounded-[var(--radius-sm)]',
  md: 'rounded-[var(--radius-md)]',
  lg: 'rounded-[var(--radius-lg)]',
  xl: 'rounded-[var(--radius-xl)]',
  full: 'rounded-full',
} as const;

const variantMap = {
  default: 'glass',
  dark: 'glass-dark',
  glow: 'glass-glow',
} as const;

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  (
    {
      children,
      variant = 'default',
      padding = 'md',
      rounded = 'lg',
      border = true,
      hoverGlow = false,
      className,
      style,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          variantMap[variant],
          paddingMap[padding],
          roundedMap[rounded],
          border && 'glass-border',
          hoverGlow && 'transition-shadow duration-300 hover:shadow-[var(--shadow-glow)]',
          className
        )}
        style={style}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassPanel.displayName = 'GlassPanel';
