// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Phase 6 OS bridge
// Tiny helpers shared by Creature, Ghost Warriors, Memory Palace and
// Dreams: make NEXUS speak (cross-feature event contract) and unlock
// achievements idempotently, re-trying once the list gets seeded.
// ═══════════════════════════════════════════════════════════

import { useXPStore } from '@/stores/useXPStore';

export type NexusSayTone = 'info' | 'success' | 'warning' | 'danger';

export interface NexusSayDetail {
  text: string;
  tone?: NexusSayTone;
}

export const NEXUS_SAY_EVENT = 'warrior:nexus-say';
const PENDING_PREFIX = 'warrior:pending:';

/**
 * Ask NEXUS to say something (shown by the NEXUS listener through the
 * notification / Dynamic Island API). Delivery rule from the contract:
 * write the detail to sessionStorage first (so a listener that mounts
 * later still receives it), then dispatch the live CustomEvent.
 */
export function sayViaNexus(text: string, tone: NexusSayTone = 'info'): void {
  if (typeof window === 'undefined') return;
  const detail: NexusSayDetail = { text, tone };
  try {
    window.sessionStorage.setItem(PENDING_PREFIX + NEXUS_SAY_EVENT, JSON.stringify(detail));
  } catch {
    /* storage unavailable — live event still fires */
  }
  window.dispatchEvent(new CustomEvent<NexusSayDetail>(NEXUS_SAY_EVENT, { detail }));
}

/** Idempotent unlock (the XP store ignores unknown or already-unlocked ids). */
export function unlockPhase6Achievement(id: string): void {
  try {
    useXPStore.getState().unlockAchievement(id);
  } catch {
    /* never let an achievement break a feature */
  }
}

/** True once the given achievement is recorded as unlocked. */
export function isAchievementUnlocked(id: string): boolean {
  const a = useXPStore.getState().achievements.find((x) => x.id === id);
  return Boolean(a?.unlockedAt);
}

/**
 * Calls `reconcile` whenever the XP store's achievement list grows (i.e.
 * it got seeded after our feature already met a condition), so unlocks
 * that were attempted too early are re-applied. Returns the unsubscribe.
 */
export function onAchievementsSeeded(reconcile: () => void): () => void {
  return useXPStore.subscribe((state, prev) => {
    if (state.achievements.length > prev.achievements.length) reconcile();
  });
}
