// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Button + IconButton (FORGED ARMOR kit)
// Chamfered plates with a bevel; hover heats the metal, press sinks it.
//   primary   molten ember plate, hot top edge — the one main action
//   secondary steel plate — most actions
//   ghost     bare — toolbars, inline actions
//   danger    blood-red plate — destructive actions
//   ember     same molten plate as primary (warrior moments)
// Sizes: sm 28px · md 32px · lg 40px.
// ═══════════════════════════════════════════════════════════

'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { renderIcon, type IconLike } from './icon';
import { Tooltip, type TooltipSide } from './Tooltip';
import { BEVEL_PRESSED, BEVEL_RAISED, EMBER_PLATE, FOCUS_EDGE, STEEL_PLATE, STEEL_PLATE_HOT } from './armor';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ember';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-display font-semibold uppercase tracking-[0.08em] ' +
  'chamfer transition-[background-color,color,box-shadow,filter,opacity,transform] duration-120 ease-out-quint active:translate-y-px ' +
  FOCUS_EDGE +
  ' disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45';

const VARIANT: Record<ButtonVariant, string> = {
  // Molten ember plate with a hot top edge; hover = hotter, press = sinks.
  primary: cn(EMBER_PLATE, 'hover:brightness-115 hover:saturate-125 active:brightness-95', BEVEL_PRESSED),
  // Steel plate; hover heats the metal, press sinks it.
  secondary: cn(STEEL_PLATE, STEEL_PLATE_HOT, BEVEL_RAISED, 'hover:text-ember-300', BEVEL_PRESSED),
  ghost: 'text-fg-muted hover:bg-white/[0.05] hover:text-ember-300 active:bg-white/[0.08]',
  danger: cn(
    'bg-linear-to-b from-[#4a1720] to-[#2a0c12] text-[#ff8a9c]',
    'shadow-[inset_0_1px_0_rgb(255_120_140/0.35),inset_0_-1px_0_rgb(0_0_0/0.6)]',
    'hover:from-[#6a1c29] hover:to-[#3a0f18] hover:text-white',
    BEVEL_PRESSED
  ),
  ember: cn(EMBER_PLATE, 'hover:brightness-115 hover:saturate-125 active:brightness-95', BEVEL_PRESSED),
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-7 gap-1.5 px-3 text-[11px] [--cut:5px]',
  md: 'h-8 gap-2 px-3.5 text-xs [--cut:6px]',
  lg: 'h-10 gap-2 px-5 text-ui [--cut:8px]',
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

export type IconButtonVariant = 'ghost' | 'secondary' | 'primary' | 'danger' | 'ghost-danger' | 'steel-danger';
export type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const ICON_VARIANT: Record<IconButtonVariant, string> = {
  ghost: 'text-fg-muted hover:bg-white/[0.06] hover:text-ember-300 active:bg-white/[0.09]',
  secondary: cn(STEEL_PLATE, STEEL_PLATE_HOT, BEVEL_RAISED, 'text-fg-muted hover:text-ember-300', BEVEL_PRESSED),
  primary: cn(EMBER_PLATE, 'hover:brightness-115 active:brightness-95', BEVEL_PRESSED),
  danger: cn(
    'bg-linear-to-b from-[#4a1720] to-[#2a0c12] text-[#ff8a9c] shadow-[inset_0_1px_0_rgb(255_120_140/0.35),inset_0_-1px_0_rgb(0_0_0/0.6)]',
    'hover:from-[#6a1c29] hover:to-[#3a0f18] hover:text-white'
  ),
  'ghost-danger': 'text-fg-muted hover:bg-linear-to-b hover:from-[#7a1f2e] hover:to-[#4a1119] hover:text-white active:brightness-90',
  // Steel plate that heats to danger red on hover (window Close).
  'steel-danger': cn(
    STEEL_PLATE,
    BEVEL_RAISED,
    'text-fg-muted hover:from-[#b3263b] hover:via-[#7d1827] hover:to-[#4a0e18] hover:text-white',
    BEVEL_PRESSED
  ),
};

// Icon plates are cut smaller than text buttons so the glyph stays centered.
const ICON_BOX: Record<IconButtonSize, string> = {
  xs: 'size-6 [--cut:4px]',
  sm: 'size-7 [--cut:5px]',
  md: 'size-8 [--cut:6px]',
  lg: 'size-10 [--cut:7px]',
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
        active
          ? 'bg-linear-to-b from-ember-500/25 to-ember-600/10 text-ember-300 shadow-[inset_0_-2px_0_var(--color-ember-400,#ff8a3d),inset_0_1px_0_rgb(255_255_255/0.08)]'
          : ICON_VARIANT[variant],
        'normal-case tracking-normal',
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
