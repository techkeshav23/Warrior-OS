// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Review (Spaced Repetition)
// The due queue across your decks: reveal, rate Again / Hard / Good
// / Easy and the learning store schedules each card's next review.
// Missed cards come back once at the end of the session. Session
// summary and a 7-day due forecast.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, CalendarCheck, CalendarClock, Layers, Play, Repeat, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { Badge, Button, Card, Chip, EmptyState, ProgressBar, SegmentedControl, StatTile } from '@/components/ui';
import { TRANSITION } from '@/styles/tokens';
import {
  collectDueCards,
  computeMastery,
  listCardLocations,
  scheduleReview,
  useLearningStore,
} from '@/stores/useLearningStore';
import { recordStudyAction } from '@/components/achievements/study-streak';
import type { DueCard, ReviewGrade } from '@/types/learning';
import { KeyHints, TabHeader } from './QuizControls';
import { DueForecast } from './practice/DueForecast';
import { FlipCard, GradeBar, GradeSummary, REVIEW_GRADES, RevealButton, countGrades } from './practice/StudyCard';
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

function SpacedRepetitionInner({ initialDeckId = null, initialTopicId = null }: SpacedRepetitionProps) {
  const decks = useLearningStore((s) => s.decks);
  const reviews = useLearningStore((s) => s.reviews);
  const recordAttempt = useLearningStore((s) => s.recordAttempt);
  const [deckId, setDeckId] = useState<string | null>(initialDeckId);
  const [topicId, setTopicId] = useState<string | null>(initialTopicId);
  const [newLimit, setNewLimit] = useState<number>(10);
  const [session, setSession] = useState<ReviewSession | null>(null);
  const reduceMotion = useReducedMotion();

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
        className="@container flex h-full flex-col outline-none"
      >
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" leadingIcon={ArrowLeft} onClick={endSession}>
                End
              </Button>
              <ProgressBar
                value={session.index}
                max={session.queue.length}
                size="sm"
                animated={false}
                className="flex-1"
                aria-label="Session progress"
              />
              <span className="shrink-0 font-mono text-xs text-fg-muted tabular">
                <span className="text-fg">{session.index + 1}</span> / {session.queue.length}
              </span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${session.index}:${current.card.id}`}
                initial={{ opacity: 0, x: reduceMotion ? 0 : 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: reduceMotion ? 0 : -24 }}
                transition={TRANSITION.small}
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
          </div>
        </div>

        <div className="shrink-0 space-y-2.5 border-t border-line px-5 py-3">
          <div className="mx-auto flex w-full max-w-2xl justify-center">
            {session.flipped ? <GradeBar onGrade={rate} previews={previews} /> : <RevealButton onReveal={flip} />}
          </div>
          <KeyHints
            className="hidden @md:flex"
            items={[
              { keys: ['Space'], label: 'flip' },
              { keys: ['1'], label: 'Again' },
              { keys: ['2'], label: 'Hard' },
              { keys: ['3'], label: 'Good' },
              { keys: ['4'], label: 'Easy' },
            ]}
          />
        </div>
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
    return (
      <div className="@container space-y-5 p-5">
        <motion.div
          initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={TRANSITION.panel}
        >
          <Card hud tone="ember" padding="lg">
            <div className="flex flex-col items-center gap-4 text-center @xl:flex-row @xl:text-left">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-card border border-gold/35 bg-gold/10 text-gold shadow-[0_0_28px_-6px_var(--color-gold)]">
                <Trophy size={26} strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="hud-label">Review · done</div>
                <h3 className="mt-1 text-xl font-semibold text-fg">Session complete</h3>
                <p className="mt-1 text-ui text-fg-muted tabular">
                  {session.results.length} answer{session.results.length === 1 ? '' : 's'}
                  {newLearned > 0 ? ` · ${newLearned} new card${newLearned === 1 ? '' : 's'} learned` : ''} ·{' '}
                  {formatDuration(session.finishedAt - session.startedAt)}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 gap-3 @md:grid-cols-3">
          <StatTile
            size="sm"
            label="Recalled first try"
            icon={Sparkles}
            value={unique > 0 ? `${Math.round((recalled / unique) * 100)}%` : '—'}
          />
          <StatTile size="sm" label="Cards reviewed" icon={Layers} value={unique} />
          <StatTile
            size="sm"
            label="Next review"
            icon={CalendarClock}
            value={nextDueAt === null ? '—' : `in ${formatInterval(Math.max(0, nextDueAt - session.finishedAt))}`}
            plainValue
          />
        </div>

        <Card eyebrow="Recall" title="How it went">
          <GradeSummary counts={countGrades(session.results)} />
        </Card>

        <DueForecast counts={forecast} todayStart={todayStart} newCount={newCards.length} />

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" size="lg" leadingIcon={ArrowLeft} onClick={() => setSession(null)}>
            Back to overview
          </Button>
          {remaining > 0 && (
            <Button variant="primary" size="lg" leadingIcon={RotateCcw} onClick={startSession}>
              Keep going · {remaining}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ─── Overview ───
  const { mastery, nextDueAt } = scopeInfo;
  const canStart = plannedDue + plannedNew > 0;

  return (
    <div className="@container space-y-6 p-5">
      <TabHeader
        icon={Repeat}
        title="Review"
        description="Spaced repetition over your own decks. Reveal a card, rate your recall, and it comes back right before you would forget it."
      />

      {/* Scope */}
      <section className="space-y-3" aria-label="Scope">
        <span className="hud-label">Scope</span>
        <div className="flex flex-wrap gap-2">
          <Chip
            selected={!scopeDeck}
            onClick={() => {
              setDeckId(null);
              setTopicId(null);
            }}
          >
            All decks
          </Chip>
          {decks.map((d) => {
            const due = dueByDeck.get(d.id) ?? 0;
            return (
              <Chip
                key={d.id}
                selected={scopeDeck?.id === d.id}
                onClick={() => {
                  setDeckId(d.id);
                  setTopicId(null);
                }}
              >
                <span aria-hidden className="mr-1.5">
                  {d.icon}
                </span>
                {d.name}
                {due > 0 && (
                  <span className="ml-1.5 rounded-full bg-warning/15 px-1.5 font-mono text-2xs text-warning tabular">{due}</span>
                )}
              </Chip>
            );
          })}
        </div>
        {scopeDeck && scopeDeck.topics.length > 1 && (
          <div className="flex flex-wrap gap-1.5 border-l border-line pl-3">
            <Chip size="sm" selected={!scopeTopic} onClick={() => setTopicId(null)}>
              All topics
            </Chip>
            {scopeDeck.topics.map((t) => (
              <Chip key={t.id} size="sm" selected={scopeTopic?.id === t.id} onClick={() => setTopicId(t.id)}>
                {t.name}
              </Chip>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-3 @md:grid-cols-3">
        <StatTile
          size="sm"
          label="Due now"
          icon={CalendarClock}
          value={<span className={dueCards.length > 0 ? 'text-warning' : undefined}>{dueCards.length}</span>}
        />
        <StatTile size="sm" label="New" icon={Sparkles} value={newCards.length} />
        <StatTile
          size="sm"
          label="Mastered"
          icon={Trophy}
          value={<span className={mastery.mastered > 0 ? 'text-success' : undefined}>{mastery.mastered}</span>}
          unit={`of ${mastery.total}`}
        />
      </div>

      <DueForecast counts={forecast} todayStart={todayStart} newCount={newCards.length} />

      <Card padding="md">
        <div className="flex flex-col gap-4 @xl:flex-row @xl:items-center @xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-ui font-medium text-fg">New cards per session</span>
            <SegmentedControl
              size="sm"
              aria-label="New cards per session"
              value={String(newLimit)}
              onChange={(v) => setNewLimit(Number(v))}
              options={NEW_LIMITS.map((n) => ({ value: String(n), label: String(n) }))}
            />
          </div>
          {canStart && (
            <Button variant="primary" size="lg" leadingIcon={Play} onClick={startSession}>
              {plannedDue > 0 ? `Review ${plannedDue} due` : `Learn ${plannedNew} new`}
              {plannedDue > 0 && plannedNew > 0 ? ` + ${plannedNew} new` : ''}
            </Button>
          )}
        </div>
      </Card>

      {!canStart &&
        (mastery.total === 0 ? (
          <EmptyState
            size="sm"
            icon={Layers}
            title="No cards here yet"
            description="Add some in Decks, then come back to review them."
          />
        ) : (
          <EmptyState
            size="sm"
            icon={CalendarCheck}
            tone="accent"
            title="All caught up"
            description={
              nextDueAt !== null
                ? `Next review in ${formatInterval(nextDueAt - now)}.`
                : newCards.length > 0
                  ? 'Raise "new cards per session" to learn more.'
                  : 'Nothing due. Your memory is holding the line.'
            }
          />
        ))}
      {canStart && dueCards.length > plannedDue && (
        <p className="flex items-center gap-2 text-xs text-fg-subtle">
          <Badge size="sm" tone="warning">
            +{dueCards.length - plannedDue}
          </Badge>
          more due after this session ({SESSION_SIZE} cards per session).
        </p>
      )}
    </div>
  );
}

export const SpacedRepetition = memo(SpacedRepetitionInner);
