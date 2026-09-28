// ═══════════════════════════════════════════════════════════
// WARRIOR OS — OS Event Helpers (widgets + PWA)
// • unlockAchievementWhenReady: unlock now, or as soon as the XP
//   store's achievement list is seeded (unlockAchievement is a no-op
//   for ids the store does not hold yet).
// • nexusSay: the shared 'warrior:nexus-say' contract. The detail is
//   parked in sessionStorage first so a listener that mounts later
//   still receives it, then a window CustomEvent is dispatched.
// ═══════════════════════════════════════════════════════════

import { useXPStore } from '@/stores/useXPStore';

function isUnlocked(id: string): boolean {
  return Boolean(useXPStore.getState().achievements.find((a) => a.id === id)?.unlockedAt);
}

/**
 * Idempotent. Returns a cleanup that cancels a pending (not yet
 * seeded) unlock; calling it after the unlock happened is harmless.
 */
export function unlockAchievementWhenReady(id: string): () => void {
  const attempt = (): boolean => {
    if (isUnlocked(id)) return true;
    useXPStore.getState().unlockAchievement(id);
    return isUnlocked(id);
  };

  if (attempt()) return () => {};

  let done = false;
  const unsubscribe = useXPStore.subscribe((state, prev) => {
    if (done || state.achievements === prev.achievements) return;
    if (attempt()) {
      done = true;
      unsubscribe();
    }
  });
  return () => {
    done = true;
    unsubscribe();
  };
}

export type NexusTone = 'info' | 'success' | 'warning' | 'danger';

export const NEXUS_SAY_EVENT = 'warrior:nexus-say';
const PENDING_PREFIX = 'warrior:pending:';

export interface NexusSayDetail {
  text: string;
  tone?: NexusTone;
}

/** Ask NEXUS to say something (shown by the NEXUS listener). SSR-safe. */
export function nexusSay(text: string, tone: NexusTone = 'info'): void {
  if (typeof window === 'undefined') return;
  const detail: NexusSayDetail = { text, tone };
  try {
    window.sessionStorage.setItem(PENDING_PREFIX + NEXUS_SAY_EVENT, JSON.stringify(detail));
  } catch {
    /* storage blocked: the live event below still reaches mounted listeners */
  }
  window.dispatchEvent(new CustomEvent<NexusSayDetail>(NEXUS_SAY_EVENT, { detail }));
}
