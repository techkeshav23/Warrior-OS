// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Routine Checklist
// Daily set of tasks organized by time-of-day categories
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { RoutineItem } from './HabitForgeApp';

interface Props {
  routines: RoutineItem[];
}

function RoutineChecklistInner({ routines }: Props) {
  const today = new Date().toISOString().split('T')[0];

  const [completed, setCompleted] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const data = JSON.parse(localStorage.getItem('warrior-routine-done') || '{}');
      return new Set(data[today] || []);
    } catch { return new Set(); }
  });

  const toggle = useCallback((id: string) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Save
      const allData = JSON.parse(localStorage.getItem('warrior-routine-done') || '{}');
      allData[today] = [...next];
      localStorage.setItem('warrior-routine-done', JSON.stringify(allData));
      return next;
    });
  }, [today]);

  const categories: { key: RoutineItem['category']; label: string; icon: string }[] = [
    { key: 'morning', label: 'Morning', icon: '🌅' },
    { key: 'study', label: 'Study', icon: '📚' },
    { key: 'night', label: 'Night', icon: '🌙' },
  ];

  const doneCount = completed.size;
  const totalCount = routines.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Today&apos;s Routine</h3>
          <span className="text-xs text-white/50">{doneCount}/{totalCount} ({pct}%)</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-orange-400 rounded-full"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {categories.map((cat) => {
        const items = routines.filter((r) => r.category === cat.key);
        if (items.length === 0) return null;
        return (
          <div key={cat.key} className="space-y-2">
            <h4 className="text-xs font-semibold text-white/60">
              {cat.icon} {cat.label}
            </h4>
            {items.map((item, i) => {
              const done = completed.has(item.id);
              return (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => toggle(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all',
                    done
                      ? 'bg-green-500/10 border-green-500/20'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  )}
                >
                  <span className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] flex-shrink-0',
                    done ? 'border-green-400 bg-green-400 text-black' : 'border-white/30'
                  )}>
                    {done ? '✓' : ''}
                  </span>
                  <div className="flex-1">
                    <p className={cn(
                      'text-sm',
                      done ? 'text-green-300 line-through' : 'text-white/80'
                    )}>
                      {item.text}
                    </p>
                  </div>
                  <span className="text-[10px] text-white/30">{item.time}</span>
                </motion.button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export const RoutineChecklist = memo(RoutineChecklistInner);
