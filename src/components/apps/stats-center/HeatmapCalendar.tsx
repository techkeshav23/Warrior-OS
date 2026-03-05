// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Heatmap Calendar
// GitHub-style 365-day activity heatmap
// ═══════════════════════════════════════════════════════════

'use client';

import { useMemo, memo } from 'react';
import { cn } from '@/lib/utils';

function HeatmapCalendarInner() {
  const days = useMemo(() => {
    if (typeof window === 'undefined') return [];
    try {
      const habits = JSON.parse(localStorage.getItem('warrior-habits') || '[]');
      const activityMap = new Map<string, number>();
      for (const h of habits) {
        for (const d of (h.completions || [])) {
          activityMap.set(d, (activityMap.get(d) || 0) + 1);
        }
      }

      const result: { date: string; count: number }[] = [];
      const now = new Date();
      for (let i = 179; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        result.push({ date: dateStr, count: activityMap.get(dateStr) || 0 });
      }
      return result;
    } catch { return []; }
  }, []);

  const getColor = (count: number) => {
    if (count === 0) return 'bg-white/5';
    if (count >= 6) return 'bg-cyan-400';
    if (count >= 4) return 'bg-cyan-500/70';
    if (count >= 2) return 'bg-cyan-600/50';
    return 'bg-cyan-700/35';
  };

  return (
    <div className="p-4 rounded-xl border border-white/10 bg-black/20">
      <p className="text-xs text-white/60 mb-3">Activity (180 days)</p>
      <div className="flex flex-wrap gap-[2px]">
        {days.map((day) => (
          <div
            key={day.date}
            title={`${day.date}: ${day.count} activities`}
            className={cn('w-2.5 h-2.5 rounded-[2px]', getColor(day.count))}
          />
        ))}
      </div>
    </div>
  );
}

export const HeatmapCalendar = memo(HeatmapCalendarInner);
