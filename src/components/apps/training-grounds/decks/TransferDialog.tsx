// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault: import / export
// Export: pick decks, optionally with review progress, then download
// a .json file or copy it. Import: a file (picked or dropped) or
// pasted JSON, as copies or replacing decks with the same id.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, type ChangeEvent, type DragEvent } from 'react';
import {
  ArrowLeftRight,
  Check,
  ChevronRight,
  CircleCheck,
  Copy,
  Download,
  FileJson,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { Button, Checkbox, RadioGroup, Tabs, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';
import { deckCards, useLearningStore } from '@/stores/useLearningStore';
import type { ImportResult } from '@/types/learning';
import { DialogShell, SubmitButton } from './Dialog';
import { downloadTextFile, fileSlug, plural } from './deck-ui';
import { DashedEdge } from '../armor-bits';

export type TransferMode = 'export' | 'import';

interface TransferDialogProps {
  initialMode: TransferMode;
  /** Decks preselected for export (null = all). */
  initialDeckIds: readonly string[] | null;
  open?: boolean;
  onClose: () => void;
  /** Called after an import ran, with its result. */
  onImported: (result: ImportResult) => void;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ERRORS_SHOWN = 12;

const EXAMPLE = `{
  "name": "Spanish Basics",
  "icon": "🗣️",
  "topics": [
    {
      "name": "Greetings",
      "cards": [
        { "kind": "flashcard", "prompt": "Good morning", "back": "Buenos días" },
        { "kind": "mcq", "prompt": "'Gracias' means…",
          "options": ["Please", "Thank you", "Sorry"], "answer": 1 },
        { "kind": "multi-select", "prompt": "Which are greetings?",
          "options": ["Hola", "Adiós", "Buenas"], "answers": [0, 2] },
        { "kind": "numeric", "prompt": "How many letters in 'hola'?", "answer": 4 }
      ]
    }
  ]
}`;

const MODE_TABS = [
  { id: 'export', label: 'Export', icon: Download },
  { id: 'import', label: 'Import', icon: Upload },
];

const CONFLICT_OPTIONS = [
  { value: 'copy', label: 'Keep both', description: 'Import it as a separate copy.' },
  { value: 'replace', label: 'Replace it', description: 'Overwrite the deck with the same id.' },
];

export function TransferDialog({ initialMode, initialDeckIds, open = true, onClose, onImported }: TransferDialogProps) {
  const decks = useLearningStore((s) => s.decks);
  const exportDecks = useLearningStore((s) => s.exportDecks);
  const importDecks = useLearningStore((s) => s.importDecks);

  const [mode, setMode] = useState<TransferMode>(initialMode);
  // Export
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(initialDeckIds ?? decks.map((d) => d.id))
  );
  const [includeProgress, setIncludeProgress] = useState(false);
  const [copied, setCopied] = useState(false);
  // Import
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [replace, setReplace] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chosen = decks.filter((d) => selected.has(d.id));
  const chosenCards = chosen.reduce((n, d) => n + deckCards(d).length, 0);
  const allSelected = decks.length > 0 && chosen.length === decks.length;

  const toggleDeck = (deckId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(deckId)) next.delete(deckId);
      else next.add(deckId);
      return next;
    });

  const exportJson = () => exportDecks(chosen.map((d) => d.id), { includeProgress });

  const download = () => {
    if (chosen.length === 0) return;
    const day = new Date().toISOString().slice(0, 10);
    const name = chosen.length === 1 ? `${fileSlug(chosen[0].name)}.deck.json` : `warrior-os-decks-${day}.json`;
    downloadTextFile(name, exportJson());
  };

  const copy = async () => {
    if (chosen.length === 0) return;
    try {
      await navigator.clipboard.writeText(exportJson());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Clipboard is blocked here. Use Download instead.');
    }
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setResult(null);
    if (file.size > MAX_FILE_BYTES) {
      setError(`${file.name} is larger than 5 MB.`);
      return;
    }
    try {
      setText(await file.text());
      setFileName(file.name);
      setError(null);
    } catch {
      setError(`Could not read ${file.name}.`);
    }
  };

  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    void readFile(event.target.files?.[0]);
    event.target.value = ''; // picking the same file again still fires
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    void readFile(event.dataTransfer.files?.[0]);
  };

  const runImport = () => {
    if (!text.trim()) {
      setError('Choose a file or paste JSON first.');
      return;
    }
    const outcome = importDecks(text, { onConflict: replace ? 'replace' : 'copy' });
    setResult(outcome);
    setError(null);
    onImported(outcome);
  };

  const submit = mode === 'export' ? download : runImport;

  return (
    <DialogShell
      open={open}
      title="Import / Export"
      subtitle="Decks travel as plain JSON: back them up, move them between browsers, share them."
      icon={ArrowLeftRight}
      size="xl"
      dirty={mode === 'import' && text.trim() !== '' && !result?.ok}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <span className="mr-auto min-w-0 text-xs text-danger" role={error ? 'alert' : undefined}>
            {error && <span className="line-clamp-2">{error}</span>}
          </span>
          <Button variant="ghost" onClick={onClose}>
            {result?.ok ? 'Done' : 'Close'}
          </Button>
          {mode === 'export' ? (
            <>
              <Button
                variant="secondary"
                leadingIcon={copied ? <Check size={16} strokeWidth={2} aria-hidden className="text-success" /> : Copy}
                onClick={() => void copy()}
                disabled={chosen.length === 0}
              >
                {copied ? 'Copied' : 'Copy JSON'}
              </Button>
              <SubmitButton leadingIcon={Download} disabled={chosen.length === 0}>
                Download .json
              </SubmitButton>
            </>
          ) : (
            <SubmitButton leadingIcon={Upload} disabled={!text.trim()}>
              Import
            </SubmitButton>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Tabs
          variant="pill"
          fullWidth
          aria-label="Import or export"
          value={mode}
          onChange={(id) => {
            setMode(id as TransferMode);
            setError(null);
          }}
          tabs={MODE_TABS}
          className="chamfer-sm bg-steel-950/60 bevel p-0.5"
        />

        {mode === 'export' ? (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-fg-muted">
                  Decks
                  <span className="tabular ml-2 font-mono text-fg-subtle">
                    {chosen.length}/{decks.length}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(decks.map((d) => d.id)))} disabled={allSelected}>
                    All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={chosen.length === 0}>
                    None
                  </Button>
                </span>
              </div>
              {decks.length === 0 ? (
                <p className="chamfer-sm bg-steel-950/50 bevel px-3 py-4 text-center text-ui text-fg-subtle">No decks to export yet.</p>
              ) : (
                <div className="scrollbar-thin armor-panel chamfer-md max-h-64 divide-y divide-black/40 overflow-y-auto">
                  {decks.map((deck) => {
                    const on = selected.has(deck.id);
                    return (
                      <label
                        key={deck.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors duration-120 ease-out-quint hover:bg-surface-hover',
                          on && 'bg-accent/[0.04]'
                        )}
                      >
                        <Checkbox checked={on} onChange={() => toggleDeck(deck.id)} />
                        <span className="text-base leading-none" aria-hidden>
                          {deck.icon}
                        </span>
                        <span className={cn('min-w-0 flex-1 truncate text-ui', on ? 'text-fg' : 'text-fg-muted')} title={deck.name}>
                          {deck.name}
                        </span>
                        <span className="tabular shrink-0 font-mono text-xs text-fg-subtle">{plural(deckCards(deck).length, 'card')}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <Checkbox
              checked={includeProgress}
              onCheckedChange={setIncludeProgress}
              label="Include my progress"
              description="Review schedule and mastery of these cards, so another browser picks up where you left off."
            />

            <p className={cn('flex items-center gap-2 text-xs', chosen.length === 0 ? 'text-warning' : 'text-fg-subtle')}>
              {chosen.length === 0 ? (
                <>
                  <TriangleAlert size={14} strokeWidth={1.75} aria-hidden />
                  Pick at least one deck.
                </>
              ) : (
                <>
                  <FileJson size={14} strokeWidth={1.75} aria-hidden />
                  {plural(chosen.length, 'deck')} · {plural(chosenCards, 'card')} ready to export.
                </>
              )}
            </p>
          </>
        ) : (
          <>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                'relative flex cursor-pointer flex-col items-center justify-center gap-2 chamfer-md px-4 py-6 text-center transition-colors duration-120 ease-out-quint',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent',
                dragging
                  ? 'bg-accent/10'
                  : fileName
                    ? 'bg-success/[0.05]'
                    : 'group/drop bg-steel-950/40 hover:bg-ember-500/5'
              )}
            >
              <DashedEdge
                className={cn(
                  'transition-colors duration-120',
                  dragging ? 'text-accent' : fileName ? 'text-success/50' : 'text-steel-500 group-hover/drop:text-ember-500/70'
                )}
              />
              <span
                className={cn(
                  'armor-plate chamfer-sm flex size-10 items-center justify-center',
                  fileName ? 'text-success' : 'text-fg-muted'
                )}
              >
                {fileName ? <CircleCheck size={20} strokeWidth={1.75} aria-hidden /> : <Upload size={20} strokeWidth={1.75} aria-hidden />}
              </span>
              <span className="text-ui text-fg">
                {fileName ? (
                  <>
                    Loaded <span className="font-mono text-success">{fileName}</span>
                  </>
                ) : dragging ? (
                  'Drop it'
                ) : (
                  'Drop a .json file here, or click to choose one'
                )}
              </span>
              <span className="text-xs text-fg-subtle">Warrior OS exports, a list of decks, or a single deck · up to 5 MB</span>
              <input type="file" accept=".json,application/json" onChange={onFileInput} className="sr-only" />
            </label>

            <Textarea
              id="deck-import-json"
              label="Or paste JSON"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setFileName(null);
                setResult(null);
              }}
              rows={6}
              spellCheck={false}
              placeholder='{ "name": "My deck", "cards": [ { "kind": "flashcard", "prompt": "…", "back": "…" } ] }'
              className="select-text font-mono text-xs"
            />

            <RadioGroup
              name="deck-import-conflict"
              label="If a deck already exists"
              orientation="horizontal"
              value={replace ? 'replace' : 'copy'}
              onValueChange={(v) => setReplace(v === 'replace')}
              options={CONFLICT_OPTIONS}
            />

            {result && <ImportSummary result={result} />}

            <details className="group/format armor-panel chamfer-md">
              <summary className="focus-ring-inset flex cursor-pointer select-none list-none items-center gap-2 px-3 py-2.5 text-ui text-fg-muted transition-colors duration-120 ease-out-quint hover:bg-surface-hover hover:text-fg [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  size={16}
                  strokeWidth={1.75}
                  aria-hidden
                  className="text-fg-subtle transition-transform duration-180 ease-out-quint group-open/format:rotate-90"
                />
                File format
              </summary>
              <div className="flex flex-col gap-3 border-t border-line px-3 py-3">
                <p className="text-xs text-fg-muted">
                  Card kinds: <code className="font-mono text-fg">flashcard</code> (prompt, back),{' '}
                  <code className="font-mono text-fg">mcq</code> (options, answer index),{' '}
                  <code className="font-mono text-fg">multi-select</code> (options, answers) and{' '}
                  <code className="font-mono text-fg">numeric</code> (answer, tolerance, unit). Optional on every card:
                  explanation, difficulty (easy / medium / hard) and tags. A deck may also list{' '}
                  <code className="font-mono text-fg">cards</code> directly instead of topics.
                </p>
                <pre className="scrollbar-thin max-h-48 select-text overflow-auto chamfer-sm bg-steel-950 p-3 shadow-[inset_0_1px_0_rgb(0_0_0/0.7),inset_0_-1px_0_rgb(255_255_255/0.06)] font-mono text-2xs text-fg-muted">
                  {EXAMPLE}
                </pre>
              </div>
            </details>
          </>
        )}
      </div>
    </DialogShell>
  );
}

