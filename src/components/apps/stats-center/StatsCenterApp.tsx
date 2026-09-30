// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Stats Center App
// The warrior's profile: identity header, then the 3D warrior avatar
// (→ Warrior Hall) beside XP and level, study
// streak, achievements, the activity heatmap and the learning section
// (today's load, deck mastery, trend) — plus the achievement gallery
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronsUp, LayoutDashboard, Trophy, type LucideIcon } from 'lucide-react';
import { AppHeader, Avatar, Badge, SectionHeader, Tabs } from '@/components/ui';
import { OWNER } from '@/config/owner';
import { getVisitorMode } from '@/lib/visitor';
import { useXPStore } from '@/stores/useXPStore';
import { levelTitle } from '@/components/effects/effects-utils';
import { XPSystem } from './XPSystem';
import { WarriorAvatarCard } from './WarriorAvatarCard';
import { StreakBoard } from './StreakBoard';
import { HeatmapCalendar } from './HeatmapCalendar';
import { RadarChart } from './RadarChart';
import { StudyPulse } from './StudyPulse';
import { LearningTrend } from './LearningTrend';
import {
  AchievementGallery,
  AchievementSummaryCard,
  useAchievementCatalogue,
} from './AchievementGallery';
import { computeAchievementStats } from './achievement-data';

type StatsTab = 'overview' | 'achievements';

const TABS: { id: StatsTab; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'achievements', label: 'Achievements', icon: Trophy },
];

function OverviewTab({ onOpenAchievements }: { onOpenAchievements: () => void }) {
  return (
    <div
      role="tabpanel"
      id="stats-center-panel-overview"
      aria-labelledby="stats-center-tab-overview"
      className="@container scrollbar-thin h-full space-y-6 overflow-y-auto p-5"
    >
      {/* Warrior avatar (opens Warrior Hall) + level and XP */}
      <div className="grid grid-cols-1 gap-4 @md:grid-cols-[128px_minmax(0,1fr)] @2xl:grid-cols-[168px_minmax(0,1fr)]">
        <WarriorAvatarCard />
        <XPSystem />
      </div>

      {/* Streak + achievements at a glance */}
      <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
        <StreakBoard />
        <AchievementSummaryCard onOpen={onOpenAchievements} />
      </div>

      {/* Activity heatmap */}
      <HeatmapCalendar />

      {/* Learning: today's load, deck mastery, trend */}
      <section aria-label="Learning" className="space-y-4">
        <SectionHeader
          size="sm"
          as="h3"
          eyebrow="Learning"
          title="Cards and decks"
          description="Review load, mastery and accuracy from Training Grounds."
        />
        <StudyPulse />
        <div className="grid grid-cols-1 gap-4 @5xl:grid-cols-2">
          <RadarChart />
          <LearningTrend />
        </div>
      </section>
    </div>
  );
}

/** Rank plate in the header: a gold-edged cut tag with chevrons and the rank name. */
function RankPlate({ level }: { level: number }) {
  return (
    <span
      className="chamfer-sm flex h-8 items-center gap-2 bg-linear-to-b from-steel-700 to-steel-850 pl-2 pr-3 shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-gold)_45%,transparent),inset_0_-2px_0_color-mix(in_oklab,var(--color-gold)_70%,transparent)]"
      title={`Rank: ${levelTitle(level)} (level ${level})`}
    >
      <ChevronsUp size={16} strokeWidth={2} className="text-gold" aria-hidden />
      <span className="engraved font-display text-xs font-semibold uppercase tracking-[0.14em] text-gold">
        {levelTitle(level)}
      </span>
    </span>
  );
}

function StatsCenterAppInner() {
  const [activeTab, setActiveTab] = useState<StatsTab>('overview');
  const [visitor] = useState(getVisitorMode);
  const level = useXPStore((s) => s.level);
  const catalogue = useAchievementCatalogue();
  const trophies = useMemo(() => computeAchievementStats(catalogue), [catalogue]);

  return (
    <div className="flex h-full flex-col text-fg">
      <AppHeader
        leading={<Avatar name={OWNER.name} size="lg" ring />}
        title={OWNER.name}
        subtitle={
          <>
            Level {level} · {levelTitle(level)} · @{OWNER.handle}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            {visitor === 'guest' && (
              <Badge tone="neutral" variant="outline" size="sm">
                Guest session
              </Badge>
            )}
            <RankPlate level={level} />
          </div>
        }
        tabs={
          <Tabs
            value={activeTab}
            onChange={(id) => setActiveTab(id as StatsTab)}
            idPrefix="stats-center"
            aria-label="Stats Center sections"
            tabs={TABS.map(({ id, label, icon }) => ({
              id,
              label,
              icon,
              badge: id === 'achievements' ? `${trophies.unlocked}/${trophies.total}` : undefined,
            }))}
          />
        }
      />

      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            className="absolute inset-0"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeTab === 'overview' && <OverviewTab onOpenAchievements={() => setActiveTab('achievements')} />}
            {activeTab === 'achievements' && (
              <div
                role="tabpanel"
                id="stats-center-panel-achievements"
                aria-labelledby="stats-center-tab-achievements"
                className="h-full"
              >
                <AchievementGallery />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export const StatsCenterApp = memo(StatsCenterAppInner);
