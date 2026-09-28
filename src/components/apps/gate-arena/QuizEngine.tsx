// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Quiz Engine
// Subject/topic selection → question by question → results with XP
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useXPStore } from '@/stores/useXPStore';
import { useQuizHistoryStore } from '@/stores/useQuizHistoryStore';
import type { Question, GateSubject } from '@/types/gate';
import {
  getAvailableSubjects,
  getTopicsForSubject,
  getQuestionsBySubject,
  getQuestionsByTopic,
} from '@/data/gate-questions';

type Phase = 'select' | 'quiz' | 'results';

interface QuizState {
  questions: Question[];
  currentIndex: number;
  answers: Record<string, number | string>;
  startTime: number;
  endTime: number | null;
}

function getGrade(pct: number): { grade: string; color: string } {
  if (pct >= 95) return { grade: 'S', color: 'text-yellow-300' };
  if (pct >= 85) return { grade: 'A+', color: 'text-green-300' };
  if (pct >= 75) return { grade: 'A', color: 'text-green-400' };
  if (pct >= 60) return { grade: 'B', color: 'text-cyan-400' };
  if (pct >= 40) return { grade: 'C', color: 'text-orange-400' };
  return { grade: 'D', color: 'text-red-400' };
}

function QuizEngineInner() {
  const [phase, setPhase] = useState<Phase>('select');
  const [selectedSubject, setSelectedSubject] = useState<GateSubject | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const addXP = useXPStore((s) => s.addXP);
  const recordAttempt = useQuizHistoryStore((s) => s.recordAttempt);

  const subjects = useMemo(() => getAvailableSubjects(), []);
  const topics = useMemo(
    () => (selectedSubject ? getTopicsForSubject(selectedSubject) : []),
    [selectedSubject]
  );

  const startQuiz = useCallback(() => {
    if (!selectedSubject) return;
    const pool = selectedTopic
      ? getQuestionsByTopic(selectedSubject, selectedTopic)
      : getQuestionsBySubject(selectedSubject);
    // Shuffle and take up to 15
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 15);
    if (shuffled.length === 0) return;
    setQuiz({
      questions: shuffled,
      currentIndex: 0,
      answers: {},
      startTime: Date.now(),
      endTime: null,
    });
    setPhase('quiz');
  }, [selectedSubject, selectedTopic]);

  const answerQuestion = useCallback(
    (qId: string, answer: number | string) => {
      if (!quiz) return;
      setQuiz((prev) =>
        prev ? { ...prev, answers: { ...prev.answers, [qId]: answer } } : prev
      );
    },
    [quiz]
  );

  const goNext = useCallback(() => {
    if (!quiz) return;
    if (quiz.currentIndex < quiz.questions.length - 1) {
      setQuiz((prev) =>
        prev ? { ...prev, currentIndex: prev.currentIndex + 1 } : prev
      );
    }
  }, [quiz]);

  const goPrev = useCallback(() => {
    if (!quiz) return;
    if (quiz.currentIndex > 0) {
      setQuiz((prev) =>
        prev ? { ...prev, currentIndex: prev.currentIndex - 1 } : prev
      );
    }
  }, [quiz]);

  const submitQuiz = useCallback(() => {
    if (!quiz) return;
    let correct = 0;
    let totalMarks = 0;
    let earnedMarks = 0;
    for (const q of quiz.questions) {
      totalMarks += q.marks;
      const userAns = quiz.answers[q.id];
      if (userAns !== undefined && String(userAns) === String(q.answer)) {
        correct++;
        earnedMarks += q.marks;
      }
    }
    const pct = totalMarks > 0 ? (earnedMarks / totalMarks) * 100 : 0;
    const xp = Math.round(correct * 10 + (pct >= 80 ? 50 : 0));
    addXP(xp, 'gate-quiz');

    // Record attempt(s) so SkillTree / RadarChart / NEXUS see real mastery.
    // If the user filtered by topic, the quiz is single-topic — record one row.
    // Otherwise the questions can span multiple topics within the subject;
    // bucket per-topic so we get topic-level mastery granularity.
    if (selectedSubject) {
      if (selectedTopic) {
        recordAttempt({
          subject: selectedSubject,
          topic: selectedTopic,
          totalQuestions: quiz.questions.length,
          correctAnswers: correct,
        });
      } else {
        const buckets = new Map<string, { total: number; correct: number }>();
        for (const q of quiz.questions) {
          const bucket = buckets.get(q.topic) ?? { total: 0, correct: 0 };
          bucket.total += 1;
          const userAns = quiz.answers[q.id];
          if (userAns !== undefined && String(userAns) === String(q.answer)) {
            bucket.correct += 1;
          }
          buckets.set(q.topic, bucket);
        }
        for (const [topic, { total, correct: c }] of buckets) {
          recordAttempt({
            subject: selectedSubject,
            topic,
            totalQuestions: total,
            correctAnswers: c,
          });
        }
      }
    }

    setQuiz((prev) => (prev ? { ...prev, endTime: Date.now() } : prev));
    setPhase('results');
  }, [quiz, addXP, recordAttempt, selectedSubject, selectedTopic]);

  const resetQuiz = useCallback(() => {
    setPhase('select');
    setQuiz(null);
    setSelectedTopic(null);
  }, []);

  // ─── Subject/Topic Selection ───
  if (phase === 'select') {
    return (
      <div className="p-6 space-y-6">
        <h3 className="text-lg font-bold text-white">Select Subject</h3>
        <div className="grid grid-cols-3 gap-3">
          {subjects.map((s) => (
            <button
              key={s}
              onClick={() => {
                setSelectedSubject(s);
                setSelectedTopic(null);
              }}
              className={cn(
                'p-3 rounded-lg text-sm border transition-all text-left',
                selectedSubject === s
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                  : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {selectedSubject && topics.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white/80">
              Filter by Topic (optional)
            </h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTopic(null)}
                className={cn(
                  'px-3 py-1 rounded text-xs border transition-all',
                  !selectedTopic
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                )}
              >
                All Topics
              </button>
              {topics.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTopic(t)}
                  className={cn(
                    'px-3 py-1 rounded text-xs border transition-all',
                    selectedTopic === t
                      ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedSubject && (
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
    const q = quiz.questions[quiz.currentIndex];
    const userAnswer = quiz.answers[q.id];

    return (
      <div className="p-6 h-full flex flex-col">
        {/* Progress */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-white/50">
            Question {quiz.currentIndex + 1} / {quiz.questions.length}
          </span>
          <span className="text-xs text-white/50">
            {q.subject} • {q.topic}
          </span>
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded',
              q.difficulty === 'easy'
                ? 'bg-green-500/20 text-green-300'
                : q.difficulty === 'medium'
                ? 'bg-yellow-500/20 text-yellow-300'
                : 'bg-red-500/20 text-red-300'
            )}
          >
            {q.difficulty} • {q.marks}M
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-white/10 rounded mb-6">
          <div
            className="h-full bg-cyan-500 rounded transition-all"
            style={{
              width: `${((quiz.currentIndex + 1) / quiz.questions.length) * 100}%`,
            }}
          />
        </div>

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 space-y-4"
          >
            <p className="text-white font-medium text-sm leading-relaxed">{q.question}</p>

            {q.type === 'mcq' && (
              <div className="space-y-2">
                {q.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => answerQuestion(q.id, i)}
                    className={cn(
                      'w-full p-3 rounded-lg text-sm text-left border transition-all',
                      userAnswer === i
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                        : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                    )}
                  >
                    <span className="text-white/40 mr-2">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {q.type === 'numerical' && (
              <input
                type="text"
                placeholder="Enter numerical answer..."
                value={typeof userAnswer === 'string' ? userAnswer : userAnswer !== undefined ? String(userAnswer) : ''}
                onChange={(e) => answerQuestion(q.id, e.target.value)}
                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50"
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
          <button
            onClick={goPrev}
            disabled={quiz.currentIndex === 0}
            className="px-4 py-2 rounded text-sm text-white/60 hover:text-white disabled:opacity-30 disabled:hover:text-white/60"
          >
            ← Prev
          </button>

          <div className="flex gap-1">
            {quiz.questions.map((_, i) => (
              <button
                key={i}
                onClick={() =>
                  setQuiz((prev) => (prev ? { ...prev, currentIndex: i } : prev))
                }
                className={cn(
                  'w-6 h-6 rounded text-[10px] transition-all',
                  i === quiz.currentIndex
                    ? 'bg-cyan-500 text-black'
                    : quiz.answers[quiz.questions[i].id] !== undefined
                    ? 'bg-cyan-500/30 text-cyan-300'
                    : 'bg-white/10 text-white/40'
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {quiz.currentIndex === quiz.questions.length - 1 ? (
            <button
              onClick={submitQuiz}
              className="px-4 py-2 rounded text-sm bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500/30"
            >
              Submit ✓
            </button>
          ) : (
            <button
              onClick={goNext}
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
    let correct = 0;
    let totalMarks = 0;
    let earnedMarks = 0;
    for (const q of quiz.questions) {
      totalMarks += q.marks;
      const userAns = quiz.answers[q.id];
      if (userAns !== undefined && String(userAns) === String(q.answer)) {
        correct++;
        earnedMarks += q.marks;
      }
    }
    const pct = totalMarks > 0 ? (earnedMarks / totalMarks) * 100 : 0;
    const endTime = quiz.endTime ?? quiz.startTime;
    const timeTaken = Math.round((endTime - quiz.startTime) / 1000);
    const { grade, color } = getGrade(pct);

    return (
      <div className="p-6 space-y-6 overflow-y-auto h-full">
        {/* Score Card */}
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={cn('text-6xl font-black', color)}
          >
            {grade}
          </motion.div>
          <p className="text-white text-xl font-bold">
            {earnedMarks} / {totalMarks} marks
          </p>
          <p className="text-white/50 text-sm">
            {correct}/{quiz.questions.length} correct • {Math.round(pct)}% •{' '}
            {Math.floor(timeTaken / 60)}m {timeTaken % 60}s
          </p>
        </div>

        {/* Question Review */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-white/80">Review</h4>
          {quiz.questions.map((q, i) => {
            const userAns = quiz.answers[q.id];
            const isCorrect =
              userAns !== undefined && String(userAns) === String(q.answer);

            return (
              <details
                key={q.id}
                className={cn(
                  'p-3 rounded-lg border text-sm',
                  isCorrect
                    ? 'bg-green-500/10 border-green-500/20'
                    : 'bg-red-500/10 border-red-500/20'
                )}
              >
                <summary className="cursor-pointer text-white/80">
                  <span className="text-white/40 mr-2">Q{i + 1}.</span>
                  {q.question.slice(0, 80)}...
                  <span className={cn('ml-2', isCorrect ? 'text-green-400' : 'text-red-400')}>
                    {isCorrect ? '✓' : '✗'}
                  </span>
                </summary>
                <div className="mt-2 text-xs text-white/60 space-y-1">
                  <p>
                    <strong className="text-white/80">Your answer:</strong>{' '}
                    {userAns !== undefined
                      ? q.type === 'mcq'
                        ? q.options[Number(userAns)]
                        : String(userAns)
                      : 'Not answered'}
                  </p>
                  <p>
                    <strong className="text-green-400">Correct:</strong>{' '}
                    {q.type === 'mcq' ? q.options[Number(q.answer)] : String(q.answer)}
                  </p>
                  <p className="text-white/50 italic">{q.explanation}</p>
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
