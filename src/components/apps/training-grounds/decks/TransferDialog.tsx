// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault: import / export
// Export: pick decks, optionally with review progress, then download
// a .json file or copy it. Import: a file (picked or dropped) or
// pasted JSON, as copies or replacing decks with the same id.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, type ChangeEvent, type DragEvent } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Check, CircleCheck, Copy, FileJson, TriangleAlert, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { deckCards, useLearningStore } from '@/stores/useLearningStore';
import type { ImportResult } from '@/types/learning';
import { DialogShell } from './Dialog';
import { BTN_GHOST, BTN_PRIMARY, INPUT, LABEL, downloadTextFile, fileSlug, plural } from './deck-ui';

export type TransferMode = 'export' | 'import';

interface TransferDialogProps {
  initialMode: TransferMode;
  /** Decks preselected for export (null = all). */
  initialDeckIds: readonly string[] | null;
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

export function TransferDialog({ initialMode, initialDeckIds, onClose, onImported }: TransferDialogProps) {
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
      title="Import / Export"
      subtitle="Decks travel as plain JSON: back them up, move them between browsers, share them."
      icon={<FileJson className="h-4 w-4 text-cyan-300" />}
      size="lg"
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          {error && (
            <span className="mr-auto text-[11px] text-red-300" role="alert">
              {error}
            </span>
          )}
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            {result?.ok ? 'Done' : 'Close'}
          </button>
          {mode === 'export' ? (
            <>
              <button type="button" onClick={() => void copy()} disabled={chosen.length === 0} className={BTN_GHOST}>
                {copied ? <Check className="h-3.5 w-3.5 text-green-300" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy JSON'}
              </button>
              <button type="submit" disabled={chosen.length === 0} className={BTN_PRIMARY}>
                <ArrowDownToLine className="h-3.5 w-3.5" />
                Download .json
              </button>
            </>
          ) : (
            <button type="submit" disabled={!text.trim()} className={BTN_PRIMARY}>
              <ArrowUpFromLine className="h-3.5 w-3.5" />
              Import
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* Mode switch */}
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1" role="tablist">
          {(['export', 'import'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs transition-colors',
                mode === m ? 'bg-cyan-500/20 text-cyan-100' : 'text-white/50 hover:text-white/80'
              )}
            >
              {m === 'export' ? <ArrowDownToLine className="h-3.5 w-3.5" /> : <ArrowUpFromLine className="h-3.5 w-3.5" />}
              {m === 'export' ? 'Export' : 'Import'}
            </button>
          ))}
        </div>

        {mode === 'export' ? (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className={LABEL}>Decks</p>
                <span className="flex gap-1 text-[11px] text-white/45">
                  <button
                    type="button"
                    onClick={() => setSelected(new Set(decks.map((d) => d.id)))}
                    className="rounded px-1.5 py-0.5 hover:bg-white/10 hover:text-white"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="rounded px-1.5 py-0.5 hover:bg-white/10 hover:text-white"
                  >
                    None
                  </button>
                </span>
              </div>
              {decks.length === 0 && <p className="text-xs text-white/40">No decks to export yet.</p>}
              <div className="grid grid-cols-1 gap-1.5 @lg:grid-cols-2">
                {decks.map((deck) => {
                  const on = selected.has(deck.id);
                  return (
                    <label
                      key={deck.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors',
                        on ? 'border-cyan-400/25 bg-cyan-400/[0.05] text-white/85' : 'border-white/[0.07] text-white/45'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleDeck(deck.id)}
                        className="h-3.5 w-3.5 accent-cyan-400"
                      />
                      <span>{deck.icon}</span>
                      <span className="min-w-0 flex-1 truncate">{deck.name}</span>
                      <span className="shrink-0 text-[10px] text-white/35">{deckCards(deck).length}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2">
              <input
                type="checkbox"
                checked={includeProgress}
                onChange={(e) => setIncludeProgress(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-cyan-400"
              />
              <span>
                <span className="block text-xs text-white/80">Include my progress</span>
                <span className="block text-[11px] text-white/40">
                  Review schedule and mastery of these cards, so another browser picks up where you left off.
                </span>
              </span>
            </label>
            <p className="text-[11px] text-white/40">
              {chosen.length === 0
                ? 'Pick at least one deck.'
                : `${plural(chosen.length, 'deck')} · ${plural(chosenCards, 'card')} ready to export.`}
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
                'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-5 text-center transition-colors',
                dragging ? 'border-cyan-300/70 bg-cyan-400/10' : 'border-white/15 bg-white/[0.02] hover:border-cyan-400/40'
              )}
            >
              <Upload className="h-5 w-5 text-cyan-300/70" />
              <span className="text-xs text-white/75">
                {fileName ? (
                  <>
                    Loaded <span className="font-mono text-cyan-200">{fileName}</span>
                  </>
                ) : (
                  'Drop a .json file here, or click to choose one'
                )}
              </span>
              <span className="text-[10px] text-white/35">Warrior OS exports, a list of decks, or a single deck</span>
              <input type="file" accept=".json,application/json" onChange={onFileInput} className="sr-only" />
            </label>

            <div className="space-y-1">
              <label htmlFor="deck-import-json" className={LABEL}>
                Or paste JSON
              </label>
              <textarea
                id="deck-import-json"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setFileName(null);
                  setResult(null);
                }}
                rows={6}
                spellCheck={false}
                placeholder='{ "name": "My deck", "cards": [ { "kind": "flashcard", "prompt": "…", "back": "…" } ] }'
                className={cn(INPUT, 'resize-y font-mono text-[11px] leading-snug')}
              />
            </div>

            <div className="space-y-1.5">
              <p className={LABEL}>If a deck already exists</p>
              <div className="grid grid-cols-1 gap-1.5 @lg:grid-cols-2">
                {[
                  { value: false, title: 'Keep both', hint: 'Import it as a separate copy.' },
                  { value: true, title: 'Replace it', hint: 'Overwrite the deck with the same id.' },
                ].map((option) => (
                  <label
                    key={option.title}
                    className={cn(
                      'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 transition-colors',
                      replace === option.value ? 'border-cyan-400/30 bg-cyan-400/[0.06]' : 'border-white/[0.07]'
                    )}
                  >
                    <input
                      type="radio"
                      name="deck-import-conflict"
                      checked={replace === option.value}
                      onChange={() => setReplace(option.value)}
                      className="mt-0.5 h-3.5 w-3.5 accent-cyan-400"
                    />
                    <span>
                      <span className="block text-xs text-white/80">{option.title}</span>
                      <span className="block text-[11px] text-white/40">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {result && <ImportSummary result={result} />}

            <details className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-xs text-white/55">
              <summary className="cursor-pointer select-none text-white/65">File format</summary>
              <p className="mt-2 text-[11px] text-white/45">
                Card kinds: <code>flashcard</code> (prompt, back), <code>mcq</code> (options, answer index),{' '}
                <code>multi-select</code> (options, answers) and <code>numeric</code> (answer, tolerance, unit). Optional
                on every card: explanation, difficulty (easy / medium / hard) and tags. A deck may also list{' '}
                <code>cards</code> directly instead of topics.
              </p>
              <pre className="mt-2 max-h-48 overflow-auto rounded bg-black/40 p-2 font-mono text-[10px] leading-snug text-cyan-100/80">
                {EXAMPLE}
              </pre>
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
        'space-y-1.5 rounded-lg border px-3 py-2.5',
        result.ok ? 'border-green-400/30 bg-green-500/[0.07]' : 'border-red-400/30 bg-red-500/[0.07]'
      )}
      role="status"
    >
      <p className={cn('flex items-center gap-1.5 text-xs font-semibold', result.ok ? 'text-green-200' : 'text-red-200')}>
        {result.ok ? <CircleCheck className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
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
        <ul className="space-y-0.5 text-[11px] text-amber-200/80">
          {shown.map((message, i) => (
            <li key={i}>• {message}</li>
          ))}
          {result.errors.length > shown.length && (
            <li className="text-white/40">…and {result.errors.length - shown.length} more</li>
          )}
        </ul>
      )}
    </div>
  );
}
