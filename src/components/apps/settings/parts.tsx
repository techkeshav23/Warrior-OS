// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Settings building blocks (FORGE HUD)
// The one settings pattern every tab uses:
//
//   <SettingsPage>                        centered column, sections 24px apart
//     <SettingsSection title description> SectionHeader + its card
//       <SettingsCard>                    glass-panel, hairline-divided rows
//         <SwitchRow … />                 label + description · switch
//         <SettingRow … control={…} />    label + description · any control
//
// Rows wrap (control drops under the label) when the window is narrow.
// ═══════════════════════════════════════════════════════════

'use client';

import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { Card, SectionHeader, Switch, renderIcon, type IconLike } from '@/components/ui';
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

/** SectionHeader (text-ui title + muted line) over its content. */
export function SettingsSection({ title, description, actions, children, className }: SettingsSectionProps) {
  return (
    <section aria-label={typeof title === 'string' ? title : undefined} className={cn('flex flex-col gap-3', className)}>
      <SectionHeader as="h2" size="sm" title={title} description={description} actions={actions} />
      {children}
    </section>
  );
}

/** A card of setting rows separated by hairlines. */
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
      <div className="flex flex-col divide-y divide-line">{children}</div>
    </Card>
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

/** Mono value readout for the right side of a row ("60%", "+10 min"). */
export function RowValue({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span className={cn('tabular min-w-12 text-right font-mono text-ui', muted ? 'text-fg-subtle' : 'text-fg')}>
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

/** Icon tile + hud-label + value (+ detail): status grids and spec sheets. */
export function SpecItem({ icon, label, children, detail, reserveDetail = false }: SpecItemProps) {
  return (
    <div className="flex min-w-0 gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-control border border-line bg-ink-800 text-fg-muted">
        {renderIcon(icon, 16)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="hud-label truncate">{label}</p>
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

/** Inline notice: icon tile, title, one or two lines, optional action. */
export function Callout({ icon, title, children, tone = 'accent', action, className, ...props }: CalloutProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-card border p-3.5',
        tone === 'accent' ? 'border-accent/25 bg-accent/[0.06]' : 'border-line bg-surface-2',
        className
      )}
      {...props}
    >
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-control border',
          tone === 'accent' ? 'border-accent/30 bg-accent/10 text-accent' : 'border-line bg-ink-800 text-fg-muted'
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
