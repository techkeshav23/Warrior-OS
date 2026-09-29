// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Question Bank
// Every card of every deck: search and filter by deck, topic, tag,
// difficulty and kind; reveal the answer and explanation, or
// practise one card on the spot (graded and fed to spaced repetition)
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useMemo, useDeferredValue, useCallback, useRef, memo, type KeyboardEvent } from 'react';
import {
  CalendarClock,
  Check,
  ChevronDown,
  CircleDot,
  Eye,
  EyeOff,
  Hash,
  Layers,
  Library,
  ListChecks,
  RotateCw,
  SearchX,
  Target,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, Chip, EmptyState, SearchField, Select, type Tone } from '@/components/ui';
import { cardStrength, listCardLocations, MASTERED_THRESHOLD, useLearningStore } from '@/stores/useLearningStore';
import { recordStudyAction } from '@/components/achievements/study-streak';
import type {
  Card,
  CardKind,
  CardLocation,
  CardReview,
  Difficulty,
  Flashcard,
  QuizCard,
  ReviewGrade,
} from '@/types/learning';
import { QuestionView } from './QuestionView';
import { DifficultyBadge, TabHeader } from './QuizControls';
import { GradeBar } from './practice/StudyCard';
import { DIFFICULTY_TONE, KIND_LABELS, isAnswerCorrect, isAnswered, type UserAnswer } from './grading';

/** Cards rendered per "page" of the list. */
const PAGE_SIZE = 40;
const ALL = 'all';

const KINDS: readonly CardKind[] = ['mcq', 'multi-select', 'numeric', 'flashcard'];
const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

const KIND_ICONS: Readonly<Record<CardKind, LucideIcon>> = {
  mcq: CircleDot,
  'multi-select': ListChecks,
  numeric: Hash,
  flashcard: Layers,
};

interface QuestionBankProps {
  /** Deck to open on, e.g. from a NEXUS deep link. */
  initialDeckId?: string | null;
}

/** Lower-cased text a search matches against: prompt, options, answer, explanation, tags. */
function searchText(card: Card): string {
  const parts = [card.prompt, card.explanation ?? '', card.tags.join(' ')];
  if (card.kind === 'mcq' || card.kind === 'multi-select') parts.push(...card.options);
  if (card.kind === 'numeric') parts.push(String(card.answer), card.unit ?? '');
  if (card.kind === 'flashcard') parts.push(card.back);
  return parts.join('\n').toLowerCase();
}

function strengthLabel(review: CardReview | undefined): { text: string; tone: Tone } {
  if (!review || review.recent.length === 0) return { text: 'New', tone: 'neutral' };
  const strength = cardStrength(review);
  if (strength >= MASTERED_THRESHOLD) return { text: 'Mastered', tone: 'success' };
  return {
    text: `${Math.round(strength * 100)}% strength`,
    tone: strength >= 0.5 ? 'warning' : 'danger',
  };
}

/** When the card comes back, measured from the answer that scheduled it. */
function nextReviewText(review: CardReview): string {
  const minutes = Math.round((review.dueAt - review.lastReviewedAt) / 60_000);
  if (minutes <= 0) return 'Due again now';
  if (minutes < 60) return `Next review in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Next review in ${hours} h`;
  const days = Math.round(hours / 24);
  return `Next review in ${days} day${days === 1 ? '' : 's'}`;
}

function NextReview({ review }: { review: CardReview }) {
  return (
    <span role="status" className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
      <CalendarClock size={14} strokeWidth={1.75} className="text-accent" aria-hidden />
      {nextReviewText(review)}
    </span>
  );
}

// ─── Practice (one card, graded) ───

interface PracticeProps {
  /** Called after an answer was recorded (study streak). */
  onStudied: () => void;
}

function QuizCardPractice({ card, onStudied }: PracticeProps & { card: QuizCard }) {
  const recordAttempt = useLearningStore((s) => s.recordAttempt);
  const [answer, setAnswer] = useState<UserAnswer | undefined>(undefined);
  const [next, setNext] = useState<CardReview | null>(null);
  const [checked, setChecked] = useState(false);

  const check = () => {
    if (checked || !isAnswered(answer)) return;
    setNext(recordAttempt({ cardId: card.id, correct: isAnswerCorrect(card, answer), source: 'review' }));
    setChecked(true);
    onStudied();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault();
      check();
    }
  };

  return (
    <div className="space-y-3" onKeyDown={onKeyDown}>
      <QuestionView card={card} answer={answer} onAnswer={setAnswer} reveal={checked} hidePrompt autoFocus />
      <div className="flex flex-wrap items-center gap-3">
        {!checked && (
          <Button variant="primary" size="sm" leadingIcon={Check} onClick={check} disabled={!isAnswered(answer)}>
            Check
          </Button>
        )}
        {next && <NextReview review={next} />}
      </div>
    </div>
  );
}

