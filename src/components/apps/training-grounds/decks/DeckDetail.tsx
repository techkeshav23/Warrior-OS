// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault: one deck
// Mastery hero with the study launchers (quiz, review, mock test,
// browse), then the topic → card editor: add, edit, move and delete,
// every destructive step behind a confirm.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  ChevronRight,
  CornerDownRight,
  Download,
  FolderPlus,
  Layers,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  SearchX,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { AppHeader, AppLayout, Badge, Button, EmptyState, IconButton, Menu, SearchField, TONE_DOT } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  MASTERED_THRESHOLD,
  cardAnswerText,
  cardStrength,
  computeTopicMastery,
  isQuizCard,
  useLearningStore,
} from '@/stores/useLearningStore';
import { TRANSITION } from '@/styles/tokens';
import type { Card, CardReview, Deck, Topic } from '@/types/learning';
import type { DeckTarget, TrainingTab } from '../deep-link';
import type { ConfirmRequest } from './Dialog';
import { MasteryRing } from './MasteryRing';
import { DIFFICULTY_META, KIND_META, TAB_ICONS, deckStyle, plural, type DeckSummary } from './deck-ui';

/** Cards shown per topic before "Show all". */
const PAGE = 40;

export interface DeckDetailActions {
  onBack: () => void;
  onEditDeck: () => void;
  onExport: () => void;
  onDeleteDeck: () => void;
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

interface StudyLauncher {
  tab: TrainingTab;
  label: string;
  icon: LucideIcon;
  disabled: boolean;
  /** Full explanation (hover text). */
  hint: string;
  /** One short line under the label. */
  short: string;
  /** Count shown next to the label (due + new for Review). */
  count?: number;
}

function DeckDetailInner({
  deck,
  reviews,
  summary,
  onBack,
  onEditDeck,
  onExport,
  onDeleteDeck,
  onAddTopic,
  onEditTopic,
  onAddCard,
  onEditCard,
  onStudy,
  confirm,
  flash,
}: DeckDetailProps) {
  const deleteTopic = useLearningStore((s) => s.deleteTopic);
  const deleteCard = useLearningStore((s) => s.deleteCard);
  const resetProgress = useLearningStore((s) => s.resetProgress);
  const reduce = useReducedMotion();

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
      message: 'Its review progress goes with it.',
      detail: (
        <p className="line-clamp-3 whitespace-pre-wrap rounded-control bg-surface-2 px-3 py-2 text-ui text-fg">
          {card.prompt}
        </p>
      ),
      confirmLabel: 'Delete card',
      onConfirm: () => {
        deleteCard(card.id);
        flash('Card deleted');
      },
    });

  const reviewHint = summary.due > 0 ? `${summary.due} due, ${summary.fresh} new` : 'Spaced-repetition review';
  const launchers: StudyLauncher[] = [
    {
      tab: 'quiz',
      label: 'Quiz',
      icon: TAB_ICONS.quiz,
      disabled: summary.quizCards === 0,
      hint: summary.quizCards === 0 ? 'Needs MCQ, multi-select or numeric cards' : plural(summary.quizCards, 'quiz card'),
      short: summary.quizCards === 0 ? 'No quiz cards' : plural(summary.quizCards, 'quiz card'),
    },
    {
      tab: 'flashcards',
      label: 'Review',
      icon: TAB_ICONS.flashcards,
      disabled: summary.cards === 0,
      hint: reviewHint,
      short: summary.due > 0 ? `${summary.due} due, ${summary.fresh} new` : summary.fresh > 0 ? `${summary.fresh} new` : 'Spaced repetition',
      count: toReview > 0 ? toReview : undefined,
    },
    {
      tab: 'mock',
      label: 'Mock test',
      icon: TAB_ICONS.mock,
      disabled: summary.quizCards === 0,
      hint: 'Timed test over the quiz cards',
      short: 'Timed test',
    },
    {
      tab: 'bank',
      label: 'Browse',
      icon: TAB_ICONS.bank,
      disabled: summary.cards === 0,
      hint: 'Every card with its answer',
      short: 'All answers',
    },
  ];

  const stats: { label: string; value: string; tone?: string }[] = [
    { label: 'Topics', value: String(deck.topics.length) },
    { label: 'Cards', value: String(summary.cards) },
    { label: 'Mastered', value: `${summary.mastery.mastered}/${summary.cards}` },
    { label: 'Due', value: String(summary.due), tone: summary.due > 0 ? 'text-warning' : undefined },
    { label: 'New', value: String(summary.fresh) },
  ];

  return (
    <AppLayout
      header={
        <AppHeader
          leading={<IconButton icon={ArrowLeft} aria-label="All decks" tooltip="Back to the vault" tooltipSide="bottom" onClick={onBack} />}
          title={<span title={deck.name}>{deck.name}</span>}
          subtitle={
            <>
              Deck vault
              <span className="text-fg-faint"> / </span>
              {deck.isSample ? 'Sample deck' : plural(summary.cards, 'card')}
            </>
          }
          actions={
            <>
              {/* Wide panels: every deck action as an icon button. */}
              <div className="hidden items-center gap-0.5 @2xl:flex">
                <IconButton icon={Pencil} aria-label="Edit deck" tooltip tooltipSide="bottom" onClick={onEditDeck} />
                <IconButton icon={Download} aria-label="Export deck" tooltip tooltipSide="bottom" onClick={onExport} />
                <IconButton
                  icon={RotateCcw}
                  aria-label="Reset progress"
                  tooltip
                  tooltipSide="bottom"
                  onClick={askResetProgress}
                  disabled={summary.mastery.seen === 0}
                />
                <IconButton
                  icon={Trash2}
                  variant="ghost-danger"
                  aria-label="Delete deck"
                  tooltip
                  tooltipSide="bottom"
                  onClick={onDeleteDeck}
                />
              </div>
              {/* Narrow panels: edit stays, the rest folds into a menu. */}
              <div className="flex items-center gap-0.5 @2xl:hidden">
                <IconButton icon={Pencil} aria-label="Edit deck" tooltip tooltipSide="bottom" onClick={onEditDeck} />
                <Menu
                  align="end"
                  aria-label="Deck actions"
                  trigger={<IconButton icon={MoreHorizontal} aria-label="More deck actions" />}
                  items={[
                    { id: 'export', label: 'Export deck', icon: Download },
                    { id: 'reset', label: 'Reset progress', icon: RotateCcw, disabled: summary.mastery.seen === 0 },
                    { id: 'div', divider: true },
                    { id: 'delete', label: 'Delete deck', icon: Trash2, danger: true },
                  ]}
                  onSelect={(id) => {
                    if (id === 'export') onExport();
                    else if (id === 'reset') askResetProgress();
                    else if (id === 'delete') onDeleteDeck();
                  }}
                />
              </div>
              <span aria-hidden className="mx-1 h-5 w-px bg-line-strong" />
              <span className="hidden @xl:contents">
                <Button variant="primary" leadingIcon={Plus} onClick={() => onAddCard(null)}>
                  Add card
                </Button>
              </span>
              <span className="contents @xl:hidden">
                <IconButton
                  icon={Plus}
                  variant="primary"
                  aria-label="Add card"
                  tooltip
                  tooltipSide="bottom"
                  onClick={() => onAddCard(null)}
                />
              </span>
            </>
          }
        />
      }
      bodyClassName="@container"
    >
      <div className="flex flex-col gap-6" style={deckStyle(deck.color)}>
        {/* Hero: mastery, numbers, study launchers */}
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={TRANSITION.panel}
          aria-label="Deck overview"
          className="glass-panel relative isolate overflow-hidden rounded-card"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(80%_140%_at_0%_0%,color-mix(in_srgb,var(--deck)_15%,transparent),transparent_60%)]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-(--deck)/70 to-transparent"
          />

          <div className="flex flex-col gap-4 p-5 @3xl:flex-row @3xl:items-center @3xl:gap-6">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <MasteryRing value={summary.mastery.value} color={deck.color} size={84} stroke={5} title={`${pct}% mastery`}>
                <span className="text-3xl leading-none">{deck.icon}</span>
              </MasteryRing>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="tabular font-display text-3xl font-semibold leading-none text-fg">
                    {pct}
                    <span className="ml-0.5 text-lg text-fg-muted">%</span>
                  </span>
                  <span className="hud-label">Mastery</span>
                </div>
                <p className="mt-2 line-clamp-2 max-w-prose text-ui text-fg-muted">
                  {deck.description || 'No description yet. Edit the deck to say what it covers.'}
                </p>
              </div>
            </div>
            <dl className="grid shrink-0 grid-cols-3 gap-x-5 gap-y-3 border-t border-line pt-4 @lg:grid-cols-5 @3xl:border-t-0 @3xl:border-l @3xl:pl-6 @3xl:pt-0">
              {stats.map((s) => (
                <div key={s.label} className="flex min-w-0 flex-col gap-1">
                  <dt className="hud-label">{s.label}</dt>
                  <dd className={cn('tabular font-mono text-sm font-medium', s.tone ?? 'text-fg')}>{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-line bg-ink-950/20 p-3 @xl:grid-cols-4">
            {launchers.map((b) => (
              <button
                key={b.tab}
                type="button"
                disabled={b.disabled}
                onClick={() => onStudy(deckTarget, b.tab)}
                title={b.hint}
                className="focus-ring group/launch flex min-w-0 items-center gap-3 rounded-control border border-line bg-surface-2 px-3 py-2.5 text-left transition-colors duration-120 ease-out-quint hover:border-line-strong hover:bg-surface-hover active:bg-surface-active disabled:pointer-events-none disabled:opacity-45"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-control border border-line bg-ink-800 text-(--deck) transition-colors duration-120 group-hover/launch:border-line-strong">
                  <b.icon size={16} strokeWidth={1.75} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-ui font-medium text-fg">
                    {b.label}
                    {b.count !== undefined && (
                      <span className="tabular rounded-full bg-warning/12 px-1.5 font-mono text-2xs leading-4 text-warning">
                        {b.count}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-fg-subtle">{b.short}</span>
                </span>
              </button>
            ))}
          </div>
        </motion.section>

        {/* Topics */}
        {deck.topics.length === 0 ? (
          <div className="glass-panel rounded-card">
            <EmptyState
              icon={Layers}
              title="This deck has no cards yet"
              description="Drop in a first card, or add topics to organize what is coming."
              actions={
                <>
                  <Button variant="secondary" leadingIcon={Plus} onClick={() => onAddCard(null)}>
                    Add first card
                  </Button>
                  <Button variant="ghost" leadingIcon={FolderPlus} onClick={onAddTopic}>
                    Add topic
                  </Button>
                </>
              }
            />
          </div>
        ) : (
          <section aria-label="Topics" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="flex items-baseline gap-2">
                <h2 className="text-sm font-semibold text-fg">Topics</h2>
                <span className="tabular font-mono text-xs text-fg-subtle">{deck.topics.length}</span>
              </div>
              <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
                <SearchField
                  size="sm"
                  value={query}
                  onValueChange={setQuery}
                  placeholder={`Search ${plural(summary.cards, 'card')}…`}
                  aria-label="Search cards"
                  wrapperClassName="max-w-64"
                />
                <Button size="sm" variant="secondary" leadingIcon={FolderPlus} onClick={onAddTopic}>
                  New topic
                </Button>
              </div>
            </div>

            {q && matchCount > 0 && (
              <p className="text-xs text-fg-subtle" role="status">
                {plural(matchCount, 'card')} match “{query.trim()}”.
              </p>
            )}

            {q && matchCount === 0 && (
              <div className="glass-panel rounded-card">
                <EmptyState
                  size="sm"
                  icon={SearchX}
                  title={`No cards match “${query.trim()}”`}
                  description="Search looks at questions, answers, options, explanations and tags."
                  actions={
                    <Button size="sm" variant="ghost" onClick={() => setQuery('')}>
                      Clear search
                    </Button>
                  }
                />
              </div>
            )}

            {topics.map(({ topic, mastery, quizCards, cards }) => {
              if (q && cards.length === 0) return null;
              const isCollapsed = !q && collapsed.has(topic.id);
              const showAll = q !== '' || expanded.has(topic.id);
              const visible = showAll ? cards : cards.slice(0, PAGE);
              const topicPct = Math.round(mastery.value * 100);
              return (
                <section key={topic.id} className="glass-panel overflow-hidden rounded-card" aria-label={topic.name}>
                  <header className="flex items-center gap-1 py-1.5 pl-1.5 pr-2">
                    <button
                      type="button"
                      onClick={() => setCollapsed((c) => toggleSet(c, topic.id))}
                      aria-expanded={!isCollapsed}
                      className="focus-ring-inset flex min-w-0 flex-1 items-center gap-2.5 rounded-control px-2 py-1.5 text-left transition-colors duration-120 ease-out-quint hover:bg-surface-hover"
                    >
                      <ChevronRight
                        size={16}
                        strokeWidth={1.75}
                        aria-hidden
                        className={cn(
                          'shrink-0 text-fg-subtle transition-transform duration-180 ease-out-quint',
                          !isCollapsed && 'rotate-90'
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-ui font-semibold text-fg" title={topic.name}>
                          {topic.name}
                        </span>
                        {topic.description && (
                          <span className="block truncate text-xs text-fg-subtle" title={topic.description}>
                            {topic.description}
                          </span>
                        )}
                      </span>
                      <span className="tabular shrink-0 font-mono text-xs text-fg-subtle">{plural(topic.cards.length, 'card')}</span>
                      <span className="hidden shrink-0 items-center gap-2 @lg:flex" title={`${topicPct}% mastery`}>
                        <span className="block h-1 w-16 overflow-hidden rounded-full bg-ink-600/70">
                          <span className="block h-full rounded-full bg-(--deck)" style={{ width: `${topicPct}%` }} />
                        </span>
                        <span className="tabular w-8 text-right font-mono text-xs text-fg-muted">{topicPct}%</span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {quizCards > 0 && (
                        <IconButton
                          icon={Play}
                          size="sm"
                          onClick={() => onStudy({ deckId: deck.id, topicId: topic.id }, 'quiz')}
                          aria-label={`Quiz on ${topic.name}`}
                          tooltip
                        />
                      )}
                      <IconButton
                        icon={Plus}
                        size="sm"
                        onClick={() => onAddCard(topic.id)}
                        aria-label={`Add a card to ${topic.name}`}
                        tooltip="Add a card here"
                      />
                      <IconButton
                        icon={Pencil}
                        size="sm"
                        onClick={() => onEditTopic(topic.id)}
                        aria-label={`Edit ${topic.name}`}
                        tooltip="Edit topic"
                      />
                      <IconButton
                        icon={Trash2}
                        size="sm"
                        variant="ghost-danger"
                        onClick={() => askDeleteTopic(topic)}
                        aria-label={`Delete ${topic.name}`}
                        tooltip="Delete topic"
                      />
                    </div>
                  </header>

                  {!isCollapsed && (
                    <div className="border-t border-line">
                      {cards.length === 0 ? (
                        <div className="flex items-center justify-between gap-3 px-4 py-3">
                          <span className="text-ui text-fg-subtle">No cards in this topic yet.</span>
                          <Button size="sm" variant="ghost" leadingIcon={Plus} onClick={() => onAddCard(topic.id)}>
                            Add the first one
                          </Button>
                        </div>
                      ) : (
                        <div className="divide-y divide-line">
                          {visible.map((card) => (
                            <CardRow
                              key={card.id}
                              card={card}
                              strength={reviews[card.id] ? cardStrength(reviews[card.id]) : null}
                              onEdit={() => onEditCard(card.id)}
                              onDelete={() => askDeleteCard(card)}
                            />
                          ))}
                        </div>
                      )}
                      {visible.length < cards.length && (
                        <div className="border-t border-line p-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            fullWidth
                            onClick={() => setExpanded((e) => toggleSet(e, topic.id))}
                          >
                            Show all {cards.length} cards
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </section>
        )}
      </div>
    </AppLayout>
  );
}

export const DeckDetail = memo(DeckDetailInner);

// ─── One card ───

interface CardRowProps {
  card: Card;
  /** 0..1, null for a card never answered. */
  strength: number | null;
  onEdit: () => void;
  onDelete: () => void;
}

const CardRow = memo(function CardRow({ card, strength, onEdit, onDelete }: CardRowProps) {
  const kind = KIND_META[card.kind];
  const difficulty = DIFFICULTY_META[card.difficulty];
  const strengthPct = strength === null ? 0 : Math.round(strength * 100);
  const mastered = strength !== null && strength >= MASTERED_THRESHOLD;
  return (
    <div className="group/card flex items-start gap-3 px-3 py-2.5 transition-colors duration-120 ease-out-quint hover:bg-surface-hover">
      <span
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-control border border-line bg-ink-800 text-fg-subtle"
        title={kind.label}
      >
        <kind.icon size={14} strokeWidth={1.75} aria-hidden />
        <span className="sr-only">{kind.label}</span>
      </span>

      <button type="button" onClick={onEdit} className="focus-ring-inset min-w-0 flex-1 rounded-control text-left" title="Edit card">
        <span className="line-clamp-2 block whitespace-pre-wrap text-ui text-fg">{card.prompt}</span>
        <span className="mt-0.5 flex min-w-0 items-start gap-1.5 text-xs text-fg-muted">
          <CornerDownRight size={12} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-success" />
          <span className="line-clamp-1">{cardAnswerText(card)}</span>
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn('size-1.5 rounded-full', TONE_DOT[difficulty.tone])} />
            {difficulty.label}
          </span>
          {card.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="font-mono">
              #{tag}
            </span>
          ))}
          {card.tags.length > 4 && <span className="font-mono">+{card.tags.length - 4}</span>}
        </span>
      </button>

      <span className="mt-1 hidden w-20 shrink-0 flex-col items-end gap-1.5 @md:flex">
        {strength === null ? (
          <Badge size="sm">New</Badge>
        ) : (
          <>
            <span className={cn('tabular font-mono text-xs', mastered ? 'text-success' : 'text-fg-muted')}>
              {strengthPct}%
            </span>
            <span className="block h-1 w-full overflow-hidden rounded-full bg-ink-600/70" title={`Strength ${strengthPct}%`}>
              <span
                className={cn('block h-full rounded-full', mastered ? 'bg-success' : 'bg-(--deck)')}
                style={{ width: `${strengthPct}%` }}
              />
            </span>
          </>
        )}
      </span>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-120 group-focus-within/card:opacity-100 group-hover/card:opacity-100 [@media(hover:none)]:opacity-100">
        <IconButton icon={Pencil} size="sm" onClick={onEdit} aria-label="Edit card" tooltip="Edit" />
        <IconButton icon={Trash2} size="sm" variant="ghost-danger" onClick={onDelete} aria-label="Delete card" tooltip="Delete" />
      </div>
    </div>
  );
});
