// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Checkbox, Radio, RadioGroup (FORGED ARMOR kit)
// Real <input>s (keyboard + forms + screen readers) drawn with the kit's
// look: 16px sunk steel socket with a cut corner, molten ember when checked.
//   <Checkbox label="Show completed" checked={v} onCheckedChange={setV} />
//   <RadioGroup name="view" value={view} onValueChange={setView} options={[…]} />
// ═══════════════════════════════════════════════════════════

'use client';

import { forwardRef, useEffect, useId, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChoiceBaseProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode;
  /** Secondary line under the label. */
  description?: ReactNode;
  /** Convenience: receives the new checked state. */
  onCheckedChange?: (checked: boolean) => void;
  wrapperClassName?: string;
}

// Base box; colors live in CONTROL_OFF / CONTROL_MIXED so states never fight (cn doesn't merge).
const CONTROL =
  'peer size-4 shrink-0 cursor-pointer appearance-none ' +
  'transition-[background-color,box-shadow] duration-120 ease-out-quint ' +
    'disabled:cursor-not-allowed disabled:opacity-45';
// Recessed steel socket; checked = molten ember plug with a hot top edge.
const CONTROL_OFF =
  'bg-linear-to-b from-[#06080b] to-[#161b22] shadow-[inset_0_0_0_1px_rgb(167_175_186/0.35),inset_0_2px_3px_rgb(0_0_0/0.7)] ' +
  'hover:shadow-[inset_0_0_0_1px_var(--color-ember-500,#f76b15),inset_0_2px_3px_rgb(0_0_0/0.7)] ' +
  'checked:from-ember-300 checked:to-ember-600 checked:shadow-[inset_0_1px_0_rgb(255_240_220/0.7),inset_0_-1px_0_rgb(90_25_0/0.7)]';
const CONTROL_MIXED =
  'bg-linear-to-b from-ember-300 to-ember-600 shadow-[inset_0_1px_0_rgb(255_240_220/0.7),inset_0_-1px_0_rgb(90_25_0/0.7)]';

function ChoiceLabel({ id, label, description, disabled }: { id: string; label?: ReactNode; description?: ReactNode; disabled?: boolean }) {
  if (!label && !description) return null;
  return (
    <span className={cn('flex min-w-0 flex-col', disabled && 'opacity-45')}>
      {label && (
        <label htmlFor={id} className="cursor-pointer text-ui leading-5 text-fg">
          {label}
        </label>
      )}
      {description && <span className="text-xs text-fg-subtle">{description}</span>}
    </span>
  );
}

export interface CheckboxProps extends ChoiceBaseProps {
  /** Mixed state (e.g. "select all" with some selected). */
  indeterminate?: boolean;
}

/** Checkbox with optional label + description. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, indeterminate = false, onCheckedChange, onChange, className, wrapperClassName, id, disabled, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const innerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <span className={cn('inline-flex items-start gap-2.5', wrapperClassName)}>
      <span className="relative mt-0.5 flex size-4 shrink-0 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
        <input
          ref={(el) => {
            innerRef.current = el;
            if (typeof ref === 'function') ref(el);
            else if (ref) ref.current = el;
          }}
          id={inputId}
          type="checkbox"
          disabled={disabled}
          aria-checked={indeterminate ? 'mixed' : undefined}
          onChange={(e) => {
            onChange?.(e);
            onCheckedChange?.(e.target.checked);
          }}
          className={cn(CONTROL, '[clip-path:polygon(0_0,calc(100%-5px)_0,100%_5px,100%_100%,0_100%)]', indeterminate ? CONTROL_MIXED : CONTROL_OFF, className)}
          {...props}
        />
        {indeterminate ? (
          <Minus size={12} strokeWidth={3} aria-hidden className="pointer-events-none absolute inset-0 m-auto text-[#1a0a02]" />
        ) : (
          <Check
            size={12}
            strokeWidth={3}
            aria-hidden
            className="pointer-events-none absolute inset-0 m-auto text-[#1a0a02] opacity-0 transition-opacity duration-120 peer-checked:opacity-100"
          />
        )}
      </span>
      <ChoiceLabel id={inputId} label={label} description={description} disabled={disabled} />
    </span>
  );
});

export type RadioProps = ChoiceBaseProps;

/** Single radio; group them with the same `name` (or use RadioGroup). */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, description, onCheckedChange, onChange, className, wrapperClassName, id, disabled, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <span className={cn('inline-flex items-start gap-2.5', wrapperClassName)}>
      <span className="relative mt-0.5 flex size-4 shrink-0 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
        <input
          ref={ref}
          id={inputId}
          type="radio"
          disabled={disabled}
          onChange={(e) => {
            onChange?.(e);
            onCheckedChange?.(e.target.checked);
          }}
          className={cn(CONTROL, CONTROL_OFF, '[clip-path:polygon(30%_0,70%_0,100%_30%,100%_70%,70%_100%,30%_100%,0_70%,0_30%)]', className)}
          {...props}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 m-auto size-1.5 scale-0 rotate-45 bg-[#1a0a02] transition-transform duration-120 peer-checked:scale-100"
        />
      </span>
      <ChoiceLabel id={inputId} label={label} description={description} disabled={disabled} />
    </span>
  );
});

export interface RadioGroupOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  options: RadioGroupOption[];
  /** Visible group label (also the accessible name). */
  label?: ReactNode;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

/** A labelled set of radios. */
export function RadioGroup({ name, value, onValueChange, options, label, orientation = 'vertical', className }: RadioGroupProps) {
  const labelId = useId();
  return (
    <div role="radiogroup" aria-labelledby={label ? labelId : undefined} className={cn('flex flex-col gap-2', className)}>
      {label && (
        <span id={labelId} className="engraved font-display text-2xs font-semibold uppercase tracking-[0.16em] text-fg-muted">
          {label}
        </span>
      )}
      <div className={cn('flex gap-x-5 gap-y-2.5', orientation === 'vertical' ? 'flex-col' : 'flex-wrap items-center')}>
        {options.map((o) => (
          <Radio
            key={o.value}
            name={name}
            value={o.value}
            checked={value === o.value}
            disabled={o.disabled}
            label={o.label}
            description={o.description}
            onChange={() => onValueChange(o.value)}
          />
        ))}
      </div>
    </div>
  );
}
