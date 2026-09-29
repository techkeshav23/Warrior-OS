// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Notes Archive App
// Markdown notes with wiki-links, search, pins and persistence.
// Three panes: collections (library + tags) · note list · editor.
// The window's width decides the layout: 3 panes ≥ 740px, list + editor
// ≥ 520px (collections move into a menu), one pane below that.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useMemo, useCallback, useLayoutEffect, useRef, memo, type RefObject } from 'react';
import { ChevronDown, Clock, FileText, Hash, Library, NotebookPen, Pin, Plus, Search } from 'lucide-react';
import {
  AppLayout,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Menu,
  SidebarNav,
  type MenuItem,
  type NavSection,
} from '@/components/ui';
import { usePendingEventListener } from '@/components/achievements/pending-events';
import { cn } from '@/lib/utils';
import { NotesList } from './NotesList';
import { MarkdownEditor, type EditorMode } from './MarkdownEditor';
import { SearchPanel } from './SearchPanel';
import { wikiTargets } from './markdown';
import { rewardNoteCreated } from './note-rewards';
import { NOTES_APP_IDS, NOTES_SEARCH_EVENT, parseNotesSearch } from './deep-link';

/** A search opened from outside (NEXUS deep link); nonce remounts the panel. */
interface SearchRequest {
  query: string;
  nonce: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  /** Pinned notes sit at the top of every collection. */
  pinned?: boolean;
}

function loadNotes(): Note[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('warrior-notes') || '[]');
  } catch { return []; }
}

function saveNotes(notes: Note[]) {
  localStorage.setItem('warrior-notes', JSON.stringify(notes));
}

// ─── Collections ─────────────────────────────────────────

type CollectionId = 'all' | 'pinned' | 'recent' | `tag:${string}`;

const RECENT_DAYS = 7;
const RECENT_MS = RECENT_DAYS * 86_400_000;

function isRecent(note: Note, now: number): boolean {
  const t = Date.parse(note.updatedAt);
  return Number.isFinite(t) && now - t < RECENT_MS;
}

function inCollection(note: Note, collection: CollectionId, now: number): boolean {
  if (collection === 'all') return true;
  if (collection === 'pinned') return !!note.pinned;
  if (collection === 'recent') return isRecent(note, now);
  return note.tags.includes(collection.slice(4));
}

/** Pinned first; otherwise the stored order (newest first). */
function ordered(notes: Note[]): Note[] {
  return [...notes.filter((n) => n.pinned), ...notes.filter((n) => !n.pinned)];
}

function collectionLabel(collection: CollectionId): string {
  if (collection === 'all') return 'All notes';
  if (collection === 'pinned') return 'Pinned';
  if (collection === 'recent') return 'Recent';
  return `#${collection.slice(4)}`;
}

// ─── Layout ──────────────────────────────────────────────

type Layout = 'three' | 'two' | 'one';

function useLayoutMode(): [RefObject<HTMLDivElement | null>, Layout] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.offsetWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const layout: Layout = width === 0 || width >= 740 ? 'three' : width >= 520 ? 'two' : 'one';
  return [ref, layout];
}

