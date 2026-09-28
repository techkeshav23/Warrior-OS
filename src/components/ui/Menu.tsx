// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Menu (FORGE HUD kit)
// Popover action menu anchored to a trigger. Portal + fixed positioning
// (never clipped by windows), flips above when there's no room below.
// Keyboard: ↑/↓/Home/End move, Enter/Space select, Esc/Tab close, focus
// returns to the trigger.
//   <Menu trigger={<IconButton icon={MoreHorizontal} aria-label="More" />}
//     items={[{ id: 'rename', label: 'Rename', icon: Pencil, shortcut: 'F2' },
//             { id: 'sep', divider: true },
//             { id: 'delete', label: 'Delete', icon: Trash2, danger: true }]}
//     onSelect={(id) => …} />
// ═══════════════════════════════════════════════════════════

'use client';

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { renderIcon, type IconLike } from './icon';

export interface MenuItem {
  id: string;
  label?: ReactNode;
  icon?: IconLike;
  /** Right-aligned hint, e.g. "Ctrl D". */
  shortcut?: string;
  description?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  /** Renders a hairline separator instead of an item. */
  divider?: boolean;
  /** Renders a hud-label group heading instead of an item. */
  heading?: boolean;
  /** Shows a check (for toggle / radio-like items). */
  checked?: boolean;
  onSelect?: () => void;
}

export interface MenuProps {
  /** The trigger element (a Button/IconButton). It gets onClick + aria props. */
  trigger: ReactElement;
  items: MenuItem[];
  onSelect?: (id: string) => void;
  align?: 'start' | 'end';
  /** Preferred side; flips when there is no room. */
  side?: 'bottom' | 'top';
  /** Min width in px (default 200). */
  width?: number;
  className?: string;
  'aria-label'?: string;
}

interface Pos {
  top: number;
  left: number;
  minWidth: number;
  origin: 'top' | 'bottom';
  alignEnd: boolean;
}

/** Anchored action menu. */
export function Menu({
  trigger,
  items,
  onSelect,
  align = 'start',
  side = 'bottom',
  width = 200,
  className,
  ...aria
}: MenuProps) {
  const [pos, setPos] = useState<Pos | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Wraps the trigger: events bubble here, so the trigger element is cloned
  // with aria props only (its own ref and handlers stay untouched).
  const triggerRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const open = pos !== null;

  const selectable = items.map((it, i) => (!it.divider && !it.heading && !it.disabled ? i : -1)).filter((i) => i >= 0);

  const close = useCallback((returnFocus = true) => {
    setPos(null);
    setActiveIndex(-1);
    if (returnFocus) (triggerRef.current?.firstElementChild as HTMLElement | null)?.focus();
  }, []);

  const openMenu = (focusFirst: boolean) => {
    const el = (triggerRef.current?.firstElementChild as HTMLElement | null) ?? triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const estHeight = Math.min(items.length * 34 + 12, 420);
    const below = window.innerHeight - r.bottom;
    const flip = side === 'bottom' ? below < estHeight + 12 && r.top > below : r.top > estHeight + 12 ? false : true;
    const placeTop = side === 'top' ? !flip : flip;
    const alignEnd = align === 'end';
    setPos({
      top: placeTop ? r.top - 6 : r.bottom + 6,
      left: alignEnd ? r.right : r.left,
      minWidth: Math.max(width, r.width),
      origin: placeTop ? 'bottom' : 'top',
      alignEnd,
    });
    setActiveIndex(focusFirst ? (selectable[0] ?? -1) : -1);
  };

  // Outside click / resize / scroll close the menu.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      close(false);
    };
    const onViewport = () => close(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onViewport);
    window.addEventListener('scroll', onViewport, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', onViewport);
      window.removeEventListener('scroll', onViewport, true);
    };
  }, [open, close]);

  // Keep DOM focus on the active item.
  useEffect(() => {
    if (!open) return;
    const el = activeIndex >= 0 ? menuRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`) : null;
    (el ?? menuRef.current)?.focus();
  }, [open, activeIndex]);

  const choose = (item: MenuItem) => {
    if (item.disabled || item.divider || item.heading) return;
    close();
    item.onSelect?.();
    onSelect?.(item.id);
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!selectable.length) return;
    const at = selectable.indexOf(activeIndex);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(selectable[(at + 1) % selectable.length]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(selectable[(at - 1 + selectable.length) % selectable.length]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(selectable[0]);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(selectable[selectable.length - 1]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      close(false);
    } else if ((e.key === 'Enter' || e.key === ' ') && activeIndex >= 0) {
      e.preventDefault();
      choose(items[activeIndex]);
    }
  };

  const triggerEl = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<Record<string, unknown>>, {
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? menuId : undefined,
      })
    : trigger;

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex"
        onClick={(e: ReactMouseEvent<HTMLSpanElement>) => {
          if (e.defaultPrevented) return;
          if (open) close(false);
          else openMenu(e.detail === 0);
        }}
        onKeyDown={(e: KeyboardEvent<HTMLSpanElement>) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            openMenu(true);
          }
        }}
      >
        {triggerEl}
      </span>
      {open &&
        pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            tabIndex={-1}
            aria-label={aria['aria-label']}
            onKeyDown={onMenuKey}
            className={cn(
              'glass-popover fixed z-[9980] max-h-[420px] overflow-y-auto rounded-card p-1 outline-none scrollbar-thin',
              'motion-safe:animate-scale-in',
              className
            )}
            style={{
              top: pos.top,
              left: pos.left,
              minWidth: pos.minWidth,
              translate: `${pos.alignEnd ? '-100%' : '0'} ${pos.origin === 'bottom' ? '-100%' : '0'}`,
              transformOrigin: `${pos.alignEnd ? 'right' : 'left'} ${pos.origin}`,
            }}
          >
            {items.map((item, i) => {
              if (item.divider) return <div key={item.id} role="separator" className="-mx-1 my-1 h-px bg-line" />;
              if (item.heading)
                return (
                  <div key={item.id} className="hud-label px-2.5 pb-1 pt-2">
                    {item.label}
                  </div>
                );
              const active = i === activeIndex;
              return (
                <div
                  key={item.id}
                  role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                  aria-checked={item.checked === undefined ? undefined : item.checked}
                  aria-disabled={item.disabled || undefined}
                  tabIndex={-1}
                  data-index={i}
                  onMouseEnter={() => !item.disabled && setActiveIndex(i)}
                  onClick={() => choose(item)}
                  className={cn(
                    'flex min-h-8 cursor-pointer select-none items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-ui outline-none',
                    item.disabled && 'cursor-not-allowed opacity-40',
                    item.danger ? 'text-danger' : 'text-fg',
                    active && (item.danger ? 'bg-danger/12' : 'bg-surface-active')
                  )}
                >
                  {item.icon != null && (
                    <span className={cn('flex shrink-0', item.danger ? 'text-danger' : active ? 'text-fg' : 'text-fg-subtle')}>
                      {renderIcon(item.icon, 16)}
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{item.label}</span>
                    {item.description != null && <span className="truncate text-xs text-fg-subtle">{item.description}</span>}
                  </span>
                  {item.checked && <Check size={14} strokeWidth={2} className="shrink-0 text-accent" aria-hidden />}
                  {item.shortcut && <span className="shrink-0 font-mono text-2xs text-fg-subtle">{item.shortcut}</span>}
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
