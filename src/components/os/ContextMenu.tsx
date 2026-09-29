// ═══════════════════════════════════════════════════════════
// WARRIOR OS — ContextMenu Component
// Right-click menu opened at a point (for anchored menus use the kit
// <Menu>). Same look as the kit menu: glass popover, 32px rows, lucide
// icon slot, right-aligned shortcut, hairline dividers, danger and
// disabled rows. Portalled so no window or layer clips it; flips to
// stay on screen. Keyboard: ↑/↓/Home/End, Enter/Space, Esc, Tab.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { EASE_OUT_QUINT } from '@/styles/tokens';
import { cn } from '@/lib/utils';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number } | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const MENU_MIN_WIDTH = 200;
const ITEM_H = 32;
const DIVIDER_H = 9;
const MARGIN = 8;

export function ContextMenu({ items, position, onSelect, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() ?? false;

  useEffect(() => {
    if (!position) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [position, onClose]);

  // Focus the menu on open so the arrow keys work straight away.
  const open = position !== null;
  useEffect(() => {
    if (open) menuRef.current?.focus({ preventScroll: true });
  }, [open]);

  // Keep the menu on screen: flip left / up at the edges.
  const estHeight =
    8 + items.reduce((sum, item) => sum + (item.divider ? DIVIDER_H : ITEM_H), 0);
  const placement =
    position && typeof window !== 'undefined'
      ? (() => {
          const flipX = position.x + MENU_MIN_WIDTH + MARGIN > window.innerWidth;
          const flipY = position.y + estHeight + MARGIN > window.innerHeight;
          return {
            x: Math.max(MARGIN, flipX ? position.x - MENU_MIN_WIDTH : position.x),
            y: Math.max(MARGIN, flipY ? position.y - estHeight : position.y),
            origin: `${flipX ? 'right' : 'left'} ${flipY ? 'bottom' : 'top'}`,
          };
        })()
      : null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const rows = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
    );
    if (!rows.length) return;
    const at = rows.indexOf(document.activeElement as HTMLButtonElement);
    let next: HTMLButtonElement | undefined;
    if (e.key === 'ArrowDown') next = rows[(at + 1) % rows.length];
    else if (e.key === 'ArrowUp') next = rows[at <= 0 ? rows.length - 1 : at - 1];
    else if (e.key === 'Home') next = rows[0];
    else if (e.key === 'End') next = rows[rows.length - 1];
    else if (e.key === 'Tab') {
      onClose();
      return;
    }
    if (!next) return;
    e.preventDefault();
    next.focus();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {placement && (
        <motion.div
          ref={menuRef}
          role="menu"
          tabIndex={-1}
          onKeyDown={onKeyDown}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.18, ease: EASE_OUT_QUINT }}
          className="armor-popover chamfer-md fixed p-1 outline-none"
          style={{
            left: placement.x,
            top: placement.y,
            minWidth: MENU_MIN_WIDTH,
            zIndex: 'var(--z-context-menu)',
            transformOrigin: placement.origin,
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {items.map((item) =>
            item.divider ? (
              <div key={item.id} role="separator" className="-mx-1 my-1 h-px bg-line" />
            ) : (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                aria-disabled={item.disabled || undefined}
                onClick={() => {
                  if (!item.disabled) {
                    onSelect(item.id);
                    onClose();
                  }
                }}
                className={cn(
                  'group/item flex h-8 w-full select-none items-center gap-2.5 rounded-[6px] px-2.5 text-left text-ui',
                  'outline-none transition-colors duration-120 ease-out-quint',
                  item.disabled
                    ? 'cursor-not-allowed text-fg opacity-40'
                    : item.danger
                      ? 'text-danger hover:bg-danger/12 focus-visible:bg-danger/12'
                      : 'text-fg hover:bg-surface-active focus-visible:bg-surface-active'
                )}
              >
                {item.icon != null && (
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center transition-colors duration-120',
                      item.danger
                        ? 'text-danger'
                        : 'text-fg-subtle group-hover/item:text-fg group-focus-visible/item:text-fg'
                    )}
                  >
                    {item.icon}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.shortcut && (
                  <span className="ml-4 shrink-0 font-mono text-2xs text-fg-subtle">{item.shortcut}</span>
                )}
              </button>
            )
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
