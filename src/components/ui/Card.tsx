// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Card + SectionHeader (FORGED ARMOR kit)
// Card = armor-panel plate with chamfered corners. Optional engraved header
// (eyebrow / title / actions), footer and corner rivets. Keep to
// max 2 levels of bordered containers (window → card).
//   <Card eyebrow="This week" title="Focus time" actions={<IconButton …/>}>…</Card>
// ═══════════════════════════════════════════════════════════

'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { renderIcon, type IconLike } from './icon';
import { ENGRAVED_LABEL } from './armor';

/** Small beveled steel plate that holds a header glyph. */
const ICON_PLATE =
  'bg-linear-to-b from-[#2b323c] to-[#161a20] shadow-[inset_0_1px_0_rgb(255_255_255/0.13),inset_0_-1px_0_rgb(0_0_0/0.6)]';

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
  /** Rivets at the plate corners (hero / live cards, not everywhere). Legacy name: `hud`. */
  hud?: boolean;
  /** Rivets at the plate corners. Same as `hud`. */
  rivets?: boolean;
  /** Hover lift for clickable cards. */
  interactive?: boolean;
  /** Tinted edge for highlighted cards. */
  tone?: 'default' | 'accent' | 'ember';
  /** Class for the body wrapper. */
  bodyClassName?: string;
}

// Tone = a heated top edge + a faint wash (drawn by overlays, so the armor material stays intact).
const TONE_EDGE = {
  default: '',
  accent: 'bg-linear-to-r from-transparent via-accent to-transparent',
  ember: 'bg-linear-to-r from-ember-600 via-ember-400 to-ember-600/0',
} as const;
const TONE_WASH = {
  default: '',
  accent: 'bg-linear-to-b from-accent/[0.08] to-transparent to-60%',
  ember: 'bg-linear-to-b from-ember-500/[0.10] to-transparent to-60%',
} as const;

/** Armor plate card with header/footer slots. */
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
    rivets,
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
        'armor-panel chamfer-md relative isolate flex min-w-0 flex-col',
        (rivets ?? hud) && 'rivets',
        interactive &&
          'group/card cursor-pointer transition-[filter,transform] duration-120 ease-out-quint hover:-translate-y-px hover:brightness-115 active:translate-y-0',
        className
      )}
      style={style}
      {...props}
    >
      {tone !== 'default' && (
        <>
          <span aria-hidden className={cn('pointer-events-none absolute inset-0 -z-10', TONE_WASH[tone])} />
          <span aria-hidden className={cn('pointer-events-none absolute inset-x-0 top-0 h-0.5', TONE_EDGE[tone])} />
        </>
      )}
      {interactive && tone === 'default' && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-ember-400 to-transparent opacity-0 transition-opacity duration-120 group-hover/card:opacity-100"
        />
      )}
      {hasHeader &&
        (header ?? (
          <div className={cn('flex items-start gap-3 pt-4', PAD_X[padding], padding === 'none' && 'pb-3')}>
            {icon != null && (
              <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center chamfer [--cut:5px] text-fg-muted', ICON_PLATE)}>
                {renderIcon(icon, 16)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              {eyebrow != null && <div className={cn(ENGRAVED_LABEL, 'mb-1 truncate')}>{eyebrow}</div>}
              {title != null && <h3 className="truncate font-display text-sm font-semibold uppercase tracking-[0.06em] text-fg">{title}</h3>}
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
        <div className={cn('flex items-center gap-2 py-3 shadow-[inset_0_1px_0_rgb(0_0_0/0.55),inset_0_2px_0_rgb(255_255_255/0.04)]', PAD_X[padding])}>{footer}</div>
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

const TITLE_SIZE = {
  sm: 'text-xs font-semibold tracking-[0.1em]',
  md: 'text-sm font-semibold tracking-[0.08em]',
  lg: 'text-xl font-bold tracking-[0.04em]',
} as const;

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
    <div className={cn('flex flex-col', size === 'sm' ? 'gap-0' : 'gap-2', className)} {...props}>
      <div className="flex items-end justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon != null && (
            <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center chamfer [--cut:5px] text-ember-400', ICON_PLATE)}>
              {renderIcon(icon, 16)}
            </span>
          )}
          <div className="min-w-0">
            {eyebrow != null && <div className={cn(ENGRAVED_LABEL, 'mb-1.5 text-ember-400/80')}>{eyebrow}</div>}
            <Heading className={cn('engraved truncate font-display uppercase text-fg', TITLE_SIZE[size])}>{title}</Heading>
            {description != null && <p className="mt-1 text-ui text-fg-muted">{description}</p>}
          </div>
        </div>
        {actions != null && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {/* Engraved rule with segment marks: an ember lead-in, then tick marks */}
      {size !== 'sm' && (
      <div aria-hidden className="flex h-1.5 items-center gap-1">
        <span className="h-0.5 w-6 bg-ember-500" />
        <span className="h-px flex-1 bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.14)_0_1px,transparent_1px_12px)] shadow-[0_1px_0_rgb(0_0_0/0.6)]" />
        <span className="h-1.5 w-px bg-white/20" />
        <span className="h-1.5 w-px bg-white/20" />
      </div>
      )}
    </div>
  );
}
