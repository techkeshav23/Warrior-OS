// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Toolbar (FORGED ARMOR kit)
// 40px action bar with hairline edge. Group controls, separate groups
// with <ToolbarSeparator/>, push the rest right with <ToolbarSpacer/>.
//   <Toolbar aria-label="Editor">
//     <IconButton icon={Bold} aria-label="Bold" size="sm" /> <ToolbarSeparator />
//     <ToolbarSpacer /> <Button size="sm" variant="primary">Save</Button>
//   </Toolbar>
// ═══════════════════════════════════════════════════════════

'use client';

import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  /** Which edge gets the hairline. */
  border?: 'bottom' | 'top' | 'none';
  /** 'dense' = 36px */
  density?: 'default' | 'dense';
}

export function Toolbar({ border = 'bottom', density = 'default', className, children, ...props }: ToolbarProps) {
  return (
    <div
      role="toolbar"
      className={cn(
        'flex shrink-0 items-center gap-1 px-3',
        density === 'dense' ? 'h-9' : 'h-10',
        border === 'bottom' && 'shadow-[inset_0_-1px_0_rgb(0_0_0/0.6),inset_0_-2px_0_rgb(255_255_255/0.04)]',
        border === 'top' && 'shadow-[inset_0_1px_0_rgb(0_0_0/0.6),inset_0_2px_0_rgb(255_255_255/0.04)]',
        'bg-linear-to-b from-white/[0.025] to-transparent',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function ToolbarGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-0.5', className)} {...props} />;
}

export function ToolbarSeparator({ className }: { className?: string }) {
  return <div role="separator" aria-orientation="vertical" className={cn('mx-1.5 h-5 w-px bg-black/60 shadow-[1px_0_0_rgb(255_255_255/0.07)]', className)} />;
}

export function ToolbarSpacer() {
  return <div className="flex-1" aria-hidden />;
}
