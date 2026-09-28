// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Mock Test
// A timed exam over the decks you pick: question count, duration and
// marking (+correct / −wrong) are yours to set. No feedback until the
// end; it submits itself when time runs out, then breaks the score
// down by deck and topic.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect, useMemo, useRef, memo, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { useXPStore } from '@/stores/useXPStore';
import { isQuizCard, listCardLocations, useLearningStore } from '@/stores/useLearningStore';
import { dispatchCreatureEvent } from '@/components/creature';
import { recordQuizCompletion } from '@/components/achievements/quiz-achievements';
import type { QuizCard, RecordAttemptInput } from '@/types/learning';
import { QuestionView } from './QuestionView';
import { AccuracyBar, Chip, Field, StatTile } from './QuizControls';
import {
  DIFFICULTY_STYLES,
  answerFromKey,
  answerStatus,
  createStopwatch,
  formatClock,
  formatDuration,
  formatMarks,
  isAnswered,
  letterGrade,
  percent,
  shuffle,
  type AnswerStatus,
  type UserAnswer,
} from './grading';

type Phase = 'setup' | 'test' | 'results';
type ReviewFilter = 'all' | 'wrong' | 'skipped' | 'marked';

/** Question counts on offer; 0 = every question in the chosen decks. */
const COUNT_OPTIONS = [10, 20, 30, 50, 100, 0] as const;
const DURATION_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180] as const;
const CORRECT_MARK_OPTIONS = [1, 2, 3, 4, 5] as const;
/** Marks lost per wrong answer when negative marking is on. */
const WRONG_MARK_OPTIONS = [0.25, 0.33, 0.5, 1, 2] as const;

/** Review rows show this much of the prompt until opened. */
const PROMPT_PREVIEW = 90;

const XP_PER_CORRECT = 8;
/** Bonus XP for XP_BONUS_PCT+ of the marks on a test of BONUS_MIN_QUESTIONS or more. */
const XP_BONUS = 100;
const XP_BONUS_PCT = 70;
const BONUS_MIN_QUESTIONS = 10;

interface MockSettings {
  /** Questions per test; 0 = all. */
  questionCount: number;
  durationMinutes: number;
  /** Marks for a correct answer. */
  marksCorrect: number;
  negativeMarking: boolean;
  /** Marks lost per wrong answer when negative marking is on (unanswered: 0). */
  marksWrong: number;
}

/** Settings of the last test, kept while the OS runs (switching tabs remounts the test). */
let lastSettings: MockSettings = {
  questionCount: 20,
  durationMinutes: 30,
  marksCorrect: 1,
  negativeMarking: false,
  marksWrong: 0.25,
};

function rememberSettings(settings: MockSettings): void {
  lastSettings = settings;
}

interface MockItem {
  card: QuizCard;
  deckId: string;
  deckName: string;
  topicId: string;
  topicName: string;
}

interface MockRun {
  items: MockItem[];
  settings: MockSettings;
  index: number;
  answers: Record<string, UserAnswer>;
  /** Questions flagged "mark for review". */
  marked: Record<string, boolean>;
  startedAt: number;
  endsAt: number;
}

/** Score of one deck or topic. */
interface Breakdown {
  key: string;
  label: string;
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
  marks: number;
  maxMarks: number;
  /** Time spent on answered questions (ms). */
  answeredMs: number;
}

interface DeckBreakdown extends Breakdown {
  /** Weakest topic first. */
  topics: Breakdown[];
}

interface MockResult {
  /** Per question, in test order. */
  statuses: AnswerStatus[];
  correct: number;
  wrong: number;
  skipped: number;
  score: number;
  maxScore: number;
  /** Score as a share of the maximum, floored at 0. */
  pct: number;
  /** Correct share of the answered questions. */
  accuracy: number;
  decks: DeckBreakdown[];
  xp: number;
  spentMs: Record<string, number>;
  durationMs: number;
  timedOut: boolean;
}

interface MockTestProps {
  /** Deck to preselect, e.g. from a NEXUS deep link. */
  initialDeckId?: string | null;
}

