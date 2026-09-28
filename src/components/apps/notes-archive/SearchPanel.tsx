// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Search Panel for Notes
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useMemo, memo } from 'react';
import type { Note } from './NotesApp';

interface Props {
  notes: Note[];
  onSelect: (id: string) => void;
}

function SearchPanelInner({ notes, onSelect }: Props) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return notes
      .filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.includes(q))
      )
      .slice(0, 20);
  }, [query, notes]);

  return (
    <div className="border-b border-white/10 p-2 space-y-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search notes..."
        autoFocus
        className="w-full p-2 bg-white/5 border border-white/10 rounded text-xs text-white outline-none focus:border-amber-500/50"
      />
      {results.length > 0 && (
        <div className="max-h-40 overflow-y-auto space-y-1">
          {results.map((note) => (
            <button
              key={note.id}
              onClick={() => onSelect(note.id)}
              className="w-full text-left p-2 rounded hover:bg-white/5 transition-all"
            >
              <p className="text-xs text-white/80 truncate">{note.title}</p>
              <p className="text-[10px] text-white/30 truncate">
                {note.content.slice(0, 60)}
              </p>
            </button>
          ))}
        </div>
      )}
      {query && results.length === 0 && (
        <p className="text-[10px] text-white/30 text-center py-2">No results</p>
      )}
    </div>
  );
}

export const SearchPanel = memo(SearchPanelInner);
