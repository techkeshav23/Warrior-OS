// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Input + Textarea (FORGE HUD kit)
// Hairline field on deep ink; accent border + soft ring on focus;
// danger border + message on error. Label/hint/error are optional.
//   <Input label="Deck name" placeholder="e.g. Operating Systems" />
//   <Input leadingIcon={Mail} error="Enter a valid email" />
//   <Input wrapperClassName="w-48" … />   narrower than its container
//   <Input fullWidth={false} … />         content width
// ═══════════════════════════════════════════════════════════

'use client';

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
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

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  /** Helper text under the field (hidden while `error` is shown). */
  hint?: ReactNode;
  /** Error message; also marks the field aria-invalid. */
  error?: ReactNode;
  /** Leading icon (legacy name). Prefer `leadingIcon`. */
  icon?: IconLike;
  leadingIcon?: IconLike;
  /** Content inside the right edge (unit, Kbd, clear button). */
  trailing?: ReactNode;
  /** 'ghost' = borderless until hover/focus (inline editing). */
  variant?: 'default' | 'ghost';
  /** sm 28 · md 32 · lg 40 */
  size?: FieldSize;
  /**
   * Class for the outer wrapper (label + field + message). A width class
   * here (w-48, w-[220px]) narrows the field.
   */
  wrapperClassName?: string;
  /** false: size to the content instead of filling the container. */
  fullWidth?: boolean;
}

/** Single-line text input. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    icon,
    leadingIcon,
    trailing,
    variant = 'default',
    size = 'md',
    className,
    wrapperClassName,
    fullWidth = true,
    id,
    required,
    ...props
  },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const lead = leadingIcon ?? icon;
  const pad = FIELD_PAD[size];

  return (
    <FieldShell
      id={inputId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      fullWidth={fullWidth}
      className={wrapperClassName}
    >
      <div className="relative flex items-center">
        {lead != null && (
          <span
            className={cn(
              'pointer-events-none absolute z-[1] top-1/2 flex -translate-y-1/2 text-fg-subtle',
              FIELD_ICON_POS[size]
            )}
          >
            {renderIcon(lead, size === 'lg' ? 18 : size === 'sm' ? 14 : 16)}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldDescribedBy(inputId, hint, error)}
          className={cn(
            FIELD_BASE,
            FIELD_SIZE[size],
            FIELD_STATE[error ? 'error' : variant === 'ghost' ? 'ghost' : 'normal'],
            lead != null ? pad.icon : pad.plain,
            trailing != null && pad.trail,
            className
          )}
          {...props}
        />
        {trailing != null && (
          <span className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1 text-fg-subtle">
            {trailing}
          </span>
        )}
      </div>
    </FieldShell>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Right side of the label row, e.g. "120 / 500". */
  labelAside?: ReactNode;
  variant?: 'default' | 'ghost';
  /** Allow vertical resize (default true). */
  resizable?: boolean;
  /** Class for the outer wrapper; a width class here narrows the field. */
  wrapperClassName?: string;
  /** false: size to the content (cols) instead of filling the container. */
  fullWidth?: boolean;
}

/** Multi-line text input. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    hint,
    error,
    labelAside,
    variant = 'default',
    resizable = true,
    className,
    wrapperClassName,
    fullWidth = true,
    id,
    required,
    rows = 4,
    ...props
  },
  ref
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      labelAside={labelAside}
      required={required}
      fullWidth={fullWidth}
      className={wrapperClassName}
    >
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(fieldId, hint, error)}
        className={cn(
          FIELD_BASE,
          FIELD_STATE[error ? 'error' : variant === 'ghost' ? 'ghost' : 'normal'],
          'scrollbar-thin min-h-16 px-3 py-2 text-ui leading-5',
          resizable ? 'resize-y' : 'resize-none',
          className
        )}
        {...props}
      />
    </FieldShell>
  );
});
