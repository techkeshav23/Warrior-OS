// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Phantom Achievements
// Fired at the moment a phantom appears, is resurrected, or is
// let go (starts dissolving without being clicked).
// ═══════════════════════════════════════════════════════════

import { useXPStore } from '@/stores/useXPStore';

export const PHANTOM_ACHIEVEMENTS = {
  /** First phantom seen drifting. */
  firstGhost: 'phantom-first-ghost',
  /** First resurrection (spec "Ghost Whisperer"). */
  ghostWhisperer: 'phantom-resurrect',
  /** 50 resurrections (spec "Necromancer"). */
  necromancer: 'phantom-necromancer',
  /** 100 phantoms dissolved without resurrecting (spec "Let It Go"). */
  letItGo: 'phantom-let-it-go',
} as const;

export const NECROMANCER_COUNT = 50;
export const LET_IT_GO_COUNT = 100;

function unlockOnce(id: string): void {
  const xp = useXPStore.getState();
  const existing = xp.achievements.find((a) => a.id === id);
  if (existing?.unlockedAt) return;
  xp.unlockAchievement(id);
}

export function onPhantomSpawned(): void {
  unlockOnce(PHANTOM_ACHIEVEMENTS.firstGhost);
}

/** `total` = lifetime resurrections after this one. */
export function onPhantomResurrected(total: number): void {
  unlockOnce(PHANTOM_ACHIEVEMENTS.ghostWhisperer);
  if (total >= NECROMANCER_COUNT) unlockOnce(PHANTOM_ACHIEVEMENTS.necromancer);
}

/** `total` = lifetime dissolves after this one. */
export function onPhantomDissolved(total: number): void {
  if (total >= LET_IT_GO_COUNT) unlockOnce(PHANTOM_ACHIEVEMENTS.letItGo);
}
