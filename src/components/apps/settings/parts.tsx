// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Settings building blocks (FORGED ARMOR)
// The one settings pattern every tab uses:
//
//   <SettingsPage>                        centered column, sections 24px apart
//     <SettingsSection title description> engraved header + its plate
//       <SettingsCard>                    armor panel, rows split by grooves
//         <SwitchRow … />                 label + description · switch
//         <SettingRow … control={…} />    label + description · any control
//   <ForgedPlaque>                        status hero: riveted plaque + socket
//
// Rows wrap (control drops under the label) when the window is narrow.
// ═══════════════════════════════════════════════════════════

'use client';

import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { Card, Switch, renderIcon, type IconLike } from '@/components/ui';
import { BEVEL_RAISED, BEVEL_SUNK, ENGRAVED_LABEL, SLOT_FILL, STEEL_PLATE } from '@/components/ui/armor';
import { cn } from '@/lib/utils';

export type SettingsTabId =
  | 'appearance'
  | 'living'
  | 'performance'
  | 'sounds'
  | 'account'
  | 'workspaces'
  | 'nexus'
  | 'showcase'
  | 'about';

/** Lets a tab send the user to another tab (e.g. "Performance settings"). */
export type OpenSettingsTab = (tab: SettingsTabId) => void;

// ─── Metal recipes ───

/** Groove cut between two rows: dark lip above, faint light lip below. */
export const GROOVE = 'shadow-[inset_0_1px_0_rgb(0_0_0/0.55),inset_0_2px_0_rgb(255_255_255/0.045)]';
/** Groove between every direct child of a stack. */
const GROOVED_STACK = '[&>*+*]:shadow-[inset_0_1px_0_rgb(0_0_0/0.55),inset_0_2px_0_rgb(255_255_255/0.045)]';
/** Small raised steel plate for a glyph. */
const GLYPH_PLATE = cn('chamfer [--cut:5px]', STEEL_PLATE.replace(' text-fg', ''), BEVEL_RAISED);
/** Sunk socket a glyph sits in (hero plaques). */
const GLYPH_SOCKET = cn('chamfer [--cut:7px]', SLOT_FILL, BEVEL_SUNK);

// ─── Page / section / card ───

/** A tab's body: max 768px wide (aligned with the header), sections 24px apart. */
export function SettingsPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex w-full max-w-3xl flex-col gap-6 pb-2', className)}>{children}</div>;
}

