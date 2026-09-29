// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Mock Test
// A timed exam over the decks you pick: question count, duration and
// marking (+correct / −wrong) are yours to set. No feedback until the
// end; it submits itself when time runs out, then breaks the score
// down by deck and topic.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect, useMemo, useRef, memo, type KeyboardEvent } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleMinus,
  CircleX,
  Eraser,
  Flag,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Target,
  Timer,
  Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  SegmentedControl,
  Select,
  StatTile,
  Switch,
} from '@/components/ui';
import { TRANSITION } from '@/styles/tokens';
import { useXPStore } from '@/stores/useXPStore';
import { isQuizCard, listCardLocations, useLearningStore } from '@/stores/useLearningStore';
import { dispatchCreatureEvent } from '@/components/creature';
import { recordQuizCompletion } from '@/components/achievements/quiz-achievements';
import type { QuizCard, RecordAttemptInput } from '@/types/learning';
import { QuestionView } from './QuestionView';
import {
  AccuracyBar,
  ConfirmBar,
  DifficultyBadge,
  KeyHints,
  PaletteButton,
  PaletteLegend,
  ReviewRow,
  ScoreHero,
  SettingRow,
  TabHeader,
  accuracyTone,
  type PaletteState,
} from './QuizControls';
import {
  KIND_LABELS,
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

/** Deck / topic analysis table: name + meter, ✓ ✗ —, marks, average time. */
const TABLE_COLS = 'grid grid-cols-[minmax(0,1fr)_2.25rem_2.25rem_2.25rem_4.75rem_3.75rem] items-center gap-x-2';

function BreakdownHeader() {
  const icon = 'ml-auto block';
  return (
    <div className={cn(TABLE_COLS, 'border-b border-line px-4 py-2')}>
      <span className="hud-label">Deck / topic</span>
      <span title="Correct">
        <CircleCheck size={14} strokeWidth={1.75} className={cn(icon, 'text-success')} aria-label="Correct" />
      </span>
      <span title="Wrong">
        <CircleX size={14} strokeWidth={1.75} className={cn(icon, 'text-danger')} aria-label="Wrong" />
      </span>
      <span title="Unattempted">
        <CircleMinus size={14} strokeWidth={1.75} className={cn(icon, 'text-fg-subtle')} aria-label="Unattempted" />
      </span>
      <span className="hud-label text-right">Marks</span>
      <span className="hud-label text-right">Avg</span>
    </div>
  );
}

/** One row of the deck / topic analysis table. */
function BreakdownRow({ row, topic = false }: { row: Breakdown; topic?: boolean }) {
  const answered = row.correct + row.wrong;
  const pct = scorePct(row);
  return (
    <div
      className={cn(
        TABLE_COLS,
        'min-h-11 px-4 py-2 font-mono text-xs tabular transition-colors duration-120 hover:bg-surface-hover',
        topic ? 'text-fg-muted' : 'text-fg'
      )}
    >
      <div className={cn('min-w-0 font-sans', topic && 'border-l border-line pl-3')}>
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn('truncate text-ui', topic ? 'text-fg-muted' : 'font-medium text-fg')} title={row.label}>
            {row.label}
          </p>
          <span className="shrink-0 font-mono text-2xs text-fg-subtle tabular">{Math.round(pct)}%</span>
        </div>
        <AccuracyBar pct={pct} className="mt-1.5" label={`${row.label}: ${Math.round(pct)}% of the marks`} />
      </div>
      <span className="text-right text-success">{row.correct}</span>
      <span className="text-right text-danger">{row.wrong}</span>
      <span className="text-right text-fg-subtle">{row.skipped}</span>
      <span className="text-right">
        {formatMarks(row.marks)}
        <span className="text-fg-subtle">/{formatMarks(row.maxMarks)}</span>
      </span>
      <span className="text-right text-fg-subtle">{answered > 0 ? formatDuration(row.answeredMs / answered) : '—'}</span>
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
  const reduceMotion = useReducedMotion();

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
      <div className="@container space-y-6 p-5">
        <TabHeader
          icon={Timer}
          title="Mock test"
          description="A timed exam over your decks. No feedback until you submit; it submits itself when time runs out."
        />

        {usableDecks.length === 0 ? (
          <EmptyState
            icon={Timer}
            title="No quiz questions yet"
            description="Decks need multiple-choice, multi-select or numeric cards for a mock test."
          />
        ) : (
          <>
            <section className="space-y-3" aria-label="Decks">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="hud-label">Decks</span>
                <span className="flex items-center gap-2">
                  <span className={cn('text-xs tabular', chosen.length === 0 ? 'text-warning' : 'text-fg-subtle')}>
                    {chosen.length === 0 ? 'Pick at least one deck.' : `${poolSize} questions available`}
                  </span>
                  {usableDecks.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setChosenIds(allChosen ? [] : usableDecks.map((d) => d.id))}
                    >
                      {allChosen ? 'Clear' : 'Select all'}
                    </Button>
                  )}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {usableDecks.map((deck) => (
                  <Chip
                    key={deck.id}
                    selected={chosen.some((d) => d.id === deck.id)}
                    onClick={() =>
                      setChosenIds((ids) => (ids.includes(deck.id) ? ids.filter((id) => id !== deck.id) : [...ids, deck.id]))
                    }
                  >
                    <span aria-hidden className="mr-1.5">
                      {deck.icon}
                    </span>
                    {deck.name}
                    <span className="ml-1.5 font-mono tabular opacity-60">{deckCounts.get(deck.id)}</span>
                  </Chip>
                ))}
              </div>
            </section>

            <Card eyebrow="Exam" title="Rules" bodyClassName="divide-y divide-line">
              <SettingRow label="Questions" hint={`${poolSize} in the chosen decks`}>
                <SegmentedControl
                  size="sm"
                  aria-label="Questions"
                  value={String(countChoice)}
                  onChange={(v) => setSettings((s) => ({ ...s, questionCount: Number(v) }))}
                  options={COUNT_OPTIONS.map((n) => ({
                    value: String(n),
                    label: n === 0 ? `All ${poolSize}` : String(n),
                    disabled: n > poolSize,
                  }))}
                />
              </SettingRow>
              <SettingRow
                label="Duration"
                hint={secondsEach > 0 ? `About ${formatDuration(secondsEach * 1000)} per question.` : undefined}
              >
                <div className="w-36">
                  <Select
                    size="sm"
                    aria-label="Duration"
                    value={String(settings.durationMinutes)}
                    onValueChange={(v) => setSettings((s) => ({ ...s, durationMinutes: Number(v) }))}
                    options={DURATION_OPTIONS.map((m) => ({ value: String(m), label: formatMinutes(m) }))}
                  />
                </div>
              </SettingRow>
              <SettingRow label="Marks per correct answer">
                <div className="w-24">
                  <Select
                    size="sm"
                    aria-label="Marks per correct answer"
                    value={String(settings.marksCorrect)}
                    onValueChange={(v) => setSettings((s) => ({ ...s, marksCorrect: Number(v) }))}
                    options={CORRECT_MARK_OPTIONS.map((v) => ({ value: String(v), label: `+${v}` }))}
                  />
                </div>
              </SettingRow>
              <SettingRow
                label="Negative marking"
                hint={
                  settings.negativeMarking
                    ? `+${formatMarks(settings.marksCorrect)} per correct, −${formatMarks(settings.marksWrong)} per wrong, 0 for unanswered: guess with care.`
                    : `+${formatMarks(settings.marksCorrect)} per correct, nothing lost for wrong or unanswered.`
                }
              >
                {settings.negativeMarking && (
                  <div className="w-36">
                    <Select
                      size="sm"
                      aria-label="Marks lost per wrong answer"
                      value={String(settings.marksWrong)}
                      onValueChange={(v) => setSettings((s) => ({ ...s, marksWrong: Number(v) }))}
                      options={WRONG_MARK_OPTIONS.map((v) => ({ value: String(v), label: `−${formatMarks(v)} per wrong` }))}
                    />
                  </div>
                )}
                <Switch
                  checked={settings.negativeMarking}
                  onCheckedChange={(on) => setSettings((s) => ({ ...s, negativeMarking: on }))}
                  aria-label="Negative marking"
                />
              </SettingRow>
            </Card>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <p className="text-ui text-fg-muted tabular">
                {plannedCount} question{plannedCount === 1 ? '' : 's'} · {formatMinutes(settings.durationMinutes)} · max{' '}
                {formatMarks(plannedCount * settings.marksCorrect)} marks
              </p>
              <Button variant="primary" size="lg" leadingIcon={Play} onClick={startMock} disabled={plannedCount === 0}>
                Start mock test
              </Button>
            </div>
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
    const marked = Boolean(run.marked[card.id]);
    const paletteState = (cardId: string, i: number): PaletteState =>
      i === run.index ? 'current' : run.marked[cardId] ? 'marked' : isAnswered(run.answers[cardId]) ? 'answered' : 'empty';

    return (
      <div ref={containerRef} tabIndex={-1} onKeyDown={onKeyDown} className="@container flex h-full flex-col outline-none">
        {/* Top bar */}
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-5">
          <span className="font-mono text-xs text-fg-muted tabular">
            <span className="text-fg">Q{run.index + 1}</span>/{run.items.length}
          </span>
          <span className="hidden min-w-0 flex-1 truncate text-xs text-fg-subtle tabular @md:block">
            {answeredCount} answered{markedCount > 0 ? ` · ${markedCount} marked` : ''}
          </span>
          <span className="flex-1 @md:hidden" />
          <span
            title="Time left"
            className={cn(
              'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-control px-2.5 font-mono text-sm font-semibold tabular',
              danger ? 'bg-danger/12 text-danger motion-safe:animate-pulse-soft' : 'bg-accent/10 text-accent'
            )}
          >
            <Timer size={14} strokeWidth={1.75} aria-hidden />
            {formatClock(timeLeft)}
          </span>
          <span aria-hidden className="h-5 w-px bg-line-strong" />
          <Button variant="secondary" size="sm" leadingIcon={Flag} onClick={requestSubmit}>
            Submit
          </Button>
        </div>
        <div className="h-0.5 shrink-0 bg-ink-700" aria-hidden>
          <div
            className={cn('h-full transition-[width] duration-1000 ease-linear', danger ? 'bg-danger' : 'bg-accent/70')}
            style={{ width: `${Math.min(100, ((timeLeft * 1000) / budget) * 100)}%` }}
          />
        </div>

        {/* Question */}
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="mx-auto w-full max-w-3xl space-y-4">
            {confirmSubmit && (
              <ConfirmBar
                actions={
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmSubmit(false)}>
                      Keep going
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => finishMock(false)}>
                      Submit test
                    </Button>
                  </>
                }
              >
                {unanswered > 0 ? `${unanswered} unanswered` : 'All answered'}
                {markedCount > 0 ? ` · ${markedCount} marked for review` : ''}. Submit now?
              </ConfirmBar>
            )}

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
                transition={TRANSITION.small}
                className="glass-panel rounded-card p-5"
              >
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="hud-label text-accent">Q{run.index + 1}</span>
                  <span aria-hidden className="text-fg-faint">
                    ·
                  </span>
                  <span className="hud-label">{KIND_LABELS[card.kind]}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-fg-subtle" title={`${deckName} › ${topicName}`}>
                    {deckName} › {topicName}
                  </span>
                  <DifficultyBadge difficulty={card.difficulty} />
                  <Badge size="sm" title="Marks for a correct / wrong answer">
                    +{formatMarks(marksCorrect)}
                    {negativeMarking ? ` / −${formatMarks(marksWrong)}` : ''}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => toggleMarked(card.id)}
                    aria-pressed={marked}
                    className={cn(
                      'focus-ring inline-flex h-7 items-center gap-1.5 rounded-control px-2.5 text-xs font-medium',
                      'transition-colors duration-120 ease-out-quint',
                      marked
                        ? 'bg-warning/12 text-warning ring-1 ring-inset ring-warning/30 hover:bg-warning/18'
                        : 'text-fg-muted hover:bg-surface-hover hover:text-fg active:bg-surface-active'
                    )}
                  >
                    {marked ? (
                      <BookmarkCheck size={14} strokeWidth={1.75} aria-hidden />
                    ) : (
                      <Bookmark size={14} strokeWidth={1.75} aria-hidden />
                    )}
                    {marked ? 'Marked' : 'Mark for review'}
                  </button>
                </div>
                <QuestionView
                  key={card.id}
                  card={card}
                  answer={answer}
                  onAnswer={(a) => setAnswer(card.id, a)}
                  autoFocus
                  size="lg"
                  keyHints
                />
              </motion.div>
            </AnimatePresence>

            <KeyHints
              items={[
                { keys: ['1', '9'], label: 'pick', range: true },
                { keys: ['Enter'], label: 'next' },
                { keys: ['←', '→'], label: 'move' },
              ]}
            />
          </div>
        </div>

        {/* Question palette */}
        <div className="shrink-0 space-y-3 border-t border-line bg-ink-950/30 px-5 py-3">
          <div className="scrollbar-thin flex max-h-[4.25rem] flex-wrap gap-1 overflow-y-auto p-0.5" aria-label="Question palette">
            {run.items.map((item, i) => (
              <PaletteButton key={item.card.id} index={i} state={paletteState(item.card.id, i)} onClick={() => goTo(i)} />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="hidden @xl:block">
              <PaletteLegend items={['answered', 'marked', 'empty']} />
            </div>
            <div className="flex flex-1 items-center justify-end gap-2">
              <Button variant="ghost" size="sm" leadingIcon={ChevronLeft} onClick={() => goTo(run.index - 1)} disabled={run.index === 0}>
                Prev
              </Button>
              <Button variant="ghost" size="sm" leadingIcon={Eraser} onClick={() => clearAnswer(card.id)} disabled={!isAnswered(answer)}>
                Clear answer
              </Button>
              {run.index === run.items.length - 1 ? (
                <Button variant="primary" size="sm" leadingIcon={Flag} onClick={requestSubmit}>
                  Submit
                </Button>
              ) : (
                <Button variant="primary" size="sm" trailingIcon={ChevronRight} onClick={() => goTo(run.index + 1)}>
                  Next
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Results ───
  if (phase === 'results' && run && result) {
    const { grade, color, tone } = letterGrade(result.pct);
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
    const insight = (kind: 'weak' | 'strong', row: Breakdown & { label: string }) => {
      const pct = scorePct(row);
      const weak = kind === 'weak';
      return (
        <div className="glass-panel flex min-w-0 items-center gap-3 rounded-card p-3.5">
          <span
            aria-hidden
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-control ring-1 ring-inset',
              weak ? 'bg-danger/10 text-danger ring-danger/25' : 'bg-success/10 text-success ring-success/25'
            )}
          >
            {weak ? <Target size={16} strokeWidth={1.75} /> : <Trophy size={16} strokeWidth={1.75} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="hud-label">{weak ? 'Focus next' : 'Strongest'}</p>
            <p className="mt-0.5 truncate text-ui font-medium text-fg" title={row.label}>
              {row.label}
            </p>
          </div>
          <span className={cn('shrink-0 font-mono text-sm font-semibold tabular', weak ? 'text-danger' : 'text-success')}>
            {Math.round(pct)}%
          </span>
        </div>
      );
    };

    return (
      <div className="@container space-y-6 p-5">
        <ScoreHero
          grade={grade}
          gradeColor={color}
          tone={tone}
          pct={result.pct}
          eyebrow="Mock test results"
          title={
            <>
              {formatMarks(result.score)} / {formatMarks(result.maxScore)} marks
            </>
          }
          meta={
            <>
              {deckLabel} · {Math.round(result.pct)}% · {formatDuration(result.durationMs)} of{' '}
              {formatMinutes(run.settings.durationMinutes)}
            </>
          }
          badges={
            <>
              <Badge tone="gold" icon={Sparkles}>
                +{result.xp} XP earned
              </Badge>
              {result.timedOut && (
                <Badge tone="danger" icon={Timer}>
                  Time&apos;s up
                </Badge>
              )}
            </>
          }
          footnote={result.timedOut ? "Time's up: the test was submitted automatically." : undefined}
        />

        <div className={cn('grid grid-cols-2 gap-3', negativeMarking ? '@xl:grid-cols-5' : '@xl:grid-cols-4')}>
          <StatTile size="sm" label="Correct" icon={CircleCheck} value={<span className="text-success">{result.correct}</span>} />
          <StatTile size="sm" label="Wrong" icon={CircleX} value={<span className="text-danger">{result.wrong}</span>} />
          <StatTile size="sm" label="Unattempted" icon={CircleMinus} value={result.skipped} />
          <StatTile
            size="sm"
            label="Accuracy"
            icon={Target}
            value={
              result.correct + result.wrong > 0 ? (
                <span className={cn(accuracyTone(result.accuracy) === 'danger' ? 'text-danger' : accuracyTone(result.accuracy) === 'warning' ? 'text-warning' : 'text-success')}>
                  {Math.round(result.accuracy)}%
                </span>
              ) : (
                '—'
              )
            }
          />
          {negativeMarking && (
            <StatTile
              size="sm"
              label="Lost to penalties"
              icon={CircleX}
              value={<span className="text-danger">−{formatMarks(result.wrong * marksWrong)}</span>}
            />
          )}
        </div>

        {/* Analysis */}
        <section className="space-y-3" aria-label="Analysis by deck and topic">
          {weakest && strongest && weakest.key !== strongest.key && scorePct(strongest) > scorePct(weakest) && (
            <div className="grid gap-3 @xl:grid-cols-2">
              {insight('weak', weakest)}
              {insight('strong', strongest)}
            </div>
          )}
          <Card eyebrow="Analysis" title="By deck & topic" padding="none">
            <BreakdownHeader />
            <div className="divide-y divide-line">
              {result.decks.map((deck) => (
                <div key={deck.key} className="divide-y divide-line">
                  <BreakdownRow row={deck} />
                  {deck.topics.length > 1 && deck.topics.map((topic) => <BreakdownRow key={topic.key} row={topic} topic />)}
                </div>
              ))}
            </div>
          </Card>
        </section>

        <div className="flex flex-wrap gap-3">
          <Button variant="primary" size="lg" leadingIcon={RotateCcw} onClick={startMock} disabled={plannedCount === 0}>
            Retake (new questions)
          </Button>
          <Button variant="secondary" size="lg" leadingIcon={SlidersHorizontal} onClick={backToSetup}>
            Back to setup
          </Button>
        </div>

        {/* Per-question review */}
        <section className="space-y-3" aria-label="Review">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-fg">Review</h4>
            <div className="flex flex-wrap gap-2">
              <Chip selected={reviewFilter === 'all'} onClick={() => setReviewFilter('all')}>
                All ({run.items.length})
              </Chip>
              <Chip tone="danger" selected={reviewFilter === 'wrong'} onClick={() => setReviewFilter('wrong')}>
                Wrong ({result.wrong})
              </Chip>
              <Chip selected={reviewFilter === 'skipped'} onClick={() => setReviewFilter('skipped')}>
                Unattempted ({result.skipped})
              </Chip>
              {markedCount > 0 && (
                <Chip tone="warning" selected={reviewFilter === 'marked'} onClick={() => setReviewFilter('marked')}>
                  Marked ({markedCount})
                </Chip>
              )}
            </div>
          </div>
          {reviewed.length === 0 ? (
            <EmptyState
              size="sm"
              icon={CircleCheck}
              title="Nothing here"
              description={reviewFilter === 'wrong' ? 'No wrong answers in this test.' : 'Every question was attempted.'}
            />
          ) : (
            <div className="glass-panel divide-y divide-line overflow-hidden rounded-card">
              {reviewed.map(({ item, i, status }) => {
                const marks = marksFor(status, run.settings);
                const spent = result.spentMs[item.card.id];
                return (
                  <ReviewRow
                    key={item.card.id}
                    index={i}
                    status={status}
                    prompt={item.card.prompt}
                    preview={PROMPT_PREVIEW}
                    flags={
                      run.marked[item.card.id] ? (
                        <BookmarkCheck size={14} strokeWidth={1.75} className="shrink-0 text-warning" aria-label="Marked for review" />
                      ) : undefined
                    }
                    meta={
                      <span className={cn(marks > 0 ? 'text-success' : marks < 0 ? 'text-danger' : 'text-fg-subtle')}>
                        {marks > 0 ? '+' : ''}
                        {formatMarks(marks)}
                      </span>
                    }
                  >
                    <QuestionView
                      card={item.card}
                      answer={run.answers[item.card.id]}
                      reveal
                      hidePrompt={item.card.prompt.length <= PROMPT_PREVIEW}
                    />
                    <p className="text-xs text-fg-subtle">
                      {item.deckName} › {item.topicName}
                      {spent ? ` · ${formatDuration(spent)} on this question` : ''}
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

export const MockTest = memo(MockTestInner);
