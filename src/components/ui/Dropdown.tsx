// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dropdown (legacy API)
// Thin wrapper over the kit's <Menu>: wraps `trigger` in a quiet button
// with a chevron, like before. New code should use Menu directly.
// ═══════════════════════════════════════════════════════════

'use client';

import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Menu, type MenuItem } from './Menu';

interface DropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  divider?: boolean;
}

interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  onSelect: (id: string) => void;
  align?: 'left' | 'right';
  className?: string;
}

/** @deprecated Use `<Menu trigger={…} items={…} />`. */
export function Dropdown({ trigger, items, onSelect, align = 'left', className }: DropdownProps) {
  const menuItems: MenuItem[] = items.map((it) => ({ ...it }));
  return (
    <Menu
      align={align === 'right' ? 'end' : 'start'}
      items={menuItems}
      onSelect={onSelect}
      trigger={
        <button
          type="button"
          className={cn(
            'focus-ring-inset chamfer-xs inline-flex items-center gap-1.5 px-1.5 py-1 text-ui text-fg-muted transition-colors duration-120 hover:bg-surface-hover hover:text-fg',
            className
          )}
        >
          {trigger}
          <ChevronDown size={14} strokeWidth={1.75} aria-hidden className="text-fg-subtle" />
        </button>
      }
    />
  );
}
