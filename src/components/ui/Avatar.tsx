// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Avatar (FORGE HUD kit)
// Photo or initials on an ink tile, optional status dot and accent ring.
//   <Avatar name="Keshav Upadhyay" size="md" status="online" />
// ═══════════════════════════════════════════════════════════

'use client';

import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const BOX: Record<AvatarSize, string> = {
  xs: 'size-5 text-[9px]',
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
  xl: 'size-14 text-lg',
};

const DOT: Record<AvatarSize, string> = {
  xs: 'size-1.5',
  sm: 'size-2',
  md: 'size-2.5',
  lg: 'size-3',
  xl: 'size-3.5',
};

const STATUS = {
  online: 'bg-success',
  away: 'bg-warning',
  busy: 'bg-danger',
  offline: 'bg-fg-faint',
} as const;

/** Up to two initials from a display name ("Keshav Upadhyay" → "KU"). */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  name?: string;
  src?: string;
  size?: AvatarSize;
  shape?: 'circle' | 'square';
  status?: keyof typeof STATUS;
  /** Accent ring (current user / selected). */
  ring?: boolean;
}

export function Avatar({ name = '', src, size = 'md', shape = 'circle', status, ring = false, className, ...props }: AvatarProps) {
  const radius = shape === 'circle' ? 'rounded-full' : 'chamfer [--cut:22%]';
  return (
    <span className={cn('relative inline-flex shrink-0', className)} {...props}>
      <span
        role="img"
        aria-label={name || 'Avatar'}
        className={cn(
          'flex items-center justify-center overflow-hidden border border-line-strong bg-linear-to-b from-ink-600 to-ink-800 font-semibold tracking-wide text-fg',
          'inset-shadow-[0_1px_0_rgb(255_255_255/0.08)]',
          radius,
          BOX[size],
          ring && 'ring-2 ring-accent/60 ring-offset-2 ring-offset-ink-900'
        )}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatars are arbitrary user URLs
          <img src={src} alt="" className="size-full object-cover" />
        ) : (
          <span aria-hidden>{getInitials(name)}</span>
        )}
      </span>
      {status && (
        <span
          aria-label={status}
          className={cn('absolute -bottom-px -right-px rounded-full ring-2 ring-ink-900', DOT[size], STATUS[status])}
        />
      )}
    </span>
  );
}
