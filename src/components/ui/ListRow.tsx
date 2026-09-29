// ═══════════════════════════════════════════════════════════
// WARRIOR OS — ListRow (FORGED ARMOR kit)
// 40px list/table row: leading slot, title + description, meta, trailing
// actions. Hover = surface-hover; selected = accent-soft + 2px indicator.
// Put rows in a container with `divide-y divide-line` for hairlines.
//   <ListRow leading={<AppIcon appId="notes" size={28} />} title="Graph theory"
//            description="Edited 2h ago" meta="12 cards" onClick={open} />
// ═══════════════════════════════════════════════════════════

'use client';

import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { renderIcon, type IconLike } from './icon';

export interface ListRowProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'onClick'> {
  /** Icon (lucide) or any node: Avatar, AppIcon, checkbox… */
  leading?: IconLike;
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned secondary text (tabular). */
  meta?: ReactNode;
  /** Right-most actions (buttons are safe here). */
  trailing?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  /** compact 32px · default 40px · comfortable 52px (two-line) */
  density?: 'compact' | 'default' | 'comfortable';
  onClick?: () => void;
  /** Hover-only trailing actions. */
  revealTrailing?: boolean;
}

const HEIGHT = { compact: 'min-h-8 py-1', default: 'min-h-10 py-1.5', comfortable: 'min-h-13 py-2' } as const;

/** Interactive or static list row. */
export function ListRow({
  leading,
  title,
  description,
  meta,
  trailing,
  selected = false,
  disabled = false,
  density = 'default',
  onClick,
  revealTrailing = false,
  className,
  ...props
}: ListRowProps) {
  const interactive = !!onClick && !disabled;
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive && selected ? true : undefined}
      aria-disabled={disabled || undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={onKeyDown}
      className={cn(
        'group/row relative flex w-full min-w-0 items-center gap-3 chamfer [--cut:5px] px-3 text-left',
        'transition-colors duration-120 ease-out-quint',
        HEIGHT[density],
        interactive && 'focus-ring-inset cursor-pointer',
        selected
          ? 'bg-linear-to-r from-ember-500/18 via-white/[0.03] to-transparent shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]'
          : interactive && 'hover:bg-linear-to-r hover:from-white/[0.06] hover:to-white/[0.02] active:bg-white/[0.08]',
        disabled && 'opacity-45',
        className
      )}
      {...props}
    >
      {selected && <span aria-hidden className="absolute inset-y-1.5 left-0 w-1 bg-ember-400 shadow-[0_0_8px_var(--color-ember-500,#f76b15)] [clip-path:polygon(0_0,100%_3px,100%_calc(100%-3px),0_100%)]" />}
      {leading != null && (
        <span className={cn('flex shrink-0 items-center', selected ? 'text-ember-400' : 'text-fg-subtle')}>{renderIcon(leading, 16)}</span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('truncate text-ui', selected ? 'font-medium text-fg' : 'text-fg')}>{title}</span>
        {description != null && <span className="truncate text-xs text-fg-subtle">{description}</span>}
      </span>
      {meta != null && <span className="tabular shrink-0 font-mono text-xs text-fg-subtle">{meta}</span>}
      {trailing != null && (
        <span
          className={cn(
            'flex shrink-0 items-center gap-1',
            revealTrailing && 'opacity-0 transition-opacity duration-120 group-hover/row:opacity-100 group-focus-within/row:opacity-100'
          )}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {trailing}
        </span>
      )}
    </div>
  );
}
