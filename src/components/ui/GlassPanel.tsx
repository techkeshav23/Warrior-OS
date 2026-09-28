// ═══════════════════════════════════════════════════════════
// WARRIOR OS — GlassPanel (FORGE HUD kit)
// Generic glass surface. Prefer <Card> for content blocks; GlassPanel is
// for custom layouts that just need the material.
//   default → glass-panel (cards) · dark → glass-popover (menus/overlays)
//   glow    → glass-panel + accent edge (live / focused surfaces)
// ═══════════════════════════════════════════════════════════

'use client';

import { type ReactNode, type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'dark' | 'glow';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Custom backdrop blur in px (ignored in lite mode by the material). */
  blur?: number;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  border?: boolean;
  hoverGlow?: boolean;
  /** HUD corner brackets. */
  hud?: boolean;
}

const paddingMap = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-6' } as const;

const roundedMap = {
  sm: 'rounded-control',
  md: 'rounded-card',
  lg: 'rounded-card',
  xl: 'rounded-sheet',
  full: 'rounded-full',
} as const;

const variantMap = {
  default: 'glass-panel',
  dark: 'glass-popover',
  glow: 'glass-panel ring-1 ring-accent/20',
} as const;

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  (
    {
      children,
      variant = 'default',
      padding = 'md',
      blur,
      rounded = 'lg',
      border = true,
      hoverGlow = false,
      hud = false,
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
          'relative',
          variantMap[variant],
          paddingMap[padding],
          roundedMap[rounded],
          !border && 'border-0',
          hoverGlow && 'transition-[box-shadow,border-color] duration-180 ease-out-quint hover:border-line-strong hover:shadow-glow',
          hud && 'hud-corners',
          className
        )}
        style={{
          ...style,
          ...(blur !== undefined && { backdropFilter: `blur(${blur}px)`, WebkitBackdropFilter: `blur(${blur}px)` }),
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassPanel.displayName = 'GlassPanel';
