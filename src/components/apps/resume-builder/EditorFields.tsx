// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Resume Editor Fields
// Kit-backed labelled inputs, entry wells with reorder/remove,
// and the dashed "add" row used by every repeatable section.
// ═══════════════════════════════════════════════════════════

'use client';

import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, IconButton, Input, Textarea, type IconLike, type Tone } from '@/components/ui';
import { ConfirmButton } from '@/components/apps/project-forge/ConfirmButton';

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
  return (
    <div className={cn('min-w-0', className)}>
      <Input
        label={label}
        type={type}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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
  return (
    <div className={cn('min-w-0', className)}>
      <Textarea
        label={label}
        value={value}
        rows={rows}
        maxLength={4000}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        hint={hint}
      />
    </div>
  );
}

interface EntryCardProps {
  title: string;
  badge?: string;
  badgeTone?: Tone;
  badgeIcon?: IconLike;
  index: number;
  count: number;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  children: ReactNode;
}

/** One repeatable entry: an unbordered well inside its section card. */
export function EntryCard({
  title,
  badge,
  badgeTone = 'neutral',
  badgeIcon,
  index,
  count,
  onMove,
  onRemove,
  children,
}: EntryCardProps) {
  return (
    <div className="rounded-card bg-ink-950/45 inset-shadow-[0_1px_0_var(--color-surface-2)]">
      <div className="flex h-10 items-center gap-2 pl-3 pr-1.5">
        <span className="tabular font-mono text-2xs text-fg-subtle">{String(index + 1).padStart(2, '0')}</span>
        <p className="min-w-0 flex-1 truncate text-ui font-medium text-fg" title={title}>
          {title}
        </p>
        {badge && (
          <Badge size="sm" tone={badgeTone} icon={badgeIcon}>
            {badge}
          </Badge>
        )}
        <span className="flex items-center">
          <IconButton icon={ArrowUp} size="xs" aria-label="Move up" title="Move up" disabled={index === 0} onClick={() => onMove(-1)} />
          <IconButton
            icon={ArrowDown}
            size="xs"
            aria-label="Move down"
            title="Move down"
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          />
          <ConfirmButton label="Remove entry" icon={Trash2} size="xs" onConfirm={onRemove} armedChildren="Remove?" />
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 px-3 pb-3.5 pt-1">{children}</div>
    </div>
  );
}

/** Dashed "add another" row. */
export function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'focus-ring flex h-8 w-full items-center justify-center gap-1.5 rounded-control border border-dashed border-line-strong',
        'text-ui font-medium text-fg-muted transition-[background-color,border-color,color] duration-120 ease-out-quint',
        'hover:border-accent/45 hover:bg-accent/[0.05] hover:text-accent active:bg-accent/10'
      )}
    >
      <Plus size={16} strokeWidth={1.75} aria-hidden />
      {children}
    </button>
  );
}
