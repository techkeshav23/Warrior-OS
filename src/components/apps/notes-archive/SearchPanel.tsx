// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Search Panel for Notes
// Full-text search over title, content and tags with highlights.
// Replaces the list pane while open: Esc clears, Esc again closes,
// Enter opens the top result.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useMemo, memo } from 'react';
import { Search, SearchX } from 'lucide-react';
import { Button, EmptyState, SearchField } from '@/components/ui';
import { plainText } from './markdown';
import type { Note } from './NotesApp';

interface Props {
  notes: Note[];
  onSelect: (id: string) => void;
  /** Query to start with, e.g. from a NEXUS deep link. */
  initialQuery?: string;
  /** Close the panel (Cancel button, or Esc on an empty field). */
  onClose?: () => void;
}

const SNIPPET_RADIUS = 36;

interface Snippet {
  before: string;
  match: string;
  after: string;
}

/** Text around the first case-insensitive match of `q`, or null when absent. */
function snippetAround(text: string, q: string): Snippet | null {
  const index = text.toLowerCase().indexOf(q);
  if (index === -1) return null;
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(text.length, index + q.length + SNIPPET_RADIUS);
  return {
    before: (start > 0 ? '…' : '') + text.slice(start, index),
    match: text.slice(index, index + q.length),
    after: text.slice(index + q.length, end) + (end < text.length ? '…' : ''),
  };
}

function Highlighted({ snippet }: { snippet: Snippet }) {
  return (
    <>
      {snippet.before}
      <mark className="bg-accent/20 px-0.5 text-fg shadow-[inset_0_-1px_0_var(--accent)]">{snippet.match}</mark>
      {snippet.after}
    </>
  );
}

function SearchPanelInner({ notes, onSelect, initialQuery = '', onClose }: Props) {
  const [query, setQuery] = useState(initialQuery);

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) return [];
    return notes
      .filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      )
      .slice(0, 20);
  }, [q, notes]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" role="search">
      <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-line pl-2 pr-1.5">
        <SearchField
          value={query}
          onValueChange={setQuery}
          placeholder="Search notes"
          size="sm"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !query) {
              e.stopPropagation();
              onClose?.();
            } else if (e.key === 'Enter' && results[0]) {
              onSelect(results[0].id);
            }
          }}
        />
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        )}
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {!q && (
          <EmptyState
            size="sm"
            grid={false}
            icon={Search}
            title="Search your notes"
            description="Matches titles, text and #tags."
            className="py-10"
          />
        )}

        {q && results.length === 0 && (
          <EmptyState
            size="sm"
            grid={false}
            icon={SearchX}
            title="No matches"
            description={`Nothing contains “${query.trim()}”.`}
            className="py-10"
          />
        )}

        {results.length > 0 && (
          <div className="p-2">
            <p className="hud-label px-2 pb-1.5 pt-1" aria-live="polite">
              {results.length === 20 ? '20+ results' : `${results.length} ${results.length === 1 ? 'result' : 'results'}`}
            </p>
            <ul className="flex flex-col gap-0.5">
              {results.map((note) => {
                const titleHit = snippetAround(note.title, q);
                const contentHit = snippetAround(plainText(note.content), q) ?? snippetAround(note.content, q);
                return (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(note.id)}
                      className="chamfer-sm focus-ring-inset flex w-full min-w-0 flex-col gap-0.5 px-3 py-2 text-left transition-colors duration-120 ease-out-quint hover:bg-surface-hover active:bg-surface-active"
                    >
                      <span className="truncate text-ui font-medium text-fg">
                        {titleHit ? <Highlighted snippet={titleHit} /> : note.title || 'Untitled'}
                      </span>
                      <span className="line-clamp-2 text-xs leading-[18px] text-fg-subtle">
                        {contentHit ? (
                          <Highlighted snippet={contentHit} />
                        ) : note.tags.length > 0 ? (
                          <span className="font-mono">{note.tags.map((t) => `#${t}`).join(' ')}</span>
                        ) : (
                          plainText(note.content).slice(0, 80)
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export const SearchPanel = memo(SearchPanelInner);