function FlashcardPractice({ card, onStudied }: PracticeProps & { card: Flashcard }) {
  const recordAttempt = useLearningStore((s) => s.recordAttempt);
  const [flipped, setFlipped] = useState(false);
  const [next, setNext] = useState<CardReview | null>(null);

  const rate = (grade: ReviewGrade) => {
    if (next) return;
    setNext(recordAttempt({ cardId: card.id, correct: grade !== 'again', grade, source: 'review' }));
    onStudied();
  };

  if (!flipped) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="sm" leadingIcon={RotateCw} onClick={() => setFlipped(true)}>
          Flip card
        </Button>
        <span className="text-xs text-fg-subtle">Recall the answer, then flip the card and rate yourself.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <FlashcardBack card={card} />
      {next ? <NextReview review={next} /> : <GradeBar onGrade={rate} size="sm" />}
    </div>
  );
}

function FlashcardBack({ card }: { card: Flashcard }) {
  return (
    <div className="space-y-1.5 rounded-control bg-success/8 px-3.5 py-3 ring-1 ring-inset ring-success/20">
      <p className="font-mono text-2xs font-medium uppercase tracking-[0.12em] text-success">Answer</p>
      <p className="select-text whitespace-pre-wrap text-ui text-fg">{card.back}</p>
      {card.explanation && (
        <p className="select-text whitespace-pre-wrap text-ui leading-relaxed text-fg-muted">{card.explanation}</p>
      )}
    </div>
  );
}

// ─── One expanded card ───

type DetailMode = 'browse' | 'answer' | 'practice';

function CardDetail({
  location,
  onTag,
  onStudied,
}: {
  location: CardLocation;
  onTag: (tag: string) => void;
  onStudied: () => void;
}) {
  const { card } = location;
  const [mode, setMode] = useState<DetailMode>('browse');
  const showsContent = mode === 'practice' || card.kind !== 'flashcard' || mode === 'answer';

  return (
    <div className="animate-fade-in space-y-4 border-t border-line bg-surface-2 px-4 py-4 pl-14">
      {showsContent &&
        (mode === 'practice' ? (
          card.kind === 'flashcard' ? (
            <FlashcardPractice card={card} onStudied={onStudied} />
          ) : (
            <QuizCardPractice card={card} onStudied={onStudied} />
          )
        ) : card.kind === 'flashcard' ? (
          <FlashcardBack card={card} />
        ) : (
          <QuestionView card={card} hidePrompt showKey={mode === 'answer'} />
        ))}

      <div className="flex flex-wrap items-center gap-2">
        {mode !== 'practice' && (
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={mode === 'answer' ? EyeOff : Eye}
            onClick={() => setMode(mode === 'answer' ? 'browse' : 'answer')}
          >
            {mode === 'answer' ? 'Hide answer' : 'Reveal answer'}
          </Button>
        )}
        <Button
          variant={mode === 'practice' ? 'ghost' : 'primary'}
          size="sm"
          leadingIcon={mode === 'practice' ? X : Target}
          onClick={() => setMode(mode === 'practice' ? 'browse' : 'practice')}
        >
          {mode === 'practice' ? 'Stop practising' : 'Practice this card'}
        </Button>
        {card.tags.length > 0 && <span aria-hidden className="mx-1 h-4 w-px bg-line-strong" />}
        {card.tags.map((tag) => (
          <Chip key={tag} size="sm" icon={Hash} onClick={() => onTag(tag)} title={`Show every card tagged #${tag}`}>
            {tag}
          </Chip>
        ))}
      </div>
    </div>
  );
}

// ─── Bank ───

