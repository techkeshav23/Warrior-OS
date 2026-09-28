// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Resume Editor Fields
// Labelled inputs, entry cards with reorder/remove, add buttons
// ═══════════════════════════════════════════════════════════

'use client';

import { useId, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmButton } from '@/components/apps/project-forge/ConfirmButton';

export const FIELD_INPUT =
  'w-full rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/90 outline-none transition-colors placeholder:text-white/30 focus:border-cyan-400/50 focus:bg-white/[0.06]';
export const FIELD_LABEL = 'text-[10px] font-semibold uppercase tracking-wider text-white/45';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel' | 'url';
  className?: string;
  maxLength?: number;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  className,
  maxLength = 200,
}: TextFieldProps) {
  const id = useId();
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={FIELD_INPUT}
      />
    </div>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  hint?: string;
  className?: string;
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  hint,
  className,
}: TextAreaFieldProps) {
  const id = useId();
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        rows={rows}
        maxLength={4000}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(FIELD_INPUT, 'resize-y leading-snug')}
      />
      {hint && <p className="text-[10px] text-white/35">{hint}</p>}
    </div>
  );
}

interface IconButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}

export function IconButton({ label, onClick, disabled, children }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded p-1 text-white/45 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-25"
    >
      {children}
    </button>
  );
}

interface EntryCardProps {
  title: string;
  badge?: string;
  index: number;
  count: number;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  children: ReactNode;
}

export function EntryCard({ title, badge, index, count, onMove, onRemove, children }: EntryCardProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03]">
      <div className="flex items-center gap-1 border-b border-white/5 py-1 pl-2.5 pr-1">
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-white/80">{title}</p>
        {badge && (
          <span className="rounded border border-cyan-400/30 bg-cyan-400/10 px-1.5 text-[9px] font-semibold uppercase tracking-wide text-cyan-200">
            {badge}
          </span>
        )}
        <IconButton label="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
          <ArrowUp className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton label="Move down" disabled={index === count - 1} onClick={() => onMove(1)}>
          <ArrowDown className="h-3.5 w-3.5" />
        </IconButton>
        <ConfirmButton
          label="Remove entry"
          onConfirm={onRemove}
          armedChildren="Remove?"
          className="rounded p-1 text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-300"
          armedClassName="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-200"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </ConfirmButton>
      </div>
      <div className="grid grid-cols-2 gap-2 p-2.5">{children}</div>
    </div>
  );
}

export function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 py-2 text-xs text-white/55 transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
    >
      <Plus className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}
