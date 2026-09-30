// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior 3D: shared types
// ═══════════════════════════════════════════════════════════

/** Everything the warrior can do. idle / stance loop; the rest are one-shots. */
export type WarriorAction = 'idle' | 'stance' | 'punch' | 'powerup' | 'victory' | 'hurt';

/** Looping actions — the pose a one-shot returns to. */
export type WarriorBaseAction = Extract<WarriorAction, 'idle' | 'stance'>;

export const WARRIOR_ACTIONS: readonly WarriorAction[] = ['idle', 'stance', 'punch', 'powerup', 'victory', 'hurt'];

export const WARRIOR_ONE_SHOTS: readonly WarriorAction[] = ['punch', 'powerup', 'victory', 'hurt'];

export function isOneShot(action: WarriorAction): boolean {
  return WARRIOR_ONE_SHOTS.includes(action);
}

/** Armor tier, 1 (fresh recruit) … 5 (ascendant). */
export type WarriorTier = 1 | 2 | 3 | 4 | 5;

export type WarriorVariant = 'hero' | 'hall' | 'card';

/** What the look is derived from — real data or a preview override. */
export interface WarriorProgress {
  level: number;
  /** The app's own rank title for the current level. */
  levelTitle: string;
  tier: WarriorTier;
  /** Tier name (the rank title that opens the bracket). */
  tierName: string;
  streakDays: number;
  /** Reality-decay stage, 0 (fresh) … 5 (full decay). */
  decayStage: number;
}

/** Visual parameters derived from progress — consumed by every 3D piece. */
export interface WarriorLook {
  tier: WarriorTier;
  /** Trim / seam emissive colour (hex). */
  trim: string;
  /** Secondary glow (hex). */
  accent: string;
  /** Emissive multiplier for seams / visor. */
  glow: number;
  /** 0 … 1.3 — aura shell + rising motes. 0 below a 3-day streak. */
  aura: number;
  /** 0 … 1 — emissive flicker / glitch amount from decay. */
  damage: number;
  /** Stage 5: sparks + hard flicker. */
  critical: boolean;
}
