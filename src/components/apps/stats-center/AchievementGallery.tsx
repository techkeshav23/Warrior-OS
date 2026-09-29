// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Achievement Gallery
// Every achievement in the catalogue as a medallion grid: unlocked ones
// in their rarity colours with the unlock date, locked ones cold with a
// padlock, hidden locked ones as "???". Category + status filters, a
// completion count and XP total, click a badge for its details.
// Opening the gallery unlocks the "trophy-room" badge.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  ChevronRight,
  Compass,
  Flame,
  Hammer,
  Sparkles,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useXPStore } from '@/stores/useXPStore';
import type { Achievement } from '@/types/achievement';
import { GALLERY_ACHIEVEMENT_ID, mergeAchievements } from '@/components/effects/achievement-sync';
import { RARITY_ORDER, RARITY_STYLE } from '@/components/effects/effects-utils';
import { cn } from '@/lib/utils';
import { Button, Card, EmptyState, ProgressBar, SegmentedControl, Tabs } from '@/components/ui';
import { AchievementBadge } from './AchievementBadge';
import { AchievementDetail } from './AchievementDetail';
import {
  computeAchievementStats,
  formatUnlockDate,
  matchesFilters,
  recentUnlocks,
  tint,
  type AchievementStats,
  type CategoryFilter,
  type StatusFilter,
} from './achievement-data';

const CATEGORY_FILTERS: { id: CategoryFilter; label: string; icon: LucideIcon }[] = [
  { id: 'all', label: 'All', icon: Trophy },
  { id: 'study', label: 'Study', icon: BookOpen },
  { id: 'build', label: 'Build', icon: Hammer },
  { id: 'streak', label: 'Streak', icon: Flame },
  { id: 'exploration', label: 'Exploration', icon: Compass },
  { id: 'special', label: 'Special', icon: Sparkles },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unlocked', label: 'Unlocked' },
  { value: 'locked', label: 'Locked' },
];

/** Gold frame for the trophy cards (XP / rewards are gold). */
const GOLD_EDGE: CSSProperties = { borderColor: 'color-mix(in oklab, var(--color-gold) 24%, transparent)' };

/** The full catalogue with this warrior's unlock dates (read-only view of the XP store). */
export function useAchievementCatalogue(): Achievement[] {
  const saved = useXPStore((s) => s.achievements);
  return useMemo(() => mergeAchievements(saved), [saved]);
}

// ─── Pieces ───

function TrophyTile({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'chamfer flex shrink-0 items-center justify-center bg-[radial-gradient(circle_at_50%_30%,color-mix(in_oklab,var(--color-gold)_32%,var(--color-steel-800)),var(--color-steel-900)_85%)] text-gold shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-gold)_55%,transparent),inset_0_-1px_0_rgb(0_0_0/0.6)] [--cut:10px]',
        size === 'sm' ? 'size-10' : 'size-11'
      )}
    >
      <Trophy size={size === 'sm' ? 18 : 20} strokeWidth={1.75} />
    </span>
  );
}

function GoldWash() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-gold/[0.06] to-transparent to-60%"
    />
  );
}

function GallerySummary({ stats }: { stats: AchievementStats }) {
  const pct = stats.total > 0 ? Math.round((stats.unlocked / stats.total) * 100) : 0;
  return (
    <Card padding="md" style={GOLD_EDGE} role="region" aria-label="Achievement summary">
      <GoldWash />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <TrophyTile />
          <div className="min-w-0">
            <p className="engraved font-display text-2xs font-semibold uppercase tracking-[0.18em] text-gold">Trophy room</p>
            <p className="mt-1.5 flex items-baseline gap-1.5 leading-none">
              <span className="tabular font-display text-3xl font-semibold text-fg">{stats.unlocked}</span>
              <span className="tabular font-mono text-sm text-fg-subtle">/ {stats.total}</span>
              <span className="tabular ml-1.5 font-mono text-xs text-gold">{pct}%</span>
            </p>
          </div>
        </div>
        <div className="ml-auto text-right">
          <p className="hud-label">XP from achievements</p>
          <p className="tabular mt-1 font-mono text-ui text-fg">
            {stats.earnedXP.toLocaleString()}
            <span className="text-fg-subtle"> / {stats.totalXP.toLocaleString()}</span>
          </p>
        </div>
      </div>

      <ProgressBar className="mt-3.5" value={pct} tone="gold" size="md" aria-label="Achievement completion" />

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {RARITY_ORDER.map((r) => (
          <span key={r} className="flex items-center gap-1.5 text-xs text-fg-muted">
            <span className="size-2 rotate-45 scale-[0.85]" style={{ background: RARITY_STYLE[r].color }} />
            {RARITY_STYLE[r].label}
            <span className="tabular font-mono text-fg-subtle">
              {stats.byRarity[r].unlocked}/{stats.byRarity[r].total}
            </span>
          </span>
        ))}
      </div>

    </Card>
  );
}

