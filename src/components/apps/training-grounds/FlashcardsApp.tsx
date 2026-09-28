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
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, Layers, Play, RotateCcw, Shuffle, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeDeckMastery, isQuizCard, listCardLocations, useLearningStore } from '@/stores/useLearningStore';
import { recordStudyAction } from '@/components/achievements/study-streak';
import type { CardLocation, ReviewGrade } from '@/types/learning';
import { FlipCard, GradeBar, GradeSummary, Kbd, RevealButton, countGrades } from './practice/StudyCard';
import { masteryColor, toPercent } from './practice/mastery';
import { formatDuration, shuffled } from './practice/schedule';
import { useStudyKeys } from './practice/use-study-keys';

type KindFilter = 'all' | 'flashcard' | 'quiz';

const KIND_FILTERS: readonly { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'All cards' },
  { id: 'flashcard', label: 'Flashcards' },
  { id: 'quiz', label: 'Quiz cards' },
];

const DEFAULT_ACCENT = '#22d3ee';

interface FlashResult {
  cardId: string;
  grade: ReviewGrade;
}

interface FlashSession {
  label: string;
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

const CHIP = 'px-3 py-1 rounded-md text-xs border transition-all';
const CHIP_OFF = 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10';

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
    begin(pool, label, deck?.color ?? DEFAULT_ACCENT, shuffleOn);
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

