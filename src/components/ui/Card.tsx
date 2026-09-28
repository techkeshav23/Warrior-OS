// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Card + SectionHeader (FORGE HUD kit)
// Card = glass-panel, rounded-card, hairline border. Optional header
// (eyebrow / title / actions), footer and HUD corner brackets. Keep to
// max 2 levels of bordered containers (window → card).
//   <Card eyebrow="This week" title="Focus time" actions={<IconButton …/>}>…</Card>
// ═══════════════════════════════════════════════════════════

'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { renderIcon, type IconLike } from './icon';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

const PAD: Record<CardPadding, string> = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5' };
const PAD_X: Record<CardPadding, string> = { none: 'px-4', sm: 'px-3', md: 'px-4', lg: 'px-5' };

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** hud-label line above the title. */
  eyebrow?: ReactNode;
  title?: ReactNode;
  /** Small line under the title. */
  description?: ReactNode;
  icon?: IconLike;
  /** Right side of the header row. */
  actions?: ReactNode;
  /** Replace the whole header row. */
  header?: ReactNode;
  /** Footer row with a hairline on top. */
  footer?: ReactNode;
  padding?: CardPadding;
  /** Subtle HUD corner brackets (use for hero/live cards, not everywhere). */
  hud?: boolean;
  /** Hover lift for clickable cards. */
  interactive?: boolean;
  /** Tinted edge for highlighted cards. */
  tone?: 'default' | 'accent' | 'ember';
  /** Class for the body wrapper. */
  bodyClassName?: string;
}

// Tone = edge color + a top wash drawn by an overlay (hud-corners owns background-image).
const TONE_EDGE = { default: undefined, accent: 'var(--color-accent-soft)', ember: 'color-mix(in oklab, var(--color-ember-500) 28%, transparent)' } as const;
const TONE_WASH = {
  default: '',
  accent: 'bg-linear-to-b from-accent/[0.07] to-transparent to-60%',
  ember: 'bg-linear-to-b from-ember-500/[0.08] to-transparent to-60%',
} as const;

/** Glass card with header/footer slots. */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    eyebrow,
    title,
    description,
    icon,
    actions,
    header,
    footer,
    padding = 'md',
    hud = false,
    interactive = false,
    tone = 'default',
    className,
    bodyClassName,
    style,
    children,
    ...props
  },
  ref
) {
  const hasHeader = header != null || title != null || eyebrow != null || actions != null;
  return (
    <div
      ref={ref}
      className={cn(
        'glass-panel relative isolate flex min-w-0 flex-col rounded-card',
        hud && 'hud-corners',
        interactive &&
          'cursor-pointer transition-[border-color,background-color,transform] duration-180 ease-out-quint hover:-translate-y-px hover:border-line-strong hover:bg-surface-hover',
        className
      )}
      style={TONE_EDGE[tone] ? { borderColor: TONE_EDGE[tone], ...style } : style}
      {...props}
    >
      {tone !== 'default' && (
        <span aria-hidden className={cn('pointer-events-none absolute inset-0 -z-10 rounded-[inherit]', TONE_WASH[tone])} />
      )}
      {hasHeader &&
        (header ?? (
          <div className={cn('flex items-start gap-3 pt-4', PAD_X[padding], padding === 'none' && 'pb-3')}>
            {icon != null && (
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-control border border-line bg-ink-800 text-fg-muted">
                {renderIcon(icon, 16)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              {eyebrow != null && <div className="hud-label mb-1 truncate">{eyebrow}</div>}
              {title != null && <h3 className="truncate text-sm font-semibold text-fg">{title}</h3>}
              {description != null && <p className="mt-0.5 text-xs text-fg-subtle">{description}</p>}
            </div>
            {actions != null && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
          </div>
        ))}
      {children != null && (
        <div className={cn('min-w-0 flex-1', PAD[padding], hasHeader && padding !== 'none' && 'pt-3', bodyClassName)}>
          {children}
        </div>
      )}
      {footer != null && (
        <div className={cn('flex items-center gap-2 border-t border-line py-3', PAD_X[padding])}>{footer}</div>
      )}
    </div>
  );
});

// ─── SectionHeader ────────────────────────────────────────

export interface SectionHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** hud-label eyebrow above the title. */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  icon?: IconLike;
  actions?: ReactNode;
  /** sm = in-card group title · md = page section · lg = hero section */
  size?: 'sm' | 'md' | 'lg';
  as?: 'h2' | 'h3' | 'h4';
}

const TITLE_SIZE = { sm: 'text-ui font-semibold', md: 'text-base font-semibold', lg: 'text-xl font-semibold tracking-tight' } as const;

/** Eyebrow + title + actions row that opens a section. */
export function SectionHeader({
  eyebrow,
  title,
  description,
  icon,
  actions,
  size = 'md',
  as: Heading = 'h2',
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div className={cn('flex items-end justify-between gap-4', className)} {...props}>
      <div className="flex min-w-0 items-start gap-3">
        {icon != null && (
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-control border border-line bg-ink-800 text-accent">
            {renderIcon(icon, 16)}
          </span>
        )}
        <div className="min-w-0">
          {eyebrow != null && <div className="hud-label mb-1.5">{eyebrow}</div>}
          <Heading className={cn('truncate text-fg', TITLE_SIZE[size])}>{title}</Heading>
          {description != null && <p className="mt-1 text-ui text-fg-muted">{description}</p>}
        </div>
      </div>
      {actions != null && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
