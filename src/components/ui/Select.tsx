// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Select (FORGE HUD kit)
// Styled native <select>: keyboard, screen-reader and mobile behaviour
// come free. Pass `options` or your own <option> children.
//   <Select label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}
//           options={[{ value: 'due', label: 'Due date' }, …]} />
//   <Select fullWidth={false} … />   as wide as its longest option
// ═══════════════════════════════════════════════════════════

'use client';

import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { renderIcon, type IconLike } from './icon';
import {
  FIELD_BASE,
  FIELD_ICON_POS,
  FIELD_PAD,
  FIELD_SIZE,
  FIELD_STATE,
  FieldShell,
  fieldDescribedBy,
  type FieldSize,
} from './Field';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  options?: SelectOption[];
  /** First, disabled option shown while value is ''. */
  placeholder?: string;
  leadingIcon?: IconLike;
  size?: FieldSize;
  /** Convenience: receives the new value string. */
  onValueChange?: (value: string) => void;
  /** Class for the outer wrapper; a width class here narrows the field. */
  wrapperClassName?: string;
  /** false: as wide as the longest option instead of filling the container. */
  fullWidth?: boolean;
}

/** Native select with the kit's field styling. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    hint,
    error,
    options,
    placeholder,
    leadingIcon,
    size = 'md',
    onValueChange,
    onChange,
    className,
    wrapperClassName,
    fullWidth = true,
    id,
    required,
    children,
    ...props
  },
  ref
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const pad = FIELD_PAD[size];
  return (
    <FieldShell
      id={selectId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      fullWidth={fullWidth}
      className={wrapperClassName}
    >
      <div className="relative flex items-center">
        {leadingIcon != null && (
          <span className={cn('pointer-events-none absolute z-[1] top-1/2 flex -translate-y-1/2 text-fg-subtle', FIELD_ICON_POS[size])}>
            {renderIcon(leadingIcon, size === 'sm' ? 14 : 16)}
          </span>
        )}
        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldDescribedBy(selectId, hint, error)}
          onChange={(e) => {
            onChange?.(e);
            onValueChange?.(e.target.value);
          }}
          className={cn(
            FIELD_BASE,
            FIELD_SIZE[size],
            FIELD_STATE[error ? 'error' : 'normal'],
            leadingIcon != null ? pad.icon : pad.plain,
            pad.trail,
            'cursor-pointer appearance-none [&>option]:bg-ink-800 [&>option]:text-fg',
            className
          )}
          {...props}
        >
          {placeholder != null && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options?.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
          {children}
        </select>
        <ChevronDown
          size={size === 'sm' ? 14 : 16}
          strokeWidth={1.75}
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-subtle"
        />
      </div>
    </FieldShell>
  );
});
