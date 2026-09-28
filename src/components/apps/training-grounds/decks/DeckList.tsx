// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault: deck grid
// Every deck with its mastery ring and due count, the vault totals,
// and the empty state that invites the first deck.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { ArchiveRestore, ArrowDownToLine, ArrowUpFromLine, NotebookPen, Play, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Deck } from '@/types/learning';
import { MasteryRing } from './MasteryRing';
import { BTN_GHOST, BTN_PRIMARY, plural, withAlpha, type DeckSummary } from './deck-ui';

interface DeckListProps {
  decks: readonly Deck[];
  summaries: ReadonlyMap<string, DeckSummary>;
  /** Shipped sample decks that are not in the vault right now. */
  missingSamples: number;
  onOpen: (deckId: string) => void;
  onReview: (deckId: string) => void;
  onCreate: () => void;
  onFromNote: () => void;
  onImport: () => void;
  onExport: () => void;
  onRestoreSamples: () => void;
}

function DeckListInner({
  decks,
  summaries,
  missingSamples,
  onOpen,
  onReview,
  onCreate,
  onFromNote,
  onImport,
  onExport,
  onRestoreSamples,
}: DeckListProps) {
  if (decks.length === 0) {
    return (
      <EmptyVault
        missingSamples={missingSamples}
        onCreate={onCreate}
        onFromNote={onFromNote}
        onImport={onImport}
        onRestoreSamples={onRestoreSamples}
      />
    );
  }

  let cards = 0;
  let due = 0;
  let mastered = 0;
  for (const summary of summaries.values()) {
    cards += summary.cards;
    due += summary.due;
    mastered += summary.mastery.mastered;
  }
  const stats = [
    { label: 'Decks', value: decks.length, tone: 'text-cyan-200' },
    { label: 'Cards', value: cards, tone: 'text-white/85' },
    { label: 'Due now', value: due, tone: due > 0 ? 'text-amber-200' : 'text-white/50' },
    { label: 'Mastered', value: mastered, tone: 'text-emerald-200' },
  ];

  return (
    <div className="space-y-4 p-5">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-white">🗂️ Deck Vault</h3>
          <p className="text-xs text-white/45">Forge decks, load them with cards, and train until every ring glows.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={onFromNote} className={BTN_GHOST} title="Create a deck from one of your notes">
            <NotebookPen className="h-3.5 w-3.5" />
            <span className="hidden @xl:inline">From note</span>
          </button>
          <button type="button" onClick={onImport} className={BTN_GHOST} title="Import decks from JSON">
            <ArrowUpFromLine className="h-3.5 w-3.5" />
            <span className="hidden @xl:inline">Import</span>
          </button>
          <button type="button" onClick={onExport} className={BTN_GHOST} title="Export decks as JSON">
            <ArrowDownToLine className="h-3.5 w-3.5" />
            <span className="hidden @xl:inline">Export</span>
          </button>
          <button type="button" onClick={onCreate} className={BTN_PRIMARY}>
            <Plus className="h-3.5 w-3.5" />
            New deck
          </button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-2 @lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2">
            <p className={cn('font-mono text-lg font-bold tabular-nums', stat.tone)}>{stat.value}</p>
            <p className="text-[10px] uppercase tracking-wider text-white/40">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Decks */}
      <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2 @4xl:grid-cols-3">
        {decks.map((deck, i) => {
          const summary = summaries.get(deck.id);
          if (!summary) return null;
          const pct = Math.round(summary.mastery.value * 100);
          return (
            <motion.div
              key={deck.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.04 }}
              className="group relative overflow-hidden rounded-xl border p-3.5 transition-colors"
              style={{
                borderColor: withAlpha(deck.color, 0.22),
                background: `linear-gradient(135deg, ${withAlpha(deck.color, 0.1)}, rgba(255,255,255,0.02) 65%)`,
              }}
            >
              {/* Whole tile opens the deck; the buttons below sit above it. */}
              <button
                type="button"
                onClick={() => onOpen(deck.id)}
                aria-label={`Open ${deck.name}`}
                className="absolute inset-0 rounded-xl transition-colors hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400/60"
              />
              <div className="pointer-events-none relative flex items-start gap-3">
                <MasteryRing value={summary.mastery.value} color={deck.color} size={52} title={`${pct}% mastery`}>
                  <span className="text-xl">{deck.icon}</span>
                </MasteryRing>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="truncate text-sm font-bold" style={{ color: deck.color }}>
                      {deck.name}
                    </h4>
                    {deck.isSample && (
                      <span className="shrink-0 rounded border border-white/15 px-1 text-[9px] uppercase tracking-wider text-white/40">
                        Sample
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/50">
                    {deck.description || 'No description yet.'}
                  </p>
                </div>
              </div>

              <div className="pointer-events-none relative mt-3 flex items-center gap-2 text-[10px] text-white/45">
                <span className="font-mono tabular-nums" style={{ color: deck.color }}>
                  {pct}%
                </span>
                <span>
                  {plural(deck.topics.length, 'topic')} · {plural(summary.cards, 'card')}
                </span>
                <span className="ml-auto flex items-center gap-1.5">
                  {summary.due > 0 && (
                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-amber-200">
                      {summary.due} due
                    </span>
                  )}
                  {summary.fresh > 0 && (
                    <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-white/45">
                      {summary.fresh} new
                    </span>
                  )}
                </span>
                {summary.due + summary.fresh > 0 && (
                  <button
                    type="button"
                    onClick={() => onReview(deck.id)}
                    title="Review due and new cards"
                    aria-label={`Review ${deck.name}`}
                    className="pointer-events-auto relative rounded-md border border-white/10 p-1 text-white/55 transition-colors hover:border-cyan-400/40 hover:text-cyan-200"
                  >
                    <Play className="h-3 w-3" />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {missingSamples > 0 && (
        <p className="flex items-center justify-center gap-2 text-[11px] text-white/35">
          {plural(missingSamples, 'sample deck')} hidden.
          <button
            type="button"
            onClick={onRestoreSamples}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-cyan-300/70 hover:bg-cyan-400/10 hover:text-cyan-200"
          >
            <ArchiveRestore className="h-3 w-3" />
            Restore
          </button>
        </p>
      )}
    </div>
  );
}

export const DeckList = memo(DeckListInner);

// ─── Empty vault ───

interface EmptyVaultProps {
  missingSamples: number;
  onCreate: () => void;
  onFromNote: () => void;
  onImport: () => void;
  onRestoreSamples: () => void;
}

function EmptyVault({ missingSamples, onCreate, onFromNote, onImport, onRestoreSamples }: EmptyVaultProps) {
  return (
    <div className="flex min-h-full items-center justify-center p-5">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-cyan-400/15 bg-black/30 px-6 py-10 text-center">
        {/* Holographic grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'linear-gradient(rgba(34,211,238,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.07) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          }}
        />
        <motion.div
          className="pointer-events-none absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent"
          initial={{ top: '0%' }}
          animate={{ top: ['0%', '100%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />

        <div className="relative mx-auto mb-5 flex h-24 w-24 items-center justify-center">
          <motion.div
            className="absolute inset-0 rounded-full border border-dashed border-cyan-400/40"
            animate={{ rotate: 360 }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute inset-3 rounded-full border border-purple-400/30"
            animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="text-4xl drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]">🗂️</span>
        </div>

        <p className="relative font-mono text-[10px] tracking-[0.35em] text-cyan-300/70">ARCHIVE EMPTY</p>
        <h3 className="relative mt-2 text-lg font-bold text-white">No decks in the vault yet</h3>
        <p className="relative mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-white/50">
          A deck is anything you want to master: a language, a framework, an exam, a hobby. Forge your first one,
          import a file, or turn one of your notes into flashcards.
        </p>

        <div className="relative mt-6 flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={onCreate} className={BTN_PRIMARY}>
            <Plus className="h-3.5 w-3.5" />
            Forge a deck
          </button>
          <button type="button" onClick={onFromNote} className={BTN_GHOST}>
            <NotebookPen className="h-3.5 w-3.5" />
            From a note
          </button>
          <button type="button" onClick={onImport} className={BTN_GHOST}>
            <ArrowUpFromLine className="h-3.5 w-3.5" />
            Import
          </button>
        </div>
        {missingSamples > 0 && (
          <button
            type="button"
            onClick={onRestoreSamples}
            className="relative mt-4 inline-flex items-center gap-1.5 text-[11px] text-cyan-300/70 hover:text-cyan-200"
          >
            <ArchiveRestore className="h-3.5 w-3.5" />
            Or restore the {plural(missingSamples, 'sample deck')} to look around first
          </button>
        )}
      </div>
    </div>
  );
}
