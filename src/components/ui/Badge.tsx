// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Badge, Chip, Kbd (FORGE HUD kit)
// Badge = static status label (mono caps, HUD style). Chip = sentence-case
// tag that can be selected / removed / clicked. Kbd = keyboard key.
//   <Badge tone="success" dot>Online</Badge>   <Badge tone="ember">+25 XP</Badge>
//   <Chip selected onClick={…}>Algorithms</Chip>   <Kbd keys={['Ctrl', 'K']} />
//   <Chip onRemove={…} removeLabel="Remove tag Algorithms">Algorithms</Chip>
// ═══════════════════════════════════════════════════════════

'use client';

import { Fragment, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { renderIcon, type IconLike } from './icon';

export type Tone = 'neutral' | 'accent' | 'ember' | 'success' | 'warning' | 'danger' | 'info' | 'gold';

/** Full static class strings per tone (Tailwind needs literal names). */
export const TONE_SOFT: Record<Tone, string> = {
  neutral: 'bg-surface-active text-fg-muted ring-line-strong',
  accent: 'bg-accent/12 text-accent ring-accent/25',
  ember: 'bg-ember-500/12 text-ember-400 ring-ember-500/30',
  success: 'bg-success/12 text-success ring-success/25',
  warning: 'bg-warning/12 text-warning ring-warning/25',
  danger: 'bg-danger/12 text-danger ring-danger/25',
  info: 'bg-info/12 text-info ring-info/25',
  gold: 'bg-gold/12 text-gold ring-gold/25',
};

export const TONE_SOLID: Record<Tone, string> = {
  neutral: 'bg-fg-muted text-ink-950 ring-transparent',
  accent: 'bg-accent text-accent-fg ring-transparent',
  ember: 'bg-ember-500 text-ink-950 ring-transparent',
  success: 'bg-success text-ink-950 ring-transparent',
  warning: 'bg-warning text-ink-950 ring-transparent',
  danger: 'bg-danger text-ink-950 ring-transparent',
  info: 'bg-info text-ink-950 ring-transparent',
  gold: 'bg-gold text-ink-950 ring-transparent',
};

export const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-fg-subtle',
  accent: 'bg-accent',
  ember: 'bg-ember-400',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  gold: 'bg-gold',
};

export const TONE_OUTLINE: Record<Tone, string> = {
  neutral: 'text-fg-muted ring-line-strong',
  accent: 'text-accent ring-accent/40',
  ember: 'text-ember-400 ring-ember-500/45',
  success: 'text-success ring-success/40',
  warning: 'text-warning ring-warning/40',
  danger: 'text-danger ring-danger/40',
  info: 'text-info ring-info/40',
  gold: 'text-gold ring-gold/40',
};

export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-fg-muted',
  accent: 'text-accent',
  ember: 'text-ember-400',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  gold: 'text-gold',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** soft (default) · solid · outline · dot (colored dot + muted text, no fill) */
  variant?: 'soft' | 'solid' | 'outline' | 'dot';
  size?: 'sm' | 'md';
  /** Leading status dot (soft/outline/solid). */
  dot?: boolean;
  /** Pulse the dot (live status only). */
  pulse?: boolean;
  icon?: IconLike;
}

/** Compact status label. */
export function Badge({
  tone = 'neutral',
  variant = 'soft',
  size = 'md',
  dot = false,
  pulse = false,
  icon,
  className,
  children,
  ...props
}: BadgeProps) {
  const showDot = dot || variant === 'dot';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-mono font-medium uppercase tracking-[0.08em]',
        size === 'sm' ? 'h-4.5 text-[10px]' : 'h-5 text-2xs',
        variant === 'dot' ? 'px-0 text-fg-muted' : size === 'sm' ? 'px-1.5' : 'px-2',
        variant === 'soft' && cn('ring-1 ring-inset', TONE_SOFT[tone]),
        variant === 'solid' && TONE_SOLID[tone],
        variant === 'outline' && cn('ring-1 ring-inset', TONE_OUTLINE[tone]),
        className
      )}
      {...props}
    >
      {showDot && (
        <span className="relative flex size-1.5 shrink-0">
          {pulse && (
            <span className={cn('absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping', TONE_DOT[tone])} />
          )}
          <span className={cn('relative size-1.5 rounded-full', variant === 'solid' ? 'bg-current' : TONE_DOT[tone])} />
        </span>
      )}
      {renderIcon(icon, size === 'sm' ? 10 : 12, 'shrink-0', 2)}
      {children}
    </span>
  );
}

