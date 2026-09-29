// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Flashcards App
// The standalone 'flashcards' app: pick a deck and topic, flip
// through the cards (quiz cards show their answer on the back) and
// rate each one. Space flips, 1-4 rate, S shuffles, → skips.
// Every rating counts toward mastery; only cards that are due move
// their review schedule (see scheduleReview), so free practice here
// never scrambles the Review queue.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Check, ChevronRight, Clock, Layers, Play, RotateCcw, Shuffle, Sparkles, Trophy, X } from 'lucide-react';
import { Button, Card, Chip, EmptyState, ProgressBar, SegmentedControl, StatTile, Switch } from '@/components/ui';
import { TRANSITION } from '@/styles/tokens';
import { computeDeckMastery, isQuizCard, listCardLocations, useLearningStore } from '@/stores/useLearningStore';
import { recordStudyAction } from '@/components/achievements/study-streak';
import type { CardLocation, ReviewGrade } from '@/types/learning';
import { DeckPickCard, KeyHints, TabHeader } from './QuizControls';
import { FlipCard, GradeBar, GradeSummary, RevealButton, countGrades } from './practice/StudyCard';
import { formatDuration, shuffled } from './practice/schedule';
import { useStudyKeys } from './practice/use-study-keys';

type KindFilter = 'all' | 'flashcard' | 'quiz';

const KIND_FILTERS: readonly { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'All cards' },
  { id: 'flashcard', label: 'Flashcards' },
  { id: 'quiz', label: 'Quiz cards' },
];

interface FlashResult {
  cardId: string;
  grade: ReviewGrade;
}

interface FlashSession {
  label: string;
  /** Deck colour for the card edge ('' = the live accent). */
  accent: string;
  cards: CardLocation[];
  index: number;
  flipped: boolean;
  startedAt: number;
  /** When the current card appeared (answer time). */
  shownAt: number;
  results: FlashResult[];
  skipped: number;
  finishedAt: number | null;
}

function matchesKind(location: CardLocation, kinds: KindFilter): boolean {
  if (kinds === 'all') return true;
  return kinds === 'quiz' ? isQuizCard(location.card) : location.card.kind === 'flashcard';
}

