// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Button + IconButton (FORGE HUD kit)
//   primary   accent fill — the one main action on a surface
//   secondary quiet hairline button — most actions
//   ghost     text-only — toolbars, inline actions
//   danger    tinted red — destructive actions
//   ember     forge-fire gradient — warrior moments (streaks, XP, "Forge it")
// Sizes: sm 28px · md 32px · lg 40px.
// ═══════════════════════════════════════════════════════════

'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { renderIcon, type IconLike } from './icon';
import { Tooltip, type TooltipSide } from './Tooltip';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ember';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium ' +
  'rounded-control transition-[background-color,border-color,color,box-shadow,filter,opacity] duration-120 ease-out-quint ' +
  'focus-ring disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45';

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-fg inset-shadow-[0_1px_0_rgb(255_255_255/0.28)] ' +
    'hover:brightness-110 hover:shadow-glow active:brightness-95',
  secondary:
    'border border-line-strong bg-surface-2 text-fg inset-shadow-[0_1px_0_rgb(255_255_255/0.04)] ' +
    'hover:border-fg-faint hover:bg-surface-hover active:bg-surface-active',
  ghost: 'text-fg-muted hover:bg-surface-hover hover:text-fg active:bg-surface-active',
  danger:
    'border border-danger/30 bg-danger/10 text-danger hover:border-danger/50 hover:bg-danger/18 active:bg-danger/25',
  ember:
    'bg-linear-to-b from-ember-400 to-ember-500 text-ink-950 inset-shadow-[0_1px_0_rgb(255_255_255/0.3)] ' +
    'hover:brightness-110 hover:shadow-[0_0_24px_-4px_var(--color-ember-500,#f76b15)] active:brightness-95',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-7 gap-1.5 px-2.5 text-xs',
  md: 'h-8 gap-2 px-3 text-ui',
  lg: 'h-10 gap-2 px-4 text-sm',
};

const ICON_SIZE: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18 };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon before the label (lucide component or element). */
  leadingIcon?: IconLike;
  /** Icon after the label. */
  trailingIcon?: IconLike;
  /** Shows a spinner in place of the leading icon and blocks clicks. */
  loading?: boolean;
  /** Stretch to the container width. */
  fullWidth?: boolean;
  children?: ReactNode;
}

/** The kit's text button. `type` defaults to "button". */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    leadingIcon,
    trailingIcon,
    loading = false,
    fullWidth = false,
    disabled,
    type = 'button',
    className,
    children,
    ...props
  },
  ref
) {
  const iconSize = ICON_SIZE[size];
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(BASE, VARIANT[variant], SIZE[size], fullWidth && 'w-full', className)}
      {...props}
    >
      {loading ? (
        <LoaderCircle size={iconSize} strokeWidth={2} className="animate-spin" aria-hidden />
      ) : (
        renderIcon(leadingIcon, iconSize, 'shrink-0')
      )}
      {children != null && <span className="truncate">{children}</span>}
      {renderIcon(trailingIcon, iconSize, 'shrink-0 opacity-80')}
    </button>
  );
});

// ─── IconButton ───────────────────────────────────────────

export type IconButtonVariant = 'ghost' | 'secondary' | 'primary' | 'danger' | 'ghost-danger';
export type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const ICON_VARIANT: Record<IconButtonVariant, string> = {
  ghost: 'text-fg-muted hover:bg-surface-hover hover:text-fg active:bg-surface-active',
  secondary:
    'border border-line-strong bg-surface-2 text-fg-muted hover:border-fg-faint hover:bg-surface-hover hover:text-fg active:bg-surface-active',
  primary: 'bg-accent text-accent-fg hover:brightness-110 active:brightness-95',
  danger: 'border border-danger/30 bg-danger/10 text-danger hover:bg-danger/18',
  'ghost-danger': 'text-fg-muted hover:bg-danger/15 hover:text-danger active:bg-danger/25',
};

const ICON_BOX: Record<IconButtonSize, string> = {
  xs: 'size-6 rounded-[6px]',
  sm: 'size-7 rounded-control',
  md: 'size-8 rounded-control',
  lg: 'size-10 rounded-control',
};

const ICON_GLYPH: Record<IconButtonSize, number> = { xs: 14, sm: 16, md: 16, lg: 18 };

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** The glyph (lucide component or element). */
  icon: IconLike;
  /** Required: icon-only buttons need an accessible name. */
  'aria-label': string;
  variant?: IconButtonVariant;
  /** xs 24 · sm 28 · md 32 · lg 40 */
  size?: IconButtonSize;
  /** Pressed/selected look (accent-soft) for toggles. Sets aria-pressed. */
  active?: boolean;
  loading?: boolean;
  /** Show a tooltip: `true` reuses the aria-label, or pass custom content. */
  tooltip?: ReactNode | true;
  tooltipSide?: TooltipSide;
  /** Keyboard shortcut shown in the tooltip. */
  shortcut?: string;
  /** Override the glyph size in px. */
  iconSize?: number;
}

/** Square icon-only button with a required aria-label and optional tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon,
    variant = 'ghost',
    size = 'md',
    active,
    loading = false,
    tooltip,
    tooltipSide = 'top',
    shortcut,
    iconSize,
    disabled,
    type = 'button',
    className,
    ...props
  },
  ref
) {
  const glyph = iconSize ?? ICON_GLYPH[size];
  const button = (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-pressed={active}
      aria-busy={loading || undefined}
      className={cn(
        BASE,
        ICON_BOX[size],
        active ? 'bg-accent/15 text-accent hover:bg-accent/20' : ICON_VARIANT[variant],
        className
      )}
      {...props}
    >
      {loading ? (
        <LoaderCircle size={glyph} strokeWidth={2} className="animate-spin" aria-hidden />
      ) : (
        renderIcon(icon, glyph)
      )}
    </button>
  );

  if (!tooltip) return button;
  return (
    <Tooltip content={tooltip === true ? props['aria-label'] : tooltip} side={tooltipSide} shortcut={shortcut}>
      {button}
    </Tooltip>
  );
});