  let body: ReactNode;
  if (session && current) {
    const progress = session.index / session.cards.length;
    const againCount = session.results.filter((r) => r.grade === 'again').length;
    body = (
      <div className="flex min-h-full flex-col gap-4 p-5">
        <div className="flex items-center gap-3 text-xs text-white/50">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: session.accent }}
              initial={false}
              animate={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="tabular-nums">
            {session.index + 1} / {session.cards.length}
          </span>
          <span className="tabular-nums text-green-300/80" title="Remembered">
            ✓ {session.results.length - againCount}
          </span>
          <span className="tabular-nums text-red-300/80" title="Again">
            ✗ {againCount}
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${session.index}:${current.card.id}`}
            initial={{ opacity: 0, x: 28, rotate: 1.5 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            exit={{ opacity: 0, x: -28, rotate: -1.5 }}
            transition={{ duration: 0.18 }}
            className="mx-auto w-full max-w-xl"
          >
            <FlipCard
              card={current.card}
              flipped={session.flipped}
              onFlip={flip}
              caption={`${current.deckName} · ${current.topicName}`}
              accent={session.accent}
            />
          </motion.div>
        </AnimatePresence>

        <div className="mx-auto flex w-full max-w-xl items-center gap-2">
          {session.flipped ? (
            <GradeBar onGrade={grade} />
          ) : (
            <>
              <RevealButton onReveal={flip} />
              <button
                type="button"
                onClick={skip}
                className="flex items-center gap-1 rounded-lg px-3 py-2.5 text-xs text-white/45 hover:bg-white/5 hover:text-white/75"
                title="Skip (→)"
              >
                Skip
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
        <p className="text-center text-[10px] text-white/30">
          <Kbd>Space</Kbd> flip · <Kbd>1</Kbd>–<Kbd>4</Kbd> rate · <Kbd>S</Kbd> shuffle · <Kbd>→</Kbd> skip
        </p>
      </div>
    );
  } else if (session && session.finishedAt !== null) {
    const counts = countGrades(session.results);
    const answered = session.results.length;
    const remembered = answered - counts.again;
    const missedIds = new Set(session.results.filter((r) => r.grade === 'again' || r.grade === 'hard').map((r) => r.cardId));
    const missed = session.cards.filter((c) => missedIds.has(c.card.id));
    const tiles = [
      { label: 'Remembered', value: answered > 0 ? `${Math.round((remembered / answered) * 100)}%` : '—' },
      { label: 'Rated', value: String(answered) },
      { label: 'Time', value: formatDuration(session.finishedAt - session.startedAt) },
    ];
    body = (
      <div className="mx-auto max-w-xl space-y-5 p-5">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 p-5 text-center"
        >
          <Trophy className="mx-auto h-8 w-8 text-yellow-300" />
          <h3 className="mt-2 text-lg font-bold text-white">Round complete</h3>
          <p className="mt-1 text-xs text-white/50">
            {session.label}
            {session.skipped > 0 ? ` · ${session.skipped} skipped` : ''}
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
        {answered > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <GradeSummary counts={counts} />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {missed.length > 0 && (
            <button
              type="button"
              onClick={() => begin(missed, `${session.label.replace(/ · missed$/, '')} · missed`, session.accent, shuffleOn)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-orange-400/30 bg-orange-500/15 p-3 text-sm font-semibold text-orange-200 hover:bg-orange-500/25"
            >
              <RotateCcw className="h-4 w-4" />
              Study missed · {missed.length}
            </button>
          )}
          <button
            type="button"
            onClick={() => begin(session.cards, session.label, session.accent, true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/20 p-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/30"
          >
            <Shuffle className="h-4 w-4" />
            Shuffle & restart
          </button>
          <button
            type="button"
            onClick={() => setSession(null)}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/70 hover:bg-white/10"
          >
            Change deck
          </button>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="space-y-5 p-5">
        <p className="text-xs text-white/50">
          Flip through your own decks. Quiz cards show their answer on the back. Rate each card and your mastery
          updates as you go.
        </p>

        {/* Decks */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2">
          <button
            type="button"
            onClick={() => {
              setDeckId(null);
              setTopicId(null);
            }}
            className={cn(
              'rounded-xl border p-3 text-left transition-all',
              !deck ? 'border-cyan-400/50 bg-cyan-500/15' : 'border-white/10 bg-white/5 hover:bg-white/10'
            )}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-white/90">
              <Layers className="h-4 w-4 text-cyan-300" />
              All decks
            </span>
            <span className="mt-1 block text-[11px] text-white/40">{totalCards} cards</span>
          </button>
          {deckStats.map(({ deck: d, cards, mastery }) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setDeckId(d.id);
                setTopicId(null);
              }}
              className={cn(
                'rounded-xl border p-3 text-left transition-all',
                deck?.id === d.id ? 'bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
              )}
              style={deck?.id === d.id ? { borderColor: d.color } : undefined}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-white/90">
                <span>{d.icon}</span>
                <span className="truncate">{d.name}</span>
              </span>
              <span className="mt-1 flex items-center justify-between text-[11px] text-white/40">
                <span>{cards} cards</span>
                <span className="tabular-nums">{toPercent(mastery)}% mastery</span>
              </span>
              <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/10">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${Math.max(2, toPercent(mastery))}%`, backgroundColor: masteryColor(mastery) }}
                />
              </span>
            </button>
          ))}
        </div>

        {/* Topics */}
        {deck && deck.topics.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTopicId(null)}
              className={cn(CHIP, !topic ? 'bg-purple-500/20 border-purple-500/40 text-purple-200' : CHIP_OFF)}
            >
              All topics
            </button>
            {deck.topics.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTopicId(t.id)}
                className={cn(
                  CHIP,
                  topic?.id === t.id ? 'bg-purple-500/20 border-purple-500/40 text-purple-200' : CHIP_OFF
                )}
              >
                {t.name}
                <span className="ml-1.5 text-white/35 tabular-nums">{t.cards.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Options */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-white/10 text-xs">
            {KIND_FILTERS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKinds(k.id)}
                aria-pressed={kinds === k.id}
                className={cn(
                  'px-3 py-1 transition-colors',
                  kinds === k.id ? 'bg-cyan-500/25 text-cyan-100' : 'text-white/50 hover:bg-white/10'
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShuffleOn((on) => !on)}
            aria-pressed={shuffleOn}
            className={cn(
              CHIP,
              'flex items-center gap-1.5',
              shuffleOn ? 'bg-purple-500/20 border-purple-500/40 text-purple-200' : CHIP_OFF
            )}
          >
            <Shuffle className="h-3.5 w-3.5" />
            {shuffleOn ? 'Shuffled' : 'In order'}
          </button>
        </div>

        <button
          type="button"
          onClick={start}
          disabled={pool.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/20 p-3 text-sm font-semibold text-cyan-100 shadow-[0_0_24px_-10px_rgba(34,211,238,0.8)] transition-all hover:bg-cyan-500/30 disabled:opacity-30 disabled:shadow-none"
        >
          <Play className="h-4 w-4" />
          {pool.length > 0
            ? `Start · ${pool.length} card${pool.length === 1 ? '' : 's'}`
            : totalCards === 0
              ? 'No cards yet: add a deck in Training Grounds'
              : 'No cards match these filters'}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={current ? onKeyDown : undefined}
      onKeyUp={current ? onKeyUp : undefined}
      className="flex h-full flex-col bg-black/30 outline-none"
    >
      <header className="flex items-center gap-3 border-b border-white/10 bg-black/20 px-4 py-2.5">
        {session && (
          <button
            type="button"
            onClick={current ? finishEarly : () => setSession(null)}
            className="flex items-center gap-1 text-xs text-white/50 hover:text-white/85"
            title={current ? 'End this round' : 'Back to decks'}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {current ? 'End' : 'Decks'}
          </button>
        )}
        <h2 className="text-sm font-bold tracking-wider text-cyan-400">🃏 FLASHCARDS</h2>
        {session && <span className="truncate text-xs text-white/50">{session.label}</span>}
        {current && (
          <button
            type="button"
            onClick={shuffleRest}
            className="ml-auto flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/60 hover:bg-white/10"
            title="Shuffle the remaining cards (S)"
          >
            <Shuffle className="h-3.5 w-3.5" />
            Shuffle
          </button>
        )}
      </header>
      <div className="flex-1 overflow-y-auto">{body}</div>
    </div>
  );
}

export const FlashcardsApp = memo(FlashcardsAppInner);
