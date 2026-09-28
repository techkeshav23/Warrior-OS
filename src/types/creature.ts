// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior Creature Types
// Digital pet that evolves with the user's XP & activity
// ═══════════════════════════════════════════════════════════

/** Growth stages, gated by user XP thresholds. */
export type CreatureStage =
  | 'egg'
  | 'baby'
  | 'teen'
  | 'adult'
  | 'legendary'
  | 'mythic';

/** Evolution form, decided by dominant activity. */
export type CreatureForm =
  | 'phoenix' // Scholar Phoenix — study dominant
  | 'serpent' // Code Serpent — coding dominant
  | 'dragon'; // Warrior Dragon — balanced

/** Transient animation / emotional state of the sprite. */
export type CreatureMood =
  | 'idle'
  | 'happy'
  | 'sad'
  | 'sleeping'
  | 'dance'
  | 'eating'
  | 'curious';

/** Which kind of work the user has been doing most. */
export type ActivityKind = 'study' | 'code' | 'balanced';

export interface StageInfo {
  stage: CreatureStage;
  /** Minimum user XP to reach this stage. */
  minXP: number;
  /** Display label. */
  label: string;
  /** Relative sprite scale multiplier. */
  scale: number;
}

export interface FormInfo {
  form: CreatureForm;
  name: string;
  /** Short flavour description. */
  blurb: string;
  /** Accent hex used for glow / aura. */
  accent: string;
}

export interface CreatureState {
  // ─── Identity ───
  name: string;
  /** ISO timestamp the egg first appeared (creature birth). */
  bornAt: string;

  // ─── Activity tracking (drives evolution form) ───
  studyPoints: number;
  codePoints: number;

  // ─── Interaction / mood ───
  mood: CreatureMood;
  /** Total times the user clicked / interacted with the creature. */
  interactions: number;
  /** ISO timestamp of the last mood-affecting activity (idle detection). */
  lastActiveAt: string;
  /** ISO date (yyyy-mm-dd) on which a golden aura was earned; null = none. */
  goldenAuraDate: string | null;

  // ─── Cinematic bookkeeping ───
  /** Whether the hatch cinematic has already played. */
  hasHatched: boolean;

  // ─── Actions ───
  setName: (name: string) => void;
  setMood: (mood: CreatureMood, autoRevertMs?: number) => void;
  registerActivity: (kind: 'study' | 'code', amount?: number) => void;
  registerInteraction: () => void;
  markActive: () => void;
  grantGoldenAura: () => void;
  markHatched: () => void;

  // ─── Queries ───
  getDominantActivity: () => ActivityKind;
  getForm: () => CreatureForm;
  getDaysAlive: () => number;
  hasGoldenAura: () => boolean;
}
