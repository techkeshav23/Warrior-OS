// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Field shell (FORGED ARMOR kit)
// Label + control + hint/error line shared by Input, Textarea, Select,
// SearchField and Slider. Wires aria-describedby / aria-invalid.
// Width: fields fill their container by default. Narrow one with a
// width class on the wrapper (wrapperClassName="w-48" replaces the
// default w-full) or size it to its content with fullWidth={false}.
// ═══════════════════════════════════════════════════════════

'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type FieldSize = 'sm' | 'md' | 'lg';

/** Control surface shared by every text-like field. */
export const FIELD_BASE =
  'w-full min-w-0 chamfer [--cut:6px] border-0 text-fg placeholder:text-fg-faint caret-ember-400 ' +
  'outline-none transition-[box-shadow,background-color] duration-120 ease-out-quint ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

// Recessed steel slot; focus heats the bottom + side lips to ember (ember-edge).
const SLOT =
  'bg-linear-to-b from-[#06080b] to-[#0f1318] ' +
  'shadow-[inset_0_1px_0_rgb(0_0_0/0.8),inset_0_2px_6px_rgb(0_0_0/0.5),inset_0_-1px_0_rgb(255_255_255/0.09),inset_1px_0_0_rgb(0_0_0/0.4),inset_-1px_0_0_rgb(255_255_255/0.04)]';

export const FIELD_STATE = {
  normal:
    SLOT +
    ' hover:shadow-[inset_0_1px_0_rgb(0_0_0/0.8),inset_0_2px_6px_rgb(0_0_0/0.5),inset_0_-1px_0_rgb(255_255_255/0.16),inset_1px_0_0_rgb(0_0_0/0.4),inset_-1px_0_0_rgb(255_255_255/0.06)]' +
    ' focus:shadow-[inset_0_1px_0_rgb(0_0_0/0.8),inset_0_2px_6px_rgb(0_0_0/0.5),inset_0_-2px_0_var(--color-ember-400,#ff8a3d),inset_1px_0_0_color-mix(in_srgb,var(--color-ember-500,#f76b15)_45%,transparent),inset_-1px_0_0_color-mix(in_srgb,var(--color-ember-500,#f76b15)_45%,transparent)]' +
    ' focus:from-[#0b0806] focus:to-[#16100b]',
  error:
    SLOT +
    ' shadow-[inset_0_1px_0_rgb(0_0_0/0.8),inset_0_2px_6px_rgb(0_0_0/0.5),inset_0_-2px_0_var(--color-danger,#ff5470),inset_1px_0_0_color-mix(in_srgb,var(--color-danger,#ff5470)_40%,transparent),inset_-1px_0_0_color-mix(in_srgb,var(--color-danger,#ff5470)_40%,transparent)]',
  ghost:
    'bg-transparent hover:bg-white/[0.04] focus:bg-[#07090c] focus:shadow-[inset_0_-2px_0_var(--color-ember-400,#ff8a3d)]',
} as const;

export const FIELD_SIZE: Record<FieldSize, string> = {
  sm: 'h-7 text-xs',
  md: 'h-8 text-ui',
  lg: 'h-10 text-sm',
};

/** Horizontal padding with/without a leading icon, per size. */
export const FIELD_PAD: Record<FieldSize, { plain: string; icon: string; trail: string }> = {
  sm: { plain: 'px-2.5', icon: 'pl-7 pr-2.5', trail: 'pr-8' },
  md: { plain: 'px-3', icon: 'pl-8.5 pr-3', trail: 'pr-9' },
  lg: { plain: 'px-3.5', icon: 'pl-10 pr-3.5', trail: 'pr-10' },
};

export const FIELD_ICON_POS: Record<FieldSize, string> = {
  sm: 'left-2',
  md: 'left-2.5',
  lg: 'left-3',
};

export interface FieldShellProps {
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Right side of the label row (e.g. a counter or "Optional"). */
  labelAside?: ReactNode;
  required?: boolean;
  /**
   * true (default): fill the container. false: shrink to the control's
   * content width (a Select as wide as its longest option). A width
   * class in `className` (w-48, w-[220px], w-auto…) wins over both.
   */
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

/** An unprefixed width utility (w-48, w-[220px], !w-full…) in a class list. */
const WIDTH_CLASS = /(?:^|\s)!?w-\S+/;

/** Wrapper width: the caller's own width class, else full or content width. */
export function fieldWidthClass(className?: string, fullWidth = true): string | undefined {
  if (className && WIDTH_CLASS.test(className)) return undefined;
  return fullWidth ? 'w-full' : 'w-fit max-w-full';
}

/** ids for the hint/error lines, for aria-describedby. */
export function fieldDescribedBy(id: string, hint?: ReactNode, error?: ReactNode): string | undefined {
  const ids = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

/** Label / control / message layout for form fields. */
export function FieldShell({
  id,
  label,
  hint,
  error,
  labelAside,
  required,
  fullWidth = true,
  className,
  children,
}: FieldShellProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', fieldWidthClass(className, fullWidth), className)}>
      {(label || labelAside) && (
        <div className="flex items-baseline justify-between gap-3">
          {label && (
            <label htmlFor={id} className="engraved font-display text-2xs font-semibold uppercase tracking-[0.16em] text-fg-muted">
              {label}
              {required && (
                <span className="ml-0.5 text-danger" aria-hidden>
                  *
                </span>
              )}
            </label>
          )}
          {labelAside && <span className="text-xs text-fg-subtle tabular">{labelAside}</span>}
        </div>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