// ─── Chip ─────────────────────────────────────────────────

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode;
  tone?: Tone;
  selected?: boolean;
  icon?: IconLike;
  /** Shows an × button; the chip body stays clickable via onClick. */
  onRemove?: () => void;
  /** Accessible name of the × button, e.g. "Remove tag algorithms" (default "Remove"). */
  removeLabel?: string;
  size?: 'sm' | 'md';
}

/** Tag / filter chip. Renders a <button> when clickable, else a <span>. */
export function Chip({
  children,
  tone = 'neutral',
  selected = false,
  icon,
  onRemove,
  removeLabel = 'Remove',
  size = 'md',
  onClick,
  className,
  disabled,
  type = 'button',
  ...props
}: ChipProps) {
  const body = (
    <>
      {renderIcon(icon, 14, 'shrink-0')}
      <span className="truncate">{children}</span>
    </>
  );
  const classes = cn(
    'inline-flex max-w-full items-center gap-1.5 rounded-full border font-medium transition-colors duration-120 ease-out-quint',
    size === 'sm' ? 'h-6 text-xs' : 'h-7 text-xs',
    onRemove ? 'pl-2.5 pr-1' : size === 'sm' ? 'px-2' : 'px-2.5',
    selected
      ? tone === 'neutral' || tone === 'accent'
        ? 'border-accent/35 bg-accent/12 text-accent'
        : cn('border-transparent ring-1 ring-inset', TONE_SOFT[tone])
      : 'border-line-strong bg-surface-2 text-fg-muted',
    onClick && !disabled && !selected && 'hover:border-fg-faint hover:bg-surface-hover hover:text-fg',
    disabled && 'opacity-45',
    className
  );
  const remove = onRemove && (
    <button
      type="button"
      aria-label={removeLabel}
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      className="focus-ring -my-1 flex size-5 items-center justify-center rounded-full text-current opacity-70 hover:bg-surface-active hover:opacity-100"
    >
      <X size={12} strokeWidth={2} aria-hidden />
    </button>
  );

  if (onClick) {
    if (remove) {
      return (
        <span className={classes}>
          <button type={type} onClick={onClick} disabled={disabled} aria-pressed={selected} className="focus-ring flex min-w-0 items-center gap-1.5 rounded-full" {...props}>
            {body}
          </button>
          {remove}
        </span>
      );
    }
    return (
      <button type={type} onClick={onClick} disabled={disabled} aria-pressed={selected} className={cn(classes, 'focus-ring')} {...props}>
        {body}
      </button>
    );
  }
  return (
    <span className={classes}>
      {body}
      {remove}
    </span>
  );
}

// ─── Kbd ──────────────────────────────────────────────────

export interface KbdProps extends HTMLAttributes<HTMLElement> {
  /** Render several keys joined by a thin "+" (e.g. ['Ctrl', 'K']). */
  keys?: string[];
  size?: 'sm' | 'md';
}

const KEY =
  'inline-flex items-center justify-center rounded-[5px] border border-line-strong border-b-2 bg-ink-800 font-mono font-medium text-fg-muted';

/** Keyboard key cap. */
export function Kbd({ keys, size = 'md', className, children, ...props }: KbdProps) {
  const cap = size === 'sm' ? 'h-4.5 min-w-4.5 px-1 text-[10px]' : 'h-5 min-w-5 px-1.5 text-2xs';
  if (keys?.length) {
    return (
      <span className={cn('inline-flex items-center gap-0.5', className)}>
        {keys.map((k, i) => (
          <Fragment key={`${k}-${i}`}>
            {i > 0 && <span className="text-2xs text-fg-faint">+</span>}
            <kbd className={cn(KEY, cap)} {...props}>
              {k}
            </kbd>
          </Fragment>
        ))}
      </span>
    );
  }
  return (
    <kbd className={cn(KEY, cap, className)} {...props}>
      {children}
    </kbd>
  );
}
