// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Switch (FORGE HUD kit)
// On/off control (role="switch"). Accent track when on. With a label it
// renders as a settings row: label + description left, switch right.
//   <Switch checked={crt} onCheckedChange={setCrt} label="CRT scanlines" />
// ═══════════════════════════════════════════════════════════

'use client';

import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'role'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  /** sm 28×16 · md 36×20 */
  size?: 'sm' | 'md';
  /** 'row' = label left, switch right (settings rows); 'inline' = switch then label. */
  layout?: 'inline' | 'row';
  /** Ember track for warrior toggles (streak mode, forge alerts). */
  tone?: 'accent' | 'ember';
  wrapperClassName?: string;
}

const DIMS = {
  sm: { track: 'h-4 w-7', thumb: 'size-3', on: 'translate-x-3' },
  md: { track: 'h-5 w-9', thumb: 'size-4', on: 'translate-x-4' },
} as const;

/** Accessible toggle switch. */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  {
    checked,
    onCheckedChange,
    label,
    description,
    size = 'md',
    layout = 'inline',
    tone = 'accent',
    disabled,
    className,
    wrapperClassName,
    id,
    ...props
  },
  ref
) {
  const autoId = useId();
  const switchId = id ?? autoId;
  const dims = DIMS[size];
  const control = (
    <button
      ref={ref}
      id={switchId}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'focus-ring relative inline-flex shrink-0 cursor-pointer items-center rounded-full border p-px',
        'transition-[background-color,border-color,box-shadow] duration-180 ease-out-quint',
        'disabled:cursor-not-allowed disabled:opacity-45',
        dims.track,
        checked
          ? tone === 'ember'
            ? 'border-ember-500 bg-ember-500'
            : 'border-accent bg-accent'
          : 'border-line-strong bg-ink-700 hover:border-fg-faint',
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'block rounded-full shadow-[0_1px_2px_rgb(0_0_0/0.4)] transition-transform duration-180 ease-out-quint',
          dims.thumb,
          checked ? cn(dims.on, 'bg-white') : 'translate-x-0 bg-fg-muted'
        )}
      />
    </button>
  );

  if (!label && !description) return control;

  return (
    <div
      className={cn(
        'flex gap-3',
        layout === 'row' ? 'w-full items-center justify-between' : 'items-start',
        disabled && 'opacity-60',
        wrapperClassName
      )}
    >
      {layout === 'inline' && <span className="mt-0.5 flex">{control}</span>}
      <span className="flex min-w-0 flex-col">
        {label && (
          <label htmlFor={switchId} className="cursor-pointer text-ui leading-5 text-fg">
            {label}
          </label>
        )}
        {description && <span className="text-xs text-fg-subtle">{description}</span>}
      </span>
      {layout === 'row' && control}
    </div>
  );
});
