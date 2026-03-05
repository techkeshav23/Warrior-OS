// ═══════════════════════════════════════════════════════════
// WARRIOR OS — PYQ Browser
// Filter and browse Previous Year GATE Questions
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { GateSubject, Question } from '@/types/gate';
import { getAvailableSubjects, getQuestionsBySubject } from '@/data/gate-questions';

function PYQBrowserInner() {
  const [subject, setSubject] = useState<GateSubject | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const subjects = useMemo(() => getAvailableSubjects(), []);

  const questions = useMemo<Question[]>(() => {
    if (!subject) return [];
    // PYQ = questions with a year field (simulated: all questions as browsable)
    return getQuestionsBySubject(subject);
  }, [subject]);

  return (
    <div className="p-6 space-y-4">
      <h3 className="text-lg font-bold text-white">📚 Previous Year Questions</h3>

      {/* Subject Filter */}
      <div className="flex flex-wrap gap-2">
        {subjects.map((s) => (
          <button
            key={s}
            onClick={() => setSubject(s)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs border transition-all',
              subject === s
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Questions List */}
      {subject && (
        <div className="space-y-2">
          <p className="text-xs text-white/40">
            {questions.length} questions in {subject}
          </p>
          {questions.map((q, i) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="border border-white/10 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                className="w-full p-3 text-left flex items-start gap-2 hover:bg-white/5 transition-all"
              >
                <span className="text-white/30 text-xs mt-0.5">{i + 1}.</span>
                <div className="flex-1">
                  <p className="text-sm text-white/80 leading-relaxed">
                    {q.question}
                  </p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] text-white/30">{q.topic}</span>
                    <span
                      className={cn(
                        'text-[10px]',
                        q.difficulty === 'easy'
                          ? 'text-green-400'
                          : q.difficulty === 'medium'
                          ? 'text-yellow-400'
                          : 'text-red-400'
                      )}
                    >
                      {q.difficulty}
                    </span>
                    <span className="text-[10px] text-white/30">{q.marks}M</span>
                    {q.year && (
                      <span className="text-[10px] text-cyan-400">GATE {q.year}</span>
                    )}
                  </div>
                </div>
                <span className="text-white/30 text-xs">
                  {expandedId === q.id ? '▲' : '▼'}
                </span>
              </button>

              <AnimatePresence>
                {expandedId === q.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/10 bg-white/5 overflow-hidden"
                  >
                    <div className="p-3 space-y-2 text-xs">
                      {q.type === 'mcq' && (
                        <div className="space-y-1">
                          {q.options.map((opt, oi) => (
                            <p
                              key={oi}
                              className={cn(
                                'p-2 rounded',
                                oi === Number(q.answer)
                                  ? 'bg-green-500/20 text-green-300'
                                  : 'text-white/60'
                              )}
                            >
                              {String.fromCharCode(65 + oi)}. {opt}
                              {oi === Number(q.answer) && <span className="ml-2">✓</span>}
                            </p>
                          ))}
                        </div>
                      )}
                      {q.type === 'numerical' && (
                        <p className="text-green-300">
                          Answer: {String(q.answer)}
                        </p>
                      )}
                      <p className="text-white/50 italic mt-2">{q.explanation}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {!subject && (
        <p className="text-sm text-white/40 text-center mt-12">
          Select a subject to browse questions
        </p>
      )}
    </div>
  );
}

export const PYQBrowser = memo(PYQBrowserInner);
