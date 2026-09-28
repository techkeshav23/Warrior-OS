// ═══════════════════════════════════════════════════════════
// WARRIOR OS — OS Event Helpers (widgets + PWA)
// • unlockAchievementWhenReady: unlock now, or as soon as the XP
//   store's achievement list is seeded (unlockAchievement is a no-op
//   for ids the store does not hold yet).
// • nexusSay: the shared 'warrior:nexus-say' contract. The detail is
//   parked in sessionStorage first so a listener that mounts later
//   still receives it, then a window CustomEvent is dispatched.
// • openApp / openTrainingGrounds: launch (or focus) an app in the
//   active workspace; Training Grounds can open on one mode through
//   the shared 'warrior:training-start' deep link.
// ═══════════════════════════════════════════════════════════

import { WARRIOR_EVENTS, emitWarriorEvent, type WarriorTrainingStartDetail } from '@/lib/nexus/events';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useXPStore } from '@/stores/useXPStore';
import type { NexusTrainingMode } from '@/types/nexus';

/** Launch an app in the active workspace (a running singleton is focused). */
export function openApp(appId: string): void {
  useAppStore.getState().launchApp(appId, useWorkspaceStore.getState().activeWorkspaceId);
}

/** Open Training Grounds, optionally on one mode ('flashcards' = the review queue of due cards). */
export function openTrainingGrounds(mode?: NexusTrainingMode): void {
  openApp('training-grounds');
  if (!mode) return;
  const detail: WarriorTrainingStartDetail = { mode };
  emitWarriorEvent(WARRIOR_EVENTS.trainingStart, detail);
}

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
