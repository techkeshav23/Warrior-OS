// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Slider (FORGED ARMOR kit)
// Styled native range input over a sunk forged track: forge-heat fill up
// to a machined steel slide block.
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

// Machined steel slide block (square, beveled) riding a sunk forged track.
const THUMB =
  '[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-none ' +
  '[&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-[linear-gradient(180deg,#d5dce6,#8e98a6_55%,#5b6472)] ' +
  '[&::-webkit-slider-thumb]:shadow-[inset_0_1px_0_rgb(255_255_255/0.75),inset_0_-1px_0_rgb(0_0_0/0.5),0_1px_3px_rgb(0_0_0/0.6)] ' +
  '[&::-webkit-slider-thumb]:transition-shadow [&::-webkit-slider-thumb]:duration-120 ' +
  'hover:[&::-webkit-slider-thumb]:shadow-[inset_0_1px_0_rgb(255_255_255/0.75),inset_0_-1px_0_rgb(0_0_0/0.5),0_0_10px_var(--slider-halo)] ' +
  'focus-visible:[&::-webkit-slider-thumb]:shadow-[0_0_0_2px_var(--color-ink-900,#070a12),0_0_0_4px_var(--slider-fill)] ' +
  '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:rounded-none [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#a9b3c0] ' +
  '[&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent';

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
  const fill = tone === 'ember' ? 'var(--color-ember-400, #ff8a3d)' : 'var(--accent, #ff8a3d)';
  const style = {
    '--slider-fill': fill,
    '--slider-halo': `color-mix(in srgb, ${fill} 55%, transparent)`,
  } as CSSProperties;
  // Heat fill: deep → hot → white-hot tip at the thumb.
  const heat =
    tone === 'ember'
      ? 'linear-gradient(90deg, #5a1606, var(--color-ember-600, #d4520b) 45%, var(--color-ember-400, #ff8a3d) 85%, #ffe2c4)'
      : `linear-gradient(90deg, color-mix(in srgb, ${fill} 25%, #000), ${fill} 80%, color-mix(in srgb, ${fill} 40%, #fff))`;

  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-2', disabled && 'opacity-45', wrapperClassName)}>
      {label != null && (
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={sliderId} className="engraved font-display text-2xs font-semibold uppercase tracking-[0.16em] text-fg-muted">
            {label}
          </label>
          {showValue && <span className="tabular font-display text-xs font-semibold text-ember-300">{formatValue ? formatValue(value) : value}</span>}
        </div>
      )}
      <div className="relative flex h-4 items-center" style={style}>
        {/* Sunk forged track with segment marks */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 chamfer [--cut:3px] bg-linear-to-b from-[#05070a] to-[#12161c] shadow-[inset_0_1px_0_rgb(0_0_0/0.8),inset_0_-1px_0_rgb(255_255_255/0.1)]"
        >
          <span
            className="absolute inset-y-0 left-0 shadow-[0_0_8px_var(--slider-halo)]"
            style={{ width: `${pct}%`, background: heat }}
          />
          <span className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_calc(10%-1px),rgb(0_0_0/0.55)_calc(10%-1px),rgb(0_0_0/0.55)_10%)]" />
        </span>
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
          'relative h-4 w-full cursor-pointer appearance-none bg-transparent outline-none disabled:cursor-not-allowed',
          THUMB,
          className
        )}
        {...props}
      />
      </div>
    </div>
  );
});
