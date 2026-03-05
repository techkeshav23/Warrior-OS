// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Habit Grid (GitHub-style contribution map)
// ═══════════════════════════════════════════════════════════

'use client';

import { useMemo, memo } from 'react';
import { cn } from '@/lib/utils';
import type { Habit } from './HabitForgeApp';

interface Props {
  habits: Habit[];
}

function HabitGridInner({ habits }: Props) {
  // Generate last 90 days grid
  const days = useMemo(() => {
    const result: { date: string; count: number }[] = [];
    const now = new Date();
    for (let i = 89; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = habits.filter((h) => h.completions.includes(dateStr)).length;
      result.push({ date: dateStr, count });
    }
    return result;
  }, [habits]);

  const maxCount = habits.length || 1;

  const getIntensity = (count: number) => {
    if (count === 0) return 'bg-white/5';
    const pct = count / maxCount;
    if (pct >= 0.8) return 'bg-green-400';
    if (pct >= 0.5) return 'bg-green-500/60';
    if (pct >= 0.25) return 'bg-green-600/40';
    return 'bg-green-700/30';
  };

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-white/60">Last 90 Days</h4>
      <div className="flex flex-wrap gap-[3px]">
        {days.map((day) => (
          <div
            key={day.date}
            title={`${day.date}: ${day.count}/${habits.length} habits`}
            className={cn(
              'w-3 h-3 rounded-sm transition-all',
              getIntensity(day.count)
            )}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-white/30">
        <span>Less</span>
        <div className="w-3 h-3 rounded-sm bg-white/5" />
        <div className="w-3 h-3 rounded-sm bg-green-700/30" />
        <div className="w-3 h-3 rounded-sm bg-green-600/40" />
        <div className="w-3 h-3 rounded-sm bg-green-500/60" />
        <div className="w-3 h-3 rounded-sm bg-green-400" />
        <span>More</span>
      </div>
    </div>
  );
}

export const HabitGrid = memo(HabitGridInner);
