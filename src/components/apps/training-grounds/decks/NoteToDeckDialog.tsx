// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault: create a deck from a note
// Pick a note from the Notes Archive, preview the topics and cards
// the offline parser found, untick what you don't want, then forge.
// ═══════════════════════════════════════════════════════════

'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, FileText, NotebookPen, Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLearningStore } from '@/stores/useLearningStore';
import { DialogShell } from './Dialog';
import { BTN_GHOST, BTN_PRIMARY, DECK_COLOR_CHOICES, INPUT, LABEL, LIMITS, mergeTags, plural } from './deck-ui';
import { loadNotes, parseNote, parsedNoteToDeckInput, stripInline, type NoteSource, type ParsedNote } from './note-to-deck';

interface NoteToDeckDialogProps {
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

function snippet(content: string): string {
  return stripInline(content.replace(/^#+\s*/gm, '').replace(/[|>`]/g, ' ')).slice(0, 90);
}

export function NoteToDeckDialog({ onClose, onCreated }: NoteToDeckDialogProps) {
  const createDeck = useLearningStore((s) => s.createDeck);
  const deckCount = useLearningStore((s) => s.decks.length);
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
  };

  const back = () => {
    setNote(null);
    setParsed(null);
    setError(null);
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
        title="Forge a deck from a note"
        subtitle={`Source: ${note.title}`}
        icon={<NotebookPen className="h-4 w-4 text-cyan-300" />}
        size="lg"
        onClose={onClose}
        onSubmit={empty ? undefined : forge}
        footer={
          <>
            <button type="button" onClick={back} className={cn(BTN_GHOST, 'mr-auto')}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Other note
            </button>
            {error && (
              <span className="text-[11px] text-red-300" role="alert">
                {error}
              </span>
            )}
            <button type="button" onClick={onClose} className={BTN_GHOST}>
              Cancel
            </button>
            {!empty && (
              <button type="submit" disabled={selected <= 0} className={BTN_PRIMARY}>
                <Sparkles className="h-3.5 w-3.5" />
                Create deck with {plural(selected, 'card')}
              </button>
            )}
          </>
        }
      >
        {empty ? (
          <div className="space-y-3 py-2 text-center">
            <p className="font-mono text-[10px] tracking-[0.3em] text-amber-300/70">NO SIGNAL</p>
            <p className="text-sm text-white/70">No cards found in this note.</p>
            <p className="text-xs text-white/45">Add a few lines in any of these shapes, then try again:</p>
            <PatternList />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="space-y-1">
                <label htmlFor="note-deck-name" className={LABEL}>
                  Deck name
                </label>
                <input
                  id="note-deck-name"
                  autoFocus
                  value={name}
                  maxLength={LIMITS.name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  className={cn(INPUT, 'font-semibold')}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="note-deck-icon" className={LABEL}>
                  Icon
                </label>
                <input
                  id="note-deck-icon"
                  value={icon}
                  maxLength={LIMITS.icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className={cn(INPUT, 'w-16 text-center text-base')}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/50">
              <span>
                Found {plural(parsed.cardCount, 'card')} in {plural(parsed.topics.length, 'topic')} ·{' '}
                <span className="text-cyan-300">{selected} selected</span>
              </span>
              <span className="ml-auto flex gap-1">
                <button type="button" onClick={() => setAll(true)} className="rounded px-1.5 py-0.5 hover:bg-white/10 hover:text-white">
                  All
                </button>
                <button type="button" onClick={() => setAll(false)} className="rounded px-1.5 py-0.5 hover:bg-white/10 hover:text-white">
                  None
                </button>
              </span>
            </div>

            <div className="space-y-3">
              {parsed.topics.map((topic) => (
                <section key={topic.name} className="space-y-1.5">
                  <h4 className="flex items-center gap-2 text-xs font-semibold text-purple-200">
                    <span className="h-px w-3 bg-purple-400/50" />
                    {topic.name}
                    <span className="font-normal text-white/35">{topic.cards.length}</span>
                  </h4>
                  {topic.cards.map((card) => {
                    const on = !excluded.has(card.id);
                    return (
                      <label
                        key={card.id}
                        className={cn(
                          'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors',
                          on ? 'border-cyan-400/20 bg-cyan-400/[0.04]' : 'border-white/5 bg-transparent opacity-50'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(card.id)}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-cyan-400"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block whitespace-pre-wrap text-sm text-white/85">{card.front}</span>
                          <span className="mt-0.5 line-clamp-3 block whitespace-pre-wrap text-[11px] text-emerald-200/70">
                            {card.back}
                          </span>
                        </span>
                      </label>
                    );
                  })}
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
      title="Forge a deck from a note"
      subtitle="Headings become topics; definitions, Q&A pairs and lists become flashcards. Nothing leaves this browser."
      icon={<NotebookPen className="h-4 w-4 text-cyan-300" />}
      size="lg"
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className={BTN_GHOST}>
          Cancel
        </button>
      }
    >
      {notes.length === 0 ? (
        <div className="space-y-3 py-4 text-center">
          <FileText className="mx-auto h-8 w-8 text-cyan-300/40" />
          <p className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/60">NOTES ARCHIVE EMPTY</p>
          <p className="text-sm text-white/65">Write a note in the Notes app first, then come back to forge it.</p>
          <PatternList />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${plural(notes.length, 'note')}…`}
              aria-label="Search notes"
              className={cn(INPUT, 'pl-8')}
            />
          </div>
          <div className="space-y-1.5">
            {visible.map((n) => {
              const found = counts.get(n.id) ?? 0;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => pick(n)}
                  className="flex w-full items-start gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-left transition-colors hover:border-cyan-400/30 hover:bg-cyan-400/[0.05]"
                >
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300/60" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-medium text-white/85">{n.title}</span>
                      <span className="shrink-0 text-[10px] text-white/30">{formatUpdated(n.updatedAt)}</span>
                    </span>
                    <span className="block truncate text-[11px] text-white/40">{snippet(n.content) || 'Empty note'}</span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2 py-0.5 text-[10px]',
                      found > 0 ? 'border-emerald-400/30 text-emerald-200' : 'border-white/10 text-white/30'
                    )}
                  >
                    {found > 0 ? plural(found, 'card') : 'no cards'}
                  </span>
                </button>
              );
            })}
            {visible.length === 0 && <p className="py-4 text-center text-xs text-white/40">No note matches “{query}”.</p>}
          </div>
          <details className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-xs text-white/55">
            <summary className="cursor-pointer select-none text-white/65">What becomes a card?</summary>
            <div className="mt-2">
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
    <ul className="mx-auto max-w-md space-y-1 text-left">
      {PATTERNS.map((p) => (
        <li key={p.example} className="flex items-baseline gap-2 text-[11px]">
          <code className="min-w-0 flex-1 truncate rounded bg-white/5 px-1.5 py-0.5 font-mono text-cyan-200/80">{p.example}</code>
          <span className="shrink-0 text-white/40">→ {p.becomes}</span>
        </li>
      ))}
    </ul>
  );
}
