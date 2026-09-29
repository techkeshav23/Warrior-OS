// ═══════════════════════════════════════════════════════════
// WARRIOR OS — SegmentedControl (FORGED ARMOR kit)
// 2–5 mutually exclusive options in one sunk steel slot; the chosen plate is raised with a heated edge (view modes, ranges).
// Arrow keys move the selection (radiogroup pattern).
//   <SegmentedControl aria-label="Range" value={range} onChange={setRange}
//     options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
// ═══════════════════════════════════════════════════════════

'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { renderIcon, type IconLike } from './icon';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label?: ReactNode;
  icon?: IconLike;
  /** Accessible name for icon-only segments. */
  'aria-label'?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  /** sm 28 · md 32 */
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  'aria-label'?: string;
  className?: string;
}

/** Inset segmented picker. */
export function SegmentedControl<T extends string = string>({
  value,
  onChange,
  options,
  size = 'md',
  fullWidth = false,
  className,
  ...aria
}: SegmentedControlProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const enabled = options.filter((o) => !o.disabled);
    const i = enabled.findIndex((o) => o.value === value);
    const next = enabled[(i + delta + enabled.length) % enabled.length];
    if (!next) return;
    onChange(next.value);
    const idx = options.indexOf(next);
    (listRef.current?.children[idx] as HTMLElement | undefined)?.focus();
  };

  return (
    <div
      ref={listRef}
      role="radiogroup"
      aria-label={aria['aria-label']}
      onKeyDown={move}
      className={cn(
        'inline-flex items-stretch gap-0.5 chamfer [--cut:6px] bg-linear-to-b from-[#05070a] to-[#10141a] p-0.5 shadow-[inset_0_1px_0_rgb(0_0_0/0.8),inset_0_2px_5px_rgb(0_0_0/0.45),inset_0_-1px_0_rgb(255_255_255/0.08)]',
        size === 'sm' ? 'h-7' : 'h-8',
        fullWidth && 'flex w-full',
        className
      )}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={o['aria-label']}
            tabIndex={selected ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'focus-ring-inset relative inline-flex min-w-0 items-center justify-center gap-1.5 chamfer [--cut:4px] font-display font-semibold uppercase tracking-[0.08em]',
              'transition-[background-color,color,box-shadow] duration-120 ease-out-quint disabled:opacity-40',
              size === 'sm' ? 'px-2 text-[11px]' : 'px-3 text-xs',
              fullWidth && 'flex-1',
              selected
                ? 'bg-linear-to-b from-[#343c47] to-[#1b2027] text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.16),inset_0_-2px_0_var(--color-ember-400,#ff8a3d)]'
                : 'text-fg-subtle hover:bg-white/[0.04] hover:text-fg'
            )}
          >
            {renderIcon(o.icon, size === 'sm' ? 14 : 16, selected ? 'text-ember-400' : undefined)}
            {o.label != null && <span className="truncate">{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
