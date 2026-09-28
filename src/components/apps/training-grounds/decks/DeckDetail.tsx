// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault: one deck
// Mastery, study launchers (quiz, review, mock test, browse), and
// the topic → card editor: add, edit, move and delete with confirms.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownToLine,
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Layers,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Target,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  cardAnswerText,
  cardStrength,
  computeTopicMastery,
  isQuizCard,
  useLearningStore,
} from '@/stores/useLearningStore';
import type { Card, CardReview, Deck, Topic } from '@/types/learning';
import type { DeckTarget, TrainingTab } from '../deep-link';
import type { ConfirmRequest } from './Dialog';
import { MasteryRing } from './MasteryRing';
import {
  BTN_GHOST,
  BTN_PRIMARY,
  DIFFICULTY_META,
  ICON_BTN,
  INPUT,
  KIND_META,
  plural,
  withAlpha,
  type DeckSummary,
} from './deck-ui';

/** Cards shown per topic before "Show all". */
const PAGE = 40;

export interface DeckDetailActions {
  onBack: () => void;
  onEditDeck: () => void;
  onExport: () => void;
  onAddTopic: () => void;
  onEditTopic: (topicId: string) => void;
  /** topicId null = the deck's first topic. */
  onAddCard: (topicId: string | null) => void;
  onEditCard: (cardId: string) => void;
  onStudy: (target: DeckTarget, tab: TrainingTab) => void;
  confirm: (request: ConfirmRequest) => void;
  flash: (message: string) => void;
}

interface DeckDetailProps extends DeckDetailActions {
  deck: Deck;
  reviews: Readonly<Record<string, CardReview>>;
  summary: DeckSummary;
}

function matches(card: Card, query: string): boolean {
  return (
    card.prompt.toLowerCase().includes(query) ||
    cardAnswerText(card).toLowerCase().includes(query) ||
    (card.explanation?.toLowerCase().includes(query) ?? false) ||
    card.tags.some((t) => t.toLowerCase().includes(query)) ||
    (card.kind !== 'flashcard' && card.kind !== 'numeric' && card.options.some((o) => o.toLowerCase().includes(query)))
  );
}

