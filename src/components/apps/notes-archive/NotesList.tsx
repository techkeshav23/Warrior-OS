// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Notes List (middle pane)
// Title · date · two-line snippet · tags. Row actions (pin, delete) are
// siblings of the row button, never nested inside it.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, type ReactNode } from 'react';
import { Pin, PinOff, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui';
import { cn } from '@/lib/utils';
import { plainSnippet } from './markdown';
import type { Note } from './NotesApp';

interface Props {
  notes: Note[];
  activeNoteId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin?: (id: string) => void;
  /** Shown when `notes` is empty. */
  empty?: ReactNode;
}

/** Compact, locale-aware "when": time today, Yesterday, weekday, then date. */
export function shortWhen(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = (t: Date) => new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  const today = new Date(now);
  const days = Math.round((day(today) - day(d)) / 86_400_000);
  if (days <= 0) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
  if (d.getFullYear() === today.getFullYear()) return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function NoteRow({
  note,
  active,
  onSelect,
  onDelete,
  onTogglePin,
}: {
  note: Note;
  active: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin?: (id: string) => void;
}) {
  const title = note.title.trim() || 'Untitled';
  const snippet = useMemo(() => plainSnippet(note.content, note.title, 140), [note.content, note.title]);
  const when = shortWhen(note.updatedAt);

  return (
    <li className="group/note relative">
      <button
        type="button"
        onClick={() => onSelect(note.id)}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'chamfer-sm focus-ring-inset relative flex w-full min-w-0 flex-col gap-1 px-3 py-2.5 text-left',
          'transition-[background-color,box-shadow] duration-120 ease-out-quint',
          active
            ? 'bg-linear-to-r from-accent/[0.14] to-accent/[0.04] shadow-[inset_0_1px_0_rgb(255_255_255/0.06),inset_0_-1px_0_color-mix(in_oklab,var(--accent)_55%,transparent)]'
            : 'hover:bg-surface-hover active:bg-surface-active'
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-2 left-0 w-[3px] bg-accent shadow-[0_0_8px_var(--accent)] transition-opacity duration-180 [clip-path:polygon(0_0,100%_3px,100%_calc(100%-3px),0_100%)]',
            active ? 'opacity-100' : 'opacity-0'
          )}
        />
        <span className="flex min-w-0 items-center gap-1.5">
          {note.pinned && <Pin size={12} strokeWidth={2} className="shrink-0 rotate-45 text-accent" aria-label="Pinned" />}
          <span className={cn('min-w-0 flex-1 truncate text-ui font-medium', active ? 'text-fg' : 'text-fg')} title={title}>
            {title}
          </span>
          <span
            className={cn(
              'tabular shrink-0 font-mono text-2xs transition-opacity duration-120',
              active ? 'text-accent/80' : 'text-fg-subtle',
              'group-focus-within/note:opacity-0 group-hover/note:opacity-0'
            )}
          >
            {when}
          </span>
        </span>
        <span className={cn('line-clamp-2 text-xs leading-[18px]', snippet ? 'text-fg-subtle' : 'italic text-fg-faint')}>
          {snippet || 'Empty note'}
        </span>
        {note.tags.length > 0 && (
          <span className="mt-0.5 flex min-w-0 gap-2 overflow-hidden font-mono text-2xs text-fg-subtle">
            {note.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="truncate">
                <span className="text-accent/60">#</span>
                {tag}
              </span>
            ))}
            {note.tags.length > 3 && <span className="shrink-0">+{note.tags.length - 3}</span>}
          </span>
        )}
      </button>

      {/* Row actions: siblings of the row button (no nested buttons) */}
      <div
        className={cn(
          'absolute right-1.5 top-1.5 flex items-center gap-0.5',
          'opacity-0 transition-opacity duration-120 group-focus-within/note:opacity-100 group-hover/note:opacity-100'
        )}
      >
        {onTogglePin && (
          <IconButton
            icon={note.pinned ? PinOff : Pin}
            aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
            size="xs"
            tooltip
            onClick={() => onTogglePin(note.id)}
          />
        )}
        <IconButton icon={Trash2} aria-label="Delete note" variant="ghost-danger" size="xs" tooltip onClick={() => onDelete(note.id)} />
      </div>
    </li>
  );
}

function NotesListInner({ notes, activeNoteId, onSelect, onDelete, onTogglePin, empty }: Props) {
  if (notes.length === 0) {
    return <div className="flex min-h-0 flex-1 flex-col justify-center">{empty}</div>;
  }
  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <ul className="flex flex-col gap-0.5 p-2" aria-label="Notes">
        {notes.map((note) => (
          <NoteRow
            key={note.id}
            note={note}
            active={activeNoteId === note.id}
            onSelect={onSelect}
            onDelete={onDelete}
            onTogglePin={onTogglePin}
          />
        ))}
      </ul>
    </div>
  );
}

export const NotesList = memo(NotesListInner);
