// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault (Training Grounds › Decks)
// Home of the "learn anything" system: the deck list with mastery and
// due counts, the deck / topic / card editors, import and export,
// deck-from-note, and launchers into the study tabs.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { deckCards, useLearningStore } from '@/stores/useLearningStore';
import { SAMPLE_DECK_IDS } from '@/data/learning';
import { TRANSITION } from '@/styles/tokens';
import type { CardKind, ImportResult } from '@/types/learning';
import type { DeckTarget, TrainingTab } from '../deep-link';
import { CardEditor } from './CardEditor';
import { ConfirmDialog, type ConfirmRequest } from './Dialog';
import { DeckDetail } from './DeckDetail';
import { DeckForm } from './DeckForm';
import { DeckList } from './DeckList';
import { NoteToDeckDialog } from './NoteToDeckDialog';
import { TopicForm } from './TopicForm';
import { TransferDialog, type TransferMode } from './TransferDialog';
import { lastStudiedAt, plural, summarizeDeck, timeAgo, useMinuteNow } from './deck-ui';

type DeckDialog =
  | { kind: 'deck'; deckId: string | null }
  | { kind: 'topic'; deckId: string; topicId: string | null }
  | { kind: 'card'; deckId: string; cardId: string | null; topicId: string | null }
  | { kind: 'confirm'; request: ConfirmRequest }
  | { kind: 'transfer'; mode: TransferMode; deckIds: string[] | null }
  | { kind: 'note' };

/**
 * The dialog on screen. A closed dialog stays mounted (open: false) so the
 * sheet can animate out; the next one replaces it under a new key.
 */
interface DialogState {
  spec: DeckDialog;
  key: number;
  open: boolean;
}

interface Flash {
  id: number;
  text: string;
  tone: 'ok' | 'warn';
}

export interface DecksPanelProps {
  /** Deck shown in detail (null = the list). Owned by the shell so it survives tab switches. */
  openDeckId: string | null;
  onOpenDeck: (deckId: string | null) => void;
  /** Jump to a study tab with the deck (or one topic) preselected; null = no particular deck. */
  onStudy: (target: DeckTarget | null, tab: TrainingTab) => void;
}