function FlashcardsAppInner() {
  const decks = useLearningStore((s) => s.decks);
  const reviews = useLearningStore((s) => s.reviews);
  const recordAttempt = useLearningStore((s) => s.recordAttempt);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [kinds, setKinds] = useState<KindFilter>('all');
  const [shuffleOn, setShuffleOn] = useState(true);
  const [session, setSession] = useState<FlashSession | null>(null);
  const reduceMotion = useReducedMotion();

  const deck = deckId ? decks.find((d) => d.id === deckId) : undefined;
  const topic = topicId ? deck?.topics.find((t) => t.id === topicId) : undefined;

  const deckStats = useMemo(
    () =>
      decks.map((d) => {
        const mastery = computeDeckMastery(d, reviews);
        return { deck: d, cards: mastery.total, mastery: mastery.value };
      }),
    [decks, reviews]
  );
  const totalCards = deckStats.reduce((sum, s) => sum + s.cards, 0);

  const pool = useMemo(
    () => listCardLocations(decks, deck?.id, topic?.id).filter((l) => matchesKind(l, kinds)),
    [decks, deck?.id, topic?.id, kinds]
  );

  const begin = useCallback(
    (cards: readonly CardLocation[], label: string, accent: string, shuffle: boolean) => {
      if (cards.length === 0) return;
      const t = Date.now();
      setSession({
        label,
        accent,
        cards: shuffle ? shuffled(cards) : [...cards],
        index: 0,
        flipped: false,
        startedAt: t,
        shownAt: t,
        results: [],
        skipped: 0,
        finishedAt: null,
      });
    },
    []
  );

  const start = useCallback(() => {
    const label = deck ? `${deck.icon} ${deck.name}${topic ? ` · ${topic.name}` : ''}` : 'All decks';
    begin(pool, label, deck?.color ?? '', shuffleOn);
  }, [begin, pool, deck, topic, shuffleOn]);

  const flip = useCallback(() => {
    setSession((s) => (s && s.finishedAt === null ? { ...s, flipped: !s.flipped } : s));
  }, []);

  /** Move past the current card; `result` is null for a skip. */
  const advance = useCallback((s: FlashSession, result: FlashResult | null, t: number): FlashSession => {
    const index = s.index + 1;
    return {
      ...s,
      index,
      flipped: false,
      shownAt: t,
      results: result ? [...s.results, result] : s.results,
      skipped: result ? s.skipped : s.skipped + 1,
      finishedAt: index >= s.cards.length ? t : null,
    };
  }, []);

  const grade = useCallback(
    (g: ReviewGrade) => {
      if (!session || session.finishedAt !== null || !session.flipped) return;
      const current = session.cards[session.index];
      if (!current) return;
      const t = Date.now();
      recordAttempt({
        cardId: current.card.id,
        correct: g !== 'again',
        grade: g,
        source: 'flashcards',
        durationMs: t - session.shownAt,
        at: t,
      });
      // Flashcard practice is study activity for today's streak.
      if (session.results.length === 0) recordStudyAction();
      setSession(advance(session, { cardId: current.card.id, grade: g }, t));
    },
    [session, recordAttempt, advance]
  );

  const skip = useCallback(() => {
    if (session && session.finishedAt === null) setSession(advance(session, null, Date.now()));
  }, [session, advance]);

  /** Reshuffle the cards not seen yet. */
  const shuffleRest = useCallback(() => {
    if (!session || session.finishedAt !== null) return;
    setSession({
      ...session,
      cards: [...session.cards.slice(0, session.index), ...shuffled(session.cards.slice(session.index))],
      flipped: false,
      shownAt: Date.now(),
    });
  }, [session]);

  const finishEarly = useCallback(() => {
    if (!session) return;
    setSession(session.results.length === 0 ? null : { ...session, finishedAt: Date.now() });
  }, [session]);

  const current = session && session.finishedAt === null ? session.cards[session.index] : undefined;
  const rootRef = useRef<HTMLDivElement>(null);
  const { onKeyDown, onKeyUp } = useStudyKeys(
    rootRef,
    { onFlip: flip, onGrade: grade, extra: { s: shuffleRest, arrowright: skip } },
    current && session ? `${session.index}:${session.flipped ? 1 : 0}:${current.card.id}` : null
  );

  // ─── Views ───

  const kindOptions = (
    <>
      <SegmentedControl
        size="sm"
        aria-label="Card kinds"
        value={kinds}
        onChange={setKinds}
        options={KIND_FILTERS.map((k) => ({ value: k.id, label: k.label }))}
      />
      <Switch size="sm" checked={shuffleOn} onCheckedChange={setShuffleOn} label="Shuffle" />
    </>
  );

  let body: ReactNode;
  let footer: ReactNode = null;
  if (session && current) {
    const againCount = session.results.filter((r) => r.grade === 'again').length;
    body = (
      <div className="@container flex flex-col gap-4 px-5 py-4">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
          <ProgressBar
            value={session.index}
            max={session.cards.length}
            size="sm"
            animated={false}
            className="flex-1"
            aria-label="Round progress"
          />
          <span className="shrink-0 font-mono text-xs text-fg-muted tabular">
            <span className="text-fg">{session.index + 1}</span> / {session.cards.length}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs text-success tabular" title="Remembered">
            <Check size={14} strokeWidth={2} aria-label="Remembered" />
            {session.results.length - againCount}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs text-danger tabular" title="Again">
            <X size={14} strokeWidth={2} aria-label="Again" />
            {againCount}
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${session.index}:${current.card.id}`}
            initial={{ opacity: 0, x: reduceMotion ? 0 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduceMotion ? 0 : -24 }}
            transition={TRANSITION.small}
            className="mx-auto w-full max-w-2xl"
          >
            <FlipCard
              card={current.card}
              flipped={session.flipped}
              onFlip={flip}
              caption={`${current.deckName} · ${current.topicName}`}
              accent={session.accent || undefined}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    );
    footer = (
      <div className="shrink-0 space-y-2.5 border-t border-line px-5 py-3">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-center gap-2">
          {session.flipped ? (
            <GradeBar onGrade={grade} />
          ) : (
            <>
              <RevealButton onReveal={flip} />
              <Button variant="ghost" size="lg" trailingIcon={ChevronRight} onClick={skip} title="Skip (→)">
                Skip
              </Button>
            </>
          )}
        </div>
        <KeyHints
          className="hidden @md:flex"
          items={[
            { keys: ['Space'], label: 'flip' },
            { keys: ['1', '4'], label: 'rate', range: true },
            { keys: ['S'], label: 'shuffle' },
            { keys: ['→'], label: 'skip' },
          ]}
        />
      </div>
    );
  } else if (session && session.finishedAt !== null) {
    const counts = countGrades(session.results);
    const answered = session.results.length;
    const remembered = answered - counts.again;
    const missedIds = new Set(session.results.filter((r) => r.grade === 'again' || r.grade === 'hard').map((r) => r.cardId));
    const missed = session.cards.filter((c) => missedIds.has(c.card.id));
    body = (
      <div className="@container mx-auto max-w-2xl space-y-5 p-5">
        <motion.div
          initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={TRANSITION.panel}
        >
          <Card hud tone="ember" padding="lg">
            <div className="flex flex-col items-center gap-4 text-center @lg:flex-row @lg:text-left">
              <span className="armor-plate chamfer-md flex size-14 shrink-0 items-center justify-center bg-[color-mix(in_oklab,var(--color-gold)_18%,var(--color-steel-800))] text-gold [--cut-tl:12px] [--cut-br:12px]">
                <Trophy size={26} strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="hud-label">Flashcards · done</div>
                <h3 className="mt-1 text-xl font-semibold text-fg">Round complete</h3>
                <p className="mt-1 truncate text-ui text-fg-muted" title={session.label}>
                  {session.label}
                  {session.skipped > 0 ? ` · ${session.skipped} skipped` : ''}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 gap-3 @md:grid-cols-3">
          <StatTile
            size="sm"
            label="Remembered"
            icon={Sparkles}
            value={answered > 0 ? `${Math.round((remembered / answered) * 100)}%` : '—'}
          />
          <StatTile size="sm" label="Rated" icon={Layers} value={answered} />
          <StatTile size="sm" label="Time" icon={Clock} value={formatDuration(session.finishedAt - session.startedAt)} />
        </div>

        {answered > 0 && (
          <Card eyebrow="Recall" title="How it went">
            <GradeSummary counts={counts} />
          </Card>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" size="lg" leadingIcon={Layers} onClick={() => setSession(null)}>
            Change deck
          </Button>
          <Button
            variant={missed.length > 0 ? 'secondary' : 'primary'}
            size="lg"
            leadingIcon={Shuffle}
            onClick={() => begin(session.cards, session.label, session.accent, true)}
          >
            Shuffle &amp; restart
          </Button>
          {missed.length > 0 && (
            <Button
              variant="primary"
              size="lg"
              leadingIcon={RotateCcw}
              onClick={() => begin(missed, `${session.label.replace(/ · missed$/, '')} · missed`, session.accent, shuffleOn)}
            >
              Study missed · {missed.length}
            </Button>
          )}
        </div>
      </div>
    );
  } else {
    body = (
      <div className="@container space-y-6 p-5">
        <TabHeader
          icon={Layers}
          title="Flashcards"
          description="Flip through your own decks. Quiz cards show their answer on the back; rate each card and your mastery updates as you go."
        />

        {totalCards === 0 ? (
          <EmptyState icon={Layers} title="No cards yet" description="Add a deck in Training Grounds, then flip through it here." />
        ) : (
          <>
            {/* Decks */}
            <section className="space-y-3" aria-label="Deck">
              <span className="hud-label">Deck</span>
              <div className="grid gap-3 @md:grid-cols-2 @3xl:grid-cols-3">
                <DeckPickCard
                  icon={<Layers size={18} strokeWidth={1.75} />}
                  name="All decks"
                  meta={`${totalCards} cards`}
                  selected={!deck}
                  onClick={() => {
                    setDeckId(null);
                    setTopicId(null);
                  }}
                />
                {deckStats.map(({ deck: d, cards, mastery }) => (
                  <DeckPickCard
                    key={d.id}
                    icon={d.icon}
                    name={d.name}
                    meta={`${cards} card${cards === 1 ? '' : 's'}`}
                    mastery={mastery}
                    selected={deck?.id === d.id}
                    onClick={() => {
                      setDeckId(d.id);
                      setTopicId(null);
                    }}
                  />
                ))}
              </div>
            </section>

            {/* Topics */}
            {deck && deck.topics.length > 1 && (
              <section className="space-y-3" aria-label="Topic">
                <span className="hud-label">Topic</span>
                <div className="flex flex-wrap gap-2">
                  <Chip selected={!topic} onClick={() => setTopicId(null)}>
                    All topics
                  </Chip>
                  {deck.topics.map((t) => (
                    <Chip key={t.id} selected={topic?.id === t.id} onClick={() => setTopicId(t.id)}>
                      {t.name}
                      <span className="ml-1.5 font-mono tabular opacity-60">{t.cards.length}</span>
                    </Chip>
                  ))}
                </div>
              </section>
            )}

            <section className="flex flex-wrap items-center gap-4 @lg:hidden" aria-label="Options">
              {kindOptions}
            </section>
          </>
        )}
      </div>
    );
  }

  if (!session && totalCards > 0) {
    footer = (
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-5 py-3">
        <div className="hidden flex-wrap items-center gap-4 @lg:flex">{kindOptions}</div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          {pool.length === 0 && <span className="truncate text-xs text-warning">No cards match these filters</span>}
          <Button
            variant="primary"
            size="lg"
            leadingIcon={Play}
            onClick={start}
            disabled={pool.length === 0}
            className="w-full @lg:w-auto"
          >
            Start · {pool.length} card{pool.length === 1 ? '' : 's'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={current ? onKeyDown : undefined}
      onKeyUp={current ? onKeyUp : undefined}
      className="@container flex h-full flex-col outline-none"
    >
      {session && (
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-3">
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={ArrowLeft}
            onClick={current ? finishEarly : () => setSession(null)}
            title={current ? 'End this round' : 'Back to decks'}
          >
            {current ? 'End' : 'Decks'}
          </Button>
          <span aria-hidden className="h-5 w-px bg-line-strong" />
          <span className="min-w-0 flex-1 truncate text-ui text-fg-muted" title={session.label}>
            {session.label}
          </span>
          {current && (
            <Button variant="ghost" size="sm" leadingIcon={Shuffle} onClick={shuffleRest} title="Shuffle the remaining cards (S)">
              Shuffle
            </Button>
          )}
        </header>
      )}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">{body}</div>
      {footer}
    </div>
  );
}

export const FlashcardsApp = memo(FlashcardsAppInner);
