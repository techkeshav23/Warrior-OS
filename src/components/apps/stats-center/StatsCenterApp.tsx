// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Stats Center App
// XP, Level, Streak, Study heatmap — the warrior's dashboard
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { useXPStore } from '@/stores/useXPStore';
import { XPSystem } from './XPSystem';
import { LevelProgress } from './LevelProgress';
import { StreakBoard } from './StreakBoard';
import { HeatmapCalendar } from './HeatmapCalendar';
import { RadarChart } from './RadarChart';

function StatsCenterAppInner() {
  const { xp, level } = useXPStore();

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 bg-black/30">
      <h2 className="text-lg font-bold text-white">📊 Stats Center</h2>

      {/* Top row: XP + Level */}
      <div className="grid grid-cols-2 gap-4">
        <XPSystem />
        <LevelProgress />
      </div>

      {/* Streak */}
      <StreakBoard />

      {/* Radar + Heatmap */}
      <div className="grid grid-cols-2 gap-4">
        <RadarChart />
        <HeatmapCalendar />
      </div>
    </div>
  );
}

export const StatsCenterApp = memo(StatsCenterAppInner);
