// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Achievement Sync
// Seeds useXPStore.achievements from the ACHIEVEMENTS catalogue while
// keeping persisted unlock dates (unlockAchievement is a no-op for ids
// missing from the store), and owns the meta achievements that watch
// the achievement system itself: level milestones, collector counts,
// the completionist badge and the gallery visit.
// ═══════════════════════════════════════════════════════════

import { ACHIEVEMENTS } from '@/data/achievements';
import { useXPStore } from '@/stores/useXPStore';
import type { Achievement } from '@/types/achievement';

/** Unlocked the first time the Stats Center achievement gallery opens. */
export const GALLERY_ACHIEVEMENT_ID = 'trophy-room';
/** "Unlock all other achievements". */
export const COMPLETIONIST_ACHIEVEMENT_ID = 'warrior-complete';

export const LEVEL_MILESTONES: ReadonlyArray<{ id: string; level: number }> = [
  { id: 'level-5', level: 5 },
  { id: 'level-10', level: 10 },
  { id: 'level-20', level: 20 },
];

export const COLLECTOR_MILESTONES: ReadonlyArray<{ id: string; count: number }> = [
  { id: 'collector-10', count: 10 },
  { id: 'collector-25', count: 25 },
];

/**
 * Catalogue order and text from ACHIEVEMENTS, unlock dates from `saved`.
 * Saved entries with no catalogue definition are kept at the end, so an
 * unlock is never lost when a definition moves or is renamed.
 */
export function mergeAchievements(saved: readonly Achievement[]): Achievement[] {
  const byId = new Map<string, Achievement>();
  for (const a of saved) byId.set(a.id, a);
  const merged: Achievement[] = ACHIEVEMENTS.map((def) => ({
    ...def,
    unlockedAt: byId.get(def.id)?.unlockedAt ?? null,
  }));
  const known = new Set(ACHIEVEMENTS.map((d) => d.id));
  for (const a of saved) {
    if (!known.has(a.id)) merged.push({ ...a });
  }
  return merged;
}

function sameAchievements(a: readonly Achievement[], b: readonly Achievement[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.unlockedAt !== y.unlockedAt ||
      x.title !== y.title ||
      x.description !== y.description ||
      x.icon !== y.icon ||
      x.xpReward !== y.xpReward ||
      x.rarity !== y.rarity ||
      x.category !== y.category ||
      x.hidden !== y.hidden
    ) {
      return false;
    }
  }
  return true;
}

/** Idempotent: merges the catalogue into the store only when something differs. */
export function seedAchievements(): void {
  const { achievements, setAchievements } = useXPStore.getState();
  const merged = mergeAchievements(achievements);
  if (!sameAchievements(achievements, merged)) setAchievements(merged);
}

function unlockedIds(): Set<string> {
  return new Set(
    useXPStore
      .getState()
      .achievements.filter((a) => !!a.unlockedAt)
      .map((a) => a.id)
  );
}

/** level-5 / level-10 / level-20 as soon as the level reaches them. */
export function checkLevelMilestones(): void {
  const { level, unlockAchievement } = useXPStore.getState();
  const unlocked = unlockedIds();
  for (const m of LEVEL_MILESTONES) {
    if (level >= m.level && !unlocked.has(m.id)) unlockAchievement(m.id);
  }
}

/** collector-10 / collector-25 by unlock count, warrior-complete when all others are done. */
export function checkCollectionMilestones(): void {
  const unlocked = unlockedIds();
  const { unlockAchievement } = useXPStore.getState();
  for (const m of COLLECTOR_MILESTONES) {
    if (unlocked.size >= m.count && !unlocked.has(m.id)) unlockAchievement(m.id);
  }
  if (unlocked.has(COMPLETIONIST_ACHIEVEMENT_ID)) return;
  const others = ACHIEVEMENTS.filter((a) => a.id !== COMPLETIONIST_ACHIEVEMENT_ID);
  if (others.length > 0 && others.every((a) => unlocked.has(a.id))) {
    unlockAchievement(COMPLETIONIST_ACHIEVEMENT_ID);
  }
}
