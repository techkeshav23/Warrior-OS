// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Quiz Engine
// Pick a deck (and topic), question count, feedback style and an
// optional timer → answer MCQ / multi-select / numeric cards →
// graded results with a per-card review and "retry wrong ones".
// Answers feed the learning store (spaced repetition + mastery);
// each quiz is logged to quiz history, pays XP and fires the quiz
// achievements.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect, useMemo, useRef, memo, type KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useXPStore } from '@/stores/useXPStore';
import { useQuizHistoryStore } from '@/stores/useQuizHistoryStore';
import {
  cardStrength,
  computeDeckMastery,
  isQuizCard,
  listCardLocations,
  useLearningStore,
} from '@/stores/useLearningStore';
import { recordQuizCompletion } from '@/components/achievements/quiz-achievements';
import type { QuizCard, RecordAttemptInput } from '@/types/learning';
import type { DeckTarget } from './deep-link';
import { QuestionView } from './QuestionView';
import { AccuracyBar, Chip, Field, StatTile } from './QuizControls';
import {
  DIFFICULTY_STYLES,
  answerFromKey,
  answerStatus,
  createStopwatch,
  formatClock,
  formatDuration,
  isAnswerCorrect,
  isAnswered,
  letterGrade,
  percent,
  shuffle,
  type AnswerStatus,
  type UserAnswer,
} from './grading';

type Phase = 'setup' | 'quiz' | 'results';
type FeedbackMode = 'instant' | 'end';
type ReviewFilter = 'all' | 'missed' | 'correct';

/** Question counts on offer; 0 = every question in scope. */
const COUNT_OPTIONS = [5, 10, 15, 20, 30, 0] as const;
/** Countdown pace in seconds per question; 0 = untimed. */
const PACE_OPTIONS = [0, 20, 30, 60, 90] as const;

/** Review rows show this much of the prompt until opened. */
const PROMPT_PREVIEW = 90;

const XP_PER_CORRECT = 10;
/** Bonus XP for XP_BONUS_PCT+ on a fresh quiz of BONUS_MIN_QUESTIONS or more. */
const XP_BONUS = 50;
const XP_BONUS_PCT = 80;
const BONUS_MIN_QUESTIONS = 5;

interface QuizSettings {
  /** Questions per quiz; 0 = all. */
  count: number;
  feedback: FeedbackMode;
  /** Seconds per question for the countdown; 0 = untimed. */
  paceSeconds: number;
  /** Lowest-mastery cards first instead of a random pick. */
  weakFirst: boolean;
}

/** Settings of the last quiz, kept while the OS runs (switching tabs remounts the engine). */
let lastSettings: QuizSettings = { count: 10, feedback: 'instant', paceSeconds: 0, weakFirst: false };

function rememberSettings(settings: QuizSettings): void {
  lastSettings = settings;
}

interface QuizItem {
  card: QuizCard;
  topicId: string;
  topicName: string;
}

interface QuizRun {
  deckId: string;
  deckName: string;
  /** Topic the quiz was limited to. */
  topicName: string | null;
  items: QuizItem[];
  settings: QuizSettings;
  /** "Retry wrong ones" round: no bonus XP, no streak / perfect-score unlocks. */
  retry: boolean;
  index: number;
  answers: Record<string, UserAnswer>;
  /** Cards checked in instant-feedback mode (locked and marked). */
  checked: Record<string, boolean>;
  startedAt: number;
  /** Countdown end (epoch ms); null when untimed. */
  endsAt: number | null;
  finishedAt: number | null;
  timedOut: boolean;
  xpEarned: number;
  /** Time spent answering each card (ms), filled in on submit. */
  spentMs: Record<string, number>;
}

type RunSeed = Pick<QuizRun, 'deckId' | 'deckName' | 'topicName' | 'items' | 'settings' | 'retry'>;

interface QuizEngineProps {
  /** Deck (and topic) to preselect, e.g. from a NEXUS deep link. */
  initialTarget?: DeckTarget | null;
}

function quizXP(correct: number, total: number, retry: boolean): number {
  const bonus = !retry && total >= BONUS_MIN_QUESTIONS && percent(correct, total) >= XP_BONUS_PCT ? XP_BONUS : 0;
  return correct * XP_PER_CORRECT + bonus;
}

