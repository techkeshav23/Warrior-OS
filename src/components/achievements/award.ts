// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Achievement Award Helpers
// Seeds useXPStore.achievements from the ACHIEVEMENTS catalogue
// (keeping every saved unlock) and unlocks achievements idempotently
// ═══════════════════════════════════════════════════════════

import { ACHIEVEMENTS } from '@/data/achievements';
import { useXPStore } from '@/stores/useXPStore';
import type { Achievement } from '@/types/achievement';

/** Every achievement id unlocked by the Phase 1-3 trigger map. */
export type WiredAchievementId =
  // Training Grounds quizzes
  | 'first-quiz'
  | 'quiz-streak-5'
  | 'perfect-quiz'
  | 'all-subjects'
  | 'quiz-master'
  // Study time + time of day
  | 'study-1hr'
  | 'study-marathon'
  | 'early-bird'
  | 'night-owl'
  // Study streaks
  | 'streak-3'
  | 'streak-7'
  | 'streak-30'
  | 'streak-100'
  // Notes
  | 'first-note'
  // Terminal
  | 'terminal-warrior'
  // Code Lab (read-only line count; no other feature wires it)
  | 'code-100-lines'
  // OS-wide
  | 'first-boot'
  | 'all-apps'
  | 'all-workspaces'
  | 'command-palette'
  | 'shortcut-master'
  | 'customize-os'
  | 'multi-window'
  | 'easter-egg'
  // XP / level
  | 'level-5'
  | 'level-10'
  | 'level-20'
  | 'warrior-complete';

/** Local-time window for "Study past midnight", [from, to) in hours. */
export const NIGHT_OWL_HOURS = { from: 0, to: 4 } as const;
/** Local-time window for "Start studying before 7 AM", [from, to) in hours. */
export const EARLY_BIRD_HOURS = { from: 4, to: 7 } as const;

export const LEVEL_MILESTONES: ReadonlyArray<{ level: number; id: WiredAchievementId }> = [
  { level: 5, id: 'level-5' },
  { level: 10, id: 'level-10' },
  { level: 20, id: 'level-20' },
];

const WARRIOR_COMPLETE_ID = 'warrior-complete';

/** UTC day key ('YYYY-MM-DD'), the same key habits, routines and dreams use. */
export function utcDayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

// ─── Catalogue seeding ───

function sameAchievement(a: Achievement, b: Achievement): boolean {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.description === b.description &&
    a.icon === b.icon &&
    a.category === b.category &&
    a.xpReward === b.xpReward &&
    a.rarity === b.rarity &&
    a.conditionId === b.conditionId &&
    a.hidden === b.hidden &&
    a.unlockedAt === b.unlockedAt
  );
}

/**
 * Merge the catalogue with saved achievements by id. Definitions come from
 * the catalogue (so edited titles/rewards reach existing users); unlock dates
 * come from the saved copy. Saved entries the catalogue no longer lists are
 * kept, so no unlock is ever lost.
 */
export function mergeAchievements(saved: readonly Achievement[]): Achievement[] {
  const savedById = new Map<string, Achievement>();
  for (const a of saved) savedById.set(a.id, a);

  const merged: Achievement[] = [];
  const catalogueIds = new Set<string>();
  for (const def of ACHIEVEMENTS) {
    if (catalogueIds.has(def.id)) continue;
    catalogueIds.add(def.id);
    merged.push({ ...def, unlockedAt: savedById.get(def.id)?.unlockedAt ?? null });
  }
  for (const a of savedById.values()) {
    if (!catalogueIds.has(a.id)) merged.push(a);
  }
  return merged;
}

/** Bring useXPStore.achievements in line with the catalogue (no-op when already in sync). */
export function syncAchievementCatalogue(): void {
  const { achievements, setAchievements } = useXPStore.getState();
  const merged = mergeAchievements(achievements);
  const inSync =
    merged.length === achievements.length &&
    merged.every((a, i) => sameAchievement(a, achievements[i]));
  if (!inSync) setAchievements(merged);
}

function catalogueSeeded(saved: readonly Achievement[]): boolean {
  if (saved.length < ACHIEVEMENTS.length) return false;
  const ids = new Set(saved.map((a) => a.id));
  return ACHIEVEMENTS.every((d) => ids.has(d.id));
}

/** Seed only when some catalogue entry is missing from the store (cheap check). */
export function ensureCatalogueSeeded(): void {
  if (!catalogueSeeded(useXPStore.getState().achievements)) syncAchievementCatalogue();
}

/** Run `callback` once the persisted XP store has rehydrated (immediately with localStorage). */
export function whenXPStoreReady(callback: () => void): void {
  if (useXPStore.persist.hasHydrated()) {
    callback();
    return;
  }
  const unsubscribe = useXPStore.persist.onFinishHydration(() => {
    unsubscribe();
    callback();
  });
}

// ─── Unlocking ───

let completionCheckQueued = false;

function queueCompletionCheck(): void {
  if (completionCheckQueued) return;
  completionCheckQueued = true;
  queueMicrotask(() => {
    completionCheckQueued = false;
    checkWarriorComplete();
  });
}

export function isUnlocked(id: string): boolean {
  return Boolean(useXPStore.getState().achievements.find((a) => a.id === id)?.unlockedAt);
}

/**
 * Unlock an achievement. Idempotent: returns true only when this call
 * unlocked it. A no-op for ids missing from the catalogue.
 */
export function unlock(id: WiredAchievementId): boolean {
  if (typeof window === 'undefined') return false;
  if (!useXPStore.persist.hasHydrated()) {
    whenXPStoreReady(() => {
      unlock(id);
    });
    return false;
  }
  ensureCatalogueSeeded();
  const target = useXPStore.getState().achievements.find((a) => a.id === id);
  if (!target || target.unlockedAt) return false;

  useXPStore.getState().unlockAchievement(id);
  const unlocked = isUnlocked(id);
  if (unlocked) queueCompletionCheck();
  return unlocked;
}

/** "True Warrior": every other catalogue achievement is unlocked. */
export function checkWarriorComplete(): void {
  const saved = new Map(useXPStore.getState().achievements.map((a) => [a.id, a] as const));
  if (!saved.has(WARRIOR_COMPLETE_ID)) return;
  const others = ACHIEVEMENTS.filter((d) => d.id !== WARRIOR_COMPLETE_ID);
  if (others.length === 0) return;
  if (others.every((d) => Boolean(saved.get(d.id)?.unlockedAt))) unlock('warrior-complete');
}

// ─── Level + time-of-day checks ───

export function levelAchievementsFor(level: number): WiredAchievementId[] {
  return LEVEL_MILESTONES.filter((m) => level >= m.level).map((m) => m.id);
}

export function checkLevelAchievements(level: number): void {
  for (const id of levelAchievementsFor(level)) unlock(id);
}

/** Which time-of-day achievement a study moment earns, if any. */
export function studyHourAchievementFor(date: Date): WiredAchievementId | null {
  const hour = date.getHours();
  if (hour >= NIGHT_OWL_HOURS.from && hour < NIGHT_OWL_HOURS.to) return 'night-owl';
  if (hour >= EARLY_BIRD_HOURS.from && hour < EARLY_BIRD_HOURS.to) return 'early-bird';
  return null;
}

/** Call at a moment the user is studying; unlocks Night Owl / Early Bird by local time. */
export function checkStudyHourAchievements(date: Date = new Date()): void {
  const id = studyHourAchievementFor(date);
  if (id) unlock(id);
}