function DecksPanelInner({ openDeckId, onOpenDeck, onStudy }: DecksPanelProps) {
  const decks = useLearningStore((s) => s.decks);
  const reviews = useLearningStore((s) => s.reviews);
  const restoreSampleDecks = useLearningStore((s) => s.restoreSampleDecks);
  const deleteDeck = useLearningStore((s) => s.deleteDeck);
  const reduce = useReducedMotion();

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [flashState, setFlashState] = useState<Flash | null>(null);
  // New cards start as the kind used last.
  const [lastKind, setLastKind] = useState<CardKind>('flashcard');
  const now = useMinuteNow();

  // Flash messages fade on their own.
  useEffect(() => {
    if (!flashState) return;
    const id = window.setTimeout(() => setFlashState(null), 2800);
    return () => window.clearTimeout(id);
  }, [flashState]);

  const summaries = useMemo(
    () => new Map(decks.map((d) => [d.id, summarizeDeck(d, reviews, now)] as const)),
    [decks, reviews, now]
  );
  const missingSamples = SAMPLE_DECK_IDS.filter((id) => !decks.some((d) => d.id === id)).length;
  const lastStudied = useMemo(() => lastStudiedAt(reviews), [reviews]);
  const status = lastStudied ? `Last session ${timeAgo(lastStudied, now)}` : 'Not studied yet';
  const deck = openDeckId ? decks.find((d) => d.id === openDeckId) : undefined;
  const summary = deck ? summaries.get(deck.id) : undefined;

  const flash = useCallback(
    (text: string, tone: Flash['tone'] = 'ok') => setFlashState((prev) => ({ id: (prev?.id ?? 0) + 1, text, tone })),
    []
  );
  const show = useCallback(
    (spec: DeckDialog) => setDialog((prev) => ({ spec, key: (prev?.key ?? 0) + 1, open: true })),
    []
  );
  const close = useCallback(() => setDialog((prev) => (prev?.open ? { ...prev, open: false } : prev)), []);
  const confirm = useCallback((request: ConfirmRequest) => show({ kind: 'confirm', request }), [show]);
  const savedAndClose = useCallback(
    (message: string) => {
      close();
      flash(message);
    },
    [close, flash]
  );

  const askDeleteDeck = useCallback(
    (deckId: string) => {
      const target = useLearningStore.getState().decks.find((d) => d.id === deckId);
      if (!target) return;
      const cards = deckCards(target).length;
      confirm({
        title: `Delete "${target.name}"?`,
        message: (
          <>
            Its {plural(target.topics.length, 'topic')}, {plural(cards, 'card')} and all review progress will be erased.{' '}
            {target.isSample ? 'It is a sample deck, so you can restore it later.' : 'Export it first if you might want it back.'}
          </>
        ),
        confirmLabel: 'Delete deck',
        onConfirm: () => {
          deleteDeck(target.id);
          flash(`Deleted "${target.name}"`);
          if (openDeckId === target.id) onOpenDeck(null);
        },
      });
    },
    [confirm, deleteDeck, flash, onOpenDeck, openDeckId]
  );

  const restoreSamples = () => {
    const restored = restoreSampleDecks();
    flash(restored > 0 ? `Restored ${plural(restored, 'sample deck')}` : 'The sample decks are already here');
  };

  const onImported = (result: ImportResult) => {
    if (!result.ok) return;
    const decksIn = result.decksAdded + result.decksReplaced;
    flash(
      `Imported ${plural(decksIn, 'deck')} · ${plural(result.cardsImported, 'card')}${
        result.errors.length > 0 ? ` (${plural(result.errors.length, 'warning')})` : ''
      }`,
      result.errors.length > 0 ? 'warn' : 'ok'
    );
  };

  // ─── Dialog ───

  let dialogNode: ReactNode = null;
  if (dialog) {
    const { spec, key, open } = dialog;
    switch (spec.kind) {
      case 'deck': {
        const target = spec.deckId ? decks.find((d) => d.id === spec.deckId) ?? null : null;
        dialogNode = (
          <DeckForm
            key={key}
            open={open}
            deck={target}
            onClose={close}
            onSaved={(deckId, created) => {
              close();
              if (created) {
                onOpenDeck(deckId);
                flash('Deck forged. Time for its first card.');
              } else {
                flash('Deck saved');
              }
            }}
          />
        );
        break;
      }
      case 'topic': {
        const target = decks.find((d) => d.id === spec.deckId);
        if (target) {
          dialogNode = (
            <TopicForm
              key={key}
              open={open}
              deckId={target.id}
              topic={spec.topicId ? target.topics.find((t) => t.id === spec.topicId) ?? null : null}
              onClose={close}
              onSaved={savedAndClose}
            />
          );
        }
        break;
      }
      case 'card': {
        const target = decks.find((d) => d.id === spec.deckId);
        if (target) {
          dialogNode = (
            <CardEditor
              key={key}
              open={open}
              deck={target}
              cardId={spec.cardId}
              topicId={spec.topicId}
              defaultKind={lastKind}
              onKindUsed={setLastKind}
              onClose={close}
              onSaved={savedAndClose}
            />
          );
        }
        break;
      }
      case 'confirm':
        dialogNode = <ConfirmDialog key={key} open={open} {...spec.request} onClose={close} />;
        break;
      case 'transfer':
        dialogNode = (
          <TransferDialog
            key={key}
            open={open}
            initialMode={spec.mode}
            initialDeckIds={spec.deckIds}
            onClose={close}
            onImported={onImported}
          />
        );
        break;
      case 'note':
        dialogNode = (
          <NoteToDeckDialog
            key={key}
            open={open}
            onClose={close}
            onCreated={(deckId, cardCount) => {
              close();
              onOpenDeck(deckId);
              flash(`Deck forged from your note: ${plural(cardCount, 'card')}`);
            }}
          />
        );
        break;
    }
  }

  return (
    <div className="@container relative h-full">
      <motion.div
        key={deck ? `deck:${deck.id}` : 'list'}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={TRANSITION.small}
        className="h-full"
      >
        {deck && summary ? (
          <DeckDetail
            deck={deck}
            reviews={reviews}
            summary={summary}
            onBack={() => onOpenDeck(null)}
            onEditDeck={() => show({ kind: 'deck', deckId: deck.id })}
            onExport={() => show({ kind: 'transfer', mode: 'export', deckIds: [deck.id] })}
            onDeleteDeck={() => askDeleteDeck(deck.id)}
            onAddTopic={() => show({ kind: 'topic', deckId: deck.id, topicId: null })}
            onEditTopic={(topicId) => show({ kind: 'topic', deckId: deck.id, topicId })}
            onAddCard={(topicId) => show({ kind: 'card', deckId: deck.id, cardId: null, topicId })}
            onEditCard={(cardId) => show({ kind: 'card', deckId: deck.id, cardId, topicId: null })}
            onStudy={onStudy}
            confirm={confirm}
            flash={flash}
          />
        ) : (
          <DeckList
            decks={decks}
            summaries={summaries}
            missingSamples={missingSamples}
            status={status}
            onOpen={onOpenDeck}
            onStudy={(deckId, tab) => onStudy({ deckId, topicId: null }, tab)}
            onReviewAll={() => onStudy(null, 'flashcards')}
            onEdit={(deckId) => show({ kind: 'deck', deckId })}
            onExportDeck={(deckId) => show({ kind: 'transfer', mode: 'export', deckIds: [deckId] })}
            onDelete={askDeleteDeck}
            onCreate={() => show({ kind: 'deck', deckId: null })}
            onFromNote={() => show({ kind: 'note' })}
            onImport={() => show({ kind: 'transfer', mode: 'import', deckIds: null })}
            onExport={() => show({ kind: 'transfer', mode: 'export', deckIds: null })}
            onRestoreSamples={restoreSamples}
          />
        )}
      </motion.div>

      {/* Flash message (a persistent live region, so screen readers hear every one). */}
      <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-5">
        <AnimatePresence>
          {flashState && (
            <motion.div
              key={flashState.id}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: reduce ? 0 : 4, transition: TRANSITION.hover }}
              transition={TRANSITION.small}
              className="armor-popover chamfer-md flex min-w-0 max-w-full items-center gap-2.5 py-2 pl-3 pr-4 text-ui text-fg"
            >
              {flashState.tone === 'ok' ? (
                <CircleCheck size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-success" />
              ) : (
                <TriangleAlert size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-warning" />
              )}
              <span className="truncate">{flashState.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {dialogNode}
    </div>
  );
}

export const DecksPanel = memo(DecksPanelInner);
