// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Spaced Repetition
// Track revision dates and show due topics
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useMemo, useCallback, memo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getAvailableSubjects, getTopicsForSubject } from '@/data/gate-questions';
import { recordStudyAction } from '@/components/achievements/study-streak';

interface RevisionEntry {
  subject: string;
  topic: string;
  lastRevised: string; // ISO date
  interval: number; // days until next review
}

function SpacedRepetitionInner() {
  // Persist to localStorage for simplicity (Firestore integration later)
  const [revisions, setRevisions] = useState<RevisionEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem('warrior-revisions') || '[]');
    } catch { return []; }
  });

  const allTopics = useMemo(() => {
    const topics: { subject: string; topic: string }[] = [];
    for (const subject of getAvailableSubjects()) {
      for (const topic of getTopicsForSubject(subject)) {
        topics.push({ subject, topic });
      }
    }
    return topics;
  }, []);

  // `now` ticks once per minute — enough resolution for day-level overdue math
  // and keeps render pure (no Date.now() in useMemo body).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const dueTopics = useMemo(() => {
    return allTopics.map((t) => {
      const rev = revisions.find((r) => r.subject === t.subject && r.topic === t.topic);
      if (!rev) return { ...t, daysOverdue: Infinity, lastRevised: null };
      const nextDue = new Date(rev.lastRevised).getTime() + rev.interval * 86400000;
      const daysOverdue = Math.floor((now - nextDue) / 86400000);
      return { ...t, daysOverdue, lastRevised: rev.lastRevised };
    }).sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [allTopics, revisions, now]);

  const markRevised = useCallback((subject: string, topic: string) => {
    const existing = revisions.find((r) => r.subject === subject && r.topic === topic);
    const newInterval = existing ? Math.min(existing.interval * 2, 30) : 1;
    const entry: RevisionEntry = {
      subject,
      topic,
      lastRevised: new Date().toISOString(),
      interval: newInterval,
    };
    const filtered = revisions.filter((r) => !(r.subject === subject && r.topic === topic));
    const updated = [...filtered, entry];
    setRevisions(updated);
    // Save outside the state updater, so it runs exactly once.
    try {
      localStorage.setItem('warrior-revisions', JSON.stringify(updated));
    } catch {
      /* storage blocked — the list still updates for this session */
    }
    // A revision is study activity for today's streak.
    recordStudyAction();
  }, [revisions]);

  return (
    <div className="p-6 space-y-4">
      <h3 className="text-lg font-bold text-white">🔄 Spaced Repetition</h3>
      <p className="text-xs text-white/50">
        Topics are sorted by urgency. Mark as revised to push the next review further out.
      </p>

      <div className="space-y-2">
        {dueTopics.map((t, i) => (
          <motion.div
            key={`${t.subject}-${t.topic}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.02 }}
            className={cn(
              'flex items-center justify-between p-3 rounded-lg border text-sm',
              t.daysOverdue === Infinity
                ? 'bg-red-500/10 border-red-500/20'
                : t.daysOverdue > 0
                ? 'bg-yellow-500/10 border-yellow-500/20'
                : 'bg-green-500/10 border-green-500/20'
            )}
          >
            <div>
              <p className="text-white/80 font-medium">{t.topic}</p>
              <p className="text-[10px] text-white/40">{t.subject}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn(
                'text-xs',
                t.daysOverdue === Infinity ? 'text-red-300' :
                t.daysOverdue > 0 ? 'text-yellow-300' :
                'text-green-300'
              )}>
                {t.daysOverdue === Infinity
                  ? 'Never revised'
                  : t.daysOverdue > 0
                  ? `${t.daysOverdue}d overdue`
                  : `Due in ${Math.abs(t.daysOverdue)}d`}
              </span>
              <button
                onClick={() => markRevised(t.subject, t.topic)}
                className="px-2 py-1 rounded text-xs bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30"
              >
                ✓ Revised
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export const SpacedRepetition = memo(SpacedRepetitionInner);