function NotesAppInner() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  // Open on the top note of the list, like any notes app.
  const [activeNoteId, setActiveNoteId] = useState<string | null>(() => ordered(notes)[0]?.id ?? null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchRequest, setSearchRequest] = useState<SearchRequest | null>(null);
  const [collection, setCollection] = useState<CollectionId>('all');
  const [mode, setMode] = useState<EditorMode>('split');
  const [freshNoteId, setFreshNoteId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const [rootRef, layout] = useLayoutMode();

  // 'warrior:notes-search' (e.g. from NEXUS): open search pre-filled with the query.
  usePendingEventListener({
    eventName: NOTES_SEARCH_EVENT,
    parse: parseNotesSearch,
    appIds: NOTES_APP_IDS,
    onEvent: ({ query }) => {
      setSearchRequest((prev) => ({ query, nonce: (prev?.nonce ?? 0) + 1 }));
      setShowSearch(true);
    },
  });

  const activeNote = notes.find((n) => n.id === activeNoteId) || null;

  // ─── Derived collections ───
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of notes) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [notes]);

  // A tag collection whose last note lost the tag falls back to All.
  const current: CollectionId =
    collection.startsWith('tag:') && !tagCounts.some(([t]) => `tag:${t}` === collection) ? 'all' : collection;

  const visible = useMemo(
    () => ordered(notes.filter((n) => inCollection(n, current, now))),
    [notes, current, now]
  );

  const knownTitles = useMemo(() => new Set(notes.map((n) => n.title.trim().toLowerCase())), [notes]);

  const backlinks = useMemo(() => {
    if (!activeNote) return [];
    const title = activeNote.title.trim().toLowerCase();
    if (!title) return [];
    return notes
      .filter((n) => n.id !== activeNote.id && wikiTargets(n.content).includes(title))
      .map((n) => ({ id: n.id, title: n.title }));
  }, [notes, activeNote]);

  const totalWords = useMemo(
    () => notes.reduce((sum, n) => sum + n.content.split(/\s+/).filter(Boolean).length, 0),
    [notes]
  );
  const pinnedCount = notes.filter((n) => n.pinned).length;
  const recentCount = notes.filter((n) => isRecent(n, now)).length;

  const closeSearch = () => {
    setShowSearch(false);
    setSearchRequest(null);
  };

  /** Select a note, switching to All when the current collection hides it. */
  const reveal = useCallback(
    (note: Note) => {
      setActiveNoteId(note.id);
      if (!inCollection(note, current, Date.now())) setCollection('all');
    },
    [current]
  );

  const createNote = () => {
    const note: Note = {
      id: `note-${Date.now()}`,
      title: 'Untitled Note',
      content: '',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [note, ...notes];
    setNotes(updated);
    saveNotes(updated);
    setActiveNoteId(note.id);
    setFreshNoteId(note.id);
    if (current === 'pinned' || current.startsWith('tag:')) setCollection('all');
    closeSearch();
    rewardNoteCreated();
  };

  const updateNote = (id: string, changes: Partial<Note>) => {
    const updated = notes.map((n) =>
      n.id === id ? { ...n, ...changes, updatedAt: new Date().toISOString() } : n
    );
    setNotes(updated);
    saveNotes(updated);
  };

  /** Pinning is an arrangement, not an edit: updatedAt stays. */
  const togglePin = (id: string) => {
    const updated = notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n));
    setNotes(updated);
    saveNotes(updated);
  };

  const deleteNote = (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    saveNotes(updated);
    if (activeNoteId === id) {
      // Land on the neighbour in the list (single pane: back to the list).
      const index = visible.findIndex((n) => n.id === id);
      const rest = visible.filter((n) => n.id !== id);
      const next = layout === 'one' ? null : (rest[Math.min(Math.max(index, 0), rest.length - 1)] ?? null);
      setActiveNoteId(next?.id ?? null);
    }
  };

  const navigateToNote = (title: string) => {
    const target = notes.find(
      (n) => n.title.toLowerCase() === title.toLowerCase()
    );
    if (target) {
      reveal(target);
    } else {
      // Create new note with that title
      const note: Note = {
        id: `note-${Date.now()}`,
        title,
        content: '',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updated = [note, ...notes];
      setNotes(updated);
      saveNotes(updated);
      setActiveNoteId(note.id);
      if (current === 'pinned' || current.startsWith('tag:')) setCollection('all');
      rewardNoteCreated();
    }
  };

  const openById = (id: string) => {
    const note = notes.find((n) => n.id === id);
    if (note) reveal(note);
  };

  const pendingDelete = notes.find((n) => n.id === pendingDeleteId) ?? null;

  // ─── Collections nav ───
  const sections: NavSection[] = [
    {
      label: 'Library',
      items: [
        { id: 'all', label: 'All notes', icon: Library, count: notes.length },
        { id: 'pinned', label: 'Pinned', icon: Pin, count: pinnedCount },
        { id: 'recent', label: 'Recent', icon: Clock, count: recentCount },
      ],
    },
    ...(tagCounts.length > 0
      ? [
          {
            label: 'Tags',
            items: tagCounts.map(([tag, count]) => ({ id: `tag:${tag}`, label: tag, icon: Hash, count })),
          },
        ]
      : []),
  ];

  const collectionMenu: MenuItem[] = [
    ...sections[0].items.map((item) => ({
      id: item.id,
      label: item.label,
      icon: item.icon,
      checked: current === item.id,
    })),
    ...(tagCounts.length > 0
      ? [
          { id: 'tags-sep', divider: true },
          { id: 'tags-heading', heading: true, label: 'Tags' },
          ...tagCounts.map(([tag]) => ({ id: `tag:${tag}`, label: tag, icon: Hash, checked: current === `tag:${tag}` })),
        ]
      : []),
  ];

  const pickCollection = (id: string) => {
    setCollection(id as CollectionId);
    closeSearch();
  };

  // ─── Panes ───
  const listEmpty = (() => {
    if (notes.length === 0) {
      return <EmptyState size="sm" grid={false} icon={NotebookPen} title="No notes yet" description="New notes appear here." />;
    }
    if (current === 'pinned') {
      return <EmptyState size="sm" grid={false} icon={Pin} title="Nothing pinned" description="Pin a note to keep it on top." />;
    }
    if (current === 'recent') {
      return (
        <EmptyState size="sm" grid={false} icon={Clock} title="Nothing recent" description={`Notes edited in the last ${RECENT_DAYS} days show up here.`} />
      );
    }
    return <EmptyState size="sm" grid={false} icon={Hash} title="No notes here" description="Nothing carries this tag yet." />;
  })();

  const listPane = (
    <section
      aria-label="Note list"
      className={cn(
        'flex min-h-0 shrink-0 flex-col',
        layout === 'one' ? 'w-full' : 'border-r border-line bg-ink-950/20',
        layout === 'three' && 'w-58',
        layout === 'two' && 'w-60'
      )}
    >
      {showSearch ? (
        <SearchPanel
          key={searchRequest?.nonce ?? 0}
          initialQuery={searchRequest?.query ?? ''}
          notes={notes}
          onClose={closeSearch}
          onSelect={(id) => {
            openById(id);
            closeSearch();
          }}
        />
      ) : (
        <>
          <div className={cn('flex h-10 shrink-0 items-center gap-1 border-b border-line pr-1.5', layout === 'three' ? 'pl-4' : 'pl-1.5')}>
            {layout === 'three' ? (
              <h2 className="min-w-0 truncate text-ui font-semibold text-fg" title={collectionLabel(current)}>
                {collectionLabel(current)}
              </h2>
            ) : (
              <Menu
                aria-label="Collections"
                width={200}
                trigger={
                  <Button variant="ghost" size="sm" trailingIcon={ChevronDown} className="max-w-40">
                    {collectionLabel(current)}
                  </Button>
                }
                items={collectionMenu}
                onSelect={pickCollection}
              />
            )}
            <span className="tabular shrink-0 font-mono text-2xs text-fg-subtle" aria-label={`${visible.length} notes`}>
              {visible.length}
            </span>
            <span className="flex-1" />
            <IconButton icon={Search} aria-label="Search notes" size="sm" tooltip tooltipSide="bottom" onClick={() => setShowSearch(true)} />
            {layout !== 'three' && (
              <IconButton icon={Plus} aria-label="New note" size="sm" variant="primary" tooltip tooltipSide="bottom" onClick={createNote} />
            )}
          </div>
          <NotesList
            notes={visible}
            activeNoteId={activeNoteId}
            onSelect={setActiveNoteId}
            onDelete={setPendingDeleteId}
            onTogglePin={togglePin}
            empty={listEmpty}
          />
        </>
      )}
    </section>
  );

  const editorPane = (
    <section aria-label="Editor" className="flex min-h-0 min-w-0 flex-1 flex-col">
      {activeNote ? (
        <div key={activeNote.id} className="h-full min-h-0 animate-fade-in">
          <MarkdownEditor
            note={activeNote}
            onUpdate={(changes) => updateNote(activeNote.id, changes)}
            onNavigate={navigateToNote}
            mode={mode}
            onModeChange={setMode}
            knownTitles={knownTitles}
            backlinks={backlinks}
            onOpenNote={openById}
            onTogglePin={() => togglePin(activeNote.id)}
            onDelete={() => setPendingDeleteId(activeNote.id)}
            onBack={layout === 'one' ? () => setActiveNoteId(null) : undefined}
            autoFocusTitle={freshNoteId === activeNote.id}
            onAutoFocused={() => setFreshNoteId(null)}
          />
        </div>
      ) : notes.length === 0 ? (
        <EmptyState
          size="lg"
          tone="accent"
          icon={NotebookPen}
          title="Start your archive"
          description="Markdown notes with [[wiki-links]], tags and pins. Everything saves as you type."
          className="h-full"
          actions={
            <Button variant={layout === 'three' ? 'secondary' : 'primary'} leadingIcon={Plus} onClick={createNote}>
              New note
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={FileText}
          title="No note selected"
          description="Pick a note from the list, or start a new one."
          className="h-full"
          actions={
            <Button leadingIcon={Plus} onClick={createNote}>
              New note
            </Button>
          }
        />
      )}
    </section>
  );

  const sidebar =
    layout === 'three' ? (
      <SidebarNav
        aria-label="Collections"
        value={current}
        onChange={pickCollection}
        sections={sections}
        header={
          <div className="-mx-1 pt-0.5">
            <Button variant="primary" fullWidth leadingIcon={Plus} onClick={createNote}>
              New note
            </Button>
          </div>
        }
        footer={
          <p className="hud-label tabular truncate px-1">
            {notes.length} {notes.length === 1 ? 'note' : 'notes'} · {totalWords.toLocaleString()} words
          </p>
        }
      />
    ) : undefined;

  return (
    <div ref={rootRef} className="h-full min-h-0">
      <AppLayout sidebar={sidebar} sidebarWidth={200} padded={false} scroll={false}>
        <div className="flex min-h-0 flex-1">
          {layout === 'one' ? (activeNote && !showSearch ? editorPane : listPane) : (
            <>
              {listPane}
              {editorPane}
            </>
          )}
        </div>
      </AppLayout>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) deleteNote(pendingDeleteId);
          setPendingDeleteId(null);
        }}
        title="Delete this note?"
        description={
          pendingDelete
            ? `“${pendingDelete.title.trim() || 'Untitled'}” will be permanently deleted. This can’t be undone.`
            : undefined
        }
        confirmLabel="Delete note"
      />
    </div>
  );
}

export const NotesApp = memo(NotesAppInner);
