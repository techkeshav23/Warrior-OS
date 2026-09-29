// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Tooltip (FORGED ARMOR kit)
// Small popover label shown on hover and keyboard focus. Rendered in a
// portal with fixed positioning, so window bodies (overflow: hidden)
// never clip it. Optional keyboard shortcut renders as <Kbd>.
//   <Tooltip content="New note" shortcut="Ctrl N"><IconButton … /></Tooltip>
// ═══════════════════════════════════════════════════════════

'use client';

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  children: ReactNode;
  /** Tooltip text (or rich content). */
  content: ReactNode;
  side?: TooltipSide;
  /** Hover delay in ms before showing. */
  delay?: number;
  /** Keyboard shortcut shown on the right, e.g. "Ctrl K". */
  shortcut?: string;
  /** Suppress the tooltip (renders children only). */
  disabled?: boolean;
  className?: string;
  /** Class for the inline wrapper around the trigger. */
  wrapperClassName?: string;
}

interface Coords {
  x: number;
  y: number;
}

const GAP = 8;

// Individual `translate` (not `transform`) so the entry keyframes' scale composes with it.
const TRANSLATE: Record<TooltipSide, string> = {
  top: '-50% -100%',
  bottom: '-50% 0',
  left: '-100% -50%',
  right: '0 -50%',
};

function coordsFor(el: HTMLElement, side: TooltipSide): Coords {
  const r = el.getBoundingClientRect();
  switch (side) {
    case 'bottom':
      return { x: r.left + r.width / 2, y: r.bottom + GAP };
    case 'left':
      return { x: r.left - GAP, y: r.top + r.height / 2 };
    case 'right':
      return { x: r.right + GAP, y: r.top + r.height / 2 };
    default:
      return { x: r.left + r.width / 2, y: r.top - GAP };
  }
}

/** Hover/focus tooltip. Keeps the old `content: string` API working. */
export function Tooltip({
  children,
  content,
  side = 'top',
  delay = 350,
  shortcut,
  disabled = false,
  className,
  wrapperClassName,
}: TooltipProps) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId();

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Hide on scroll/resize: fixed coordinates would drift from the trigger.
  useEffect(() => {
    if (!coords) return;
    const hide = () => setCoords(null);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [coords]);

  if (disabled || content == null || content === '') return <>{children}</>;

  const show = (immediate: boolean) => {
    clearTimeout(timerRef.current);
    const open = () => {
      const el = wrapRef.current?.firstElementChild ?? wrapRef.current;
      if (el instanceof HTMLElement) setCoords(coordsFor(el, side));
    };
    if (immediate) open();
    else timerRef.current = setTimeout(open, delay);
  };

  const hide = () => {
    clearTimeout(timerRef.current);
    setCoords(null);
  };

  const trigger =
    isValidElement(children) && coords
      ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, { 'aria-describedby': id })
      : children;

  return (
    <span
      ref={wrapRef}
      className={cn('inline-flex', wrapperClassName)}
      onMouseEnter={() => show(false)}
      onMouseLeave={hide}
      onFocus={(e) => {
        if ((e.target as HTMLElement).matches?.(':focus-visible')) show(true);
      }}
      onBlur={hide}
      onMouseDown={hide}
      onKeyDown={(e) => {
        if (e.key === 'Escape') hide();
      }}
    >
      {trigger}
      {coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            className={cn(
              'pointer-events-none fixed z-[9990] flex max-w-72 items-center gap-2',
              'armor-popover chamfer [--cut:5px] px-2 py-1 shadow-[inset_0_-1px_0_var(--color-ember-500,#f76b15)]',
              'text-xs font-medium text-fg',
              'motion-safe:animate-scale-in',
              className
            )}
            style={{ left: coords.x, top: coords.y, translate: TRANSLATE[side] }}
          >
            <span className="min-w-0">{content}</span>
            {shortcut && (
              <kbd className="chamfer [--cut:3px] bg-linear-to-b from-[#303843] to-[#171b21] px-1 font-mono text-2xs text-fg-muted shadow-[inset_0_1px_0_rgb(255_255_255/0.14),inset_0_-1px_0_rgb(0_0_0/0.6)]">
                {shortcut}
              </kbd>
            )}
          </div>,
          document.body
        )}
    </span>
  );
}
