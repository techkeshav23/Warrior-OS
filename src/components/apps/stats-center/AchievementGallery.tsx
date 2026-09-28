// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Achievement Gallery
// Every achievement in the catalogue as a badge grid: unlocked ones
// in their rarity colours with the unlock date, locked ones greyed
// with a padlock, hidden locked ones as "???". Category + status
// filters, a completion count and XP total, click a badge for its
// details. Opening the gallery unlocks the "trophy-room" badge.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  ChevronRight,
  Compass,
  Flame,
  Hammer,
  Sparkles,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { useXPStore } from '@/stores/useXPStore';
import type { Achievement } from '@/types/achievement';
import { GALLERY_ACHIEVEMENT_ID, mergeAchievements } from '@/components/effects/achievement-sync';
import { RARITY_ORDER, RARITY_STYLE, withAlpha } from '@/components/effects/effects-utils';
import { cn } from '@/lib/utils';
import { AchievementBadge } from './AchievementBadge';
import { AchievementDetail } from './AchievementDetail';
import {
  computeAchievementStats,
  formatUnlockDate,
  matchesFilters,
  recentUnlocks,
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

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unlocked', label: 'Unlocked' },
  { id: 'locked', label: 'Locked' },
];

/** The full catalogue with this warrior's unlock dates (read-only view of the XP store). */
export function useAchievementCatalogue(): Achievement[] {
  const saved = useXPStore((s) => s.achievements);
  return useMemo(() => mergeAchievements(saved), [saved]);
}

// ─── Pieces ───

function GallerySummary({ stats }: { stats: AchievementStats }) {
  const pct = stats.total > 0 ? Math.round((stats.unlocked / stats.total) * 100) : 0;
  return (
    <section className="rounded-xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-transparent to-purple-500/10 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-amber-200/70">Achievements unlocked</p>
          <p className="text-3xl font-black text-amber-100">
            {stats.unlocked}
            <span className="text-base font-bold text-white/45"> / {stats.total}</span>
            <span className="ml-2 text-sm font-semibold text-amber-200/70">{pct}%</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/50">XP from achievements</p>
          <p className="font-mono text-sm text-white/85">
            {stats.earnedXP.toLocaleString()} / {stats.totalXP.toLocaleString()}
          </p>
        </div>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-label="Achievement completion"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-purple-500"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        {RARITY_ORDER.map((r) => (
          <span key={r} className="flex items-center gap-1.5 text-[10px] text-white/60">
            <span className="h-2 w-2 rounded-full" style={{ background: RARITY_STYLE[r].color }} />
            {RARITY_STYLE[r].label} {stats.byRarity[r].unlocked}/{stats.byRarity[r].total}
          </span>
        ))}
      </div>
      {stats.latest?.unlockedAt && (
        <p className="mt-2 truncate text-[11px] text-white/55">
          Latest: {stats.latest.icon} {stats.latest.title} · {formatUnlockDate(stats.latest.unlockedAt)}
        </p>
      )}
    </section>
  );
}

interface TileProps {
  achievement: Achievement;
  index: number;
  onOpen: (id: string) => void;
}

function AchievementTile({ achievement, index, onOpen }: TileProps) {
  const unlocked = !!achievement.unlockedAt;
  const secret = !unlocked && !!achievement.hidden;
  const rarity = RARITY_STYLE[achievement.rarity];
  const label = secret
    ? 'Hidden achievement, locked'
    : `${achievement.title}, ${rarity.label}, ${unlocked ? 'unlocked' : 'locked'}`;

  return (
    <motion.button
      type="button"
      onClick={() => onOpen(achievement.id)}
      aria-label={label}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 30) * 0.015, duration: 0.2 }}
      className={cn(
        'group flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60',
        unlocked ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-white/5 bg-black/25 hover:bg-white/5'
      )}
      style={
        unlocked
          ? { borderColor: withAlpha(rarity.color, 0.32), boxShadow: `inset 0 0 18px ${withAlpha(rarity.color, 0.08)}` }
          : undefined
      }
    >
      <AchievementBadge
        achievement={achievement}
        size={46}
        className="transition-transform duration-200 group-hover:scale-110"
      />
      <span
        className={cn(
          'line-clamp-2 text-[11px] font-semibold leading-tight',
          unlocked ? 'text-white/90' : 'text-white/45'
        )}
      >
        {secret ? '???' : achievement.title}
      </span>
      <span
        className="text-[9px] font-medium uppercase tracking-wider"
        style={{ color: unlocked ? rarity.color : 'rgba(255, 255, 255, 0.4)' }}
      >
        {unlocked && achievement.unlockedAt ? formatUnlockDate(achievement.unlockedAt) : secret ? 'Hidden' : 'Locked'}
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
      <div className="h-full space-y-4 overflow-y-auto p-5">
        <GallerySummary stats={stats} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter achievements by category">
            {CATEGORY_FILTERS.map(({ id, label, icon: Icon }) => {
              const counts = stats.byCategory[id];
              const active = category === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategory(id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] transition-colors',
                    active
                      ? 'border-cyan-500/40 bg-cyan-500/20 text-cyan-300'
                      : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                  <span className="font-mono text-[10px] opacity-70">
                    {counts.unlocked}/{counts.total}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex rounded-lg border border-white/10 bg-black/20 p-0.5" role="group" aria-label="Filter by status">
            {STATUS_FILTERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={status === id}
                onClick={() => setStatus(id)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[11px] transition-colors',
                  status === id ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 py-12 text-center">
            <Trophy className="h-8 w-8 text-white/25" />
            <p className="text-sm text-white/55">
              {status === 'unlocked' ? 'Nothing unlocked in this category yet.' : 'No achievements match this filter.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2.5">
            {visible.map((a, i) => (
              <AchievementTile key={a.id} achievement={a} index={i} onOpen={setSelectedId} />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            key="achievement-detail"
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setSelectedId(null)}
          >
            <AchievementDetail
              achievement={selected}
              index={selectedIndex}
              total={visible.length}
              onClose={() => setSelectedId(null)}
              onPrev={() => step(-1)}
              onNext={() => step(1)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const AchievementGallery = memo(AchievementGalleryInner);

// ─── Overview card ───

function AchievementSummaryCardInner({ onOpen }: { onOpen: () => void }) {
  const all = useAchievementCatalogue();
  const stats = useMemo(() => computeAchievementStats(all), [all]);
  const recent = useMemo(() => recentUnlocks(all, 5), [all]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-xl border border-amber-400/20 bg-gradient-to-r from-amber-500/10 to-purple-500/10 p-4 text-left transition-colors hover:border-amber-400/40"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-amber-200/70">Achievements</p>
          <p className="text-2xl font-black text-amber-100">
            {stats.unlocked}
            <span className="text-sm font-bold text-white/45"> / {stats.total}</span>
          </p>
        </div>
        {recent.length > 0 ? (
          <div className="flex -space-x-2">
            {recent.map((a) => (
              <AchievementBadge key={a.id} achievement={a} size={30} />
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-white/50">No badges yet</p>
        )}
        <span className="flex shrink-0 items-center gap-1 text-xs text-amber-200/80">
          Gallery <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
}

export const AchievementSummaryCard = memo(AchievementSummaryCardInner);
