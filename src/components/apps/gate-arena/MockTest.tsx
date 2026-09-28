// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Mock Test
// Full-length timed GATE mock with marking scheme
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect, useMemo, useRef, memo } from 'react';
import { cn } from '@/lib/utils';
import { useXPStore } from '@/stores/useXPStore';
import { dispatchCreatureEvent } from '@/components/creature';
import { recordQuizCompletion } from '@/components/achievements/quiz-achievements';
import type { GateSubject, Question } from '@/types/gate';
import { ALL_QUESTIONS, getAvailableSubjects, getQuestionsBySubject } from '@/data/gate-questions';
import { isAnswerCorrect, isAnswered, type UserAnswer } from './grading';

type Phase = 'setup' | 'test' | 'results';
type SubjectFilter = GateSubject | 'all';

interface MockConfig {
  questionCount: number;
  durationMinutes: number;
  subject: SubjectFilter;
}

interface MockResult {
  totalQuestions: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  earned: number;
  totalMarks: number;
  pct: number;
  xp: number;
}

interface MockTestProps {
  /** Subject to preselect, e.g. from a NEXUS deep link. */
  initialSubject?: GateSubject | null;
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
 * GATE marking: +marks when correct; a wrong MCQ costs a third of its marks
 * (−0.33 / −0.67); no negative marking for numerical answers.
 * `results` lists correctness per question in the order shown.
 */
function scoreMock(
  questions: readonly Question[],
  answers: Record<string, UserAnswer>
): { result: MockResult; results: boolean[] } {
  let totalMarks = 0;
  let earned = 0;
  let correct = 0;
  let incorrect = 0;
  let unattempted = 0;
  const results: boolean[] = [];

  for (const q of questions) {
    totalMarks += q.marks;
    const answer = answers[q.id];
    if (!isAnswered(answer)) {
      unattempted++;
      results.push(false);
      continue;
    }
    const ok = isAnswerCorrect(q, answer);
    results.push(ok);
    if (ok) {
      correct++;
      earned += q.marks;
    } else {
      incorrect++;
      if (q.type === 'mcq') earned -= q.marks === 2 ? 0.67 : 0.33;
    }
  }

  const pct = totalMarks > 0 ? Math.max(0, (earned / totalMarks) * 100) : 0;
  const xp = Math.round(correct * 8 + (pct >= 70 ? 100 : 0));
  return {
    result: { totalQuestions: questions.length, correct, incorrect, unattempted, earned, totalMarks, pct, xp },
    results,
  };
}

function MockTestInner({ initialSubject = null }: MockTestProps) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [config, setConfig] = useState<MockConfig>(() => ({
    questionCount: 30,
    durationMinutes: 60,
    subject: initialSubject ?? 'all',
  }));
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});
  const [marked, setMarked] = useState<Set<string>>(() => new Set());
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [result, setResult] = useState<MockResult | null>(null);
  const finishedRef = useRef(false);
  const addXP = useXPStore((s) => s.addXP);

  const subjects = useMemo(() => getAvailableSubjects(), []);
  const pool = useMemo(
    () => (config.subject === 'all' ? ALL_QUESTIONS : getQuestionsBySubject(config.subject)),
    [config.subject]
  );
  const questionTarget = Math.min(config.questionCount, pool.length);

  // Score once, award XP once, fire achievements once — on manual submit or time-out.
  const finishMock = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const { result: scored, results } = scoreMock(questions, answers);
    const answered = scored.correct + scored.incorrect;
    addXP(scored.xp, 'mock-test');
    recordQuizCompletion({
      kind: 'mock',
      subject: config.subject === 'all' ? null : config.subject,
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
  }, [questions, answers, addXP, config.subject]);

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
    setQuestions(picked);
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
    return (
      <div className="p-6 space-y-6">
        <h3 className="text-lg font-bold text-white">⏱️ Mock Test</h3>
        <p className="text-xs text-white/50">
          Simulated GATE exam with negative marking: +2/−0.67 for 2-mark, +1/−0.33 for 1-mark MCQs. No negative for NAT.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/60 block mb-1">Subject</label>
            <select
              value={config.subject}
              onChange={(e) => setConfig((c) => ({ ...c, subject: e.target.value as SubjectFilter }))}
              className="bg-white/5 border border-white/10 rounded p-2 text-sm text-white w-full"
            >
              <option value="all">All subjects (full GATE mix)</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
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
              <option value={15}>15 (Quick)</option>
              <option value={30}>30 (Half)</option>
              <option value={65}>65 (Full GATE)</option>
            </select>
            {questionTarget < config.questionCount && (
              <p className="text-[11px] text-yellow-300/80 mt-1">
                Only {pool.length} questions are available for {config.subject}; the test will use all {questionTarget}.
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
              <option value={30}>30 min</option>
              <option value={60}>1 hour</option>
              <option value={180}>3 hours (Full)</option>
            </select>
          </div>
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
  if (phase === 'test' && questions.length > 0) {
    const q = questions[currentIndex];
    return (
      <div className="flex flex-col h-full">
        {/* Top bar */}
        <div className="flex items-center justify-between p-3 border-b border-white/10 bg-black/20">
          <span className="text-xs text-white/50">
            Q{currentIndex + 1}/{questions.length}
          </span>
          <span className={cn(
            'text-sm font-mono font-bold',
            timeLeft < 300 ? 'text-red-400 animate-pulse' : 'text-cyan-300'
          )}>
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
            <span>{q.subject}</span>
            <span>•</span>
            <span>{q.topic}</span>
            <span>•</span>
            <span>{q.marks}M</span>
            <button
              onClick={() => setMarked((prev) => {
                const next = new Set(prev);
                if (next.has(q.id)) next.delete(q.id);
                else next.add(q.id);
                return next;
              })}
              className={cn(
                'ml-auto px-2 py-0.5 rounded text-[10px] border',
                marked.has(q.id) ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' : 'border-white/10 text-white/40'
              )}
            >
              {marked.has(q.id) ? '🔖 Marked' : 'Mark'}
            </button>
          </div>

          <p className="text-sm text-white leading-relaxed">{q.question}</p>

          {q.type === 'mcq' && (
            <div className="space-y-2">
              {q.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                  className={cn(
                    'w-full p-3 rounded text-sm text-left border transition-all',
                    answers[q.id] === i
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                  )}
                >
                  {String.fromCharCode(65 + i)}. {opt}
                </button>
              ))}
            </div>
          )}

          {q.type === 'numerical' && (
            <input
              type="text"
              placeholder="Enter numerical answer"
              value={answers[q.id] !== undefined ? String(answers[q.id]) : ''}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              className="w-full p-3 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:border-cyan-500/50"
            />
          )}
        </div>

        {/* Question nav */}
        <div className="p-3 border-t border-white/10 bg-black/20">
          <div className="flex flex-wrap gap-1 mb-3">
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={cn(
                  'w-7 h-7 rounded text-[10px] transition-all',
                  i === currentIndex ? 'bg-cyan-500 text-black font-bold' :
                  marked.has(questions[i].id) ? 'bg-yellow-500/30 text-yellow-300' :
                  isAnswered(answers[questions[i].id]) ? 'bg-green-500/30 text-green-300' :
                  'bg-white/10 text-white/40'
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
              onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))}
              disabled={currentIndex === questions.length - 1}
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
            <p className="text-2xl font-bold text-cyan-300">{result.earned.toFixed(2)}/{result.totalMarks}</p>
            <p className="text-xs text-cyan-400/60">{Math.round(result.pct)}%</p>
          </div>
        </div>
        <p className="text-xs text-white/40 text-center">+{result.xp} XP earned</p>

        <button
          onClick={() => {
            setPhase('setup');
            setQuestions([]);
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
