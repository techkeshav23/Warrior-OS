// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Switch (FORGED ARMOR kit)
// On/off control (role="switch"). Mechanical slider: steel block in a sunk slot that fills with forge heat when on. With a label it
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
  sm: { track: 'h-4 w-8', thumb: 'h-3 w-3.5', on: 'translate-x-4' },
  md: { track: 'h-5 w-10', thumb: 'h-4 w-4.5', on: 'translate-x-5' },
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
        'focus-ring group/sw relative inline-flex shrink-0 cursor-pointer items-center p-0.5',
        'disabled:cursor-not-allowed disabled:opacity-45',
        dims.track,
        className
      )}
      {...props}
    >
      {/* Sunk steel slot; fills with forge heat when on */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-0 chamfer [--cut:4px] transition-[background-color,box-shadow] duration-180 ease-out-quint',
          'shadow-[inset_0_1px_0_rgb(0_0_0/0.8),inset_0_2px_4px_rgb(0_0_0/0.5),inset_0_-1px_0_rgb(255_255_255/0.1)]',
          checked
            ? tone === 'ember'
              ? 'bg-linear-to-r from-ember-600 via-ember-500 to-ember-300'
              : 'bg-linear-to-r from-accent/45 via-accent/80 to-accent'
            : 'bg-linear-to-b from-[#06080b] to-[#141920] group-hover/sw:shadow-[inset_0_1px_0_rgb(0_0_0/0.8),inset_0_2px_4px_rgb(0_0_0/0.5),inset_0_-1px_0_var(--color-ember-600,#d4520b)]'
        )}
      />
      {/* Machined steel slide block with grip lines */}
      <span
        aria-hidden
        className={cn(
          'relative flex items-center justify-center gap-px chamfer [--cut:2px] transition-transform duration-180 ease-out-quint',
          'bg-linear-to-b from-[#c9d1dc] via-[#8e98a6] to-[#5b6472] shadow-[inset_0_1px_0_rgb(255_255_255/0.7),inset_0_-1px_0_rgb(0_0_0/0.45)]',
          dims.thumb,
          checked ? dims.on : 'translate-x-0'
        )}
      >
        <span className="h-1.5 w-px bg-black/40" />
        <span className="h-1.5 w-px bg-black/40" />
      </span>
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
