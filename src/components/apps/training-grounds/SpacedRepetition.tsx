// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Review (Spaced Repetition)
// The due queue across your decks: reveal, rate Again / Hard / Good
// / Easy and the learning store schedules each card's next review.
// Missed cards come back once at the end of the session. Session
// summary and a 7-day due forecast.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CalendarClock, Play, Repeat, RotateCcw, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  collectDueCards,
  computeMastery,
  listCardLocations,
  scheduleReview,
  useLearningStore,
} from '@/stores/useLearningStore';
import { recordStudyAction } from '@/components/achievements/study-streak';
import type { DueCard, ReviewGrade } from '@/types/learning';
import { DueForecast } from './practice/DueForecast';
import { FlipCard, GradeBar, GradeSummary, Kbd, REVIEW_GRADES, RevealButton, countGrades } from './practice/StudyCard';
import { DAY_MS, dueForecast, formatDuration, formatInterval, utcDayStart } from './practice/schedule';
import { useStudyKeys } from './practice/use-study-keys';

/** Cards per session: due ones first, then new ones up to the chosen limit. */
const SESSION_SIZE = 30;
/** Choices for how many never-seen cards join a session. */
const NEW_LIMITS = [0, 5, 10, 20] as const;
const FORECAST_DAYS = 7;

interface SpacedRepetitionProps {
  /** Deck to review, e.g. from a deep link or a planner quest; all decks otherwise. */
  initialDeckId?: string | null;
  /** Topic inside that deck. */
  initialTopicId?: string | null;
}

interface ReviewResult {
  cardId: string;
  grade: ReviewGrade;
  isNew: boolean;
}

interface ReviewSession {
  queue: DueCard[];
  index: number;
  flipped: boolean;
  startedAt: number;
  /** When the current card appeared (answer time, interval previews). */
  shownAt: number;
  results: ReviewResult[];
  /** Cards missed once and queued again at the end. */
  requeued: string[];
  /** Queue length at the start; later positions are second tries. */
  baseLength: number;
  finishedAt: number | null;
}

const CHIP = 'px-3 py-1 rounded-md text-xs border transition-all';
const CHIP_ON = 'bg-cyan-500/20 border-cyan-500/40 text-cyan-200';
const CHIP_OFF = 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10';

