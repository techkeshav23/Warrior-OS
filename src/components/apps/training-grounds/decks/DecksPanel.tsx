// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault (Training Grounds › Decks)
// Home of the "learn anything" system: the deck list with mastery and
// due counts, the deck / topic / card editors, import and export,
// deck-from-note, and launchers into the study tabs.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLearningStore } from '@/stores/useLearningStore';
import { SAMPLE_DECK_IDS } from '@/data/learning';
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
import { plural, summarizeDeck } from './deck-ui';

type DeckDialog =
  | { kind: 'deck'; deckId: string | null }
  | { kind: 'topic'; deckId: string; topicId: string | null }
  | { kind: 'card'; deckId: string; cardId: string | null; topicId: string | null }
  | { kind: 'confirm'; request: ConfirmRequest }
  | { kind: 'transfer'; mode: TransferMode; deckIds: string[] | null }
  | { kind: 'note' };

interface Flash {
  id: number;
  text: string;
  tone: 'ok' | 'warn';
}

export interface DecksPanelProps {
  /** Deck shown in detail (null = the list). Owned by the shell so it survives tab switches. */
  openDeckId: string | null;
  onOpenDeck: (deckId: string | null) => void;
  /** Jump to a study tab with the deck (or one topic) preselected. */
  onStudy: (target: DeckTarget, tab: TrainingTab) => void;
}

function DecksPanelInner({ openDeckId, onOpenDeck, onStudy }: DecksPanelProps) {
  const decks = useLearningStore((s) => s.decks);
  const reviews = useLearningStore((s) => s.reviews);
  const restoreSampleDecks = useLearningStore((s) => s.restoreSampleDecks);

  const [dialog, setDialog] = useState<DeckDialog | null>(null);
  const [flashState, setFlashState] = useState<Flash | null>(null);
  // New cards start as the kind used last.
  const [lastKind, setLastKind] = useState<CardKind>('flashcard');

  // `now` ticks once per minute: enough for due counts, and it keeps render pure.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

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
  const deck = openDeckId ? decks.find((d) => d.id === openDeckId) : undefined;
  const summary = deck ? summaries.get(deck.id) : undefined;

  const flash = useCallback(
    (text: string, tone: Flash['tone'] = 'ok') => setFlashState((prev) => ({ id: (prev?.id ?? 0) + 1, text, tone })),
    []
  );
  const close = useCallback(() => setDialog(null), []);
  const confirm = useCallback((request: ConfirmRequest) => setDialog({ kind: 'confirm', request }), []);
  const savedAndClose = useCallback(
    (message: string) => {
      setDialog(null);
      flash(message);
    },
    [flash]
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
    switch (dialog.kind) {
      case 'deck': {
        const target = dialog.deckId ? decks.find((d) => d.id === dialog.deckId) ?? null : null;
        dialogNode = (
          <DeckForm
            key="deck"
            deck={target}
            onClose={close}
            onSaved={(deckId, created) => {
              setDialog(null);
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
        const target = decks.find((d) => d.id === dialog.deckId);
        if (target) {
          dialogNode = (
            <TopicForm
              key="topic"
              deckId={target.id}
              topic={dialog.topicId ? target.topics.find((t) => t.id === dialog.topicId) ?? null : null}
              onClose={close}
              onSaved={savedAndClose}
            />
          );
        }
        break;
      }
      case 'card': {
        const target = decks.find((d) => d.id === dialog.deckId);
        if (target) {
          dialogNode = (
            <CardEditor
              key="card"
              deck={target}
              cardId={dialog.cardId}
              topicId={dialog.topicId}
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
        dialogNode = <ConfirmDialog key="confirm" {...dialog.request} onClose={close} />;
        break;
      case 'transfer':
        dialogNode = (
          <TransferDialog
            key="transfer"
            initialMode={dialog.mode}
            initialDeckIds={dialog.deckIds}
            onClose={close}
            onImported={onImported}
          />
        );
        break;
      case 'note':
        dialogNode = (
          <NoteToDeckDialog
            key="note"
            onClose={close}
            onCreated={(deckId, cardCount) => {
              setDialog(null);
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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        className="h-full overflow-y-auto"
      >
        {deck && summary ? (
          <DeckDetail
            deck={deck}
            reviews={reviews}
            summary={summary}
            onBack={() => onOpenDeck(null)}
            onEditDeck={() => setDialog({ kind: 'deck', deckId: deck.id })}
            onExport={() => setDialog({ kind: 'transfer', mode: 'export', deckIds: [deck.id] })}
            onAddTopic={() => setDialog({ kind: 'topic', deckId: deck.id, topicId: null })}
            onEditTopic={(topicId) => setDialog({ kind: 'topic', deckId: deck.id, topicId })}
            onAddCard={(topicId) => setDialog({ kind: 'card', deckId: deck.id, cardId: null, topicId })}
            onEditCard={(cardId) => setDialog({ kind: 'card', deckId: deck.id, cardId, topicId: null })}
            onStudy={onStudy}
            confirm={confirm}
            flash={flash}
          />
        ) : (
          <DeckList
            decks={decks}
            summaries={summaries}
            missingSamples={missingSamples}
            onOpen={onOpenDeck}
            onReview={(deckId) => onStudy({ deckId, topicId: null }, 'flashcards')}
            onCreate={() => setDialog({ kind: 'deck', deckId: null })}
            onFromNote={() => setDialog({ kind: 'note' })}
            onImport={() => setDialog({ kind: 'transfer', mode: 'import', deckIds: null })}
            onExport={() => setDialog({ kind: 'transfer', mode: 'export', deckIds: null })}
            onRestoreSamples={restoreSamples}
          />
        )}
      </motion.div>

      {/* Flash message */}
      <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-4">
        <AnimatePresence>
          {flashState && (
            <motion.div
              key={flashState.id}
              role="status"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={cn(
                'flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs shadow-lg shadow-black/40 backdrop-blur',
                flashState.tone === 'ok'
                  ? 'border-emerald-400/30 bg-emerald-950/80 text-emerald-100'
                  : 'border-amber-400/30 bg-amber-950/80 text-amber-100'
              )}
            >
              {flashState.tone === 'ok' ? (
                <CircleCheck className="h-3.5 w-3.5 text-emerald-300" />
              ) : (
                <TriangleAlert className="h-3.5 w-3.5 text-amber-300" />
              )}
              {flashState.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>{dialogNode}</AnimatePresence>
    </div>
  );
}

export const DecksPanel = memo(DecksPanelInner);
