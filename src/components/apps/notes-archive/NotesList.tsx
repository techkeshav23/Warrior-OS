// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Notes List Sidebar
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { Note } from './NotesApp';

interface Props {
  notes: Note[];
  activeNoteId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function NotesListInner({ notes, activeNoteId, onSelect, onDelete }: Props) {
  return (
    <div className="flex-1 overflow-y-auto">
      {notes.length === 0 && (
        <p className="text-xs text-white/30 text-center mt-8 px-4">
          No notes yet. Click + to create one.
        </p>
      )}
      {notes.map((note) => (
        <button
          key={note.id}
          onClick={() => onSelect(note.id)}
          className={cn(
            'w-full text-left p-3 border-b border-white/5 transition-all group',
            activeNoteId === note.id
              ? 'bg-amber-500/10'
              : 'hover:bg-white/5'
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-sm font-medium truncate',
                activeNoteId === note.id ? 'text-amber-300' : 'text-white/80'
              )}>
                {note.title || 'Untitled'}
              </p>
              <p className="text-[10px] text-white/30 truncate mt-0.5">
                {note.content.slice(0, 60) || 'Empty note'}
              </p>
              <p className="text-[10px] text-white/20 mt-0.5">
                {new Date(note.updatedAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(note.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 text-xs p-1"
              title="Delete"
            >
              ×
            </button>
          </div>
          {note.tags.length > 0 && (
            <div className="flex gap-1 mt-1">
              {note.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/30"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

export const NotesList = memo(NotesListInner);