function emptyBreakdown(key: string, label: string): Breakdown {
  return { key, label, total: 0, correct: 0, wrong: 0, skipped: 0, marks: 0, maxMarks: 0, answeredMs: 0 };
}

function tally(row: Breakdown, status: AnswerStatus, marks: number, maxMarks: number, spentMs: number): void {
  row.total += 1;
  if (status === 'correct') row.correct += 1;
  else if (status === 'wrong') row.wrong += 1;
  else row.skipped += 1;
  row.marks += marks;
  row.maxMarks += maxMarks;
  if (status !== 'skipped') row.answeredMs += spentMs;
}

/** Share of the maximum marks, 0..100 (a negative score shows as 0). */
function scorePct(row: Pick<Breakdown, 'marks' | 'maxMarks'>): number {
  return row.maxMarks > 0 ? Math.max(0, (row.marks / row.maxMarks) * 100) : 0;
}

function marksFor(status: AnswerStatus, settings: MockSettings): number {
  if (status === 'correct') return settings.marksCorrect;
  if (status === 'wrong' && settings.negativeMarking) return -settings.marksWrong;
  return 0;
}

/** Score every question and break the result down by deck and topic. */
function scoreMock(
  items: readonly MockItem[],
  answers: Record<string, UserAnswer>,
  settings: MockSettings,
  spentMs: Record<string, number>
): Omit<MockResult, 'durationMs' | 'timedOut'> {
  const statuses: AnswerStatus[] = [];
  const decks = new Map<string, DeckBreakdown>();
  let correct = 0;
  let wrong = 0;
  let score = 0;

  for (const item of items) {
    const status = answerStatus(item.card, answers[item.card.id]);
    const marks = marksFor(status, settings);
    const spent = spentMs[item.card.id] ?? 0;
    statuses.push(status);
    if (status === 'correct') correct++;
    else if (status === 'wrong') wrong++;
    score += marks;

    let deck = decks.get(item.deckId);
    if (!deck) {
      deck = { ...emptyBreakdown(item.deckId, item.deckName), topics: [] };
      decks.set(item.deckId, deck);
    }
    tally(deck, status, marks, settings.marksCorrect, spent);
    let topic = deck.topics.find((t) => t.key === item.topicId);
    if (!topic) {
      topic = emptyBreakdown(item.topicId, item.topicName);
      deck.topics.push(topic);
    }
    tally(topic, status, marks, settings.marksCorrect, spent);
  }

  for (const deck of decks.values()) deck.topics.sort((a, b) => scorePct(a) - scorePct(b));
  const maxScore = items.length * settings.marksCorrect;
  const pct = maxScore > 0 ? Math.max(0, (score / maxScore) * 100) : 0;
  const bonus = items.length >= BONUS_MIN_QUESTIONS && pct >= XP_BONUS_PCT ? XP_BONUS : 0;
  return {
    statuses,
    correct,
    wrong,
    skipped: items.length - correct - wrong,
    score,
    maxScore,
    pct,
    accuracy: percent(correct, correct + wrong),
    decks: [...decks.values()],
    xp: correct * XP_PER_CORRECT + bonus,
    spentMs,
  };
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  return minutes % 60 ? `${h} h ${minutes % 60} min` : `${h} h`;
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

const SELECT_CLASS = 'bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none';

/** One row of the deck / topic analysis table. */
function BreakdownRow({ row, topic = false }: { row: Breakdown; topic?: boolean }) {
  const answered = row.correct + row.wrong;
  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_2rem_2rem_2rem_4.5rem_3.5rem] items-center gap-x-2 px-3 py-2 text-xs',
        topic ? 'text-white/55' : 'bg-white/[0.04] text-white/85 font-semibold'
      )}
    >
      <div className={cn('min-w-0', topic && 'pl-4')}>
        <p className="truncate">{row.label}</p>
        <AccuracyBar pct={scorePct(row)} className="mt-1" />
      </div>
      <span className="text-right text-green-300/90">{row.correct}</span>
      <span className="text-right text-red-300/90">{row.wrong}</span>
      <span className="text-right text-white/40">{row.skipped}</span>
      <span className="text-right">
        {formatMarks(row.marks)}/{formatMarks(row.maxMarks)}
      </span>
      <span className="text-right text-white/40">{answered > 0 ? formatDuration(row.answeredMs / answered) : '—'}</span>
    </div>
  );
}

