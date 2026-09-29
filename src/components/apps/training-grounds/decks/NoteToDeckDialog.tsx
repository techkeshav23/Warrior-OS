// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault: create a deck from a note
// Pick a note from the Notes Archive, preview the topics and cards
// the offline parser found, untick what you don't want, then forge.
// ═══════════════════════════════════════════════════════════

'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { Anvil, ArrowLeft, ChevronRight, FileSearch, FileText, NotebookPen, SearchX } from 'lucide-react';
import { Badge, Button, Checkbox, EmptyState, Input, SearchField } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useLearningStore } from '@/stores/useLearningStore';
import { DialogShell, SubmitButton } from './Dialog';
import { DECK_COLOR_CHOICES, LIMITS, mergeTags, plural } from './deck-ui';
import { loadNotes, parseNote, parsedNoteToDeckInput, stripInline, type NoteSource, type ParsedNote } from './note-to-deck';

interface NoteToDeckDialogProps {
  open?: boolean;
  onClose: () => void;
  onCreated: (deckId: string, cardCount: number) => void;
}

const PATTERNS: readonly { example: string; becomes: string }[] = [
  { example: '## Closures', becomes: 'a topic' },
  { example: 'Closure: a function that remembers its scope', becomes: 'a card (term → definition)' },
  { example: 'Q: What is a closure?  A: …', becomes: 'a card (question → answer)' },
  { example: 'What does useMemo cache?  (next line: the answer)', becomes: 'a card' },
  { example: 'Benefits of hooks:  + a bullet list', becomes: 'a card (lead-in → list)' },
  { example: '- Parent bullet  + nested bullets', becomes: 'a card (parent → children)' },
  { example: '| Term | Meaning |  tables', becomes: 'a card per row' },
];

function formatUpdated(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
}

