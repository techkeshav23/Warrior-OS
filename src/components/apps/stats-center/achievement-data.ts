// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Achievement gallery data helpers
// Pure counts and date formatting for the Stats Center gallery
// ═══════════════════════════════════════════════════════════

import { format } from 'date-fns';
import type { Achievement, AchievementCategory } from '@/types/achievement';
import { RARITY_ORDER, type Rarity } from '@/components/effects/effects-utils';

export type CategoryFilter = 'all' | AchievementCategory;
export type StatusFilter = 'all' | 'unlocked' | 'locked';

/** `color` mixed toward transparent: tints, rims and glows from a rarity or token colour. */
export function tint(color: string, percent: number): string {
  return `color-mix(in oklab, ${color} ${percent}%, transparent)`;
}

export interface Tally {
  total: number;
  unlocked: number;
}

export interface AchievementStats {
  total: number;
  unlocked: number;
  earnedXP: number;
  totalXP: number;
  byCategory: Record<CategoryFilter, Tally>;
  byRarity: Record<Rarity, Tally>;
  /** Most recently unlocked achievement, if any. */
  latest: Achievement | null;
}

const emptyTally = (): Tally => ({ total: 0, unlocked: 0 });

export function computeAchievementStats(list: readonly Achievement[]): AchievementStats {
  const byCategory: Record<CategoryFilter, Tally> = {
    all: emptyTally(),
    study: emptyTally(),
    build: emptyTally(),
    streak: emptyTally(),
    exploration: emptyTally(),
    special: emptyTally(),
  };
  const byRarity = {} as Record<Rarity, Tally>;
  for (const r of RARITY_ORDER) byRarity[r] = emptyTally();

  let earnedXP = 0;
  let totalXP = 0;
  let latest: Achievement | null = null;
  for (const a of list) {
    const unlocked = !!a.unlockedAt;
    const category = byCategory[a.category] ?? (byCategory[a.category] = emptyTally());
    const rarity = byRarity[a.rarity] ?? (byRarity[a.rarity] = emptyTally());
    byCategory.all.total += 1;
    category.total += 1;
    rarity.total += 1;
    totalXP += a.xpReward;
    if (unlocked) {
      byCategory.all.unlocked += 1;
      category.unlocked += 1;
      rarity.unlocked += 1;
      earnedXP += a.xpReward;
      if (a.unlockedAt && (!latest || (latest.unlockedAt ?? '') < a.unlockedAt)) latest = a;
    }
  }

  return {
    total: byCategory.all.total,
    unlocked: byCategory.all.unlocked,
    earnedXP,
    totalXP,
    byCategory,
    byRarity,
    latest,
  };
}

export function matchesFilters(a: Achievement, category: CategoryFilter, status: StatusFilter): boolean {
  if (category !== 'all' && a.category !== category) return false;
  if (status === 'unlocked') return !!a.unlockedAt;
  if (status === 'locked') return !a.unlockedAt;
  return true;
}

/** Newest unlocks first. */
export function recentUnlocks(list: readonly Achievement[], count: number): Achievement[] {
  return list
    .filter((a) => !!a.unlockedAt)
    .sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? ''))
    .slice(0, count);
}

export function formatUnlockDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'd MMM yyyy');
}

export function formatUnlockDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, "d MMMM yyyy 'at' h:mm a");
}
