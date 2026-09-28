// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Quiz Engine
// Deck/topic selection → question by question → results with XP
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useXPStore } from '@/stores/useXPStore';
import { useQuizHistoryStore } from '@/stores/useQuizHistoryStore';
import { cardAnswerText, isQuizCard, listCardLocations, useLearningStore } from '@/stores/useLearningStore';
import { recordQuizCompletion } from '@/components/achievements/quiz-achievements';
import type { QuizCard, RecordAttemptInput } from '@/types/learning';
import type { DeckTarget } from './deep-link';
import { describeAnswer, isAnswerCorrect, isAnswered, toggleOption, type UserAnswer } from './grading';

type Phase = 'select' | 'quiz' | 'results';

/** Questions per quiz. */
const QUIZ_LENGTH = 15;

interface QuizItem {
  card: QuizCard;
  topicId: string;
  topicName: string;
}

interface QuizState {
  deckId: string;
  deckName: string;
  items: QuizItem[];
  currentIndex: number;
  answers: Record<string, UserAnswer>;
  startTime: number;
  endTime: number | null;
  xpEarned: number;
}

interface QuizEngineProps {
  /** Deck (and topic) to preselect, e.g. from a NEXUS deep link. */
  initialTarget?: DeckTarget | null;
}

function getGrade(pct: number): { grade: string; color: string } {
  if (pct >= 95) return { grade: 'S', color: 'text-yellow-300' };
  if (pct >= 85) return { grade: 'A+', color: 'text-green-300' };
  if (pct >= 75) return { grade: 'A', color: 'text-green-400' };
  if (pct >= 60) return { grade: 'B', color: 'text-cyan-400' };
  if (pct >= 40) return { grade: 'C', color: 'text-orange-400' };
  return { grade: 'D', color: 'text-red-400' };
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function QuizEngineInner({ initialTarget = null }: QuizEngineProps) {
  const [phase, setPhase] = useState<Phase>('select');
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(initialTarget?.deckId ?? null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(initialTarget?.topicId ?? null);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const addXP = useXPStore((s) => s.addXP);
  const recordSession = useQuizHistoryStore((s) => s.recordAttempt);
  const decks = useLearningStore((s) => s.decks);
  const recordAttempts = useLearningStore((s) => s.recordAttempts);

  // Gradable (non-flashcard) cards per deck and per topic.
  const quizCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const deck of decks) {
      let deckTotal = 0;
      for (const topic of deck.topics) {
        const n = topic.cards.filter(isQuizCard).length;
        counts.set(topic.id, n);
        deckTotal += n;
      }
      counts.set(deck.id, deckTotal);
    }
    return counts;
  }, [decks]);

  const selectedDeck = decks.find((d) => d.id === selectedDeckId);
  const topics = selectedDeck ? selectedDeck.topics.filter((t) => (quizCounts.get(t.id) ?? 0) > 0) : [];
  // A topic without quiz cards (e.g. flashcards only) falls back to the whole deck.
  const activeTopicId = selectedTopicId && topics.some((t) => t.id === selectedTopicId) ? selectedTopicId : null;

  const startQuiz = useCallback(() => {
    const deck = decks.find((d) => d.id === selectedDeckId);
    if (!deck) return;
    const pool: QuizItem[] = [];
    for (const location of listCardLocations([deck], deck.id, activeTopicId ?? undefined)) {
      if (isQuizCard(location.card)) {
        pool.push({ card: location.card, topicId: location.topicId, topicName: location.topicName });
      }
    }
    const items = shuffle(pool).slice(0, QUIZ_LENGTH);
    if (items.length === 0) return;
    setQuiz({
      deckId: deck.id,
      deckName: deck.name,
      items,
      currentIndex: 0,
      answers: {},
      startTime: Date.now(),
      endTime: null,
      xpEarned: 0,
    });
    setPhase('quiz');
  }, [decks, selectedDeckId, activeTopicId]);

  const answerQuestion = useCallback((cardId: string, answer: UserAnswer) => {
    setQuiz((prev) => (prev ? { ...prev, answers: { ...prev.answers, [cardId]: answer } } : prev));
  }, []);

  const goTo = useCallback((index: number) => {
    setQuiz((prev) =>
      prev ? { ...prev, currentIndex: Math.max(0, Math.min(prev.items.length - 1, index)) } : prev
    );
  }, []);

  const submitQuiz = useCallback(() => {
    if (!quiz) return;
    // Per question, in the order shown — drives score, XP and the answer-streak achievement.
    const results = quiz.items.map((item) => isAnswerCorrect(item.card, quiz.answers[item.card.id]));
    const answered = quiz.items.filter((item) => isAnswered(quiz.answers[item.card.id])).length;
    const correct = results.filter(Boolean).length;
    const pct = quiz.items.length > 0 ? (correct / quiz.items.length) * 100 : 0;
    const xp = Math.round(correct * 10 + (pct >= 80 ? 50 : 0));
    addXP(xp, 'quiz');

    // Per-card progress (answered cards only): spaced-repetition schedule + mastery.
    const endTime = Date.now();
    const cardResults: RecordAttemptInput[] = [];
    quiz.items.forEach((item, i) => {
      if (isAnswered(quiz.answers[item.card.id])) {
        cardResults.push({ cardId: item.card.id, correct: results[i], source: 'quiz', at: endTime });
      }
    });
    recordAttempts(cardResults);

    // Session log, one row per topic, so NEXUS / widgets / the creature see the quiz.
    const buckets = new Map<string, { name: string; total: number; correct: number }>();
    quiz.items.forEach((item, i) => {
      const bucket = buckets.get(item.topicId) ?? { name: item.topicName, total: 0, correct: 0 };
      bucket.total += 1;
      if (results[i]) bucket.correct += 1;
      buckets.set(item.topicId, bucket);
    });
    for (const [topicId, bucket] of buckets) {
      recordSession({
        subject: quiz.deckName,
        topic: bucket.name,
        deckId: quiz.deckId,
        topicId,
        totalQuestions: bucket.total,
        correctAnswers: bucket.correct,
      });
    }

    // Achievements (after the history write, which the creature also reacts to):
    // first-quiz, quiz-streak-5, perfect-quiz, all-subjects, quiz-master,
    // night-owl / early-bird, study streak.
    recordQuizCompletion({ kind: 'quiz', deckId: quiz.deckId, results, answered });

    setQuiz((prev) => (prev ? { ...prev, endTime, xpEarned: xp } : prev));
    setPhase('results');
  }, [quiz, addXP, recordAttempts, recordSession]);

  const resetQuiz = useCallback(() => {
    setPhase('select');
    setQuiz(null);
    setSelectedTopicId(null);
  }, []);

  // ─── Deck/Topic Selection ───
  if (phase === 'select') {
    const hasQuizCards = decks.some((d) => (quizCounts.get(d.id) ?? 0) > 0);
    return (
      <div className="p-6 space-y-6">
        <h3 className="text-lg font-bold text-white">Select Deck</h3>
        {!hasQuizCards && (
          <p className="text-sm text-white/40">
            No quiz questions yet. Decks need multiple-choice, multi-select or numeric cards to run a quiz.
          </p>
        )}
        <div className="grid grid-cols-3 gap-3">
          {decks.map((deck) => {
            const count = quizCounts.get(deck.id) ?? 0;
            return (
              <button
                key={deck.id}
                disabled={count === 0}
                onClick={() => {
                  setSelectedDeckId(deck.id);
                  setSelectedTopicId(null);
                }}
                className={cn(
                  'p-3 rounded-lg text-sm border transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed',
                  selectedDeckId === deck.id
                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                    : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                )}
              >
                <span className="mr-1.5">{deck.icon}</span>
                {deck.name}
                <span className="block text-[10px] text-white/40 mt-1">
                  {count} question{count === 1 ? '' : 's'}
                </span>
              </button>
            );
          })}
        </div>

        {selectedDeck && topics.length > 1 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white/80">Filter by Topic (optional)</h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTopicId(null)}
                className={cn(
                  'px-3 py-1 rounded text-xs border transition-all',
                  !activeTopicId
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                )}
              >
                All Topics
              </button>
              {topics.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTopicId(t.id)}
                  className={cn(
                    'px-3 py-1 rounded text-xs border transition-all',
                    activeTopicId === t.id
                      ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                  )}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedDeck && (quizCounts.get(selectedDeck.id) ?? 0) > 0 && (
          <button
            onClick={startQuiz}
            className="px-6 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 transition-all text-sm font-semibold"
          >
            Start Quiz →
          </button>
        )}
      </div>
    );
  }

  // ─── Quiz Phase ───
  if (phase === 'quiz' && quiz) {
    const { card, topicName } = quiz.items[quiz.currentIndex];
    const userAnswer = quiz.answers[card.id];

    return (
      <div className="p-6 h-full flex flex-col">
        {/* Progress */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-white/50">
            Question {quiz.currentIndex + 1} / {quiz.items.length}
          </span>
          <span className="text-xs text-white/50">
            {quiz.deckName} • {topicName}
          </span>
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded',
              card.difficulty === 'easy'
                ? 'bg-green-500/20 text-green-300'
                : card.difficulty === 'medium'
                ? 'bg-yellow-500/20 text-yellow-300'
                : 'bg-red-500/20 text-red-300'
            )}
          >
            {card.difficulty}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-white/10 rounded mb-6">
          <div
            className="h-full bg-cyan-500 rounded transition-all"
            style={{ width: `${((quiz.currentIndex + 1) / quiz.items.length) * 100}%` }}
          />
        </div>

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 space-y-4"
          >
            <p className="text-white font-medium text-sm leading-relaxed whitespace-pre-wrap">{card.prompt}</p>

            {card.kind === 'mcq' && (
              <div className="space-y-2">
                {card.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => answerQuestion(card.id, i)}
                    className={cn(
                      'w-full p-3 rounded-lg text-sm text-left border transition-all',
                      userAnswer === i
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                        : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                    )}
                  >
                    <span className="text-white/40 mr-2">{String.fromCharCode(65 + i)}.</span>
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {card.kind === 'multi-select' && (
              <div className="space-y-2">
                <p className="text-[11px] text-white/40">Pick every correct option.</p>
                {card.options.map((opt, i) => {
                  const picked = Array.isArray(userAnswer) && userAnswer.includes(i);
                  return (
                    <button
                      key={i}
                      onClick={() => answerQuestion(card.id, toggleOption(userAnswer, i))}
                      aria-pressed={picked}
                      className={cn(
                        'w-full p-3 rounded-lg text-sm text-left border transition-all',
                        picked
                          ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      )}
                    >
                      <span className="text-white/40 mr-2">{picked ? '☑' : '☐'}</span>
                      {opt}
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
                  placeholder="Enter a number..."
                  value={typeof userAnswer === 'string' ? userAnswer : ''}
                  onChange={(e) => answerQuestion(card.id, e.target.value)}
                  className="flex-1 p-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50"
                />
                {card.unit && <span className="text-sm text-white/50">{card.unit}</span>}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
          <button
            onClick={() => goTo(quiz.currentIndex - 1)}
            disabled={quiz.currentIndex === 0}
            className="px-4 py-2 rounded text-sm text-white/60 hover:text-white disabled:opacity-30 disabled:hover:text-white/60"
          >
            ← Prev
          </button>

          <div className="flex flex-wrap justify-center gap-1">
            {quiz.items.map((item, i) => (
              <button
                key={item.card.id}
                onClick={() => goTo(i)}
                className={cn(
                  'w-6 h-6 rounded text-[10px] transition-all',
                  i === quiz.currentIndex
                    ? 'bg-cyan-500 text-black'
                    : isAnswered(quiz.answers[item.card.id])
                    ? 'bg-cyan-500/30 text-cyan-300'
                    : 'bg-white/10 text-white/40'
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {quiz.currentIndex === quiz.items.length - 1 ? (
            <button
              onClick={submitQuiz}
              className="px-4 py-2 rounded text-sm bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500/30"
            >
              Submit ✓
            </button>
          ) : (
            <button
              onClick={() => goTo(quiz.currentIndex + 1)}
              className="px-4 py-2 rounded text-sm text-white/60 hover:text-white"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Results ───
  if (phase === 'results' && quiz) {
    const correct = quiz.items.filter((item) => isAnswerCorrect(item.card, quiz.answers[item.card.id])).length;
    const pct = quiz.items.length > 0 ? (correct / quiz.items.length) * 100 : 0;
    const endTime = quiz.endTime ?? quiz.startTime;
    const timeTaken = Math.round((endTime - quiz.startTime) / 1000);
    const { grade, color } = getGrade(pct);

    return (
      <div className="p-6 space-y-6 overflow-y-auto h-full">
        {/* Score Card */}
        <div className="text-center space-y-3">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className={cn('text-6xl font-black', color)}>
            {grade}
          </motion.div>
          <p className="text-white text-xl font-bold">
            {correct} / {quiz.items.length} correct
          </p>
          <p className="text-white/50 text-sm">
            {quiz.deckName} • {Math.round(pct)}% • {Math.floor(timeTaken / 60)}m {timeTaken % 60}s
          </p>
          <p className="text-xs font-semibold text-cyan-300">+{quiz.xpEarned} XP earned</p>
        </div>

        {/* Question Review */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-white/80">Review</h4>
          {quiz.items.map(({ card }, i) => {
            const userAns = quiz.answers[card.id];
            const isCorrect = isAnswerCorrect(card, userAns);
            return (
              <details
                key={card.id}
                className={cn(
                  'p-3 rounded-lg border text-sm',
                  isCorrect ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'
                )}
              >
                <summary className="cursor-pointer text-white/80">
                  <span className="text-white/40 mr-2">Q{i + 1}.</span>
                  {card.prompt.length > 80 ? `${card.prompt.slice(0, 80)}…` : card.prompt}
                  <span className={cn('ml-2', isCorrect ? 'text-green-400' : 'text-red-400')}>
                    {isCorrect ? '✓' : '✗'}
                  </span>
                </summary>
                <div className="mt-2 text-xs text-white/60 space-y-1">
                  <p>
                    <strong className="text-white/80">Your answer:</strong> {describeAnswer(card, userAns)}
                  </p>
                  <p>
                    <strong className="text-green-400">Correct:</strong> {cardAnswerText(card)}
                  </p>
                  {card.explanation && <p className="text-white/50 italic">{card.explanation}</p>}
                </div>
              </details>
            );
          })}
        </div>

        <button
          onClick={resetQuiz}
          className="w-full p-3 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 text-sm font-semibold"
        >
          Take Another Quiz
        </button>
      </div>
    );
  }

  return null;
}

export const QuizEngine = memo(QuizEngineInner);
