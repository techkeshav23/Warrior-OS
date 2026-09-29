// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault: deck grid
// Header with the vault actions, the vault totals, every deck as a card
// (mastery ring, due / new counts, quick actions), and the empty state
// that invites the first deck.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  AlarmClock,
  ArchiveRestore,
  Download,
  Layers,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Play,
  Plus,
  StickyNote,
  Trash2,
  Trophy,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import {
  AppHeader,
  AppLayout,
  Badge,
  Button,
  EmptyState,
  IconButton,
  Menu,
  StatTile,
  type MenuItem,
} from '@/components/ui';
import { TRANSITION } from '@/styles/tokens';
import type { Deck } from '@/types/learning';
import type { TrainingTab } from '../deep-link';
import { MasteryRing } from './MasteryRing';
import { TAB_ICONS, deckStyle, plural, type DeckSummary } from './deck-ui';
import { DashedEdge } from '../armor-bits';

interface DeckListProps {
  decks: readonly Deck[];
  summaries: ReadonlyMap<string, DeckSummary>;
  /** Shipped sample decks that are not in the vault right now. */
  missingSamples: number;
  /** "Last session 2h ago" style status for the header. */
  status: string;
  onOpen: (deckId: string) => void;
  /** Study a deck (Review / Quiz / Mock test quick actions). */
  onStudy: (deckId: string, tab: TrainingTab) => void;
  /** Review everything due across the vault. */
  onReviewAll: () => void;
  onEdit: (deckId: string) => void;
  onExportDeck: (deckId: string) => void;
  onDelete: (deckId: string) => void;
  onCreate: () => void;
  onFromNote: () => void;
  onImport: () => void;
  onExport: () => void;
  onRestoreSamples: () => void;
}

/** Labelled button on wide panels, icon button with a tooltip on narrow ones. */
function HeaderAction({ icon, label, hint, onClick }: { icon: LucideIcon; label: string; hint: string; onClick: () => void }) {
  return (
    <>
      <span className="hidden @2xl:contents">
        <Button variant="ghost" leadingIcon={icon} onClick={onClick} title={hint}>
          {label}
        </Button>
      </span>
      <span className="contents @2xl:hidden">
        <IconButton icon={icon} aria-label={label} tooltip={hint} tooltipSide="bottom" onClick={onClick} />
      </span>
    </>
  );
}