interface TileProps {
  achievement: Achievement;
  index: number;
  onOpen: (id: string) => void;
}

function AchievementTile({ achievement, index, onOpen }: TileProps) {
  const reduceMotion = useReducedMotion();
  const unlocked = !!achievement.unlockedAt;
  const secret = !unlocked && !!achievement.hidden;
  const rarity = RARITY_STYLE[achievement.rarity] ?? RARITY_STYLE.common;
  const label = secret
    ? 'Hidden achievement, locked'
    : `${achievement.title}, ${rarity.label}, ${unlocked ? 'unlocked' : 'locked'}`;

  return (
    <motion.button
      type="button"
      onClick={() => onOpen(achievement.id)}
      aria-label={label}
      title={secret ? 'Hidden achievement' : achievement.title}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 30) * 0.012, duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'armor-panel chamfer-md focus-ring group relative isolate flex min-h-[132px] flex-col items-center gap-2 overflow-hidden px-2.5 pb-3 pt-3.5 text-center',
        'transition-[filter,border-color] duration-120 ease-out-quint hover:brightness-120',
        !unlocked && 'bg-steel-900/70'
      )}
      style={unlocked ? { borderColor: tint(rarity.color, 30) } : undefined}
    >
      {unlocked && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-16"
          style={{ background: `linear-gradient(to bottom, ${tint(rarity.color, 12)}, transparent)` }}
        />
      )}
      <AchievementBadge
        achievement={achievement}
        size={48}
        className="transition-transform duration-180 ease-out-quint group-hover:-translate-y-0.5 group-hover:scale-105"
      />
      <span
        className={cn(
          'line-clamp-2 text-xs font-medium leading-4',
          unlocked ? 'text-fg' : 'text-fg-muted'
        )}
      >
        {secret ? '???' : achievement.title}
      </span>
      <span
        className={cn(
          'mt-auto font-mono text-[10px] font-medium uppercase tracking-[0.1em]',
          !unlocked && 'text-fg-subtle'
        )}
        style={unlocked ? { color: rarity.color } : undefined}
      >
        {unlocked && achievement.unlockedAt ? formatUnlockDate(achievement.unlockedAt) : secret ? 'Hidden' : rarity.label}
      </span>
    </motion.button>
  );
}

// ─── Gallery ───

