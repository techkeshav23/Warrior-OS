// ═══════════════════════════════════════════════════════════
// WARRIOR OS — SearchField (FORGE HUD kit)
// Search input with a leading glass icon, a clear button while it has
// text, an optional shortcut hint, and Escape-to-clear.
//   <SearchField value={q} onValueChange={setQ} placeholder="Search notes" shortcut="/" />
// ═══════════════════════════════════════════════════════════

'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FIELD_BASE, FIELD_ICON_POS, FIELD_PAD, FIELD_SIZE, FIELD_STATE, type FieldSize } from './Field';

export interface SearchFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'value' | 'onChange' | 'type'> {
  value: string;
  onValueChange: (value: string) => void;
  /** Called after the clear button / Escape empties the field. */
  onClear?: () => void;
  /** Shortcut hint shown while empty, e.g. "/" or "Ctrl K". */
  shortcut?: string;
  size?: FieldSize;
  wrapperClassName?: string;
}

/** Controlled search box. `aria-label` defaults to the placeholder or "Search". */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onValueChange, onClear, shortcut, size = 'md', className, wrapperClassName, placeholder = 'Search', onKeyDown, ...props },
  ref
) {
  const pad = FIELD_PAD[size];
  const clear = () => {
    onValueChange('');
    onClear?.();
  };
  return (
    <div className={cn('relative flex w-full min-w-0 items-center', wrapperClassName)}>
      <Search
        size={size === 'sm' ? 14 : 16}
        strokeWidth={1.75}
        aria-hidden
        className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2 text-fg-subtle', FIELD_ICON_POS[size])}
      />
      <input
        ref={ref}
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={props['aria-label'] ?? placeholder}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.stopPropagation();
            clear();
          }
          onKeyDown?.(e);
        }}
        className={cn(
          FIELD_BASE,
          FIELD_SIZE[size],
          FIELD_STATE.normal,
          pad.icon,
          pad.trail,
          '[&::-webkit-search-cancel-button]:appearance-none',
          className
        )}
        {...props}
      />
      <span className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={clear}
            className="focus-ring flex size-5 items-center justify-center rounded-[5px] text-fg-subtle transition-colors duration-120 hover:bg-surface-hover hover:text-fg"
          >
            <X size={14} strokeWidth={1.75} aria-hidden />
          </button>
        ) : shortcut ? (
          <kbd className="pointer-events-none rounded-[4px] border border-line-strong bg-ink-800 px-1.5 font-mono text-2xs leading-4 text-fg-subtle">
            {shortcut}
          </kbd>
        ) : null}
      </span>
    </div>
  );
});
