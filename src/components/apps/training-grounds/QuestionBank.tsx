// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Question Bank
// Every card of every deck: search and filter by deck, topic, tag,
// difficulty and kind; reveal the answer and explanation, or
// practise one card on the spot (graded and fed to spaced repetition)
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useMemo, useDeferredValue, useCallback, useRef, memo, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
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
import { Chip } from './QuizControls';
import { DIFFICULTY_STYLES, KIND_LABELS, isAnswerCorrect, isAnswered, type UserAnswer } from './grading';

/** Cards rendered per "page" of the list. */
const PAGE_SIZE = 40;
const ALL = 'all';

const KINDS: readonly CardKind[] = ['mcq', 'multi-select', 'numeric', 'flashcard'];
const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

const GRADES: { grade: ReviewGrade; label: string; className: string }[] = [
  { grade: 'again', label: 'Again', className: 'bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/25' },
  { grade: 'hard', label: 'Hard', className: 'bg-orange-500/15 border-orange-500/30 text-orange-300 hover:bg-orange-500/25' },
  { grade: 'good', label: 'Good', className: 'bg-green-500/15 border-green-500/30 text-green-300 hover:bg-green-500/25' },
  { grade: 'easy', label: 'Easy', className: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25' },
];

const SELECT_CLASS =
  'bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50 disabled:opacity-40';
const ACTION_CLASS = 'px-3 py-1.5 rounded border text-xs transition-all disabled:opacity-30';

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

function strengthLabel(review: CardReview | undefined): { text: string; className: string } {
  if (!review || review.recent.length === 0) return { text: 'New', className: 'text-white/30' };
  const strength = cardStrength(review);
  if (strength >= MASTERED_THRESHOLD) return { text: 'Mastered', className: 'text-green-400/80' };
  return {
    text: `${Math.round(strength * 100)}% strength`,
    className: strength >= 0.5 ? 'text-yellow-300/70' : 'text-red-300/70',
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
          <button
            type="button"
            onClick={check}
            disabled={!isAnswered(answer)}
            className={cn(ACTION_CLASS, 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30')}
          >
            Check
          </button>
        )}
        {next && <span className="text-[11px] text-white/40">{nextReviewText(next)}</span>}
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
      <div className="space-y-2">
        <p className="text-[11px] text-white/40">Recall the answer, then flip the card and rate yourself.</p>
        <button
          type="button"
          onClick={() => setFlipped(true)}
          className={cn(ACTION_CLASS, 'bg-purple-500/20 border-purple-500/40 text-purple-300 hover:bg-purple-500/30')}
        >
          Flip card
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <FlashcardBack card={card} />
      {next ? (
        <p className="text-[11px] text-white/40">{nextReviewText(next)}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {GRADES.map(({ grade, label, className }) => (
            <button key={grade} type="button" onClick={() => rate(grade)} className={cn(ACTION_CLASS, className)}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FlashcardBack({ card }: { card: Flashcard }) {
  return (
    <div className="p-3 rounded-lg border border-green-500/20 bg-green-500/10 text-xs space-y-1">
      <p className="text-green-200 whitespace-pre-wrap">{card.back}</p>
      {card.explanation && <p className="text-white/50 whitespace-pre-wrap">{card.explanation}</p>}
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

  return (
    <div className="border-t border-white/10 bg-white/[0.03] p-3 space-y-3 text-xs">
      {mode === 'practice' ? (
        card.kind === 'flashcard' ? (
          <FlashcardPractice card={card} onStudied={onStudied} />
        ) : (
          <QuizCardPractice card={card} onStudied={onStudied} />
        )
      ) : card.kind === 'flashcard' ? (
        mode === 'answer' && <FlashcardBack card={card} />
      ) : (
        <QuestionView card={card} hidePrompt showKey={mode === 'answer'} />
      )}

      <div className="flex flex-wrap items-center gap-2">
        {mode !== 'practice' && (
          <button
            type="button"
            onClick={() => setMode(mode === 'answer' ? 'browse' : 'answer')}
            className={cn(ACTION_CLASS, 'bg-green-500/15 border-green-500/30 text-green-300 hover:bg-green-500/25')}
          >
            {mode === 'answer' ? 'Hide answer' : '👁 Reveal answer'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setMode(mode === 'practice' ? 'browse' : 'practice')}
          className={cn(ACTION_CLASS, 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25')}
        >
          {mode === 'practice' ? 'Stop practising' : '🎯 Practice this card'}
        </button>
        {card.tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onTag(tag)}
            title={`Show every card tagged #${tag}`}
            className="text-[11px] text-purple-300/70 hover:text-purple-200"
          >
            #{tag}
          </button>
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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-white">📚 Question Bank</h3>
        <span className="text-xs text-white/40">
          {filtered.length === totalCards
            ? `${totalCards} card${totalCards === 1 ? '' : 's'}`
            : `${filtered.length} of ${totalCards} cards`}
        </span>
      </div>

      {/* Filters */}
      <input
        type="search"
        value={query}
        onChange={(e) => search(e.target.value)}
        placeholder="Search prompts, options, answers, explanations, tags…"
        aria-label="Search cards"
        className="w-full p-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={scopeDeckId ?? ALL}
          onChange={(e) => chooseDeck(e.target.value)}
          aria-label="Deck"
          className={SELECT_CLASS}
        >
          <option value={ALL} className="bg-neutral-900">
            All decks
          </option>
          {decks.map((d) => (
            <option key={d.id} value={d.id} className="bg-neutral-900">
              {d.icon} {d.name}
            </option>
          ))}
        </select>
        <select
          value={scopeTopicId ?? ALL}
          onChange={(e) => chooseTopic(e.target.value)}
          disabled={!deck || deck.topics.length < 2}
          aria-label="Topic"
          className={SELECT_CLASS}
        >
          <option value={ALL} className="bg-neutral-900">
            All topics
          </option>
          {deck?.topics.map((t) => (
            <option key={t.id} value={t.id} className="bg-neutral-900">
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={activeTag}
          onChange={(e) => chooseTag(e.target.value)}
          disabled={tags.length === 0}
          aria-label="Tag"
          className={SELECT_CLASS}
        >
          <option value={ALL} className="bg-neutral-900">
            All tags
          </option>
          {tags.map((t) => (
            <option key={t} value={t} className="bg-neutral-900">
              #{t}
            </option>
          ))}
        </select>
        {filtersActive && (
          <button type="button" onClick={clearFilters} className="text-[11px] text-white/40 hover:text-white/70">
            Clear filters
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={difficulty === ALL} onClick={() => chooseDifficulty(ALL)}>
          Any difficulty
        </Chip>
        {DIFFICULTIES.map((d) => (
          <Chip key={d} active={difficulty === d} onClick={() => chooseDifficulty(d)}>
            {d}
          </Chip>
        ))}
        <span className="w-px h-4 bg-white/10 mx-1" aria-hidden="true" />
        <Chip active={kind === ALL} onClick={() => chooseKind(ALL)}>
          Any kind
        </Chip>
        {KINDS.map((k) => (
          <Chip key={k} active={kind === k} onClick={() => chooseKind(k)}>
            {KIND_LABELS[k]}
          </Chip>
        ))}
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {filtered.slice(0, limit).map((location) => {
          const { card, deckName, topicName } = location;
          const open = expandedId === card.id;
          const strength = strengthLabel(reviews[card.id]);
          return (
            <div key={card.id} className="border border-white/10 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedId(open ? null : card.id)}
                aria-expanded={open}
                className="w-full p-3 text-left flex items-start gap-2 hover:bg-white/5 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm text-white/80 leading-relaxed whitespace-pre-wrap', !open && 'line-clamp-2')}>
                    {card.prompt}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[10px]">
                    <span className="text-white/30">
                      {deckName} › {topicName}
                    </span>
                    <span className="text-cyan-400/70">{KIND_LABELS[card.kind]}</span>
                    <span className={cn('px-1.5 rounded', DIFFICULTY_STYLES[card.difficulty])}>{card.difficulty}</span>
                    <span className={strength.className}>{strength.text}</span>
                    {!open && card.tags.length > 0 && (
                      <span className="text-purple-300/50 truncate">{card.tags.map((t) => `#${t}`).join(' ')}</span>
                    )}
                  </div>
                </div>
                <span className="text-white/30 text-xs">{open ? '▲' : '▼'}</span>
              </button>
              {open && <CardDetail key={card.id} location={location} onTag={showTag} onStudied={markStudied} />}
            </div>
          );
        })}
      </div>

      {filtered.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + PAGE_SIZE)}
          className="w-full p-2 rounded-lg border border-white/10 text-xs text-white/50 hover:bg-white/5 hover:text-white/80"
        >
          Show more ({filtered.length - limit} left)
        </button>
      )}

      {filtered.length === 0 && (
        <div className="text-center mt-12 space-y-2">
          <p className="text-sm text-white/40">
            {totalCards === 0 ? 'No cards yet. Add a deck to start building your bank.' : 'No cards match these filters.'}
          </p>
          {filtersActive && totalCards > 0 && (
            <button type="button" onClick={clearFilters} className="text-xs text-cyan-300/80 hover:text-cyan-200">
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const QuestionBank = memo(QuestionBankInner);