export interface SettingsSectionProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Engraved section header: an ember lead-in, the title cut into the steel, a ticked groove. */
export function EngravedHeader({
  title,
  description,
  actions,
  as: Heading = 'h2',
  tone = 'ember',
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  as?: 'h2' | 'h3';
  tone?: 'ember' | 'danger';
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-6 items-center gap-2.5">
        <span
          aria-hidden
          className={cn(
            'h-3.5 w-2 shrink-0 [clip-path:polygon(45%_0,100%_0,55%_100%,0_100%)] bg-linear-to-b',
            tone === 'danger' ? 'from-danger to-ember-700' : 'from-ember-300 via-ember-500 to-ember-700'
          )}
        />
        <Heading
          className={cn(
            'engraved min-w-0 truncate font-display text-xs font-semibold uppercase tracking-[0.18em]',
            tone === 'danger' ? 'text-danger' : 'text-fg'
          )}
        >
          {title}
        </Heading>
        <span aria-hidden className="flex min-w-6 flex-1 items-center gap-1">
          <span className="h-px flex-1 bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.13)_0_1px,transparent_1px_10px)] shadow-[0_1px_0_rgb(0_0_0/0.6)]" />
          <span className="h-2 w-px bg-white/20" />
          <span className="h-2 w-px bg-white/20" />
        </span>
        {actions != null && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {description != null && <p className="max-w-prose pl-4.5 text-ui text-fg-muted">{description}</p>}
    </div>
  );
}

/** Engraved header over its plate(s). */
export function SettingsSection({ title, description, actions, children, className }: SettingsSectionProps) {
  return (
    <section aria-label={typeof title === 'string' ? title : undefined} className={cn('flex flex-col gap-3', className)}>
      <EngravedHeader title={title} description={description} actions={actions} />
      {children}
    </section>
  );
}

/** An armor panel of setting rows separated by grooves. */
export function SettingsCard({
  children,
  className,
  style,
  hud,
  tone,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  hud?: boolean;
  tone?: 'default' | 'accent';
}) {
  return (
    <Card padding="none" hud={hud} tone={tone} className={className} style={style}>
      <div className={cn('flex flex-col', GROOVED_STACK)}>{children}</div>
    </Card>
  );
}

// ─── Forged plaque ───

export type PlaqueTone = 'accent' | 'neutral' | 'plasma' | 'success';

const PLAQUE_GLYPH: Record<PlaqueTone, string> = {
  accent: 'text-accent drop-shadow-[0_0_6px_color-mix(in_oklab,var(--accent)_55%,transparent)]',
  neutral: 'text-fg-muted',
  plasma: 'text-plasma-400 drop-shadow-[0_0_6px_color-mix(in_oklab,var(--color-plasma-400)_55%,transparent)]',
  success: 'text-success',
};
const PLAQUE_STRIP: Record<PlaqueTone, string> = {
  accent: 'from-accent/90 via-accent/60 to-accent/10',
  neutral: 'from-steel-400 via-steel-500 to-steel-600',
  plasma: 'from-plasma-300 via-plasma-500 to-plasma-600/30',
  success: 'from-success via-success/60 to-success/10',
};
const PLAQUE_WASH: Record<PlaqueTone, string> = {
  accent: 'from-accent/[0.09]',
  neutral: 'from-white/[0.02]',
  plasma: 'from-plasma-400/[0.07]',
  success: 'from-success/[0.06]',
};
const PLAQUE_EYEBROW: Record<PlaqueTone, string> = {
  accent: 'text-accent/85',
  neutral: 'text-fg-subtle',
  plasma: 'text-plasma-400/85',
  success: 'text-success/85',
};

export interface ForgedPlaqueProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon: IconLike;
  /** Engraved caps line above the title ("System status"). */
  eyebrow?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  tone?: PlaqueTone;
  /** Small stamped mark in the top-right corner ("LT-01"). */
  stamp?: string;
  action?: ReactNode;
}

