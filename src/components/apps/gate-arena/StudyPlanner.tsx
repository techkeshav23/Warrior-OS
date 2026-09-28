// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Study Planner
// Auto-generate daily study plan based on exam date
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useMemo, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getAvailableSubjects } from '@/data/gate-questions';
import { recordStudyAction } from '@/components/achievements/study-streak';

interface PlanDay {
  date: string;
  subjects: string[];
}

/** The exam date is remembered so the plan is there whenever the planner opens. */
const EXAM_DATE_KEY = 'warrior-exam-date';

function readExamDate(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(EXAM_DATE_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * Plan from today to the exam (max 60 days), 2-3 subjects a day in rotation.
 * Days are UTC keys, like the "today" marker and every other day key in the OS.
 */
function buildPlan(examDate: string, subjects: readonly string[]): PlanDay[] {
  if (!examDate || subjects.length === 0) return [];
  const startMs = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const examMs = Date.parse(`${examDate}T00:00:00Z`);
  if (Number.isNaN(examMs)) return [];
  const daysLeft = Math.max(1, Math.ceil((examMs - startMs) / 86400000));

  const days: PlanDay[] = [];
  for (let d = 0; d < Math.min(daysLeft, 60); d++) {
    // Distribute subjects evenly: 2-3 subjects per day
    const subjectsPerDay = 2 + (d % 2);
    const daySubjects: string[] = [];
    for (let s = 0; s < subjectsPerDay; s++) {
      daySubjects.push(subjects[(d * subjectsPerDay + s) % subjects.length]);
    }
    days.push({
      date: new Date(startMs + d * 86400000).toISOString().slice(0, 10),
      subjects: daySubjects,
    });
  }
  return days;
}

function StudyPlannerInner() {
  const [examDate, setExamDate] = useState(readExamDate);
  const [plan, setPlan] = useState<PlanDay[]>(() => buildPlan(readExamDate(), getAvailableSubjects()));
  const [completed, setCompleted] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem('warrior-plan-done') || '[]'));
    } catch { return new Set(); }
  });

  const subjects = useMemo(() => getAvailableSubjects(), []);

  const generatePlan = useCallback(() => {
    if (!examDate) return;
    setPlan(buildPlan(examDate, subjects));
    try {
      localStorage.setItem(EXAM_DATE_KEY, examDate);
    } catch {
      /* storage blocked — the plan still shows for this session */
    }
  }, [examDate, subjects]);

  const toggleDone = useCallback((key: string) => {
    const next = new Set(completed);
    const nowDone = !next.has(key);
    if (nowDone) next.add(key);
    else next.delete(key);
    setCompleted(next);
    // Save outside the state updater, so it runs exactly once.
    try {
      localStorage.setItem('warrior-plan-done', JSON.stringify([...next]));
    } catch {
      /* storage blocked — the plan still updates for this session */
    }
    // Finishing a planned subject is study activity for today's streak.
    if (nowDone) recordStudyAction();
  }, [completed]);

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="p-6 space-y-4">
      <h3 className="text-lg font-bold text-white">📋 Study Planner</h3>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="text-xs text-white/60 block mb-1">GATE Exam Date</label>
          <input
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            className="w-full p-2 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <button
          onClick={generatePlan}
          disabled={!examDate}
          className="px-4 py-2 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-sm disabled:opacity-30"
        >
          Generate Plan
        </button>
      </div>

      {plan.length > 0 && (
        <div className="space-y-2">
          {plan.map((day, i) => {
            const isToday = day.date === today;
            return (
              <motion.div
                key={day.date}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className={cn(
                  'p-3 rounded-lg border',
                  isToday
                    ? 'bg-cyan-500/10 border-cyan-500/30'
                    : 'bg-white/5 border-white/10'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn('text-xs font-mono', isToday ? 'text-cyan-300' : 'text-white/50')}>
                    {day.date} {isToday && '← TODAY'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {day.subjects.map((subject) => {
                    const key = `${day.date}-${subject}`;
                    const done = completed.has(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleDone(key)}
                        className={cn(
                          'px-3 py-1 rounded text-xs border transition-all',
                          done
                            ? 'bg-green-500/20 border-green-500/40 text-green-300 line-through'
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                        )}
                      >
                        {done ? '✓' : '○'} {subject}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {plan.length === 0 && (
        <p className="text-sm text-white/40 text-center mt-12">
          Set your exam date to generate a personalized study plan
        </p>
      )}
    </div>
  );
}

export const StudyPlanner = memo(StudyPlannerInner);
