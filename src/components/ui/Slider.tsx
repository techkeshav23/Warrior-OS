// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Slider (FORGE HUD kit)
// Styled native range input: accent fill up to the thumb, hairline
// track, round thumb with a soft halo on hover/focus.
//   <Slider label="Glass opacity" value={v} onValueChange={setV} min={0} max={100}
//           formatValue={(n) => `${n}%`} />
// ═══════════════════════════════════════════════════════════

'use client';

import { forwardRef, useId, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SliderProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'size' | 'min' | 'max' | 'step'> {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: ReactNode;
  /** Show the formatted value on the right of the label row. */
  showValue?: boolean;
  formatValue?: (value: number) => ReactNode;
  tone?: 'accent' | 'ember';
  wrapperClassName?: string;
}

const THUMB =
  '[&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full ' +
  '[&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_var(--slider-halo),0_1px_3px_rgb(0_0_0/0.5)] ' +
  '[&::-webkit-slider-thumb]:transition-shadow [&::-webkit-slider-thumb]:duration-120 ' +
  'hover:[&::-webkit-slider-thumb]:shadow-[0_0_0_6px_var(--slider-halo),0_1px_3px_rgb(0_0_0/0.5)] ' +
  'focus-visible:[&::-webkit-slider-thumb]:shadow-[0_0_0_2px_var(--color-ink-900,#070a12),0_0_0_4px_var(--slider-fill)] ' +
  '[&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white';

/** Range slider with optional label + value readout. */
export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  {
    value,
    onValueChange,
    min = 0,
    max = 100,
    step = 1,
    label,
    showValue = true,
    formatValue,
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
  const sliderId = id ?? autoId;
  const pct = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;
  const fill = tone === 'ember' ? 'var(--color-ember-400, #ff8a3d)' : 'var(--accent, #2fd6f5)';
  const style = {
    '--slider-fill': fill,
    '--slider-halo': `color-mix(in srgb, ${fill} 22%, transparent)`,
    background: `linear-gradient(to right, ${fill} 0%, ${fill} ${pct}%, var(--color-ink-600, #243044) ${pct}%, var(--color-ink-600, #243044) 100%)`,
  } as CSSProperties;

  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-2', disabled && 'opacity-45', wrapperClassName)}>
      {label != null && (
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={sliderId} className="text-xs font-medium text-fg-muted">
            {label}
          </label>
          {showValue && <span className="tabular font-mono text-xs text-fg">{formatValue ? formatValue(value) : value}</span>}
        </div>
      )}
      <input
        ref={ref}
        id={sliderId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange(Number(e.target.value))}
        className={cn(
          'h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none disabled:cursor-not-allowed',
          THUMB,
          className
        )}
        style={style}
        {...props}
      />
    </div>
  );
});