function DeckDetailInner({
  deck,
  reviews,
  summary,
  onBack,
  onEditDeck,
  onExport,
  onAddTopic,
  onEditTopic,
  onAddCard,
  onEditCard,
  onStudy,
  confirm,
  flash,
}: DeckDetailProps) {
  const deleteDeck = useLearningStore((s) => s.deleteDeck);
  const deleteTopic = useLearningStore((s) => s.deleteTopic);
  const deleteCard = useLearningStore((s) => s.deleteCard);
  const resetProgress = useLearningStore((s) => s.resetProgress);

  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  const q = query.trim().toLowerCase();
  const topics = useMemo(
    () =>
      deck.topics.map((topic) => ({
        topic,
        mastery: computeTopicMastery(topic, reviews),
        quizCards: topic.cards.filter(isQuizCard).length,
        cards: q ? topic.cards.filter((c) => matches(c, q)) : topic.cards,
      })),
    [deck.topics, reviews, q]
  );
  const matchCount = topics.reduce((n, t) => n + t.cards.length, 0);

  const pct = Math.round(summary.mastery.value * 100);
  const toReview = summary.due + summary.fresh;
  const deckTarget: DeckTarget = { deckId: deck.id, topicId: null };

  const toggleSet = (set: ReadonlySet<string>, id: string): Set<string> => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const askDeleteDeck = () =>
    confirm({
      title: `Delete "${deck.name}"?`,
      message: (
        <>
          Its {plural(deck.topics.length, 'topic')}, {plural(summary.cards, 'card')} and all review progress will be
          erased.{' '}
          {deck.isSample
            ? 'It is a sample deck, so you can restore it later.'
            : 'Export it first if you might want it back.'}
        </>
      ),
      confirmLabel: 'Delete deck',
      onConfirm: () => {
        deleteDeck(deck.id);
        flash(`Deleted "${deck.name}"`);
        onBack();
      },
    });

  const askResetProgress = () =>
    confirm({
      title: 'Reset progress?',
      message: `Mastery, review schedule and answer history of all ${plural(summary.cards, 'card')} in "${deck.name}" go back to zero. The cards themselves stay.`,
      confirmLabel: 'Reset progress',
      onConfirm: () => {
        resetProgress(deck.id);
        flash(`Progress of "${deck.name}" reset`);
      },
    });

  const askDeleteTopic = (topic: Topic) =>
    confirm({
      title: `Delete topic "${topic.name}"?`,
      message:
        topic.cards.length > 0
          ? `Its ${plural(topic.cards.length, 'card')} and their progress will be erased.`
          : 'The topic is empty.',
      confirmLabel: 'Delete topic',
      onConfirm: () => {
        deleteTopic(deck.id, topic.id);
        flash(`Topic "${topic.name}" deleted`);
      },
    });

  const askDeleteCard = (card: Card) =>
    confirm({
      title: 'Delete this card?',
      message: (
        <>
          <span className="line-clamp-3 block rounded border border-white/10 bg-white/[0.03] px-2 py-1.5 text-white/80">
            {card.prompt}
          </span>
          <span className="mt-2 block">Its review progress goes with it.</span>
        </>
      ),
      confirmLabel: 'Delete card',
      onConfirm: () => {
        deleteCard(card.id);
        flash('Card deleted');
      },
    });

  const studyButtons: {
    tab: TrainingTab;
    label: string;
    icon: typeof Target;
    disabled: boolean;
    hint: string;
  }[] = [
    {
      tab: 'quiz',
      label: 'Quiz',
      icon: Target,
      disabled: summary.quizCards === 0,
      hint: summary.quizCards === 0 ? 'Needs MCQ, multi-select or numeric cards' : `${plural(summary.quizCards, 'quiz card')}`,
    },
    {
      tab: 'flashcards',
      label: toReview > 0 ? `Review · ${toReview}` : 'Review',
      icon: Layers,
      disabled: summary.cards === 0,
      hint: summary.due > 0 ? `${summary.due} due, ${summary.fresh} new` : 'Spaced-repetition review',
    },
    {
      tab: 'mock',
      label: 'Mock test',
      icon: Timer,
      disabled: summary.quizCards === 0,
      hint: 'Timed test over the quiz cards',
    },
    {
      tab: 'bank',
      label: 'Browse',
      icon: BookOpen,
      disabled: summary.cards === 0,
      hint: 'Every card with its answer',
    },
  ];

  return (
    <div className="space-y-4 p-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-white/50 hover:bg-white/5 hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All decks
      </button>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl border p-4"
        style={{
          borderColor: withAlpha(deck.color, 0.28),
          background: `linear-gradient(135deg, ${withAlpha(deck.color, 0.14)}, rgba(255,255,255,0.02) 70%)`,
        }}
      >
        <div className="flex flex-wrap items-start gap-4">
          <MasteryRing value={summary.mastery.value} color={deck.color} size={76} stroke={5} title={`${pct}% mastery`}>
            <span className="text-3xl">{deck.icon}</span>
          </MasteryRing>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-lg font-bold" style={{ color: deck.color }}>
                {deck.name}
              </h3>
              {deck.isSample && (
                <span className="shrink-0 rounded border border-white/15 px-1 text-[9px] uppercase tracking-wider text-white/40">
                  Sample
                </span>
              )}
            </div>
            {deck.description && <p className="mt-0.5 text-xs leading-relaxed text-white/55">{deck.description}</p>}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/50">
              <span className="font-mono" style={{ color: deck.color }}>
                {pct}% mastery
              </span>
              <span>{plural(deck.topics.length, 'topic')}</span>
              <span>{plural(summary.cards, 'card')}</span>
              <span>
                {summary.mastery.mastered}/{summary.cards} mastered
              </span>
              {summary.due > 0 && <span className="text-amber-200">{summary.due} due</span>}
              {summary.fresh > 0 && <span>{summary.fresh} new</span>}
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={onEditDeck} className={ICON_BTN} title="Edit deck" aria-label="Edit deck">
              <Pencil className="h-4 w-4" />
            </button>
            <button type="button" onClick={onExport} className={ICON_BTN} title="Export deck" aria-label="Export deck">
              <ArrowDownToLine className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={askResetProgress}
              disabled={summary.mastery.seen === 0}
              className={ICON_BTN}
              title="Reset progress"
              aria-label="Reset progress"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={askDeleteDeck}
              className={cn(ICON_BTN, 'hover:bg-red-500/15 hover:text-red-300')}
              title="Delete deck"
              aria-label="Delete deck"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Study launchers */}
        <div className="mt-4 grid grid-cols-2 gap-2 @xl:grid-cols-4">
          {studyButtons.map((b) => (
            <button
              key={b.tab}
              type="button"
              disabled={b.disabled}
              onClick={() => onStudy(deckTarget, b.tab)}
              title={b.hint}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-left text-xs text-white/80 transition-colors hover:border-white/25 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <b.icon className="h-4 w-4 shrink-0" style={{ color: deck.color }} />
              <span className="min-w-0">
                <span className="block font-semibold">{b.label}</span>
                <span className="block truncate text-[10px] text-white/40">{b.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[160px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${plural(summary.cards, 'card')}…`}
            aria-label="Search cards"
            className={cn(INPUT, 'py-1 pl-8 text-xs')}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/40 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button type="button" onClick={onAddTopic} className={BTN_GHOST}>
          <FolderPlus className="h-3.5 w-3.5" />
          Topic
        </button>
        <button type="button" onClick={() => onAddCard(null)} className={BTN_PRIMARY}>
          <Plus className="h-3.5 w-3.5" />
          Card
        </button>
      </div>

      {q && (
        <p className="text-[11px] text-white/40">
          {matchCount === 0 ? `No cards match “${query.trim()}”.` : `${plural(matchCount, 'card')} match “${query.trim()}”.`}
        </p>
      )}

      {/* Empty deck */}
      {deck.topics.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/15 px-6 py-10 text-center">
          <p className="font-mono text-[10px] tracking-[0.35em] text-cyan-300/60">EMPTY SHELL</p>
          <p className="mt-2 text-sm text-white/70">This deck has no cards yet.</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-white/40">
            Drop in a first card, or add topics to organize what is coming.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={() => onAddCard(null)} className={BTN_PRIMARY}>
              <Plus className="h-3.5 w-3.5" />
              Add first card
            </button>
            <button type="button" onClick={onAddTopic} className={BTN_GHOST}>
              <FolderPlus className="h-3.5 w-3.5" />
              Add topic
            </button>
          </div>
        </div>
      )}

      {/* Topics */}
      <div className="space-y-3">
        {topics.map(({ topic, mastery, quizCards, cards }) => {
          if (q && cards.length === 0) return null;
          const isCollapsed = !q && collapsed.has(topic.id);
          const showAll = q !== '' || expanded.has(topic.id);
          const visible = showAll ? cards : cards.slice(0, PAGE);
          const topicPct = Math.round(mastery.value * 100);
          return (
            <section key={topic.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02]">
              <header className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => toggleSet(c, topic.id))}
                  aria-expanded={!isCollapsed}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/40" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/40" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white/85">{topic.name}</span>
                    {topic.description && (
                      <span className="block truncate text-[10px] text-white/40">{topic.description}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-[10px] text-white/35">{topic.cards.length}</span>
                  <span
                    className="hidden h-1 w-16 shrink-0 overflow-hidden rounded-full bg-white/10 @md:block"
                    title={`${topicPct}% mastery`}
                  >
                    <span className="block h-full rounded-full" style={{ width: `${topicPct}%`, background: deck.color }} />
                  </span>
                </button>
                <div className="flex shrink-0 items-center">
                  {quizCards > 0 && (
                    <button
                      type="button"
                      onClick={() => onStudy({ deckId: deck.id, topicId: topic.id }, 'quiz')}
                      className={ICON_BTN}
                      title={`Quiz on ${topic.name}`}
                      aria-label={`Quiz on ${topic.name}`}
                    >
                      <Play className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onAddCard(topic.id)}
                    className={ICON_BTN}
                    title="Add a card here"
                    aria-label={`Add a card to ${topic.name}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditTopic(topic.id)}
                    className={ICON_BTN}
                    title="Edit topic"
                    aria-label={`Edit ${topic.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => askDeleteTopic(topic)}
                    className={cn(ICON_BTN, 'hover:bg-red-500/15 hover:text-red-300')}
                    title="Delete topic"
                    aria-label={`Delete ${topic.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </header>

              {!isCollapsed && (
                <div className="space-y-1.5 border-t border-white/[0.06] p-2">
                  {cards.length === 0 && (
                    <button
                      type="button"
                      onClick={() => onAddCard(topic.id)}
                      className="w-full rounded-lg border border-dashed border-white/10 py-3 text-xs text-white/40 hover:border-cyan-400/30 hover:text-cyan-200"
                    >
                      No cards yet. Add the first one.
                    </button>
                  )}
                  {visible.map((card) => (
                    <CardRow
                      key={card.id}
                      card={card}
                      color={deck.color}
                      strength={reviews[card.id] ? cardStrength(reviews[card.id]) : null}
                      onEdit={() => onEditCard(card.id)}
                      onDelete={() => askDeleteCard(card)}
                    />
                  ))}
                  {visible.length < cards.length && (
                    <button
                      type="button"
                      onClick={() => setExpanded((e) => toggleSet(e, topic.id))}
                      className="w-full rounded-md py-1.5 text-[11px] text-cyan-300/70 hover:bg-cyan-400/5 hover:text-cyan-200"
                    >
                      Show all {cards.length} cards
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export const DeckDetail = memo(DeckDetailInner);

// ─── One card ───

interface CardRowProps {
  card: Card;
  color: string;
  /** 0..1, null for a card never answered. */
  strength: number | null;
  onEdit: () => void;
  onDelete: () => void;
}

const CardRow = memo(function CardRow({ card, color, strength, onEdit, onDelete }: CardRowProps) {
  const kind = KIND_META[card.kind];
  const difficulty = DIFFICULTY_META[card.difficulty];
  return (
    <div className="group flex items-start gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2 transition-colors hover:border-white/15">
      <span className={cn('mt-0.5 shrink-0 rounded border px-1 py-px font-mono text-[9px] tracking-wider', kind.badge)} title={kind.label}>
        {kind.short}
      </span>
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left" title="Edit card">
        <span className="line-clamp-2 block whitespace-pre-wrap text-[13px] leading-snug text-white/85">{card.prompt}</span>
        <span className="mt-0.5 line-clamp-1 block text-[11px] text-emerald-300/70">→ {cardAnswerText(card)}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-white/40">
          <span className="flex items-center gap-1">
            <span className={cn('h-1.5 w-1.5 rounded-full', difficulty.dot)} />
            {difficulty.label}
          </span>
          {card.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-cyan-300/50">
              #{tag}
            </span>
          ))}
          {strength === null ? (
            <span className="text-white/30">new</span>
          ) : (
            <span className="flex items-center gap-1" title={`Strength ${Math.round(strength * 100)}%`}>
              <span className="h-1 w-10 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full" style={{ width: `${Math.round(strength * 100)}%`, background: color }} />
              </span>
            </span>
          )}
        </span>
      </button>
      <div className="flex shrink-0 items-center opacity-50 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button type="button" onClick={onEdit} className={ICON_BTN} aria-label="Edit card" title="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className={cn(ICON_BTN, 'hover:bg-red-500/15 hover:text-red-300')}
          aria-label="Delete card"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
});