function AchievementGalleryInner() {
  const all = useAchievementCatalogue();
  const stats = useMemo(() => computeAchievementStats(all), [all]);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Opening the trophy room is itself an achievement (idempotent).
  useEffect(() => {
    useXPStore.getState().unlockAchievement(GALLERY_ACHIEVEMENT_ID);
  }, []);

  const visible = useMemo(
    () => all.filter((a) => matchesFilters(a, category, status)),
    [all, category, status]
  );
  const selectedIndex = selectedId ? visible.findIndex((a) => a.id === selectedId) : -1;
  const selected = selectedIndex >= 0 ? visible[selectedIndex] : null;

  const step = (direction: 1 | -1) => {
    if (selectedIndex < 0 || visible.length === 0) return;
    const next = (selectedIndex + direction + visible.length) % visible.length;
    setSelectedId(visible[next].id);
  };

  return (
    <div className="relative h-full">
      <div className="@container scrollbar-thin h-full space-y-5 overflow-y-auto p-5">
        <GallerySummary stats={stats} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Tabs
              className="flex-wrap"
              variant="pill"
              size="sm"
              value={category}
              onChange={(id) => setCategory(id as CategoryFilter)}
              aria-label="Filter achievements by category"
              tabs={CATEGORY_FILTERS.map(({ id, label, icon }) => ({
                id,
                label,
                icon,
                badge: `${stats.byCategory[id].unlocked}/${stats.byCategory[id].total}`,
              }))}
            />
          </div>
          <SegmentedControl
            size="sm"
            value={status}
            onChange={setStatus}
            options={STATUS_FILTERS}
            aria-label="Filter by status"
          />
        </div>

        {visible.length === 0 ? (
          <div className="chamfer-md bg-linear-to-b from-steel-950 to-steel-900 shadow-[inset_0_1px_0_rgb(0_0_0/0.7),inset_0_2px_6px_rgb(0_0_0/0.45),inset_0_-1px_0_rgb(255_255_255/0.07)]">
            <EmptyState
              icon={Trophy}
              title={status === 'unlocked' ? 'Nothing unlocked here yet' : 'No achievements match'}
              description={
                status === 'unlocked'
                  ? 'Keep training, building and exploring. Badges in this category land here.'
                  : 'Try another category or status filter.'
              }
              actions={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setCategory('all');
                    setStatus('all');
                  }}
                >
                  Show all
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2.5">
            {visible.map((a, i) => (
              <AchievementTile key={a.id} achievement={a} index={i} onOpen={setSelectedId} />
            ))}
          </div>
        )}
      </div>

      <AchievementDetail
        achievement={selected}
        index={selectedIndex}
        total={visible.length}
        onClose={() => setSelectedId(null)}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
      />
    </div>
  );
}

export const AchievementGallery = memo(AchievementGalleryInner);

// ─── Overview card ───

function AchievementSummaryCardInner({ onOpen }: { onOpen: () => void }) {
  const all = useAchievementCatalogue();
  const stats = useMemo(() => computeAchievementStats(all), [all]);
  const recent = useMemo(() => recentUnlocks(all, 5), [all]);
  const pct = stats.total > 0 ? Math.round((stats.unlocked / stats.total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Achievements: ${stats.unlocked} of ${stats.total} unlocked. Open the gallery`}
      className={cn(
        'armor-panel chamfer-md focus-ring group relative isolate flex h-full w-full min-w-0 flex-col p-4 text-left',
        'transition-[filter] duration-180 ease-out-quint hover:brightness-115'
      )}
      style={GOLD_EDGE}
    >
      <GoldWash />
      <div className="flex w-full items-start gap-3.5">
        <TrophyTile />
        <div className="min-w-0 flex-1">
          <p className="engraved font-display text-2xs font-semibold uppercase tracking-[0.18em] text-gold">Achievements</p>
          <p className="mt-1.5 flex items-baseline gap-1.5 leading-none">
            <span className="tabular font-display text-3xl font-semibold text-fg">{stats.unlocked}</span>
            <span className="tabular font-mono text-sm text-fg-subtle">/ {stats.total}</span>
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-fg-muted transition-colors duration-120 group-hover:text-fg">
          Gallery
          <ChevronRight size={14} strokeWidth={1.75} className="transition-transform duration-180 ease-out-quint group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>

      <ProgressBar className="mt-4" value={pct} tone="gold" size="sm" animated={false} aria-label="Achievement completion" />

      <div className="mt-3 flex min-h-8 items-center gap-3">
        {recent.length > 0 ? (
          <>
            <div className="flex -space-x-1.5">
              {recent.map((a) => (
                <AchievementBadge key={a.id} achievement={a} size={30} />
              ))}
            </div>
            <span className="flex min-w-0 items-center gap-1 truncate text-xs text-fg-subtle">
              <Zap size={12} strokeWidth={2} className="shrink-0 text-gold" aria-hidden />
              <span className="tabular font-mono">{stats.earnedXP.toLocaleString()}</span> XP earned
            </span>
          </>
        ) : (
          <p className="text-xs text-fg-subtle">No badges yet. Your first one is closer than you think.</p>
        )}
      </div>
    </button>
  );
}

export const AchievementSummaryCard = memo(AchievementSummaryCardInner);
