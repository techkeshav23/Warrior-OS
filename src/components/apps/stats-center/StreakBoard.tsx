// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Streak Board
// Current streak counter with flame animation
// ═══════════════════════════════════════════════════════════

'use client';

import { useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

function StreakBoardInner() {
  // Compute streak from habit data in localStorage
  const { currentStreak, longestStreak } = useMemo(() => {
    if (typeof window === 'undefined') return { currentStreak: 0, longestStreak: 0 };
    try {
      const habits = JSON.parse(localStorage.getItem('warrior-habits') || '[]');
      if (habits.length === 0) return { currentStreak: 0, longestStreak: 0 };

      // Collect all dates where at least one habit was completed
      const activeDays = new Set<string>();
      for (const h of habits) {
        for (const d of (h.completions || [])) {
          activeDays.add(d);
        }
      }

      // Calculate current streak from today
      let current = 0;
      const now = new Date();
      for (let i = 0; i < 365; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        if (activeDays.has(dateStr)) {
          current++;
        } else {
          if (i === 0) continue; // today might not be completed yet
          break;
        }
      }

      // Calculate longest streak
      const sorted = [...activeDays].sort();
      let longest = 0;
      let run = 0;
      let prev = '';
      for (const d of sorted) {
        if (prev) {
          const diff = (new Date(d).getTime() - new Date(prev).getTime()) / 86400000;
          if (diff === 1) {
            run++;
          } else {
            longest = Math.max(longest, run);
            run = 1;
          }
        } else {
          run = 1;
        }
        prev = d;
      }
      longest = Math.max(longest, run);

      return { currentStreak: current, longestStreak: longest };
    } catch {
      return { currentStreak: 0, longestStreak: 0 };
    }
  }, []);

  return (
    <div className="p-4 rounded-xl border border-orange-500/20 bg-gradient-to-r from-orange-500/10 to-red-500/10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-orange-400/60">Current Streak</p>
          <div className="flex items-baseline gap-2">
            <motion.span
              className="text-4xl font-black text-orange-300"
              key={currentStreak}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
            >
              {currentStreak}
            </motion.span>
            <span className="text-sm text-orange-400/60">days</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/40">Best</p>
          <p className="text-lg font-bold text-white/60">{longestStreak}d</p>
        </div>
        <motion.span
          className="text-4xl"
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          🔥
        </motion.span>
      </div>
      {currentStreak > 0 && (
        <p className="text-[10px] text-orange-400/40 mt-2">
          Keep going! Every day counts.
        </p>
      )}
    </div>
  );
}

export const StreakBoard = memo(StreakBoardInner);
