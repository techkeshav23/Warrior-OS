// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Mock Test
// Timed test over one deck or all decks, optional negative marking
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect, useMemo, useRef, memo } from 'react';
import { cn } from '@/lib/utils';
import { useXPStore } from '@/stores/useXPStore';
import { isQuizCard, listCardLocations, useLearningStore } from '@/stores/useLearningStore';
import { dispatchCreatureEvent } from '@/components/creature';
import { recordQuizCompletion } from '@/components/achievements/quiz-achievements';
import type { QuizCard, RecordAttemptInput } from '@/types/learning';
import { isAnswerCorrect, isAnswered, toggleOption, type UserAnswer } from './grading';

type Phase = 'setup' | 'test' | 'results';
type DeckFilter = string | 'all';

/** Points lost per wrong choice answer when negative marking is on (numeric answers never lose points). */
const NEGATIVE_MARK = 0.25;

interface MockConfig {
  questionCount: number;
  durationMinutes: number;
  deckId: DeckFilter;
  negativeMarking: boolean;
}

interface MockItem {
  card: QuizCard;
  deckName: string;
  topicName: string;
}

interface MockResult {
  totalQuestions: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  score: number;
  pct: number;
  xp: number;
}

interface MockTestProps {
  /** Deck to preselect, e.g. from a NEXUS deep link. */
  initialDeckId?: string | null;
}

function shuffleArray<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * +1 per correct answer; with negative marking a wrong choice answer
 * costs NEGATIVE_MARK. `results` lists correctness per question in order.
 */
function scoreMock(
  items: readonly MockItem[],
  answers: Record<string, UserAnswer>,
  negativeMarking: boolean
): { result: MockResult; results: boolean[] } {
  let score = 0;
  let correct = 0;
  let incorrect = 0;
  let unattempted = 0;
  const results: boolean[] = [];

  for (const { card } of items) {
    const answer = answers[card.id];
    if (!isAnswered(answer)) {
      unattempted++;
      results.push(false);
      continue;
    }
    const ok = isAnswerCorrect(card, answer);
    results.push(ok);
    if (ok) {
      correct++;
      score += 1;
    } else {
      incorrect++;
      if (negativeMarking && card.kind !== 'numeric') score -= NEGATIVE_MARK;
    }
  }

  const pct = items.length > 0 ? Math.max(0, (score / items.length) * 100) : 0;
  const xp = Math.round(correct * 8 + (pct >= 70 ? 100 : 0));
  return {
    result: { totalQuestions: items.length, correct, incorrect, unattempted, score, pct, xp },
    results,
  };
}