/** Status hero: a riveted plaque with a heated side strip and a sunk glyph socket. */
export function ForgedPlaque({
  icon,
  eyebrow,
  title,
  children,
  tone = 'accent',
  stamp,
  action,
  className,
  ...props
}: ForgedPlaqueProps) {
  return (
    <div
      className={cn(
        'armor-panel chamfer-tl-br [--cut:12px] rivets [--rivet-inset:7px] relative isolate flex min-w-0 items-start gap-4 py-4 pr-5 pl-6',
        className
      )}
      {...props}
    >
      <span aria-hidden className={cn('pointer-events-none absolute inset-0 -z-10 bg-linear-to-r to-transparent to-55%', PLAQUE_WASH[tone])} />
      <span aria-hidden className={cn('pointer-events-none absolute inset-y-3 left-0 w-1 bg-linear-to-b', PLAQUE_STRIP[tone])} />
      {stamp && (
        <span aria-hidden className="engraved pointer-events-none absolute top-2.5 right-6 hidden font-mono @lg:block text-2xs tracking-[0.2em] text-fg-faint">
          {stamp}
        </span>
      )}
      <span className={cn('flex size-12 shrink-0 items-center justify-center', GLYPH_SOCKET, PLAQUE_GLYPH[tone])}>
        {renderIcon(icon, 22)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
        {eyebrow != null && <p className={cn(ENGRAVED_LABEL.replace(' text-fg-subtle', ''), PLAQUE_EYEBROW[tone])}>{eyebrow}</p>}
        {title != null && <div className="text-sm font-medium text-fg">{title}</div>}
        {children != null && <div className="text-xs text-fg-muted">{children}</div>}
        {action != null && <div className="mt-2 flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}

// ─── Rows ───

const ROW_PAD = 'px-4 py-3.5';

export interface SettingRowProps {
  label: ReactNode;
  description?: ReactNode;
  /** Renders the label as a <label> for this control id. */
  htmlFor?: string;
  /** id for the label element (for aria-labelledby). */
  labelId?: string;
  /** Right-hand control; drops under the label when the card is narrow. */
  control?: ReactNode;
  /** Full-width content under the label/control line (slider, readouts). */
  children?: ReactNode;
  /** Dims the text: the row's controls should be disabled too. */
  disabled?: boolean;
  /** Put the control under the description (rows with long copy). */
  stack?: boolean;
  className?: string;
}

/** Label + description on the left, control on the right. */
export function SettingRow({
  label,
  description,
  htmlFor,
  labelId,
  control,
  children,
  disabled,
  stack = false,
  className,
}: SettingRowProps) {
  const labelClass = 'block text-ui font-medium leading-5 text-fg';
  return (
    <div className={cn('flex flex-col gap-3', ROW_PAD, className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5">
        <div className={cn('min-w-0 flex-1', stack ? 'basis-full' : 'basis-40', disabled && 'opacity-60')}>
          {htmlFor ? (
            <label id={labelId} htmlFor={htmlFor} className={labelClass}>
              {label}
            </label>
          ) : (
            <p id={labelId} className={labelClass}>
              {label}
            </p>
          )}
          {description != null && <p className="text-xs text-fg-subtle">{description}</p>}
        </div>
        {control != null && <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{control}</div>}
      </div>
      {children}
    </div>
  );
}

export interface SwitchRowProps {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Accessible name for the switch (defaults to the label). */
  ariaLabel?: string;
  /** Small badge after the label (e.g. "Off in lite mode"). */
  badge?: ReactNode;
  disabled?: boolean;
}

/** The kit Switch as a settings row. */
export function SwitchRow({ label, description, checked, onCheckedChange, ariaLabel, badge, disabled }: SwitchRowProps) {
  return (
    <div className={ROW_PAD}>
      <Switch
        layout="row"
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={ariaLabel ?? label}
        disabled={disabled}
        label={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
            {label}
            {badge}
          </span>
        }
        description={description}
      />
    </div>
  );
}

/** Mono gauge readout sunk into the plate ("60%", "+10 min"). */
export function RowValue({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={cn(
        'tabular inline-flex h-6 min-w-14 items-center justify-end px-2 font-mono text-ui chamfer-xs',
        SLOT_FILL,
        BEVEL_SUNK,
        muted ? 'text-fg-subtle' : 'text-ember-300'
      )}
    >
      {children}
    </span>
  );
}

// ─── Spec item ───

export interface SpecItemProps {
  icon: IconLike;
  /** hud-label line. */
  label: string;
  /** The value (text-ui medium). */
  children: ReactNode;
  /** Muted line under the value (truncated; full text in the tooltip). */
  detail?: string;
  /** Keep the detail line's height while it is still unknown. */
  reserveDetail?: boolean;
}

/** Glyph plate + engraved label + value (+ detail): status grids and spec sheets. */
export function SpecItem({ icon, label, children, detail, reserveDetail = false }: SpecItemProps) {
  return (
    <div className="flex min-w-0 gap-3">
      <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center text-fg-muted', GLYPH_PLATE)}>
        {renderIcon(icon, 16)}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn(ENGRAVED_LABEL, 'truncate')}>{label}</p>
        <div className="mt-0.5 truncate text-ui font-medium text-fg">{children}</div>
        {(detail != null || reserveDetail) && (
          <p className={cn('truncate text-xs text-fg-subtle', detail == null && 'invisible')} title={detail}>
            {detail ?? '—'}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Callout ───

export interface CalloutProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon: IconLike;
  title: ReactNode;
  children?: ReactNode;
  /** accent = live / informative · neutral = quiet */
  tone?: 'accent' | 'neutral';
  action?: ReactNode;
}

/** Inline notice: a small plate with a heated edge, glyph, title, one or two lines, optional action. */
export function Callout({ icon, title, children, tone = 'accent', action, className, ...props }: CalloutProps) {
  return (
    <div className={cn('armor-panel chamfer-md relative isolate flex items-start gap-3 p-3.5 pl-4', className)} {...props}>
      {tone === 'accent' && (
        <>
          <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-r from-accent/[0.08] to-transparent to-50%" />
          <span aria-hidden className="pointer-events-none absolute inset-y-2.5 left-0 w-0.5 bg-accent" />
        </>
      )}
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center',
          GLYPH_PLATE,
          tone === 'accent' ? 'text-accent' : 'text-fg-muted'
        )}
      >
        {renderIcon(icon, 16)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-ui font-medium text-fg">{title}</p>
        {children != null && <div className="text-xs text-fg-muted">{children}</div>}
        {action != null && <div className="mt-2 flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}