function MockTestInner({ initialDeckId = null }: MockTestProps) {
  const decks = useLearningStore((s) => s.decks);
  const recordAttempts = useLearningStore((s) => s.recordAttempts);
  const addXP = useXPStore((s) => s.addXP);

  const [phase, setPhase] = useState<Phase>('setup');
  const [settings, setSettings] = useState<MockSettings>(() => lastSettings);
  // A deep-linked deck alone, else every deck with questions.
  const [chosenIds, setChosenIds] = useState<string[]>(() => {
    const usable = useLearningStore
      .getState()
      .decks.filter((d) => d.topics.some((t) => t.cards.some(isQuizCard)))
      .map((d) => d.id);
    return initialDeckId && usable.includes(initialDeckId) ? [initialDeckId] : usable;
  });
  const [run, setRun] = useState<MockRun | null>(null);
  const [result, setResult] = useState<MockResult | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [stopwatch] = useState(createStopwatch);
  const finishedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Decks with gradable questions (count per deck), and the chosen ones in deck order.
  const { usableDecks, deckCounts, chosen } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const deck of decks) {
      const n = deck.topics.reduce((sum, t) => sum + t.cards.filter(isQuizCard).length, 0);
      if (n > 0) counts.set(deck.id, n);
    }
    const usable = decks.filter((d) => counts.has(d.id));
    return { usableDecks: usable, deckCounts: counts, chosen: usable.filter((d) => chosenIds.includes(d.id)) };
  }, [decks, chosenIds]);

  const poolSize = chosen.reduce((sum, d) => sum + (deckCounts.get(d.id) ?? 0), 0);
  const plannedCount = settings.questionCount === 0 ? poolSize : Math.min(settings.questionCount, poolSize);
  // A count above what the decks hold shows as "All".
  const countChoice = settings.questionCount > poolSize ? 0 : settings.questionCount;

  // ─── Running a test ───

  const startMock = useCallback(() => {
    const pool: MockItem[] = [];
    for (const location of listCardLocations(chosen)) {
      if (isQuizCard(location.card)) {
        pool.push({
          card: location.card,
          deckId: location.deckId,
          deckName: location.deckName,
          topicId: location.topicId,
          topicName: location.topicName,
        });
      }
    }
    const picked = shuffle(pool);
    const items = settings.questionCount === 0 ? picked : picked.slice(0, settings.questionCount);
    if (items.length === 0) return;
    const start = Date.now();
    finishedRef.current = false;
    stopwatch.reset(start);
    rememberSettings(settings);
    setRun({
      items,
      settings,
      index: 0,
      answers: {},
      marked: {},
      startedAt: start,
      endsAt: start + settings.durationMinutes * 60_000,
    });
    setResult(null);
    setNow(start);
    setConfirmSubmit(false);
    setReviewFilter('all');
    setPhase('test');
    // Keys work straight away (unless a numeric input took the focus).
    requestAnimationFrame(() => {
      const panel = containerRef.current;
      if (panel && !panel.contains(document.activeElement)) panel.focus();
    });
  }, [chosen, settings, stopwatch]);

  const setAnswer = useCallback((cardId: string, answer: UserAnswer) => {
    setRun((prev) => (prev ? { ...prev, answers: { ...prev.answers, [cardId]: answer } } : prev));
    setConfirmSubmit(false);
  }, []);

  const clearAnswer = useCallback((cardId: string) => {
    setRun((prev) => {
      if (!prev || !(cardId in prev.answers)) return prev;
      const answers = { ...prev.answers };
      delete answers[cardId];
      return { ...prev, answers };
    });
  }, []);

  const toggleMarked = useCallback((cardId: string) => {
    setRun((prev) => (prev ? { ...prev, marked: { ...prev.marked, [cardId]: !prev.marked[cardId] } } : prev));
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (!run) return;
      const next = Math.max(0, Math.min(run.items.length - 1, index));
      if (next === run.index) return;
      stopwatch.leave(run.items[run.index].card.id, Date.now());
      setRun({ ...run, index: next });
      setConfirmSubmit(false);
      // Keep keyboard focus in the test when the focused input unmounts.
      containerRef.current?.focus();
    },
    [run, stopwatch]
  );

  // Score once, award XP once, fire achievements once: on submit or when time runs out.
  const finishMock = useCallback(
    (timedOut: boolean) => {
      if (!run || finishedRef.current) return;
      finishedRef.current = true;
      const at = Date.now();
      stopwatch.leave(run.items[run.index].card.id, at);
      const scored = scoreMock(run.items, run.answers, run.settings, stopwatch.snapshot());
      const answered = scored.correct + scored.wrong;

      // A blank submission earns and records nothing.
      if (answered > 0) {
        if (scored.xp > 0) addXP(scored.xp, 'mock-test');

        // Per-card progress for every answered question.
        const cardResults: RecordAttemptInput[] = [];
        run.items.forEach(({ card }, i) => {
          if (scored.statuses[i] === 'skipped') return;
          const durationMs = scored.spentMs[card.id];
          cardResults.push({
            cardId: card.id,
            correct: scored.statuses[i] === 'correct',
            source: 'mock',
            at,
            ...(durationMs ? { durationMs } : {}),
          });
        });
        recordAttempts(cardResults);

        // A test drawn from a single deck counts toward "a quiz in every deck".
        const testDecks = new Set(run.items.map((item) => item.deckId));
        recordQuizCompletion({
          kind: 'mock',
          deckId: testDecks.size === 1 ? run.items[0].deckId : null,
          results: scored.statuses.map((s) => s === 'correct'),
          answered,
        });
        // Mock tests never reach quiz history (which the creature watches), so tell it directly.
        dispatchCreatureEvent({ type: scored.correct === run.items.length ? 'quiz-perfect' : 'quiz-complete' });
      }

      setResult({ ...scored, xp: answered > 0 ? scored.xp : 0, durationMs: at - run.startedAt, timedOut });
      setConfirmSubmit(false);
      setPhase('results');
    },
    [run, stopwatch, addXP, recordAttempts]
  );

  // The countdown calls the latest finishMock without restarting its interval.
  const finishRef = useRef(finishMock);
  useEffect(() => {
    finishRef.current = finishMock;
  });

  // Countdown: time left derives from endsAt; auto-submit when it runs out.
  const endsAt = run?.endsAt ?? 0;
  useEffect(() => {
    if (phase !== 'test') return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) finishRef.current(true);
    }, 1000);
    return () => clearInterval(id);
  }, [phase, endsAt]);

  /** Submit, asking once while questions are unanswered or marked for review. */
  const requestSubmit = useCallback(() => {
    if (!run) return;
    const open = run.items.some((item) => !isAnswered(run.answers[item.card.id]) || run.marked[item.card.id]);
    if (open && !confirmSubmit) setConfirmSubmit(true);
    else finishMock(false);
  }, [run, confirmSubmit, finishMock]);

  const backToSetup = useCallback(() => {
    finishedRef.current = true;
    setRun(null);
    setResult(null);
    setPhase('setup');
  }, []);

  // Keys (only while focus is inside the test): 1-9 / 0 pick options, Enter / → next, ← back.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (phase !== 'test' || !run || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement;
    if (e.key === 'Enter') {
      if (target.tagName === 'BUTTON' && target.dataset.quizOption === undefined) return;
      e.preventDefault();
      if (run.index === run.items.length - 1) requestSubmit();
      else goTo(run.index + 1);
      return;
    }
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(run.index + (e.key === 'ArrowRight' ? 1 : -1));
      return;
    }
    const { card } = run.items[run.index];
    const next = answerFromKey(card, run.answers[card.id], e.key);
    if (next !== null) {
      e.preventDefault();
      setAnswer(card.id, next);
    }
  };

  // ─── Setup ───
  if (phase === 'setup') {
    const allChosen = usableDecks.length > 0 && chosen.length === usableDecks.length;
    const secondsEach = plannedCount > 0 ? (settings.durationMinutes * 60) / plannedCount : 0;
    return (
      <div className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-white">⏱️ Mock Test</h3>
          <p className="text-xs text-white/40 mt-1">
            A timed exam over your decks. No feedback until you submit; it submits itself when time runs out.
          </p>
        </div>

        {usableDecks.length === 0 ? (
          <p className="text-sm text-white/40">
            No quiz questions yet. Decks need multiple-choice, multi-select or numeric cards for a mock test.
          </p>
        ) : (
          <>
            <Field label="Decks" hint={chosen.length === 0 ? 'Pick at least one deck.' : `${poolSize} questions available`}>
              {usableDecks.map((deck) => (
                <Chip
                  key={deck.id}
                  active={chosen.some((d) => d.id === deck.id)}
                  onClick={() =>
                    setChosenIds((ids) => (ids.includes(deck.id) ? ids.filter((id) => id !== deck.id) : [...ids, deck.id]))
                  }
                >
                  {deck.icon} {deck.name} <span className="opacity-50">{deckCounts.get(deck.id)}</span>
                </Chip>
              ))}
              {usableDecks.length > 1 && (
                <button
                  type="button"
                  onClick={() => setChosenIds(allChosen ? [] : usableDecks.map((d) => d.id))}
                  className="text-[11px] text-white/40 hover:text-white/70"
                >
                  {allChosen ? 'Clear' : 'Select all'}
                </button>
              )}
            </Field>

            <Field label="Questions">
              {COUNT_OPTIONS.map((n) => (
                <Chip
                  key={n}
                  active={countChoice === n}
                  disabled={n > poolSize}
                  onClick={() => setSettings((s) => ({ ...s, questionCount: n }))}
                >
                  {n === 0 ? `All (${poolSize})` : n}
                </Chip>
              ))}
            </Field>

            <Field
              label="Duration"
              hint={secondsEach > 0 ? `About ${formatDuration(secondsEach * 1000)} per question.` : undefined}
            >
              <select
                value={settings.durationMinutes}
                onChange={(e) => setSettings((s) => ({ ...s, durationMinutes: Number(e.target.value) }))}
                aria-label="Duration"
                className={SELECT_CLASS}
              >
                {DURATION_OPTIONS.map((m) => (
                  <option key={m} value={m} className="bg-neutral-900">
                    {formatMinutes(m)}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Marking"
              hint={
                settings.negativeMarking
                  ? `+${formatMarks(settings.marksCorrect)} per correct, −${formatMarks(settings.marksWrong)} per wrong, 0 for unanswered: guess with care.`
                  : `+${formatMarks(settings.marksCorrect)} per correct, nothing lost for wrong or unanswered.`
              }
            >
              <span className="text-xs text-white/50">Correct</span>
              <select
                value={settings.marksCorrect}
                onChange={(e) => setSettings((s) => ({ ...s, marksCorrect: Number(e.target.value) }))}
                aria-label="Marks per correct answer"
                className={SELECT_CLASS}
              >
                {CORRECT_MARK_OPTIONS.map((v) => (
                  <option key={v} value={v} className="bg-neutral-900">
                    +{v}
                  </option>
                ))}
              </select>
              <label className="ml-2 flex items-center gap-2 text-xs text-white/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.negativeMarking}
                  onChange={(e) => setSettings((s) => ({ ...s, negativeMarking: e.target.checked }))}
                  className="accent-red-400"
                />
                Negative marking
              </label>
              {settings.negativeMarking && (
                <select
                  value={settings.marksWrong}
                  onChange={(e) => setSettings((s) => ({ ...s, marksWrong: Number(e.target.value) }))}
                  aria-label="Marks lost per wrong answer"
                  className={SELECT_CLASS}
                >
                  {WRONG_MARK_OPTIONS.map((v) => (
                    <option key={v} value={v} className="bg-neutral-900">
                      −{formatMarks(v)} per wrong
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <button
              type="button"
              onClick={startMock}
              disabled={plannedCount === 0}
              className="w-full p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 text-sm font-bold disabled:opacity-30"
            >
              🚀 Start Mock Test{' '}
              <span className="font-normal text-red-300/60">
                {plannedCount} question{plannedCount === 1 ? '' : 's'} · {formatMinutes(settings.durationMinutes)} · max{' '}
                {formatMarks(plannedCount * settings.marksCorrect)} marks
              </span>
            </button>
          </>
        )}
      </div>
    );
  }

  // ─── Test ───
  if (phase === 'test' && run) {
    const { card, deckName, topicName } = run.items[run.index];
    const answer = run.answers[card.id];
    const answeredCount = run.items.filter((item) => isAnswered(run.answers[item.card.id])).length;
    const markedCount = run.items.filter((item) => run.marked[item.card.id]).length;
    const unanswered = run.items.length - answeredCount;
    const budget = Math.max(1, run.endsAt - run.startedAt);
    const timeLeft = Math.max(0, Math.ceil((run.endsAt - now) / 1000));
    const danger = timeLeft * 1000 <= Math.max(60_000, budget * 0.1);
    const { marksCorrect, marksWrong, negativeMarking } = run.settings;

    return (
      <div ref={containerRef} tabIndex={-1} onKeyDown={onKeyDown} className="flex flex-col h-full outline-none">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 p-3 border-b border-white/10 bg-black/20">
          <span className="text-xs text-white/50">
            Q{run.index + 1}/{run.items.length} · {answeredCount} answered
          </span>
          <span
            title="Time left"
            className={cn('text-sm font-mono font-bold', danger ? 'text-red-400 animate-pulse' : 'text-cyan-300')}
          >
            {formatClock(timeLeft)}
          </span>
          <button
            type="button"
            onClick={requestSubmit}
            className="px-3 py-1 rounded text-xs bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30"
          >
            Submit
          </button>
        </div>
        <div className="h-0.5 bg-white/5">
          <div
            className={cn('h-full transition-all', danger ? 'bg-red-400/70' : 'bg-cyan-500/60')}
            style={{ width: `${Math.min(100, ((timeLeft * 1000) / budget) * 100)}%` }}
          />
        </div>

        {confirmSubmit && (
          <div className="m-3 mb-0 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-xs text-yellow-200 flex flex-wrap items-center justify-between gap-2">
            <span>
              {unanswered > 0 ? `${unanswered} unanswered` : 'All answered'}
              {markedCount > 0 ? ` · ${markedCount} marked for review` : ''}. Submit now?
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmSubmit(false)}
                className="px-3 py-1 rounded border border-white/10 text-white/60 hover:text-white"
              >
                Keep going
              </button>
              <button
                type="button"
                onClick={() => finishMock(false)}
                className="px-3 py-1 rounded bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30"
              >
                Submit test
              </button>
            </span>
          </div>
        )}

        {/* Question */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          <div className="flex items-center gap-2 text-xs text-white/40">
            <span className="truncate">
              {deckName} • {topicName}
            </span>
            <span className={cn('px-2 py-0.5 rounded shrink-0', DIFFICULTY_STYLES[card.difficulty])}>
              {card.difficulty}
            </span>
            <span className="shrink-0 text-white/30">
              +{formatMarks(marksCorrect)}
              {negativeMarking ? ` / −${formatMarks(marksWrong)}` : ''}
            </span>
            <button
              type="button"
              onClick={() => toggleMarked(card.id)}
              className={cn(
                'ml-auto shrink-0 px-2 py-0.5 rounded text-[10px] border',
                run.marked[card.id]
                  ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                  : 'border-white/10 text-white/40 hover:text-white/70'
              )}
            >
              {run.marked[card.id] ? '🔖 Marked' : 'Mark for review'}
            </button>
          </div>
          <QuestionView key={card.id} card={card} answer={answer} onAnswer={(a) => setAnswer(card.id, a)} autoFocus />
        </div>

        {/* Question palette */}
        <div className="p-3 border-t border-white/10 bg-black/20 space-y-2">
          <div className="flex flex-wrap gap-1">
            {run.items.map((item, i) => (
              <button
                key={item.card.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Question ${i + 1}`}
                className={cn(
                  'w-7 h-7 rounded text-[10px] transition-all',
                  i === run.index
                    ? 'bg-cyan-500 text-black font-bold'
                    : run.marked[item.card.id]
                    ? 'bg-yellow-500/30 text-yellow-300'
                    : isAnswered(run.answers[item.card.id])
                    ? 'bg-green-500/30 text-green-300'
                    : 'bg-white/10 text-white/40'
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="flex gap-3 text-[10px] text-white/35">
            <span>
              <span className="inline-block w-2 h-2 rounded-sm bg-green-500/50 mr-1" />
              Answered
            </span>
            <span>
              <span className="inline-block w-2 h-2 rounded-sm bg-yellow-500/50 mr-1" />
              Marked
            </span>
            <span>
              <span className="inline-block w-2 h-2 rounded-sm bg-white/20 mr-1" />
              Not answered
            </span>
            <span className="ml-auto">Keys: 1–9 pick · Enter next · ← →</span>
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => goTo(run.index - 1)}
              disabled={run.index === 0}
              className="px-4 py-1 text-xs text-white/50 hover:text-white disabled:opacity-30"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => clearAnswer(card.id)}
              disabled={!isAnswered(answer)}
              className="px-3 py-1 text-xs text-white/40 hover:text-white/70 disabled:opacity-30"
            >
              Clear answer
            </button>
            {run.index === run.items.length - 1 ? (
              <button
                type="button"
                onClick={requestSubmit}
                className="px-4 py-1 rounded text-xs bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30"
              >
                Submit ✓
              </button>
            ) : (
              <button
                type="button"
                onClick={() => goTo(run.index + 1)}
                className="px-4 py-1 text-xs text-white/50 hover:text-white"
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Results ───
  if (phase === 'results' && run && result) {
    const { grade, color } = letterGrade(result.pct);
    const { marksWrong, negativeMarking } = run.settings;
    const topics = result.decks.flatMap((d) =>
      d.topics.map((t) => ({ ...t, label: result.decks.length > 1 ? `${d.label} › ${t.label}` : t.label }))
    );
    const ranked = topics.length > 1 ? [...topics].sort((a, b) => scorePct(a) - scorePct(b)) : [];
    const weakest = ranked[0];
    const strongest = ranked[ranked.length - 1];
    const deckLabel = result.decks.length === 1 ? result.decks[0].label : `${result.decks.length} decks`;

    const reviewed = run.items
      .map((item, i) => ({ item, i, status: result.statuses[i] }))
      .filter(({ item, status }) =>
        reviewFilter === 'all'
          ? true
          : reviewFilter === 'marked'
          ? Boolean(run.marked[item.card.id])
          : reviewFilter === 'wrong'
          ? status === 'wrong'
          : status === 'skipped'
      );
    const markedCount = run.items.filter((item) => run.marked[item.card.id]).length;

    return (
      <div className="p-6 space-y-6">
        {/* Score */}
        <div className="text-center space-y-2">
          <h3 className="text-lg font-bold text-white">Mock Test Results</h3>
          <div className={cn('text-5xl font-black', color)}>{grade}</div>
          <p className="text-white text-xl font-bold">
            {formatMarks(result.score)} / {formatMarks(result.maxScore)} marks
          </p>
          <p className="text-white/50 text-sm">
            {deckLabel} • {Math.round(result.pct)}% • {formatDuration(result.durationMs)} of{' '}
            {formatMinutes(run.settings.durationMinutes)}
          </p>
          <p className="text-xs font-semibold text-cyan-300">+{result.xp} XP earned</p>
          {result.timedOut && <p className="text-xs text-red-300">⏱ Time&apos;s up: the test was submitted automatically.</p>}
        </div>

        <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(96px,1fr))]">
          <StatTile value={result.correct} label="Correct" tone="green" />
          <StatTile value={result.wrong} label="Wrong" tone="red" />
          <StatTile value={result.skipped} label="Unattempted" />
          <StatTile
            value={result.correct + result.wrong > 0 ? `${Math.round(result.accuracy)}%` : '—'}
            label="Accuracy"
            tone="cyan"
          />
          {negativeMarking && (
            <StatTile value={`−${formatMarks(result.wrong * marksWrong)}`} label="Lost to penalties" tone="purple" />
          )}
        </div>

        {/* Analysis */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-white/80">Analysis by deck &amp; topic</h4>
          {weakest && strongest && weakest.key !== strongest.key && (
            <div className="grid gap-2 sm:grid-cols-2 text-xs">
              <p className="p-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-200">
                Focus next: <span className="font-semibold">{weakest.label}</span> ({Math.round(scorePct(weakest))}%)
              </p>
              <p className="p-2 rounded-lg border border-green-500/20 bg-green-500/10 text-green-200">
                Strongest: <span className="font-semibold">{strongest.label}</span> ({Math.round(scorePct(strongest))}%)
              </p>
            </div>
          )}
          <div className="rounded-lg border border-white/10 overflow-hidden divide-y divide-white/5">
            <div className="grid grid-cols-[minmax(0,1fr)_2rem_2rem_2rem_4.5rem_3.5rem] gap-x-2 px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/35">
              <span>Deck / topic</span>
              <span className="text-right">✓</span>
              <span className="text-right">✗</span>
              <span className="text-right">—</span>
              <span className="text-right">Marks</span>
              <span className="text-right">Avg</span>
            </div>
            {result.decks.map((deck) => (
              <div key={deck.key} className="divide-y divide-white/5">
                <BreakdownRow row={deck} />
                {deck.topics.length > 1 && deck.topics.map((topic) => <BreakdownRow key={topic.key} row={topic} topic />)}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={startMock}
            disabled={plannedCount === 0}
            className="flex-1 p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 text-sm font-semibold disabled:opacity-30"
          >
            ↻ Retake (new questions)
          </button>
          <button
            type="button"
            onClick={backToSetup}
            className="flex-1 p-3 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 text-sm font-semibold"
          >
            Back to Setup
          </button>
        </div>

        {/* Per-question review */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-white/80">Review</h4>
            <div className="flex flex-wrap gap-1">
              <Chip active={reviewFilter === 'all'} onClick={() => setReviewFilter('all')}>
                All
              </Chip>
              <Chip active={reviewFilter === 'wrong'} onClick={() => setReviewFilter('wrong')}>
                Wrong ({result.wrong})
              </Chip>
              <Chip active={reviewFilter === 'skipped'} onClick={() => setReviewFilter('skipped')}>
                Unattempted ({result.skipped})
              </Chip>
              {markedCount > 0 && (
                <Chip active={reviewFilter === 'marked'} onClick={() => setReviewFilter('marked')}>
                  Marked ({markedCount})
                </Chip>
              )}
            </div>
          </div>
          {reviewed.length === 0 && <p className="text-xs text-white/40">Nothing here.</p>}
          {reviewed.map(({ item, i, status }) => {
            const marks = marksFor(status, run.settings);
            return (
              <details key={item.card.id} className={cn('p-3 rounded-lg border text-sm', REVIEW_STYLES[status])}>
                <summary className="cursor-pointer text-white/80">
                  <span className="text-white/40 mr-2">Q{i + 1}.</span>
                  {item.card.prompt.length > PROMPT_PREVIEW
                    ? `${item.card.prompt.slice(0, PROMPT_PREVIEW)}…`
                    : item.card.prompt}
                  <span className={cn('ml-2', STATUS_MARKS[status].className)}>{STATUS_MARKS[status].icon}</span>
                  <span className="ml-2 text-[10px] text-white/40">
                    {marks > 0 ? '+' : ''}
                    {formatMarks(marks)}
                  </span>
                  {run.marked[item.card.id] && <span className="ml-1 text-[10px]">🔖</span>}
                </summary>
                <div className="mt-3 space-y-2">
                  <QuestionView
                    card={item.card}
                    answer={run.answers[item.card.id]}
                    reveal
                    hidePrompt={item.card.prompt.length <= PROMPT_PREVIEW}
                  />
                  <p className="text-[10px] text-white/30">
                    {item.deckName} › {item.topicName}
                    {result.spentMs[item.card.id] ? ` · ${formatDuration(result.spentMs[item.card.id])} on this question` : ''}
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

export const MockTest = memo(MockTestInner);
