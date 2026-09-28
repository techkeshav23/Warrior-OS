// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Stats Center App
// XP, level, study streak, deck mastery, learning trend and the
// activity heatmap — the warrior's dashboard — plus the achievement
// gallery
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, Trophy, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { XPSystem } from './XPSystem';
import { LevelProgress } from './LevelProgress';
import { StreakBoard } from './StreakBoard';
import { HeatmapCalendar } from './HeatmapCalendar';
import { RadarChart } from './RadarChart';
import { StudyPulse } from './StudyPulse';
import { LearningTrend } from './LearningTrend';
import { AchievementGallery, AchievementSummaryCard } from './AchievementGallery';

type StatsTab = 'overview' | 'achievements';

const TABS: { id: StatsTab; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'achievements', label: 'Achievements', icon: Trophy },
];

function OverviewTab({ onOpenAchievements }: { onOpenAchievements: () => void }) {
  return (
    <div className="@container h-full space-y-6 overflow-y-auto p-6">
      {/* Top row: XP + Level */}
      <div className="grid grid-cols-2 gap-4">
        <XPSystem />
        <LevelProgress />
      </div>

      {/* Achievements at a glance */}
      <AchievementSummaryCard onOpen={onOpenAchievements} />

      {/* Study streak */}
      <StreakBoard />

      {/* Learning: today's load, deck mastery, trend */}
      <section aria-label="Learning" className="space-y-4">
        <StudyPulse />
        <div className="grid grid-cols-1 gap-4 @5xl:grid-cols-2">
          <RadarChart />
          <LearningTrend />
        </div>
      </section>

      {/* Activity heatmap */}
      <HeatmapCalendar />
    </div>
  );
}

function StatsCenterAppInner() {
  const [activeTab, setActiveTab] = useState<StatsTab>('overview');

  return (
    <div className="flex h-full flex-col bg-black/30">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 py-2.5">
        <h2 className="text-sm font-bold text-white">📊 Stats Center</h2>
        <div className="flex gap-1 rounded-lg bg-white/5 p-0.5" role="tablist" aria-label="Stats Center sections">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1 text-xs transition-colors',
                activeTab === id ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/55 hover:text-white/85'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            className="absolute inset-0"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'overview' && <OverviewTab onOpenAchievements={() => setActiveTab('achievements')} />}
            {activeTab === 'achievements' && <AchievementGallery />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export const StatsCenterApp = memo(StatsCenterAppInner);