function MockTestInner({ initialDeckId = null }: MockTestProps) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [config, setConfig] = useState<MockConfig>(() => {
    // A preselected deck without quiz questions (flashcards only) falls back to all decks.
    const deck = useLearningStore.getState().decks.find((d) => d.id === initialDeckId);
    const usable = deck?.topics.some((t) => t.cards.some(isQuizCard)) ?? false;
    return {
      questionCount: 25,
      durationMinutes: 30,
      deckId: deck && usable ? deck.id : 'all',
      negativeMarking: false,
    };
  });
  const [items, setItems] = useState<MockItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});
  const [marked, setMarked] = useState<Set<string>>(() => new Set());
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [result, setResult] = useState<MockResult | null>(null);
  const finishedRef = useRef(false);
  const addXP = useXPStore((s) => s.addXP);
  const decks = useLearningStore((s) => s.decks);
  const recordAttempts = useLearningStore((s) => s.recordAttempts);

  const pool = useMemo<MockItem[]>(() => {
    const out: MockItem[] = [];
    const deckId = config.deckId === 'all' ? undefined : config.deckId;
    for (const location of listCardLocations(decks, deckId)) {
      if (isQuizCard(location.card)) {
        out.push({ card: location.card, deckName: location.deckName, topicName: location.topicName });
      }
    }
    return out;
  }, [decks, config.deckId]);
  const questionTarget = Math.min(config.questionCount, pool.length);
  const deckOptions = decks.filter((d) => d.topics.some((t) => t.cards.some(isQuizCard)));

  // Score once, award XP once, fire achievements once — on manual submit or time-out.
  const finishMock = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const { result: scored, results } = scoreMock(items, answers, config.negativeMarking);
    const answered = scored.correct + scored.incorrect;
    addXP(scored.xp, 'mock-test');

    // Per-card progress for every answered question.
    const at = Date.now();
    const cardResults: RecordAttemptInput[] = [];
    items.forEach(({ card }, i) => {
      if (isAnswered(answers[card.id])) cardResults.push({ cardId: card.id, correct: results[i], source: 'mock', at });
    });
    recordAttempts(cardResults);

    recordQuizCompletion({
      kind: 'mock',
      deckId: config.deckId === 'all' ? null : config.deckId,
      results,
      answered,
    });
    // Mock tests never reach quiz history (which the creature watches), so tell it directly.
    if (answered > 0) {
      dispatchCreatureEvent({
        type: scored.correct === scored.totalQuestions ? 'quiz-perfect' : 'quiz-complete',
      });
    }
    setResult(scored);
    setPhase('results');
  }, [items, answers, addXP, recordAttempts, config.deckId, config.negativeMarking]);

  // Latest finishMock for the timer, so typing an answer doesn't restart the interval.
  const finishRef = useRef(finishMock);
  useEffect(() => {
    finishRef.current = finishMock;
  });

  // Timer: time left derives from endsAt; auto-submit when it runs out.
  useEffect(() => {
    if (phase !== 'test') return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) finishRef.current();
    }, 1000);
    return () => clearInterval(id);
  }, [phase, endsAt]);

  const startMock = useCallback(() => {
    const picked = shuffleArray(pool).slice(0, config.questionCount);
    if (picked.length === 0) return;
    const start = Date.now();
    finishedRef.current = false;
    setItems(picked);
    setAnswers({});
    setMarked(new Set());
    setCurrentIndex(0);
    setResult(null);
    setNow(start);
    setEndsAt(start + config.durationMinutes * 60_000);
    setPhase('test');
  }, [pool, config.questionCount, config.durationMinutes]);

  const timeLeft = Math.max(0, Math.ceil((endsAt - now) / 1000));

  // ─── Setup ───
  if (phase === 'setup') {
    const deckName = decks.find((d) => d.id === config.deckId)?.name ?? 'this deck';
    return (
      <div className="p-6 space-y-6">
        <h3 className="text-lg font-bold text-white">⏱️ Mock Test</h3>
        <p className="text-xs text-white/50">
          Timed, no feedback until the end. +1 per correct answer
          {config.negativeMarking ? `, −${NEGATIVE_MARK} per wrong choice answer (numeric answers never lose points)` : ''}.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/60 block mb-1">Deck</label>
            <select
              value={config.deckId}
              onChange={(e) => setConfig((c) => ({ ...c, deckId: e.target.value }))}
              className="bg-white/5 border border-white/10 rounded p-2 text-sm text-white w-full"
            >
              <option value="all">All decks (mixed)</option>
              {deckOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.icon} {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/60 block mb-1">Questions</label>
            <select
              value={config.questionCount}
              onChange={(e) => setConfig((c) => ({ ...c, questionCount: Number(e.target.value) }))}
              className="bg-white/5 border border-white/10 rounded p-2 text-sm text-white w-full"
            >
              <option value={10}>10 (Quick)</option>
              <option value={25}>25 (Standard)</option>
              <option value={50}>50 (Marathon)</option>
            </select>
            {questionTarget < config.questionCount && (
              <p className="text-[11px] text-yellow-300/80 mt-1">
                Only {pool.length} question{pool.length === 1 ? '' : 's'} available
                {config.deckId === 'all' ? '' : ` in ${deckName}`}; the test will use {questionTarget}.
              </p>
            )}
          </div>
          <div>
            <label className="text-xs text-white/60 block mb-1">Duration</label>
            <select
              value={config.durationMinutes}
              onChange={(e) => setConfig((c) => ({ ...c, durationMinutes: Number(e.target.value) }))}
              className="bg-white/5 border border-white/10 rounded p-2 text-sm text-white w-full"
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={60}>1 hour</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
            <input
              type="checkbox"
              checked={config.negativeMarking}
              onChange={(e) => setConfig((c) => ({ ...c, negativeMarking: e.target.checked }))}
              className="accent-red-400"
            />
            Negative marking
          </label>
        </div>

        <button
          onClick={startMock}
          disabled={questionTarget === 0}
          className="w-full p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 text-sm font-bold disabled:opacity-30"
        >
          🚀 Start Mock Test
        </button>
      </div>
    );
  }

  // ─── Test ───
  if (phase === 'test' && items.length > 0) {
    const { card, deckName, topicName } = items[currentIndex];
    const answer = answers[card.id];
    return (
      <div className="flex flex-col h-full">
        {/* Top bar */}
        <div className="flex items-center justify-between p-3 border-b border-white/10 bg-black/20">
          <span className="text-xs text-white/50">
            Q{currentIndex + 1}/{items.length}
          </span>
          <span
            className={cn(
              'text-sm font-mono font-bold',
              timeLeft < 300 ? 'text-red-400 animate-pulse' : 'text-cyan-300'
            )}
          >
            {formatTime(timeLeft)}
          </span>
          <button
            onClick={finishMock}
            className="px-3 py-1 rounded text-xs bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30"
          >
            Submit
          </button>
        </div>

        {/* Question */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          <div className="flex items-center gap-2 text-xs text-white/40">
            <span>{deckName}</span>
            <span>•</span>
            <span>{topicName}</span>
            <button
              onClick={() =>
                setMarked((prev) => {
                  const next = new Set(prev);
                  if (next.has(card.id)) next.delete(card.id);
                  else next.add(card.id);
                  return next;
                })
              }
              className={cn(
                'ml-auto px-2 py-0.5 rounded text-[10px] border',
                marked.has(card.id)
                  ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                  : 'border-white/10 text-white/40'
              )}
            >
              {marked.has(card.id) ? '🔖 Marked' : 'Mark'}
            </button>
          </div>

          <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{card.prompt}</p>

          {card.kind === 'mcq' && (
            <div className="space-y-2">
              {card.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setAnswers((a) => ({ ...a, [card.id]: i }))}
                  className={cn(
                    'w-full p-3 rounded text-sm text-left border transition-all',
                    answer === i
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                  )}
                >
                  {String.fromCharCode(65 + i)}. {opt}
                </button>
              ))}
            </div>
          )}

          {card.kind === 'multi-select' && (
            <div className="space-y-2">
              <p className="text-[11px] text-white/40">Pick every correct option.</p>
              {card.options.map((opt, i) => {
                const picked = Array.isArray(answer) && answer.includes(i);
                return (
                  <button
                    key={i}
                    onClick={() => setAnswers((a) => ({ ...a, [card.id]: toggleOption(a[card.id], i) }))}
                    aria-pressed={picked}
                    className={cn(
                      'w-full p-3 rounded text-sm text-left border transition-all',
                      picked
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                        : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                    )}
                  >
                    {picked ? '☑' : '☐'} {opt}
                  </button>
                );
              })}
            </div>
          )}

          {card.kind === 'numeric' && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                placeholder="Enter a number"
                value={typeof answer === 'string' ? answer : ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [card.id]: e.target.value }))}
                className="flex-1 p-3 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:border-cyan-500/50"
              />
              {card.unit && <span className="text-sm text-white/50">{card.unit}</span>}
            </div>
          )}
        </div>

        {/* Question nav */}
        <div className="p-3 border-t border-white/10 bg-black/20">
          <div className="flex flex-wrap gap-1 mb-3">
            {items.map((item, i) => (
              <button
                key={item.card.id}
                onClick={() => setCurrentIndex(i)}
                className={cn(
                  'w-7 h-7 rounded text-[10px] transition-all',
                  i === currentIndex
                    ? 'bg-cyan-500 text-black font-bold'
                    : marked.has(item.card.id)
                    ? 'bg-yellow-500/30 text-yellow-300'
                    : isAnswered(answers[item.card.id])
                    ? 'bg-green-500/30 text-green-300'
                    : 'bg-white/10 text-white/40'
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="flex justify-between">
            <button
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="px-4 py-1 text-xs text-white/50 disabled:opacity-30"
            >
              ← Prev
            </button>
            <button
              onClick={() => setCurrentIndex(Math.min(items.length - 1, currentIndex + 1))}
              disabled={currentIndex === items.length - 1}
              className="px-4 py-1 text-xs text-white/50 disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Results ───
  if (phase === 'results' && result) {
    return (
      <div className="p-6 space-y-4 overflow-y-auto h-full">
        <h3 className="text-lg font-bold text-white text-center">Mock Test Results</h3>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-2xl font-bold text-green-300">{result.correct}</p>
            <p className="text-xs text-green-400/60">Correct</p>
          </div>
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-2xl font-bold text-red-300">{result.incorrect}</p>
            <p className="text-xs text-red-400/60">Incorrect</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-2xl font-bold text-white/70">{result.unattempted}</p>
            <p className="text-xs text-white/40">Unattempted</p>
          </div>
          <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
            <p className="text-2xl font-bold text-cyan-300">
              {Number.isInteger(result.score) ? result.score : result.score.toFixed(2)}/{result.totalQuestions}
            </p>
            <p className="text-xs text-cyan-400/60">{Math.round(result.pct)}%</p>
          </div>
        </div>
        <p className="text-xs text-white/40 text-center">+{result.xp} XP earned</p>

        <button
          onClick={() => {
            setPhase('setup');
            setItems([]);
            setAnswers({});
            setResult(null);
          }}
          className="w-full p-3 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-sm font-semibold"
        >
          Back to Setup
        </button>
      </div>
    );
  }

  return null;
}

export const MockTest = memo(MockTestInner);
