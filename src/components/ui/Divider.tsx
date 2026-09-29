// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Divider + Skeleton (FORGED ARMOR kit)
//   <Divider />  <Divider label="Or" />  <Divider orientation="vertical" />
//   <Skeleton className="h-4 w-40" />  <Skeleton lines={3} />
// ═══════════════════════════════════════════════════════════

'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DividerProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  /** Centered hud-label between two hairlines. */
  label?: ReactNode;
  /** Brighter hairline. */
  strong?: boolean;
}

/** 1px hairline separator. */
export function Divider({ orientation = 'horizontal', label, strong = false, className, ...props }: DividerProps) {
  const line = strong ? 'bg-line-strong' : 'bg-line';
  if (orientation === 'vertical') {
    return <div role="separator" aria-orientation="vertical" className={cn('w-px self-stretch', line, className)} {...props} />;
  }
  if (label != null) {
    return (
      <div role="separator" className={cn('flex items-center gap-3', className)} {...props}>
        <span className={cn('h-px flex-1', line)} />
        <span className="hud-label shrink-0">{label}</span>
        <span className={cn('h-px flex-1', line)} />
      </div>
    );
  }
  return <div role="separator" className={cn('h-px w-full', line, className)} {...props} />;
}

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** line (text row) · block (card/media) · circle (avatar) */
  shape?: 'line' | 'block' | 'circle';
  /** Render N text lines (last one shorter). */
  lines?: number;
}

const SHIMMER =
  'bg-surface-active bg-linear-to-r from-transparent via-white/[0.06] to-transparent bg-[length:200%_100%] bg-no-repeat motion-safe:animate-shimmer';

/** Loading placeholder with a soft shimmer sweep (static under reduced motion). */
export function Skeleton({ shape = 'line', lines, className, style, ...props }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div className={cn('flex flex-col gap-2', className)} aria-hidden {...props}>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={cn(SHIMMER, 'h-3 chamfer-xs', i === lines - 1 ? 'w-3/5' : 'w-full')} />
        ))}
      </div>
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        SHIMMER,
        // Defaults only when the caller didn't size/round it (cn doesn't merge).
        !/(^|\s)(h|size)-/.test(className ?? '') && shape === 'line' && 'h-3',
        !/(^|\s)rounded/.test(className ?? '') &&
          (shape === 'circle' ? 'rounded-full' : shape === 'block' ? 'chamfer-md' : 'chamfer-xs'),
        className
      )}
      style={style}
      {...props}
    />
  );
}