function SpacedRepetitionInner({ initialDeckId = null, initialTopicId = null }: SpacedRepetitionProps) {
  const decks = useLearningStore((s) => s.decks);
  const reviews = useLearningStore((s) => s.reviews);
  const recordAttempt = useLearningStore((s) => s.recordAttempt);
  const [deckId, setDeckId] = useState<string | null>(initialDeckId);
  const [topicId, setTopicId] = useState<string | null>(initialTopicId);
  const [newLimit, setNewLimit] = useState<number>(10);
  const [session, setSession] = useState<ReviewSession | null>(null);

  // `now` ticks once a minute: enough for due dates, and it keeps render pure.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // The deck / topic filter, dropped when its deck or topic no longer exists.
  const scope = useMemo(() => {
    const deck = deckId ? decks.find((d) => d.id === deckId) : undefined;
    const topic = deck && topicId ? deck.topics.find((t) => t.id === topicId) : undefined;
    return { deck, topic, deckId: deck?.id, topicId: topic?.id };
  }, [decks, deckId, topicId]);
  const scopeDeck = scope.deck;
  const scopeTopic = scope.topic;

  const queue = useMemo(
    () => collectDueCards(decks, reviews, { deckId: scope.deckId, topicId: scope.topicId, now }),
    [decks, reviews, scope, now]
  );
  const { dueCards, newCards } = useMemo(() => {
    const due: DueCard[] = [];
    const fresh: DueCard[] = [];
    for (const item of queue) (item.review ? due : fresh).push(item);
    return { dueCards: due, newCards: fresh };
  }, [queue]);

  // Mastery of the scope and the soonest upcoming review (for "all caught up").
  const scopeInfo = useMemo(() => {
    const locations = listCardLocations(decks, scope.deckId, scope.topicId);
    let nextDueAt: number | null = null;
    for (const { card } of locations) {
      const dueAt = reviews[card.id]?.dueAt;
      if (dueAt !== undefined && dueAt > now && (nextDueAt === null || dueAt < nextDueAt)) nextDueAt = dueAt;
    }
    return {
      mastery: computeMastery(
        locations.map((l) => l.card),
        reviews
      ),
      nextDueAt,
    };
  }, [decks, reviews, scope, now]);

  const dueByDeck = useMemo(() => {
    const counts = new Map<string, number>();
    for (const deck of decks) {
      let n = 0;
      for (const topic of deck.topics) {
        for (const card of topic.cards) {
          const review = reviews[card.id];
          if (review && review.dueAt <= now) n += 1;
        }
      }
      counts.set(deck.id, n);
    }
    return counts;
  }, [decks, reviews, now]);

  const forecast = useMemo(
    () => dueForecast(decks, reviews, now, FORECAST_DAYS, { deckId: scope.deckId, topicId: scope.topicId }),
    [decks, reviews, now, scope]
  );
  const todayStart = utcDayStart(now);

  const plannedDue = Math.min(dueCards.length, SESSION_SIZE);
  const plannedNew = Math.min(newCards.length, newLimit, SESSION_SIZE - plannedDue);

  const startSession = useCallback(() => {
    const cards = [...dueCards.slice(0, plannedDue), ...newCards.slice(0, plannedNew)];
    if (cards.length === 0) return;
    const t = Date.now();
    setSession({
      queue: cards,
      index: 0,
      flipped: false,
      startedAt: t,
      shownAt: t,
      results: [],
      requeued: [],
      baseLength: cards.length,
      finishedAt: null,
    });
  }, [dueCards, newCards, plannedDue, plannedNew]);

  const flip = useCallback(() => {
    setSession((s) => (s && s.finishedAt === null ? { ...s, flipped: !s.flipped } : s));
  }, []);

  const rate = useCallback(
    (grade: ReviewGrade) => {
      if (!session || session.finishedAt !== null || !session.flipped) return;
      const item = session.queue[session.index];
      if (!item) return;
      const t = Date.now();
      recordAttempt({
        cardId: item.card.id,
        correct: grade !== 'again',
        grade,
        source: 'review',
        durationMs: t - session.shownAt,
        at: t,
      });
      // Reviewing is study activity for today's streak.
      if (session.results.length === 0) recordStudyAction();
      const requeue = grade === 'again' && !session.requeued.includes(item.card.id);
      const nextQueue = requeue ? [...session.queue, item] : session.queue;
      const index = session.index + 1;
      const done = index >= nextQueue.length;
      setSession({
        ...session,
        queue: nextQueue,
        index,
        flipped: false,
        shownAt: t,
        results: [...session.results, { cardId: item.card.id, grade, isNew: item.review === null }],
        requeued: requeue ? [...session.requeued, item.card.id] : session.requeued,
        finishedAt: done ? t : null,
      });
      if (done) setNow(t);
    },
    [session, recordAttempt]
  );

  const endSession = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setSession((s) => (!s ? s : s.results.length === 0 ? null : { ...s, finishedAt: t }));
  }, []);

  const current = session && session.finishedAt === null ? session.queue[session.index] : undefined;
  const currentId = current?.card.id;
  const shownAt = session?.shownAt ?? 0;

  // Next interval per grade, as the store would schedule it.
  const previews = useMemo(() => {
    if (!currentId) return undefined;
    const prev = reviews[currentId] ?? null;
    const out: Partial<Record<ReviewGrade, string>> = {};
    for (const grade of REVIEW_GRADES) {
      out[grade] = formatInterval(scheduleReview(prev, currentId, grade, grade !== 'again', shownAt).dueAt - shownAt);
    }
    return out;
  }, [currentId, shownAt, reviews]);

  const rootRef = useRef<HTMLDivElement>(null);
  const { onKeyDown, onKeyUp } = useStudyKeys(
    rootRef,
    { onFlip: flip, onGrade: rate },
    current && session ? `${session.index}:${session.flipped ? 1 : 0}` : null
  );

  // ─── Session ───
  if (session && current) {
    const accent = decks.find((d) => d.id === current.deckId)?.color;
    const badge =
      session.index >= session.baseLength
        ? 'Second try'
        : current.review === null
          ? 'New'
          : current.overdueMs >= DAY_MS
            ? `Overdue ${formatInterval(current.overdueMs)}`
            : 'Due';
    return (
      <div
        ref={rootRef}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        className="flex min-h-full flex-col gap-4 p-6 outline-none"
      >
        <div className="flex items-center gap-3 text-xs text-white/50">
          <button type="button" onClick={endSession} className="flex items-center gap-1 hover:text-white/80">
            <ArrowLeft className="h-3.5 w-3.5" />
            End
          </button>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-cyan-400"
              initial={false}
              animate={{ width: `${(session.index / session.queue.length) * 100}%` }}
            />
          </div>
          <span className="tabular-nums">
            {session.index + 1} / {session.queue.length}
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${session.index}:${current.card.id}`}
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={{ duration: 0.18 }}
            className="mx-auto w-full max-w-xl"
          >
            <FlipCard
              card={current.card}
              flipped={session.flipped}
              onFlip={flip}
              caption={`${current.deckName} · ${current.topicName}`}
              accent={accent}
              badge={badge}
            />
          </motion.div>
        </AnimatePresence>

        <div className="mx-auto w-full max-w-xl">
          {session.flipped ? <GradeBar onGrade={rate} previews={previews} /> : <RevealButton onReveal={flip} />}
        </div>
        <p className="text-center text-[10px] text-white/30">
          <Kbd>Space</Kbd> flip · <Kbd>1</Kbd> Again · <Kbd>2</Kbd> Hard · <Kbd>3</Kbd> Good · <Kbd>4</Kbd> Easy
        </p>
      </div>
    );
  }

  // ─── Summary ───
  if (session && session.finishedAt !== null) {
    const firstGrades = new Map<string, ReviewGrade>();
    for (const r of session.results) if (!firstGrades.has(r.cardId)) firstGrades.set(r.cardId, r.grade);
    const unique = firstGrades.size;
    const recalled = [...firstGrades.values()].filter((g) => g !== 'again').length;
    const newLearned = new Set(session.results.filter((r) => r.isNew).map((r) => r.cardId)).size;
    let nextDueAt: number | null = null;
    for (const cardId of firstGrades.keys()) {
      const dueAt = reviews[cardId]?.dueAt;
      if (dueAt !== undefined && (nextDueAt === null || dueAt < nextDueAt)) nextDueAt = dueAt;
    }
    const remaining = plannedDue + plannedNew;
    const tiles = [
      { label: 'Recalled first try', value: unique > 0 ? `${Math.round((recalled / unique) * 100)}%` : '—' },
      { label: 'Cards reviewed', value: String(unique) },
      {
        label: 'Next review',
        value: nextDueAt === null ? '—' : `in ${formatInterval(Math.max(0, nextDueAt - session.finishedAt))}`,
      },
    ];
    return (
      <div className="space-y-5 p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 p-5 text-center"
        >
          <Trophy className="mx-auto h-8 w-8 text-yellow-300" />
          <h3 className="mt-2 text-lg font-bold text-white">Session complete</h3>
          <p className="mt-1 text-xs text-white/50">
            {session.results.length} answer{session.results.length === 1 ? '' : 's'}
            {newLearned > 0 ? ` · ${newLearned} new card${newLearned === 1 ? '' : 's'} learned` : ''} ·{' '}
            {formatDuration(session.finishedAt - session.startedAt)}
          </p>
        </motion.div>

        <div className="grid grid-cols-3 gap-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="text-xl font-semibold text-white">{tile.value}</p>
              <p className="mt-0.5 text-[11px] text-white/45">{tile.label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-3 text-xs font-semibold text-white/75">How it went</p>
          <GradeSummary counts={countGrades(session.results)} />
        </div>

        <DueForecast counts={forecast} todayStart={todayStart} newCount={newCards.length} />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setSession(null)}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/70 hover:bg-white/10"
          >
            Back to overview
          </button>
          {remaining > 0 && (
            <button
              type="button"
              onClick={startSession}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/20 p-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/30"
            >
              <RotateCcw className="h-4 w-4" />
              Keep going · {remaining}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Overview ───
  const { mastery, nextDueAt } = scopeInfo;
  const stats = [
    { label: 'Due now', value: dueCards.length, tone: 'text-amber-200', ring: 'border-amber-400/25 bg-amber-500/10' },
    { label: 'New', value: newCards.length, tone: 'text-cyan-200', ring: 'border-cyan-400/25 bg-cyan-500/10' },
    {
      label: `Mastered of ${mastery.total}`,
      value: mastery.mastered,
      tone: 'text-emerald-200',
      ring: 'border-emerald-400/25 bg-emerald-500/10',
    },
  ];

  return (
    <div className="space-y-5 p-6">
      <header>
        <h3 className="flex items-center gap-2 text-lg font-bold text-white">
          <Repeat className="h-5 w-5 text-cyan-300" />
          Review
        </h3>
        <p className="mt-1 text-xs text-white/50">
          Spaced repetition over your own decks. Reveal a card, rate your recall, and it comes back right before you
          would forget it: misses within minutes, easy cards weeks out.
        </p>
      </header>

      {/* Scope */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setDeckId(null);
              setTopicId(null);
            }}
            className={cn(CHIP, !scopeDeck ? CHIP_ON : CHIP_OFF)}
          >
            All decks
          </button>
          {decks.map((d) => {
            const due = dueByDeck.get(d.id) ?? 0;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setDeckId(d.id);
                  setTopicId(null);
                }}
                className={cn(CHIP, 'flex items-center gap-1.5', scopeDeck?.id === d.id ? CHIP_ON : CHIP_OFF)}
              >
                <span>{d.icon}</span>
                {d.name}
                {due > 0 && (
                  <span className="rounded bg-amber-400/20 px-1 text-[10px] font-semibold text-amber-200 tabular-nums">
                    {due}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {scopeDeck && scopeDeck.topics.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTopicId(null)}
              className={cn(CHIP, !scopeTopic ? 'bg-purple-500/20 border-purple-500/40 text-purple-200' : CHIP_OFF)}
            >
              All topics
            </button>
            {scopeDeck.topics.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTopicId(t.id)}
                className={cn(
                  CHIP,
                  scopeTopic?.id === t.id ? 'bg-purple-500/20 border-purple-500/40 text-purple-200' : CHIP_OFF
                )}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        {stats.map((s) => (
          <div key={s.label} className={cn('rounded-xl border p-3', s.ring)}>
            <p className={cn('text-2xl font-bold', s.tone)}>{s.value}</p>
            <p className="text-[11px] text-white/50">{s.label}</p>
          </div>
        ))}
      </div>

      <DueForecast counts={forecast} todayStart={todayStart} newCount={newCards.length} />

      <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
        <span>New cards per session</span>
        <div className="flex overflow-hidden rounded-md border border-white/10">
          {NEW_LIMITS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNewLimit(n)}
              aria-pressed={newLimit === n}
              className={cn(
                'px-2.5 py-1 tabular-nums transition-colors',
                newLimit === n ? 'bg-cyan-500/25 text-cyan-100' : 'text-white/50 hover:bg-white/10'
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {plannedDue + plannedNew > 0 ? (
        <button
          type="button"
          onClick={startSession}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/20 p-3 text-sm font-semibold text-cyan-100 shadow-[0_0_24px_-10px_rgba(34,211,238,0.8)] transition-all hover:bg-cyan-500/30"
        >
          <Play className="h-4 w-4" />
          {plannedDue > 0 ? `Review ${plannedDue} due` : `Learn ${plannedNew} new`}
          {plannedDue > 0 && plannedNew > 0 ? ` + ${plannedNew} new` : ''}
        </button>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          <CalendarClock className="h-4 w-4" />
          {mastery.total === 0
            ? 'No cards here yet. Add some in the Question Bank.'
            : nextDueAt !== null
              ? `All caught up. Next review in ${formatInterval(nextDueAt - now)}.`
              : newCards.length > 0
                ? 'All caught up. Raise "new cards per session" to learn more.'
                : 'All caught up.'}
        </div>
      )}
    </div>
  );
}

export const SpacedRepetition = memo(SpacedRepetitionInner);