function DeckListInner({
  decks,
  summaries,
  missingSamples,
  status,
  onOpen,
  onStudy,
  onReviewAll,
  onEdit,
  onExportDeck,
  onDelete,
  onCreate,
  onFromNote,
  onImport,
  onExport,
  onRestoreSamples,
}: DeckListProps) {
  if (decks.length === 0) {
    return (
      <AppLayout header={<AppHeader title="Deck vault" subtitle="No decks yet" />} bodyClassName="@container">
        <EmptyVault
          missingSamples={missingSamples}
          onCreate={onCreate}
          onFromNote={onFromNote}
          onImport={onImport}
          onRestoreSamples={onRestoreSamples}
        />
      </AppLayout>
    );
  }

  let cards = 0;
  let due = 0;
  let fresh = 0;
  let mastered = 0;
  let topics = 0;
  for (const deck of decks) {
    const summary = summaries.get(deck.id);
    topics += deck.topics.length;
    if (!summary) continue;
    cards += summary.cards;
    due += summary.due;
    fresh += summary.fresh;
    mastered += summary.mastery.mastered;
  }

  return (
    <AppLayout
      header={
        <AppHeader
          title="Deck vault"
          subtitle={status}
          actions={
            <>
              <HeaderAction icon={NotebookPen} label="From note" hint="Create a deck from one of your notes" onClick={onFromNote} />
              <HeaderAction icon={Upload} label="Import" hint="Import decks from JSON" onClick={onImport} />
              <HeaderAction icon={Download} label="Export" hint="Export decks as JSON" onClick={onExport} />
              <Button variant="primary" leadingIcon={Plus} onClick={onCreate}>
                New deck
              </Button>
            </>
          }
        />
      }
      bodyClassName="@container"
    >
      <div className="flex flex-col gap-6">
        {/* Totals */}
        <div className="grid grid-cols-2 gap-3 @xl:grid-cols-4">
          <StatTile label="Decks" value={decks.length} icon={Layers} deltaLabel={plural(topics, 'topic')} />
          <StatTile label="Cards" value={cards} icon={StickyNote} deltaLabel={fresh > 0 ? `${fresh} never studied` : 'All studied'} />
          {due > 0 ? (
            // The tile doubles as the "review everything due" action.
            <div className="group/due relative">
              <StatTile
                label="Due now"
                value={due}
                icon={AlarmClock}
                tone="accent"
                deltaLabel={
                  <span className="inline-flex items-center gap-1 text-accent">
                    Review now
                    <Play size={12} strokeWidth={2} aria-hidden className="transition-transform duration-120 ease-out-quint group-hover/due:translate-x-0.5" />
                  </span>
                }
                className="h-full"
              />
              <button
                type="button"
                onClick={onReviewAll}
                aria-label={`Review ${plural(due, 'due card')}`}
                className="focus-ring absolute inset-0 chamfer-md transition-colors duration-120 ease-out-quint hover:bg-surface-hover active:bg-surface-active"
              />
            </div>
          ) : (
            <StatTile label="Due now" value={0} icon={AlarmClock} deltaLabel="All caught up" />
          )}
          <StatTile
            label="Mastered"
            value={mastered}
            unit={`/ ${cards}`}
            icon={Trophy}
            deltaLabel={`${cards > 0 ? Math.round((mastered / cards) * 100) : 0}% of cards`}
          />
        </div>

        {/* Decks */}
        <section aria-label="Decks" className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @5xl:grid-cols-3">
          {decks.map((deck, i) => {
            const summary = summaries.get(deck.id);
            if (!summary) return null;
            return (
              <DeckCard
                key={deck.id}
                deck={deck}
                summary={summary}
                index={i}
                onOpen={onOpen}
                onStudy={onStudy}
                onEdit={onEdit}
                onExport={onExportDeck}
                onDelete={onDelete}
              />
            );
          })}
          <button
            type="button"
            onClick={onCreate}
            className="focus-ring group/new relative flex min-h-32 flex-col items-center justify-center gap-2 chamfer-md bg-steel-950/40 px-4 py-6 text-center transition-colors duration-120 ease-out-quint hover:bg-ember-500/5 active:bg-surface-active"
          >
            <DashedEdge className="text-steel-500 transition-colors duration-120 group-hover/new:text-ember-500/70" />
            <span className="armor-plate chamfer-sm flex size-9 items-center justify-center text-fg-subtle transition-colors duration-120 group-hover/new:text-ember-400">
              <Plus size={18} strokeWidth={1.75} aria-hidden />
            </span>
            <span className="engraved font-display text-xs font-semibold uppercase tracking-[0.16em] text-fg-muted group-hover/new:text-fg">Forge a new deck</span>
            <span className="text-xs text-fg-subtle">A language, a framework, an exam…</span>
          </button>
        </section>

        {missingSamples > 0 && (
          <div className="flex items-center justify-center gap-1 text-xs text-fg-subtle">
            <span>{plural(missingSamples, 'sample deck')} hidden.</span>
            <Button variant="ghost" size="sm" leadingIcon={ArchiveRestore} onClick={onRestoreSamples}>
              Restore
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export const DeckList = memo(DeckListInner);

// ─── One deck ───

interface DeckCardProps {
  deck: Deck;
  summary: DeckSummary;
  index: number;
  onOpen: (deckId: string) => void;
  onStudy: (deckId: string, tab: TrainingTab) => void;
  onEdit: (deckId: string) => void;
  onExport: (deckId: string) => void;
  onDelete: (deckId: string) => void;
}

const DeckCard = memo(function DeckCard({ deck, summary, index, onOpen, onStudy, onEdit, onExport, onDelete }: DeckCardProps) {
  const reduce = useReducedMotion();
  const pct = Math.round(summary.mastery.value * 100);
  const toReview = summary.due + summary.fresh;
  const allMastered = summary.cards > 0 && summary.mastery.mastered === summary.cards;

  const menuItems: MenuItem[] = [
    { id: 'review', label: 'Review', icon: TAB_ICONS.flashcards, disabled: summary.cards === 0 },
    { id: 'quiz', label: 'Quiz', icon: TAB_ICONS.quiz, disabled: summary.quizCards === 0 },
    { id: 'mock', label: 'Mock test', icon: TAB_ICONS.mock, disabled: summary.quizCards === 0 },
    { id: 'div-1', divider: true },
    { id: 'edit', label: 'Edit deck', icon: Pencil },
    { id: 'export', label: 'Export', icon: Download },
    { id: 'div-2', divider: true },
    { id: 'delete', label: 'Delete deck', icon: Trash2, danger: true },
  ];

  const onMenu = (id: string) => {
    if (id === 'review') onStudy(deck.id, 'flashcards');
    else if (id === 'quiz') onStudy(deck.id, 'quiz');
    else if (id === 'mock') onStudy(deck.id, 'mock');
    else if (id === 'edit') onEdit(deck.id);
    else if (id === 'export') onExport(deck.id);
    else if (id === 'delete') onDelete(deck.id);
  };

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...TRANSITION.panel, delay: Math.min(index, 8) * 0.03 }}
      style={deckStyle(deck.color)}
      className="group/deck armor-panel chamfer-md relative isolate flex min-w-0 flex-col overflow-hidden [--cut-tl:14px] [--cut-br:14px] transition-[border-color,background-color,box-shadow] duration-180 ease-out-quint hover:bg-steel-750/70 has-[:focus-visible]:ember-edge"
    >
      {/* The deck's hue: a faint wash behind the ring and a hairline along the top edge. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(110%_90%_at_0%_0%,color-mix(in_srgb,var(--deck)_13%,transparent),transparent_58%)]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-0.5 bg-linear-to-r from-transparent via-(--deck)/70 to-transparent"
      />

      {/* The whole card opens the deck; the actions sit above this button. */}
      <button
        type="button"
        onClick={() => onOpen(deck.id)}
        aria-label={`Open ${deck.name}`}
        className="focus-ring-inset absolute inset-0"
      />

      <div className="pointer-events-none relative flex items-start gap-3.5 p-4 pb-3">
        <MasteryRing value={summary.mastery.value} color={deck.color} size={52} title={`${pct}% mastery`}>
          <span className="text-xl leading-none">{deck.icon}</span>
        </MasteryRing>
        <div className="min-w-0 flex-1">
          <p className="hud-label truncate">
            {deck.isSample && <span className="text-fg-muted">Sample · </span>}
            {plural(deck.topics.length, 'topic')}
          </p>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-fg" title={deck.name}>
            {deck.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs text-fg-muted">{deck.description || 'No description yet.'}</p>
        </div>
        <div className="pointer-events-auto -mr-1.5 -mt-1.5 shrink-0">
          <Menu
            align="end"
            aria-label={`${deck.name} actions`}
            trigger={<IconButton icon={MoreHorizontal} size="sm" aria-label={`More actions for ${deck.name}`} />}
            items={menuItems}
            onSelect={onMenu}
          />
        </div>
      </div>

      <div className="pointer-events-none relative mt-auto flex min-h-11 items-center gap-2 border-t border-line px-4 py-2">
        {summary.cards === 0 ? (
          <span className="text-xs text-fg-subtle">No cards yet</span>
        ) : (
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="tabular font-mono text-ui font-medium text-fg">{pct}%</span>
            <span className="truncate text-xs text-fg-subtle">{plural(summary.cards, 'card')}</span>
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {allMastered && (
            <Badge tone="gold" size="sm" icon={Trophy}>
              Mastered
            </Badge>
          )}
          {summary.due > 0 && (
            <Badge tone="warning" size="sm">
              {summary.due} due
            </Badge>
          )}
          {summary.fresh > 0 && <Badge size="sm">{summary.fresh} new</Badge>}
          {toReview > 0 && (
            <span className="pointer-events-auto ml-0.5">
              <IconButton
                icon={Play}
                size="sm"
                variant="secondary"
                onClick={() => onStudy(deck.id, 'flashcards')}
                aria-label={`Review ${deck.name}`}
                tooltip="Review due and new cards"
              />
            </span>
          )}
        </span>
      </div>
    </motion.article>
  );
});

// ─── Empty vault ───

interface EmptyVaultProps {
  missingSamples: number;
  onCreate: () => void;
  onFromNote: () => void;
  onImport: () => void;
  onRestoreSamples: () => void;
}

function EmptyVault({ missingSamples, onCreate, onFromNote, onImport, onRestoreSamples }: EmptyVaultProps): ReactNode {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-2">
      <EmptyState
        size="lg"
        tone="accent"
        icon={Layers}
        title="No decks in the vault yet"
        description="A deck is anything you want to master: a language, a framework, an exam. Forge one, import a file, or turn a note into flashcards."
        actions={
          <>
            <Button variant="primary" leadingIcon={Plus} onClick={onCreate}>
              Forge a deck
            </Button>
            <Button variant="secondary" leadingIcon={NotebookPen} onClick={onFromNote}>
              From a note
            </Button>
            <Button variant="ghost" leadingIcon={Upload} onClick={onImport}>
              Import
            </Button>
          </>
        }
      />
      {missingSamples > 0 && (
        <Button variant="ghost" size="sm" leadingIcon={ArchiveRestore} onClick={onRestoreSamples}>
          Or restore the {plural(missingSamples, 'sample deck')} to look around first
        </Button>
      )}
    </div>
  );
}
