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
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleMinus,
  CircleX,
  Clock,
  Flag,
  ListChecks,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Timer,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ProgressBar,
  SegmentedControl,
  StatTile,
  Switch,
} from '@/components/ui';
import { TRANSITION } from '@/styles/tokens';
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
import {
  AccuracyBar,
  ConfirmBar,
  DeckPickCard,
  DifficultyBadge,
  KeyHints,
  PaletteButton,
  ReviewRow,
  ScoreHero,
  SettingRow,
  TabHeader,
  type PaletteState,
} from './QuizControls';
import {
  KIND_LABELS,
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
  const reduceMotion = useReducedMotion();

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
    const summary = [
      `${plannedCount} question${plannedCount === 1 ? '' : 's'}`,
      settings.paceSeconds > 0 ? `${formatClock(plannedCount * settings.paceSeconds)} on the clock` : 'untimed',
      settings.feedback === 'instant' ? 'instant feedback' : 'feedback at the end',
    ].join(' · ');
    return (
      <div className="@container space-y-6 p-5">
        <TabHeader icon={ListChecks} title="Quiz" description="Pick a deck, set the pace, prove what you know." />

        {!hasQuizCards ? (
          <EmptyState
            icon={ListChecks}
            title="No quiz questions yet"
            description="Decks need multiple-choice, multi-select or numeric cards to run a quiz. Add some in Decks."
          />
        ) : (
          <section className="space-y-3" aria-label="Deck">
            <div className="flex items-baseline justify-between gap-3">
              <span className="hud-label">Deck</span>
              {!selectedDeck && <span className="text-xs text-fg-subtle">Choose one to set up the quiz</span>}
            </div>
            <div className="grid gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">
              {decks.map((deck) => {
                const count = countOf(deck.id);
                return (
                  <DeckPickCard
                    key={deck.id}
                    icon={deck.icon}
                    name={deck.name}
                    meta={count === 0 ? 'No quiz cards' : `${count} question${count === 1 ? '' : 's'}`}
                    mastery={deckStats.mastery.get(deck.id) ?? 0}
                    selected={selectedDeck?.id === deck.id}
                    disabled={count === 0}
                    onClick={() => {
                      setDeckId(deck.id);
                      setTopicId(null);
                    }}
                  />
                );
              })}
            </div>
          </section>
        )}

        {selectedDeck && topics.length > 1 && (
          <section className="space-y-3" aria-label="Topic">
            <span className="hud-label">Topic</span>
            <div className="flex flex-wrap gap-2">
              <Chip selected={!activeTopic} onClick={() => setTopicId(null)}>
                All topics
              </Chip>
              {topics.map((t) => (
                <Chip key={t.id} selected={activeTopic?.id === t.id} onClick={() => setTopicId(t.id)}>
                  {t.name}
                  <span className="ml-1.5 font-mono tabular opacity-60">{countOf(t.id)}</span>
                </Chip>
              ))}
            </div>
          </section>
        )}

        {selectedDeck && (
          <Card eyebrow="Session" title="Set the pace" bodyClassName="divide-y divide-line">
            <SettingRow label="Questions" hint={`${poolSize} in scope`}>
              <SegmentedControl
                size="sm"
                aria-label="Questions"
                value={String(countChoice)}
                onChange={(v) => setSettings((s) => ({ ...s, count: Number(v) }))}
                options={COUNT_OPTIONS.map((n) => ({
                  value: String(n),
                  label: n === 0 ? `All ${poolSize}` : String(n),
                  disabled: n > poolSize,
                }))}
              />
            </SettingRow>
            <SettingRow
              label="Feedback"
              hint={
                settings.feedback === 'instant'
                  ? 'Check each answer as you go and read the explanation.'
                  : 'Answer everything first; the review comes with the results.'
              }
            >
              <SegmentedControl
                size="sm"
                aria-label="Feedback"
                value={settings.feedback}
                onChange={(feedback) => setSettings((s) => ({ ...s, feedback }))}
                options={[
                  { value: 'instant', label: 'Instant', icon: Zap },
                  { value: 'end', label: 'At the end', icon: Flag },
                ]}
              />
            </SettingRow>
            <SettingRow label="Timer" hint="Seconds per question. At zero the quiz submits itself.">
              <SegmentedControl
                size="sm"
                aria-label="Timer"
                value={String(settings.paceSeconds)}
                onChange={(v) => setSettings((s) => ({ ...s, paceSeconds: Number(v) }))}
                options={PACE_OPTIONS.map((sec) => ({ value: String(sec), label: sec === 0 ? 'Off' : `${sec}s` }))}
              />
            </SettingRow>
            <SettingRow label="Weakest cards first" hint="Lowest mastery and never-answered cards lead the quiz.">
              <Switch
                checked={settings.weakFirst}
                onCheckedChange={(on) => setSettings((s) => ({ ...s, weakFirst: on }))}
                aria-label="Weakest cards first"
              />
            </SettingRow>
          </Card>
        )}

        {selectedDeck && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <p className="text-ui text-fg-muted tabular">{summary}</p>
            <Button variant="primary" size="lg" leadingIcon={Play} onClick={startQuiz} disabled={plannedCount === 0}>
              Start quiz
            </Button>
          </div>
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
    const lowTime = timeLeft !== null && timeLeft <= Math.max(10, timeBudget * 0.15);
    const paletteState = (item: QuizItem, i: number): PaletteState => {
      if (i === run.index) return 'current';
      if (run.checked[item.card.id]) return answerStatus(item.card, run.answers[item.card.id]) === 'correct' ? 'correct' : 'wrong';
      return isAnswered(run.answers[item.card.id]) ? 'answered' : 'empty';
    };

    return (
      <div ref={containerRef} tabIndex={-1} onKeyDown={onKeyDown} className="@container flex h-full flex-col outline-none">
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-line px-5">
          <span className="min-w-0 flex-1 truncate text-xs text-fg-subtle" title={`${run.deckName} › ${topicName}`}>
            <span className="text-fg-muted">{run.deckName}</span> › {topicName}
          </span>
          {run.retry && (
            <Badge tone="ember" size="sm" icon={RotateCcw}>
              Retry
            </Badge>
          )}
          <DifficultyBadge difficulty={card.difficulty} />
          <span
            title={timeLeft !== null ? 'Time left' : 'Time elapsed'}
            className={cn(
              'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-control px-2 font-mono text-ui font-medium tabular',
              timeLeft === null
                ? 'text-fg-muted'
                : lowTime
                  ? 'bg-danger/12 text-danger motion-safe:animate-pulse-soft'
                  : 'bg-accent/10 text-accent'
            )}
          >
            {timeLeft !== null ? (
              <Timer size={14} strokeWidth={1.75} aria-hidden />
            ) : (
              <Clock size={14} strokeWidth={1.75} aria-hidden />
            )}
            {timeLeft !== null ? formatClock(timeLeft) : formatClock(elapsed)}
          </span>
          <span aria-hidden className="mx-0.5 h-5 w-px bg-line-strong" />
          <Button variant="ghost" size="sm" leadingIcon={Flag} onClick={requestFinish}>
            Finish
          </Button>
          <Button variant="ghost" size="sm" leadingIcon={X} onClick={quitQuiz}>
            Quit
          </Button>
        </div>

        {/* Question */}
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="mx-auto w-full max-w-3xl space-y-4">
            <ProgressBar
              value={run.index + 1}
              max={run.items.length}
              size="sm"
              animated={false}
              label={`Question ${run.index + 1} of ${run.items.length}`}
              valueLabel={`${run.items.length - unanswered} answered`}
            />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
                transition={TRANSITION.small}
                className="glass-panel rounded-card p-5"
              >
                <div className="mb-4 flex items-center gap-2">
                  <span className="hud-label text-accent">Q{run.index + 1}</span>
                  <span aria-hidden className="text-fg-faint">
                    ·
                  </span>
                  <span className="hud-label">{KIND_LABELS[card.kind]}</span>
                </div>
                <QuestionView
                  card={card}
                  answer={answer}
                  onAnswer={(a) => setAnswer(card.id, a)}
                  reveal={checked}
                  autoFocus
                  size="lg"
                  keyHints
                />
              </motion.div>
            </AnimatePresence>

            {confirmFinish && (
              <ConfirmBar
                actions={
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmFinish(false)}>
                      Keep going
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => finishQuiz(false)}>
                      Submit anyway
                    </Button>
                  </>
                }
              >
                {unanswered} question{unanswered === 1 ? '' : 's'} unanswered: they count as wrong.
              </ConfirmBar>
            )}

            <KeyHints
              items={[
                { keys: ['1', '9'], label: 'pick', range: true },
                { keys: ['Enter'], label: instant ? 'check / next' : 'next' },
                { keys: ['←', '→'], label: 'move' },
              ]}
            />
          </div>
        </div>

        {/* Navigation */}
        <div className="flex shrink-0 items-center gap-3 border-t border-line px-5 py-3">
          <Button variant="ghost" leadingIcon={ChevronLeft} onClick={() => goTo(run.index - 1)} disabled={run.index === 0}>
            Prev
          </Button>
          <div className="scrollbar-none hidden min-w-0 flex-1 overflow-x-auto @lg:block">
            <div className="mx-auto flex w-max items-center gap-1 p-1">
              {run.items.map((item, i) => (
                <PaletteButton key={item.card.id} index={i} state={paletteState(item, i)} onClick={() => goTo(i)} size="sm" />
              ))}
            </div>
          </div>
          <div className="flex-1 @lg:hidden" />
          <div className="flex shrink-0 gap-2">
            {instant && !checked ? (
              <>
                <Button variant="ghost" onClick={() => (last ? requestFinish() : goTo(run.index + 1))}>
                  Skip
                </Button>
                <Button variant="primary" leadingIcon={Check} onClick={checkCurrent} disabled={!isAnswered(answer)}>
                  Check
                </Button>
              </>
            ) : last ? (
              <Button variant="primary" leadingIcon={Flag} onClick={requestFinish}>
                {instant ? 'Finish' : 'Submit'}
              </Button>
            ) : (
              <Button variant={instant ? 'primary' : 'secondary'} trailingIcon={ChevronRight} onClick={() => goTo(run.index + 1)}>
                Next
              </Button>
            )}
          </div>
        </div>
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
    const { grade, color, tone } = letterGrade(pct);
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
      <div className="@container space-y-6 p-5">
        <ScoreHero
          grade={grade}
          gradeColor={color}
          tone={tone}
          pct={pct}
          eyebrow={run.retry ? 'Retry round · results' : 'Quiz results'}
          title={
            <>
              {correct} / {run.items.length} correct
            </>
          }
          meta={
            <>
              {run.deckName}
              {run.topicName ? ` › ${run.topicName}` : ''} · {Math.round(pct)}% · {formatDuration(duration)}
            </>
          }
          badges={
            <>
              <Badge tone="gold" icon={Sparkles}>
                +{run.xpEarned} XP earned
              </Badge>
              {missed === 0 && (
                <Badge tone="success" icon={CircleCheck}>
                  Flawless
                </Badge>
              )}
              {run.timedOut && (
                <Badge tone="danger" icon={Timer}>
                  Time ran out
                </Badge>
              )}
            </>
          }
          footnote={
            run.timedOut || run.retry ? (
              <>
                {run.timedOut && 'Time ran out: the quiz was submitted automatically. '}
                {run.retry && 'Retry round: no bonus XP, streak or perfect-score unlocks.'}
              </>
            ) : undefined
          }
        />

        <div className="grid grid-cols-2 gap-3 @xl:grid-cols-4">
          <StatTile size="sm" label="Correct" icon={CircleCheck} value={<span className="text-success">{correct}</span>} />
          <StatTile size="sm" label="Wrong" icon={CircleX} value={<span className="text-danger">{wrong}</span>} />
          <StatTile size="sm" label="Skipped" icon={CircleMinus} value={skipped} />
          <StatTile
            size="sm"
            label="Avg / answer"
            icon={Timer}
            value={correct + wrong > 0 ? formatDuration(answeredTime / (correct + wrong)) : '—'}
          />
        </div>

        {topicRows.length > 1 && (
          <Card eyebrow="Breakdown" title="By topic">
            <ul className="space-y-3.5">
              {topicRows.map((row) => {
                const rowPct = percent(row.correct, row.total);
                return (
                  <li key={row.id} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-ui text-fg-muted" title={row.name}>
                        {row.name}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-fg tabular">
                        {row.correct}/{row.total}
                        <span className="ml-2 inline-block w-9 text-right text-fg-subtle">{Math.round(rowPct)}%</span>
                      </span>
                    </div>
                    <AccuracyBar pct={rowPct} label={`${row.name}: ${Math.round(rowPct)}%`} />
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        <div className="flex flex-wrap gap-3">
          {missed > 0 && (
            <Button variant="primary" size="lg" leadingIcon={RotateCcw} onClick={retryMissed}>
              Retry wrong ones ({missed})
            </Button>
          )}
          <Button variant={missed > 0 ? 'secondary' : 'primary'} size="lg" leadingIcon={Plus} onClick={quitQuiz}>
            New quiz
          </Button>
        </div>

        {/* Per-card review */}
        <section className="space-y-3" aria-label="Review">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-fg">Review</h4>
            <div className="flex flex-wrap gap-2">
              <Chip selected={reviewFilter === 'all'} onClick={() => setReviewFilter('all')}>
                All ({run.items.length})
              </Chip>
              <Chip tone="danger" selected={reviewFilter === 'missed'} onClick={() => setReviewFilter('missed')}>
                Wrong ({missed})
              </Chip>
              <Chip tone="success" selected={reviewFilter === 'correct'} onClick={() => setReviewFilter('correct')}>
                Correct ({correct})
              </Chip>
            </div>
          </div>
          {reviewed.length === 0 ? (
            <EmptyState
              size="sm"
              icon={reviewFilter === 'missed' ? CircleCheck : CircleX}
              title={reviewFilter === 'missed' ? 'Nothing missed' : 'No correct answers this round'}
              description={
                reviewFilter === 'missed' ? 'Every question landed. Take a harder deck next.' : 'Retry the wrong ones to turn these around.'
              }
            />
          ) : (
            <div className="glass-panel divide-y divide-line overflow-hidden rounded-card">
              {reviewed.map(({ item, i, status }) => {
                const spent = run.spentMs[item.card.id];
                return (
                  <ReviewRow
                    key={item.card.id}
                    index={i}
                    status={status}
                    prompt={item.card.prompt}
                    preview={PROMPT_PREVIEW}
                    meta={spent ? formatDuration(spent) : undefined}
                  >
                    <QuestionView
                      card={item.card}
                      answer={run.answers[item.card.id]}
                      reveal
                      hidePrompt={item.card.prompt.length <= PROMPT_PREVIEW}
                    />
                    <p className="text-xs text-fg-subtle">
                      {item.topicName}
                      {spent ? ` · ${formatDuration(spent)} on this card` : ''}
                    </p>
                  </ReviewRow>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  return null;
}

export const QuizEngine = memo(QuizEngineInner);