const STATUS_MARKS: Record<AnswerStatus, { icon: string; className: string }> = {
  correct: { icon: '✓', className: 'text-green-400' },
  wrong: { icon: '✗', className: 'text-red-400' },
  skipped: { icon: '—', className: 'text-white/40' },
};

const REVIEW_STYLES: Record<AnswerStatus, string> = {
  correct: 'bg-green-500/10 border-green-500/20',
  wrong: 'bg-red-500/10 border-red-500/20',
  skipped: 'bg-white/5 border-white/10',
};

function QuizEngineInner({ initialTarget = null }: QuizEngineProps) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [deckId, setDeckId] = useState<string | null>(initialTarget?.deckId ?? null);
  const [topicId, setTopicId] = useState<string | null>(initialTarget?.topicId ?? null);
  const [settings, setSettings] = useState<QuizSettings>(() => lastSettings);
  const [run, setRun] = useState<QuizRun | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [stopwatch] = useState(createStopwatch);
  const finishedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const addXP = useXPStore((s) => s.addXP);
  const recordSession = useQuizHistoryStore((s) => s.recordAttempt);
  const decks = useLearningStore((s) => s.decks);
  const reviews = useLearningStore((s) => s.reviews);
  const recordAttempts = useLearningStore((s) => s.recordAttempts);

  // Gradable (non-flashcard) cards per deck and per topic, plus deck mastery.
  const deckStats = useMemo(() => {
    const counts = new Map<string, number>();
    const mastery = new Map<string, number>();
    for (const deck of decks) {
      let deckTotal = 0;
      for (const topic of deck.topics) {
        const n = topic.cards.filter(isQuizCard).length;
        counts.set(topic.id, n);
        deckTotal += n;
      }
      counts.set(deck.id, deckTotal);
      mastery.set(deck.id, computeDeckMastery(deck, reviews).value);
    }
    return { counts, mastery };
  }, [decks, reviews]);

  const countOf = (id: string) => deckStats.counts.get(id) ?? 0;
  const selectedDeck = decks.find((d) => d.id === deckId && countOf(d.id) > 0);
  const topics = selectedDeck ? selectedDeck.topics.filter((t) => countOf(t.id) > 0) : [];
  // A topic without quiz cards (e.g. flashcards only) falls back to the whole deck.
  const activeTopic = topics.find((t) => t.id === topicId) ?? null;
  const poolSize = activeTopic ? countOf(activeTopic.id) : selectedDeck ? countOf(selectedDeck.id) : 0;
  const plannedCount = settings.count === 0 ? poolSize : Math.min(settings.count, poolSize);
  // A count above what the scope holds shows as "All".
  const countChoice = settings.count > poolSize ? 0 : settings.count;

  // ─── Running a quiz ───

  const beginRun = useCallback(
    (seed: RunSeed) => {
      if (seed.items.length === 0) return;
      const start = Date.now();
      finishedRef.current = false;
      stopwatch.reset(start);
      setRun({
        ...seed,
        index: 0,
        answers: {},
        checked: {},
        startedAt: start,
        endsAt: seed.settings.paceSeconds > 0 ? start + seed.items.length * seed.settings.paceSeconds * 1000 : null,
        finishedAt: null,
        timedOut: false,
        xpEarned: 0,
        spentMs: {},
      });
      setNow(start);
      setConfirmFinish(false);
      setReviewFilter('all');
      setPhase('quiz');
      // Keys work straight away (unless a numeric input took the focus).
      requestAnimationFrame(() => {
        const panel = containerRef.current;
        if (panel && !panel.contains(document.activeElement)) panel.focus();
      });
    },
    [stopwatch]
  );

  const startQuiz = () => {
    if (!selectedDeck) return;
    const pool: QuizItem[] = [];
    for (const location of listCardLocations([selectedDeck], selectedDeck.id, activeTopic?.id)) {
      if (isQuizCard(location.card)) {
        pool.push({ card: location.card, topicId: location.topicId, topicName: location.topicName });
      }
    }
    let ordered = shuffle(pool);
    if (settings.weakFirst) {
      // Weakest (and never answered) cards first; the stable sort keeps ties shuffled.
      const strength = new Map(ordered.map((item) => [item.card.id, cardStrength(reviews[item.card.id])] as const));
      ordered = ordered.sort((a, b) => (strength.get(a.card.id) ?? 0) - (strength.get(b.card.id) ?? 0));
    }
    rememberSettings(settings);
    beginRun({
      deckId: selectedDeck.id,
      deckName: selectedDeck.name,
      topicName: activeTopic?.name ?? null,
      items: settings.count === 0 ? ordered : ordered.slice(0, settings.count),
      settings,
      retry: false,
    });
  };

  const setAnswer = useCallback((cardId: string, answer: UserAnswer) => {
    setRun((prev) =>
      prev && !prev.checked[cardId] ? { ...prev, answers: { ...prev.answers, [cardId]: answer } } : prev
    );
    setConfirmFinish(false);
  }, []);

  /** Books the time on the current card (reading a checked card's explanation does not count). */
  const leaveCurrent = useCallback(
    (r: QuizRun) => {
      const id = r.items[r.index].card.id;
      stopwatch.leave(r.checked[id] ? null : id, Date.now());
    },
    [stopwatch]
  );

  const goTo = useCallback(
    (index: number) => {
      if (!run) return;
      const next = Math.max(0, Math.min(run.items.length - 1, index));
      if (next === run.index) return;
      leaveCurrent(run);
      setRun({ ...run, index: next });
      setConfirmFinish(false);
      // Keep keyboard focus in the quiz when the focused input unmounts.
      containerRef.current?.focus();
    },
    [run, leaveCurrent]
  );

  const checkCurrent = useCallback(() => {
    if (!run) return;
    const { card } = run.items[run.index];
    if (run.checked[card.id] || !isAnswered(run.answers[card.id])) return;
    leaveCurrent(run);
    setRun({ ...run, checked: { ...run.checked, [card.id]: true } });
    containerRef.current?.focus();
  }, [run, leaveCurrent]);

  const finishQuiz = useCallback(
    (timedOut: boolean) => {
      if (!run || finishedRef.current) return;
      finishedRef.current = true;
      leaveCurrent(run);
      const at = Date.now();
      const spentMs = stopwatch.snapshot();
      // Per question, in the order shown: drives score, XP and the answer-streak achievement.
      const results = run.items.map((item) => isAnswerCorrect(item.card, run.answers[item.card.id]));
      const answered = run.items.filter((item) => isAnswered(run.answers[item.card.id])).length;
      const correct = results.filter(Boolean).length;
      const xp = answered > 0 ? quizXP(correct, run.items.length, run.retry) : 0;

      // A blank submission is not a quiz: nothing is logged.
      if (answered > 0) {
        if (xp > 0) addXP(xp, 'quiz');

        // Per-card progress (answered cards only): spaced-repetition schedule + mastery.
        const cardResults: RecordAttemptInput[] = [];
        run.items.forEach((item, i) => {
          if (!isAnswered(run.answers[item.card.id])) return;
          const durationMs = spentMs[item.card.id];
          cardResults.push({
            cardId: item.card.id,
            correct: results[i],
            source: 'quiz',
            at,
            ...(durationMs ? { durationMs } : {}),
          });
        });
        recordAttempts(cardResults);

        // Session log, one row per topic, so NEXUS / widgets / the creature see the quiz.
        const buckets = new Map<string, { name: string; total: number; correct: number }>();
        run.items.forEach((item, i) => {
          const bucket = buckets.get(item.topicId) ?? { name: item.topicName, total: 0, correct: 0 };
          bucket.total += 1;
          if (results[i]) bucket.correct += 1;
          buckets.set(item.topicId, bucket);
        });
        for (const [topicId, bucket] of buckets) {
          recordSession({
            subject: run.deckName,
            topic: bucket.name,
            deckId: run.deckId,
            topicId,
            totalQuestions: bucket.total,
            correctAnswers: bucket.correct,
            ...(run.retry ? { retry: true } : {}),
          });
        }

        // Achievements (after the history write, which the creature also reacts to):
        // first-quiz, quiz-streak-5, perfect-quiz, all-subjects, quiz-master,
        // night-owl / early-bird, study streak.
        recordQuizCompletion({ kind: 'quiz', deckId: run.deckId, results, answered, retry: run.retry });
      }

      setRun({ ...run, finishedAt: at, timedOut, xpEarned: xp, spentMs });
      setConfirmFinish(false);
      setReviewFilter('all');
      setPhase('results');
    },
    [run, stopwatch, leaveCurrent, addXP, recordAttempts, recordSession]
  );

  // The countdown calls the latest finishQuiz without restarting its interval.
  const finishRef = useRef(finishQuiz);
  useEffect(() => {
    finishRef.current = finishQuiz;
  });

  // Clock: elapsed / time left derive from `now`; auto-submit when time runs out.
  const endsAt = run?.endsAt ?? null;
  useEffect(() => {
    if (phase !== 'quiz') return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (endsAt !== null && t >= endsAt) finishRef.current(true);
    }, 1000);
    return () => clearInterval(id);
  }, [phase, endsAt]);

  /** Submit, asking once when questions are still unanswered. */
  const requestFinish = useCallback(() => {
    if (!run) return;
    const unanswered = run.items.filter((item) => !isAnswered(run.answers[item.card.id])).length;
    if (unanswered > 0 && !confirmFinish) setConfirmFinish(true);
    else finishQuiz(false);
  }, [run, confirmFinish, finishQuiz]);

  const quitQuiz = useCallback(() => {
    finishedRef.current = true;
    setRun(null);
    setConfirmFinish(false);
    setPhase('setup');
  }, []);

  const retryMissed = useCallback(() => {
    if (!run) return;
    const missed = run.items.filter((item) => !isAnswerCorrect(item.card, run.answers[item.card.id]));
    beginRun({
      deckId: run.deckId,
      deckName: run.deckName,
      topicName: run.topicName,
      items: shuffle(missed),
      settings: run.settings,
      retry: true,
    });
  }, [run, beginRun]);

  /** Enter: check (instant feedback), else next question / submit. */
  const primaryAction = () => {
    if (!run) return;
    const { card } = run.items[run.index];
    if (run.settings.feedback === 'instant' && !run.checked[card.id]) {
      if (isAnswered(run.answers[card.id])) checkCurrent();
      return;
    }
    if (run.index === run.items.length - 1) requestFinish();
    else goTo(run.index + 1);
  };

  // Keys (only while focus is inside the quiz): 1-9 / 0 pick options, Enter checks / moves on, ← → navigate.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (phase !== 'quiz' || !run || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement;
    if (e.key === 'Enter') {
      // Other buttons keep their own Enter; options, the number input and the panel run the main action.
      if (target.tagName === 'BUTTON' && target.dataset.quizOption === undefined) return;
      e.preventDefault();
      primaryAction();
      return;
    }
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(run.index + (e.key === 'ArrowRight' ? 1 : -1));
      return;
    }
    const { card } = run.items[run.index];
    if (run.checked[card.id]) return;
    const next = answerFromKey(card, run.answers[card.id], e.key);
    if (next !== null) {
      e.preventDefault();
      setAnswer(card.id, next);
    }
  };

  // ─── Setup ───
  if (phase === 'setup') {
    const hasQuizCards = decks.some((d) => countOf(d.id) > 0);
    return (
      <div className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-white">📝 Quiz</h3>
          <p className="text-xs text-white/40 mt-1">Pick a deck, set the pace, prove what you know.</p>
        </div>

        {!hasQuizCards && (
          <p className="text-sm text-white/40">
            No quiz questions yet. Decks need multiple-choice, multi-select or numeric cards to run a quiz.
          </p>
        )}

        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
          {decks.map((deck) => {
            const count = countOf(deck.id);
            const mastery = Math.round((deckStats.mastery.get(deck.id) ?? 0) * 100);
            const active = selectedDeck?.id === deck.id;
            return (
              <button
                key={deck.id}
                type="button"
                disabled={count === 0}
                aria-pressed={active}
                onClick={() => {
                  setDeckId(deck.id);
                  setTopicId(null);
                }}
                className={cn(
                  'p-3 rounded-lg text-sm border transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed',
                  active
                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                    : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span>{deck.icon}</span>
                  <span className="truncate">{deck.name}</span>
                </span>
                <span className="block text-[10px] text-white/40 mt-1">
                  {count} question{count === 1 ? '' : 's'} · {mastery}% mastery
                </span>
                <span className="block h-1 mt-2 rounded bg-white/10 overflow-hidden">
                  <span className="block h-full rounded" style={{ width: `${mastery}%`, backgroundColor: deck.color }} />
                </span>
              </button>
            );
          })}
        </div>

        {selectedDeck && topics.length > 1 && (
          <Field label="Topic (optional)">
            <Chip active={!activeTopic} onClick={() => setTopicId(null)}>
              All topics
            </Chip>
            {topics.map((t) => (
              <Chip key={t.id} active={activeTopic?.id === t.id} onClick={() => setTopicId(t.id)}>
                {t.name} <span className="opacity-50">{countOf(t.id)}</span>
              </Chip>
            ))}
          </Field>
        )}

        {selectedDeck && (
          <div className="space-y-4 p-4 rounded-lg border border-white/10 bg-white/[0.03]">
            <Field label="Questions">
              {COUNT_OPTIONS.map((n) => (
                <Chip
                  key={n}
                  active={countChoice === n}
                  disabled={n > poolSize}
                  onClick={() => setSettings((s) => ({ ...s, count: n }))}
                >
                  {n === 0 ? `All (${poolSize})` : n}
                </Chip>
              ))}
            </Field>
            <Field
              label="Feedback"
              hint={
                settings.feedback === 'instant'
                  ? 'Check each answer as you go and read the explanation.'
                  : 'Answer everything first; the review comes with the results.'
              }
            >
              <Chip
                active={settings.feedback === 'instant'}
                onClick={() => setSettings((s) => ({ ...s, feedback: 'instant' }))}
              >
                Instant
              </Chip>
              <Chip active={settings.feedback === 'end'} onClick={() => setSettings((s) => ({ ...s, feedback: 'end' }))}>
                At the end
              </Chip>
            </Field>
            <Field label="Timer">
              {PACE_OPTIONS.map((sec) => (
                <Chip
                  key={sec}
                  active={settings.paceSeconds === sec}
                  onClick={() => setSettings((s) => ({ ...s, paceSeconds: sec }))}
                >
                  {sec === 0 ? 'Off' : `${sec}s / question`}
                </Chip>
              ))}
            </Field>
            <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={settings.weakFirst}
                onChange={(e) => setSettings((s) => ({ ...s, weakFirst: e.target.checked }))}
                className="accent-cyan-400"
              />
              Weakest cards first (lowest mastery)
            </label>
          </div>
        )}

        {selectedDeck && (
          <button
            type="button"
            onClick={startQuiz}
            className="px-6 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 transition-all text-sm font-semibold"
          >
            Start Quiz →{' '}
            <span className="font-normal text-cyan-300/60">
              {plannedCount} question{plannedCount === 1 ? '' : 's'}
              {settings.paceSeconds > 0 ? ` · ${formatClock(plannedCount * settings.paceSeconds)}` : ''}
            </span>
          </button>
        )}
      </div>
    );
  }

  // ─── Quiz ───
  if (phase === 'quiz' && run) {
    const { card, topicName } = run.items[run.index];
    const answer = run.answers[card.id];
    const instant = run.settings.feedback === 'instant';
    const checked = Boolean(run.checked[card.id]);
    const last = run.index === run.items.length - 1;
    const unanswered = run.items.filter((item) => !isAnswered(run.answers[item.card.id])).length;
    const timeLeft = run.endsAt !== null ? Math.max(0, Math.ceil((run.endsAt - now) / 1000)) : null;
    const timeBudget = run.endsAt !== null ? (run.endsAt - run.startedAt) / 1000 : 0;
    const elapsed = Math.max(0, Math.floor((now - run.startedAt) / 1000));

    return (
      <div ref={containerRef} tabIndex={-1} onKeyDown={onKeyDown} className="p-6 h-full flex flex-col outline-none">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 text-xs">
          <span className="text-white/50 shrink-0">
            Question {run.index + 1} / {run.items.length}
          </span>
          <span className="flex-1 truncate text-center text-white/40">
            {run.deckName} • {topicName}
            {run.retry ? ' • retry round' : ''}
          </span>
          <span className={cn('px-2 py-0.5 rounded shrink-0', DIFFICULTY_STYLES[card.difficulty])}>{card.difficulty}</span>
          <span
            title={timeLeft !== null ? 'Time left' : 'Time elapsed'}
            className={cn(
              'font-mono shrink-0',
              timeLeft === null
                ? 'text-white/40'
                : timeLeft <= Math.max(10, timeBudget * 0.15)
                ? 'text-red-400 animate-pulse'
                : 'text-cyan-300'
            )}
          >
            {timeLeft !== null ? `⏱ ${formatClock(timeLeft)}` : formatClock(elapsed)}
          </span>
          <button type="button" onClick={requestFinish} className="shrink-0 text-green-300/70 hover:text-green-200">
            Finish
          </button>
          <button type="button" onClick={quitQuiz} className="shrink-0 text-white/40 hover:text-white/70">
            Quit
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-white/10 rounded mb-6">
          <div
            className="h-full bg-cyan-500 rounded transition-all"
            style={{ width: `${((run.index + 1) / run.items.length) * 100}%` }}
          />
        </div>

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="flex-1"
          >
            <QuestionView
              card={card}
              answer={answer}
              onAnswer={(a) => setAnswer(card.id, a)}
              reveal={checked}
              autoFocus
            />
          </motion.div>
        </AnimatePresence>

        {confirmFinish && (
          <div className="mt-4 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-xs text-yellow-200 flex flex-wrap items-center justify-between gap-2">
            <span>
              {unanswered} question{unanswered === 1 ? '' : 's'} unanswered: they count as wrong.
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmFinish(false)}
                className="px-3 py-1 rounded border border-white/10 text-white/60 hover:text-white"
              >
                Keep going
              </button>
              <button
                type="button"
                onClick={() => finishQuiz(false)}
                className="px-3 py-1 rounded bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500/30"
              >
                Submit anyway
              </button>
            </span>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={() => goTo(run.index - 1)}
            disabled={run.index === 0}
            className="px-4 py-2 rounded text-sm text-white/60 hover:text-white disabled:opacity-30 disabled:hover:text-white/60"
          >
            ← Prev
          </button>

          <div className="flex flex-wrap justify-center gap-1">
            {run.items.map((item, i) => {
              const done = Boolean(run.checked[item.card.id]);
              const status = done ? answerStatus(item.card, run.answers[item.card.id]) : null;
              return (
                <button
                  key={item.card.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Question ${i + 1}`}
                  className={cn(
                    'w-6 h-6 rounded text-[10px] transition-all',
                    i === run.index
                      ? 'bg-cyan-500 text-black'
                      : status === 'correct'
                      ? 'bg-green-500/30 text-green-300'
                      : status === 'wrong'
                      ? 'bg-red-500/30 text-red-300'
                      : isAnswered(run.answers[item.card.id])
                      ? 'bg-cyan-500/30 text-cyan-300'
                      : 'bg-white/10 text-white/40'
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <div className="flex shrink-0 gap-2">
            {instant && !checked ? (
              <>
                <button
                  type="button"
                  onClick={() => (last ? requestFinish() : goTo(run.index + 1))}
                  className="px-3 py-2 rounded text-sm text-white/40 hover:text-white/70"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={checkCurrent}
                  disabled={!isAnswered(answer)}
                  className="px-4 py-2 rounded text-sm bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-30"
                >
                  Check
                </button>
              </>
            ) : last ? (
              <button
                type="button"
                onClick={requestFinish}
                className="px-4 py-2 rounded text-sm bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500/30"
              >
                {instant ? 'Finish ✓' : 'Submit ✓'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => goTo(run.index + 1)}
                className="px-4 py-2 rounded text-sm text-white/60 hover:text-white"
              >
                Next →
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] text-white/25">
          Keys: 1–9 pick · Enter {instant ? 'checks / next' : 'next'} · ← → move
        </p>
      </div>
    );
  }

  // ─── Results ───
  if (phase === 'results' && run) {
    const statuses = run.items.map((item) => answerStatus(item.card, run.answers[item.card.id]));
    const correct = statuses.filter((s) => s === 'correct').length;
    const wrong = statuses.filter((s) => s === 'wrong').length;
    const skipped = statuses.length - correct - wrong;
    const missed = wrong + skipped;
    const pct = percent(correct, run.items.length);
    const { grade, color } = letterGrade(pct);
    const duration = (run.finishedAt ?? run.startedAt) - run.startedAt;
    const answeredTime = run.items.reduce(
      (sum, item, i) => sum + (statuses[i] === 'skipped' ? 0 : run.spentMs[item.card.id] ?? 0),
      0
    );

    const topicRows: { id: string; name: string; total: number; correct: number }[] = [];
    run.items.forEach((item, i) => {
      let row = topicRows.find((r) => r.id === item.topicId);
      if (!row) {
        row = { id: item.topicId, name: item.topicName, total: 0, correct: 0 };
        topicRows.push(row);
      }
      row.total += 1;
      if (statuses[i] === 'correct') row.correct += 1;
    });

    const reviewed = run.items
      .map((item, i) => ({ item, i, status: statuses[i] }))
      .filter(({ status }) =>
        reviewFilter === 'all' ? true : reviewFilter === 'correct' ? status === 'correct' : status !== 'correct'
      );

    return (
      <div className="p-6 space-y-6">
        {/* Score */}
        <div className="text-center space-y-2">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className={cn('text-6xl font-black', color)}>
            {grade}
          </motion.div>
          <p className="text-white text-xl font-bold">
            {correct} / {run.items.length} correct
          </p>
          <p className="text-white/50 text-sm">
            {run.deckName}
            {run.topicName ? ` › ${run.topicName}` : ''} • {Math.round(pct)}% • {formatDuration(duration)}
          </p>
          <p className="text-xs font-semibold text-cyan-300">+{run.xpEarned} XP earned</p>
          {run.timedOut && <p className="text-xs text-red-300">⏱ Time ran out: the quiz was submitted automatically.</p>}
          {run.retry && (
            <p className="text-[11px] text-white/40">Retry round: no bonus XP, streak or perfect-score unlocks.</p>
          )}
        </div>

        <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(96px,1fr))]">
          <StatTile value={correct} label="Correct" tone="green" />
          <StatTile value={wrong} label="Wrong" tone="red" />
          <StatTile value={skipped} label="Skipped" />
          <StatTile
            value={correct + wrong > 0 ? formatDuration(answeredTime / (correct + wrong)) : '—'}
            label="Avg / answer"
            tone="cyan"
          />
        </div>

        {topicRows.length > 1 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-white/80">By topic</h4>
            {topicRows.map((row) => (
              <div key={row.id} className="space-y-1 text-xs">
                <div className="flex justify-between text-white/60">
                  <span className="truncate">{row.name}</span>
                  <span>
                    {row.correct}/{row.total}
                  </span>
                </div>
                <AccuracyBar pct={percent(row.correct, row.total)} />
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={retryMissed}
            disabled={missed === 0}
            className="flex-1 p-3 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30 text-sm font-semibold disabled:opacity-40 disabled:cursor-default"
          >
            {missed > 0 ? `↻ Retry wrong ones (${missed})` : 'Flawless: nothing to retry'}
          </button>
          <button
            type="button"
            onClick={quitQuiz}
            className="flex-1 p-3 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 text-sm font-semibold"
          >
            New Quiz
          </button>
        </div>

        {/* Per-card review */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-white/80">Review</h4>
            <div className="flex gap-1">
              <Chip active={reviewFilter === 'all'} onClick={() => setReviewFilter('all')}>
                All
              </Chip>
              <Chip active={reviewFilter === 'missed'} onClick={() => setReviewFilter('missed')}>
                Wrong ({missed})
              </Chip>
              <Chip active={reviewFilter === 'correct'} onClick={() => setReviewFilter('correct')}>
                Correct ({correct})
              </Chip>
            </div>
          </div>
          {reviewed.length === 0 && <p className="text-xs text-white/40">Nothing here.</p>}
          {reviewed.map(({ item, i, status }) => {
            const spent = run.spentMs[item.card.id];
            return (
              <details key={item.card.id} className={cn('p-3 rounded-lg border text-sm', REVIEW_STYLES[status])}>
                <summary className="cursor-pointer text-white/80">
                  <span className="text-white/40 mr-2">Q{i + 1}.</span>
                  {item.card.prompt.length > PROMPT_PREVIEW
                    ? `${item.card.prompt.slice(0, PROMPT_PREVIEW)}…`
                    : item.card.prompt}
                  <span className={cn('ml-2', STATUS_MARKS[status].className)}>{STATUS_MARKS[status].icon}</span>
                </summary>
                <div className="mt-3 space-y-2">
                  <QuestionView
                    card={item.card}
                    answer={run.answers[item.card.id]}
                    reveal
                    hidePrompt={item.card.prompt.length <= PROMPT_PREVIEW}
                  />
                  <p className="text-[10px] text-white/30">
                    {item.topicName}
                    {spent ? ` · ${formatDuration(spent)} on this card` : ''}
                  </p>
                </div>
              </details>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

export const QuizEngine = memo(QuizEngineInner);