/** First words of a note, without a leading heading that just repeats its title. */
function snippet(title: string, content: string): string {
  const [first = '', ...rest] = content.split('\n');
  const repeatsTitle = stripInline(first.replace(/^#+\s*/, '')).toLowerCase() === title.trim().toLowerCase();
  const body = repeatsTitle ? rest.join('\n') : content;
  return stripInline(body.replace(/^#+\s*/gm, '').replace(/[|>`]/g, ' ')).slice(0, 90);
}

export function NoteToDeckDialog({ open = true, onClose, onCreated }: NoteToDeckDialogProps) {
  const createDeck = useLearningStore((s) => s.createDeck);
  const deckCount = useLearningStore((s) => s.decks.length);
  const uid = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  // Read once when the dialog opens.
  const [notes] = useState<NoteSource[]>(() => loadNotes());
  const [query, setQuery] = useState('');
  const [note, setNote] = useState<NoteSource | null>(null);
  const [parsed, setParsed] = useState<ParsedNote | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📝');
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => new Map(notes.map((n) => [n.id, parseNote(n.title, n.content).cardCount])), [notes]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q)) ||
        n.content.toLowerCase().includes(q)
    );
  }, [notes, query]);

  const pick = (picked: NoteSource) => {
    setNote(picked);
    setParsed(parseNote(picked.title, picked.content));
    setName(picked.title.slice(0, LIMITS.name));
    setExcluded(new Set());
    setError(null);
    // The preview replaces the list: start typing in the deck name.
    requestAnimationFrame(() => nameRef.current?.focus());
  };

  const back = () => {
    setNote(null);
    setParsed(null);
    setError(null);
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const selected = parsed ? parsed.cardCount - excluded.size : 0;

  const toggle = (cardId: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });

  const setAll = (include: boolean) =>
    setExcluded(include || !parsed ? new Set() : new Set(parsed.topics.flatMap((t) => t.cards.map((c) => c.id))));

  const forge = () => {
    if (!note || !parsed) return;
    if (!name.trim()) {
      setError('Name the deck.');
      nameRef.current?.focus();
      return;
    }
    if (selected <= 0) {
      setError('Pick at least one card.');
      return;
    }
    const input = parsedNoteToDeckInput(parsed, {
      name: name.trim(),
      description: `Forged from the note "${note.title}".`,
      icon: icon.trim() || '📝',
      color: DECK_COLOR_CHOICES[deckCount % DECK_COLOR_CHOICES.length],
      tags: mergeTags([], note.tags.join(',')),
      include: (id) => !excluded.has(id),
    });
    onCreated(createDeck(input), selected);
  };

  // ─── Step 2: preview ───
  if (note && parsed) {
    const empty = parsed.cardCount === 0;
    return (
      <DialogShell
        open={open}
        title="Forge a deck from a note"
        subtitle={`Source: ${note.title}`}
        icon={NotebookPen}
        iconTone="ember"
        size="xl"
        dirty={!empty}
        onClose={onClose}
        onSubmit={empty ? undefined : forge}
        footer={
          <>
            <Button variant="ghost" leadingIcon={ArrowLeft} onClick={back} className="mr-auto">
              Other note
            </Button>
            {error && (
              <span className="min-w-0 truncate text-xs text-danger" role="alert" title={error}>
                {error}
              </span>
            )}
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            {!empty && (
              <SubmitButton variant="ember" leadingIcon={Anvil} disabled={selected <= 0}>
                Forge deck · {plural(selected, 'card')}
              </SubmitButton>
            )}
          </>
        }
      >
        {empty ? (
          <div className="flex flex-col gap-4">
            <EmptyState
              size="sm"
              icon={FileSearch}
              title="No cards found in this note"
              description="Add a few lines in any of these shapes, then try again."
            />
            <PatternList />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Input
                ref={nameRef}
                id="note-deck-name"
                label="Deck name"
                value={name}
                maxLength={LIMITS.name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
              />
              <div className="w-20">
                <Input
                  id="note-deck-icon"
                  label="Icon"
                  value={icon}
                  maxLength={LIMITS.icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="text-center text-base"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xs text-fg-muted">
                Found {plural(parsed.cardCount, 'card')} in {plural(parsed.topics.length, 'topic')}
              </span>
              <Badge tone="accent" size="sm" className="tabular">
                {selected} selected
              </Badge>
              <span className="ml-auto flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setAll(true)} disabled={excluded.size === 0}>
                  All
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setAll(false)} disabled={selected === 0}>
                  None
                </Button>
              </span>
            </div>

            <div className="flex flex-col gap-4">
              {parsed.topics.map((topic) => (
                <section key={topic.name} className="flex flex-col gap-2" aria-label={topic.name}>
                  <h4 className="flex items-center gap-2">
                    <span className="engraved font-display text-2xs font-semibold uppercase tracking-[0.18em] text-fg-muted">{topic.name}</span>
                    <span className="tabular font-mono text-2xs text-fg-subtle">{topic.cards.length}</span>
                    <span aria-hidden className="h-px flex-1 bg-line" />
                  </h4>
                  <div className="armor-panel chamfer-md divide-y divide-black/40 overflow-hidden">
                    {topic.cards.map((card) => {
                      const on = !excluded.has(card.id);
                      return (
                        <label
                          key={card.id}
                          className={cn(
                            'flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-[background-color,opacity] duration-120 ease-out-quint hover:bg-surface-hover',
                            !on && 'opacity-55'
                          )}
                        >
                          <Checkbox checked={on} onChange={() => toggle(card.id)} />
                          <span className="min-w-0 flex-1">
                            <span className="block whitespace-pre-wrap text-ui text-fg">{card.front}</span>
                            <span className="mt-0.5 line-clamp-3 block whitespace-pre-wrap text-xs text-fg-muted">{card.back}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </DialogShell>
    );
  }

  // ─── Step 1: pick a note ───
  return (
    <DialogShell
      open={open}
      title="Forge a deck from a note"
      subtitle="Headings become topics; definitions, Q&A pairs and lists become flashcards. Nothing leaves this browser."
      icon={NotebookPen}
      iconTone="ember"
      size="xl"
      onClose={onClose}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      {notes.length === 0 ? (
        <div className="flex flex-col gap-4">
          <EmptyState
            icon={NotebookPen}
            title="Your notes archive is empty"
            description="Write a note in the Notes app first, then come back to forge it into a deck."
          />
          <PatternList />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <SearchField
            ref={searchRef}
            id={`${uid}-search`}
            value={query}
            onValueChange={setQuery}
            placeholder={`Search ${plural(notes.length, 'note')}…`}
            aria-label="Search notes"
          />
          {visible.length === 0 ? (
            <EmptyState
              size="sm"
              icon={SearchX}
              title={`No note matches “${query.trim()}”`}
              description="Search looks at titles, tags and note text."
              actions={
                <Button size="sm" variant="ghost" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <div className="scrollbar-thin armor-panel chamfer-md max-h-80 divide-y divide-black/40 overflow-y-auto">
              {visible.map((n) => {
                const found = counts.get(n.id) ?? 0;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => pick(n)}
                    className="focus-ring-inset group/note flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-120 ease-out-quint hover:bg-surface-hover active:bg-surface-active"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center chamfer-xs bg-steel-950/70 bevel text-fg-subtle">
                      <FileText size={16} strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-ui font-medium text-fg" title={n.title}>
                          {n.title}
                        </span>
                        <span className="tabular shrink-0 font-mono text-2xs text-fg-subtle">{formatUpdated(n.updatedAt)}</span>
                      </span>
                      <span className="block truncate text-xs text-fg-subtle">{snippet(n.title, n.content) || 'Empty note'}</span>
                    </span>
                    <Badge tone={found > 0 ? 'success' : 'neutral'} size="sm">
                      {found > 0 ? plural(found, 'card') : 'No cards'}
                    </Badge>
                    <ChevronRight
                      size={16}
                      strokeWidth={1.75}
                      aria-hidden
                      className="shrink-0 text-fg-faint transition-[color,transform] duration-120 ease-out-quint group-hover/note:translate-x-0.5 group-hover/note:text-fg-muted"
                    />
                  </button>
                );
              })}
            </div>
          )}
          <details className="group/help armor-panel chamfer-md">
            <summary className="focus-ring-inset flex cursor-pointer select-none list-none items-center gap-2 px-3 py-2.5 text-ui text-fg-muted transition-colors duration-120 ease-out-quint hover:bg-surface-hover hover:text-fg [&::-webkit-details-marker]:hidden">
              <ChevronRight
                size={16}
                strokeWidth={1.75}
                aria-hidden
                className="text-fg-subtle transition-transform duration-180 ease-out-quint group-open/help:rotate-90"
              />
              What becomes a card?
            </summary>
            <div className="border-t border-line p-3">
              <PatternList />
            </div>
          </details>
        </div>
      )}
    </DialogShell>
  );
}

function PatternList() {
  return (
    <ul className="flex flex-col gap-1.5">
      {PATTERNS.map((p) => (
        <li key={p.example} className="flex items-baseline gap-3 text-xs">
          <code className="min-w-0 flex-1 truncate chamfer-xs bg-steel-950 px-2 py-1 font-mono text-fg-muted" title={p.example}>
            {p.example}
          </code>
          <span className="shrink-0 text-fg-subtle">→ {p.becomes}</span>
        </li>
      ))}
    </ul>
  );
}
