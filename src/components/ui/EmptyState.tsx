// ═══════════════════════════════════════════════════════════
// WARRIOR OS — EmptyState (FORGE HUD kit)
// The designed "nothing here / error / loading" block every screen uses:
// lucide icon in a HUD tile, title, one line of body, actions, over a
// faint grid that fades out at the edges.
//   <EmptyState icon={NotebookPen} title="No notes yet"
//     description="Capture your first idea — it saves as you type."
//     actions={<Button variant="primary" leadingIcon={Plus}>New note</Button>} />
// ═══════════════════════════════════════════════════════════

'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { renderIcon, type IconLike } from './icon';

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: IconLike;
  title: ReactNode;
  /** One line of body copy. */
  description?: ReactNode;
  actions?: ReactNode;
  tone?: 'neutral' | 'accent' | 'ember' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  /** Grid backdrop (default on). */
  grid?: boolean;
}

const TILE_TONE = {
  neutral: 'text-fg-muted border-line-strong',
  accent: 'text-accent border-accent/30 shadow-[0_0_24px_-6px_var(--accent,#2fd6f5)]',
  ember: 'text-ember-400 border-ember-500/35 shadow-[0_0_24px_-6px_var(--color-ember-500,#f76b15)]',
  danger: 'text-danger border-danger/35 shadow-[0_0_24px_-8px_var(--color-danger,#ff5470)]',
} as const;

const GRID_STYLE = {
  backgroundImage:
    'linear-gradient(to right, var(--color-line, rgba(148,170,205,.10)) 1px, transparent 1px), linear-gradient(to bottom, var(--color-line, rgba(148,170,205,.10)) 1px, transparent 1px)',
  backgroundSize: '24px 24px',
  backgroundPosition: 'center center',
  maskImage: 'radial-gradient(ellipse 60% 70% at 50% 45%, #000 20%, transparent 75%)',
  WebkitMaskImage: 'radial-gradient(ellipse 60% 70% at 50% 45%, #000 20%, transparent 75%)',
} as const;

/** Designed empty / error / zero-data state. */
export function EmptyState({
  icon = Inbox,
  title,
  description,
  actions,
  tone = 'neutral',
  size = 'md',
  grid = true,
  className,
  ...props
}: EmptyStateProps) {
  const tile = size === 'sm' ? 'size-10' : size === 'lg' ? 'size-14' : 'size-12';
  return (
    <div
      className={cn(
        'relative isolate flex w-full flex-col items-center justify-center text-center',
        size === 'sm' ? 'gap-2 px-4 py-6' : size === 'lg' ? 'gap-3 px-8 py-16' : 'gap-3 px-6 py-10',
        className
      )}
      {...props}
    >
      {grid && <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-80" style={GRID_STYLE} />}
      <div
        className={cn(
          'flex items-center justify-center rounded-card border bg-linear-to-b from-ink-750 to-ink-850 inset-shadow-[0_1px_0_rgb(255_255_255/0.06)]',
          tile,
          TILE_TONE[tone]
        )}
      >
        {renderIcon(icon, size === 'sm' ? 18 : size === 'lg' ? 26 : 22)}
      </div>
      <div className={cn('flex max-w-sm flex-col', size === 'sm' ? 'gap-0.5' : 'gap-1')}>
        <h3 className={cn('font-semibold text-fg', size === 'lg' ? 'text-base' : 'text-sm')}>{title}</h3>
        {description != null && <p className="text-ui text-fg-muted">{description}</p>}
      </div>
      {actions != null && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}
