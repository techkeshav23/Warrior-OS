// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Confirm Button
// Two-step destructive button: first click arms it, second
// click within 3 s confirms. Shared by Forge and Resume Builder.
// Idle it looks like a kit ghost / secondary / danger button;
// armed it turns solid danger so the second click is deliberate.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { renderIcon, type IconLike } from '@/components/ui';

type ConfirmSize = 'xs' | 'sm' | 'md';

interface ConfirmButtonProps {
  onConfirm: () => void;
  /** Accessible name (and tooltip) while idle. */
  label: string;
  /** Idle text. Omit for an icon-only button. */
  children?: ReactNode;
  /** Leading icon (the only glyph when there is no text). */
  icon?: IconLike;
  /** Content while armed. */
  armedChildren?: ReactNode;
  /** xs 24 · sm 28 · md 32 */
  size?: ConfirmSize;
  /** Idle look; armed is always solid danger. */
  variant?: 'ghost' | 'secondary' | 'danger';
  fullWidth?: boolean;
  /** Layout-only classes (margins, reveal-on-hover). */
  className?: string;
}

const BASE =
  'focus-ring inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-control font-medium ' +
  'transition-[background-color,border-color,color,filter] duration-120 ease-out-quint';

const IDLE = {
  ghost: 'text-fg-subtle hover:bg-danger/12 hover:text-danger active:bg-danger/20',
  secondary:
    'border border-line-strong bg-surface-2 text-fg-muted hover:border-danger/40 hover:bg-danger/8 hover:text-danger active:bg-danger/15',
  danger: 'border border-danger/30 bg-danger/10 text-danger hover:border-danger/50 hover:bg-danger/18 active:bg-danger/25',
} as const;

const ARMED = 'border border-transparent bg-danger font-semibold text-ink-950 hover:brightness-110 active:brightness-95';

const HEIGHT: Record<ConfirmSize, string> = { xs: 'h-6', sm: 'h-7', md: 'h-8' };
const SQUARE: Record<ConfirmSize, string> = { xs: 'size-6', sm: 'size-7', md: 'size-8' };
const TEXT: Record<ConfirmSize, string> = { xs: 'px-2 text-xs', sm: 'px-2.5 text-xs', md: 'px-3 text-ui' };
const GLYPH: Record<ConfirmSize, number> = { xs: 14, sm: 14, md: 16 };

export function ConfirmButton({
  onConfirm,
  label,
  children,
  icon,
  armedChildren = 'Confirm?',
  size = 'sm',
  variant = 'ghost',
  fullWidth = false,
  className,
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    []
  );

  const handleClick = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (armed) {
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setArmed(false);
    }, 3000);
  };

  const iconOnly = children == null;
  const glyph = GLYPH[size];

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={armed ? `Confirm: ${label}` : label}
      title={armed ? 'Click again to confirm' : label}
      className={cn(
        BASE,
        HEIGHT[size],
        armed ? ARMED : IDLE[variant],
        iconOnly && !armed ? SQUARE[size] : TEXT[size],
        fullWidth && 'w-full',
        className
      )}
    >
      {armed ? (
        <>
          {!iconOnly && renderIcon(icon, glyph, 'shrink-0')}
          <span className="truncate">{armedChildren}</span>
        </>
      ) : (
        <>
          {renderIcon(icon, glyph, 'shrink-0')}
          {!iconOnly && <span className="truncate">{children}</span>}
        </>
      )}
    </button>
  );
}