function QuestionBankInner({ initialDeckId = null }: QuestionBankProps) {
  const decks = useLearningStore((s) => s.decks);
  const reviews = useLearningStore((s) => s.reviews);
  const [query, setQuery] = useState('');
  const [deckId, setDeckId] = useState<string>(initialDeckId ?? ALL);
  const [topicId, setTopicId] = useState<string>(ALL);
  const [tag, setTag] = useState<string>(ALL);
  const [difficulty, setDifficulty] = useState<Difficulty | typeof ALL>(ALL);
  const [kind, setKind] = useState<CardKind | typeof ALL>(ALL);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const studiedRef = useRef(false);
  const deferredQuery = useDeferredValue(query);

  // Unknown ids (a deleted deck or topic) fall back to "all".
  const deck = decks.find((d) => d.id === deckId);
  const scopeDeckId = deck ? deckId : undefined;
  const scopeTopicId = deck?.topics.some((t) => t.id === topicId) ? topicId : undefined;

  const totalCards = useMemo(() => decks.reduce((n, d) => n + d.topics.reduce((m, t) => m + t.cards.length, 0), 0), [decks]);
  const scoped = useMemo(
    () => listCardLocations(decks, scopeDeckId, scopeTopicId),
    [decks, scopeDeckId, scopeTopicId]
  );
  const tags = useMemo(
    () => [...new Set(scoped.flatMap((l) => l.card.tags))].sort((a, b) => a.localeCompare(b)),
    [scoped]
  );
  const activeTag = tags.includes(tag) ? tag : ALL;
  const haystacks = useMemo(() => new Map(scoped.map((l) => [l.card.id, searchText(l.card)] as const)), [scoped]);

  const filtered = useMemo(() => {
    const words = deferredQuery.toLowerCase().split(/\s+/).filter(Boolean);
    return scoped.filter(
      ({ card }) =>
        (kind === ALL || card.kind === kind) &&
        (difficulty === ALL || card.difficulty === difficulty) &&
        (activeTag === ALL || card.tags.includes(activeTag)) &&
        (words.length === 0 || words.every((w) => haystacks.get(card.id)?.includes(w)))
    );
  }, [scoped, haystacks, deferredQuery, kind, difficulty, activeTag]);

  const filtersActive =
    query !== '' || scopeDeckId !== undefined || activeTag !== ALL || difficulty !== ALL || kind !== ALL;

  // Every filter change starts the list from the top.
  const refilter = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setLimit(PAGE_SIZE);
  };
  const chooseDeck = refilter((id: string) => {
    setDeckId(id);
    setTopicId(ALL);
  });
  const chooseTopic = refilter(setTopicId);
  const chooseTag = refilter(setTag);
  const chooseDifficulty = refilter(setDifficulty);
  const chooseKind = refilter(setKind);
  const search = refilter(setQuery);

  const clearFilters = () => {
    setQuery('');
    setDeckId(ALL);
    setTopicId(ALL);
    setTag(ALL);
    setDifficulty(ALL);
    setKind(ALL);
    setLimit(PAGE_SIZE);
  };

  // Practising counts toward today's study streak (once per visit is enough).
  const markStudied = useCallback(() => {
    if (studiedRef.current) return;
    studiedRef.current = true;
    recordStudyAction();
  }, []);

  const showTag = useCallback((value: string) => {
    setTag(value);
    setLimit(PAGE_SIZE);
  }, []);

  const countLabel =
    filtered.length === totalCards
      ? `${totalCards} card${totalCards === 1 ? '' : 's'}`
      : `${filtered.length} of ${totalCards} cards`;

  return (
    <div className="@container space-y-5 p-5">
      <TabHeader
        icon={Library}
        title="Question bank"
        description="Every card of every deck. Search, reveal the answer, or practise one on the spot."
        actions={<span className="font-mono text-xs text-fg-subtle tabular">{countLabel}</span>}
      />

      {/* Filters */}
      <div className="space-y-3">
        <SearchField
          value={query}
          onValueChange={search}
          placeholder="Search prompts, options, answers, explanations, tags"
          aria-label="Search cards"
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full @md:w-44">
            <Select
              size="sm"
              aria-label="Deck"
              value={scopeDeckId ?? ALL}
              onValueChange={chooseDeck}
              options={[{ value: ALL, label: 'All decks' }, ...decks.map((d) => ({ value: d.id, label: `${d.icon} ${d.name}` }))]}
            />
          </div>
          <div className="w-full @md:w-40">
            <Select
              size="sm"
              aria-label="Topic"
              value={scopeTopicId ?? ALL}
              onValueChange={chooseTopic}
              disabled={!deck || deck.topics.length < 2}
              options={[{ value: ALL, label: 'All topics' }, ...(deck?.topics.map((t) => ({ value: t.id, label: t.name })) ?? [])]}
            />
          </div>
          <div className="w-full @md:w-36">
            <Select
              size="sm"
              aria-label="Tag"
              value={activeTag}
              onValueChange={chooseTag}
              disabled={tags.length === 0}
              options={[{ value: ALL, label: 'All tags' }, ...tags.map((t) => ({ value: t, label: `#${t}` }))]}
            />
          </div>
          {filtersActive && (
            <Button variant="ghost" size="sm" leadingIcon={X} onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip size="sm" selected={difficulty === ALL} onClick={() => chooseDifficulty(ALL)}>
            Any difficulty
          </Chip>
          {DIFFICULTIES.map((d) => (
            <Chip key={d} size="sm" tone={DIFFICULTY_TONE[d]} selected={difficulty === d} onClick={() => chooseDifficulty(d)}>
              <span className="capitalize">{d}</span>
            </Chip>
          ))}
          <span aria-hidden className="mx-1.5 h-4 w-px bg-line-strong" />
          <Chip size="sm" selected={kind === ALL} onClick={() => chooseKind(ALL)}>
            Any kind
          </Chip>
          {KINDS.map((k) => (
            <Chip key={k} size="sm" icon={KIND_ICONS[k]} selected={kind === k} onClick={() => chooseKind(k)}>
              {KIND_LABELS[k]}
            </Chip>
          ))}
        </div>
      </div>

      {/* Cards */}
      {filtered.length > 0 && (
        <div className="glass-panel divide-y divide-line overflow-hidden rounded-card">
          {filtered.slice(0, limit).map((location) => {
            const { card, deckName, topicName } = location;
            const open = expandedId === card.id;
            const strength = strengthLabel(reviews[card.id]);
            const KindIcon = KIND_ICONS[card.kind];
            return (
              <div key={card.id}>
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : card.id)}
                  aria-expanded={open}
                  className={cn(
                    'focus-ring-inset flex w-full items-start gap-3 px-4 py-3 text-left',
                    'transition-colors duration-120 ease-out-quint hover:bg-surface-hover active:bg-surface-active',
                    open && 'bg-surface-2'
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-control border bg-ink-800 transition-colors duration-120',
                      open ? 'border-accent/40 text-accent' : 'border-line text-fg-subtle'
                    )}
                  >
                    <KindIcon size={14} strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block whitespace-pre-wrap text-ui leading-relaxed',
                        open ? 'text-fg' : 'line-clamp-2 text-fg'
                      )}
                    >
                      {card.prompt}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      <span className="max-w-full truncate text-xs text-fg-subtle" title={`${deckName} › ${topicName}`}>
                        {deckName} › {topicName}
                      </span>
                      <Badge size="sm">{KIND_LABELS[card.kind]}</Badge>
                      <DifficultyBadge difficulty={card.difficulty} />
                      <Badge size="sm" variant="dot" tone={strength.tone}>
                        {strength.text}
                      </Badge>
                      {!open && card.tags.length > 0 && (
                        <span className="min-w-0 truncate font-mono text-2xs text-fg-subtle">
                          {card.tags.map((t) => `#${t}`).join(' ')}
                        </span>
                      )}
                    </span>
                  </span>
                  <ChevronDown
                    size={16}
                    strokeWidth={1.75}
                    aria-hidden
                    className={cn(
                      'mt-1 shrink-0 text-fg-subtle transition-transform duration-180 ease-out-quint',
                      open && 'rotate-180 text-fg-muted'
                    )}
                  />
                </button>
                {open && <CardDetail key={card.id} location={location} onTag={showTag} onStudied={markStudied} />}
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > limit && (
        <Button variant="secondary" fullWidth onClick={() => setLimit((n) => n + PAGE_SIZE)}>
          Show more ({filtered.length - limit} left)
        </Button>
      )}

      {filtered.length === 0 &&
        (totalCards === 0 ? (
          <EmptyState icon={Library} title="No cards yet" description="Add a deck to start building your bank." />
        ) : (
          <EmptyState
            icon={SearchX}
            title="No cards match these filters"
            description="Try fewer words, or widen the deck, tag, difficulty or kind."
            actions={
              filtersActive ? (
                <Button variant="secondary" leadingIcon={X} onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ))}
    </div>
  );
}

export const QuestionBank = memo(QuestionBankInner);