function ImportSummary({ result }: { result: ImportResult }) {
  const shown = result.errors.slice(0, MAX_ERRORS_SHOWN);
  return (
    <div
      className={cn(
        'relative flex flex-col gap-2 chamfer-md border px-3.5 py-3 before:absolute before:inset-y-0 before:left-0 before:w-0.5',
        result.ok ? 'border-success/30 bg-success/[0.06] before:bg-success/70' : 'border-danger/30 bg-danger/[0.06] before:bg-danger/70'
      )}
      role="status"
    >
      <p className={cn('flex items-center gap-2 text-ui font-medium', result.ok ? 'text-success' : 'text-danger')}>
        {result.ok ? (
          <CircleCheck size={16} strokeWidth={1.75} aria-hidden />
        ) : (
          <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
        )}
        {result.ok
          ? [
              result.decksAdded > 0 ? `${plural(result.decksAdded, 'deck')} added` : null,
              result.decksReplaced > 0 ? `${plural(result.decksReplaced, 'deck')} replaced` : null,
              plural(result.cardsImported, 'card'),
            ]
              .filter(Boolean)
              .join(' · ')
          : 'Nothing was imported'}
      </p>
      {shown.length > 0 && (
        <ul className={cn('flex flex-col gap-1 pl-6 text-xs', result.ok ? 'text-warning' : 'text-fg-muted')}>
          {shown.map((message, i) => (
            <li key={i} className="list-disc">
              {message}
            </li>
          ))}
          {result.errors.length > shown.length && (
            <li className="list-none text-fg-subtle">…and {result.errors.length - shown.length} more</li>
          )}
        </ul>
      )}
    </div>
  );
}
