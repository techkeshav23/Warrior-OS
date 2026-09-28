// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior Creature Types
// Digital pet that evolves with the user's XP & activity
// ═══════════════════════════════════════════════════════════

/** Growth stages, gated by creature XP thresholds (+ egg incubation). */
export type CreatureStage =
  | 'egg'
  | 'baby'
  | 'teen'
  | 'adult'
  | 'legendary'
  | 'mythic';

/** Evolution form, decided by dominant activity on each creature level-up. */
export type CreatureForm =
  | 'phoenix' // Scholar Phoenix — study dominant
  | 'serpent' // Code Serpent — coding dominant
  | 'dragon'; // Warrior Dragon — balanced

/** Animation / emotional state of the sprite. */
export type CreatureMood =
  | 'idle' // breathing
  | 'happy' // bounce + sparkles
  | 'sad' // dim + shiver
  | 'sleeping' // ZzZ
  | 'excited' // spin + sparkles (achievement unlock)
  | 'dance' // victory dance + flames (perfect quiz, evolution)
  | 'eating' // nom (XP gained)
  | 'curious'; // head tilt (window opened, poked)

/** Which kind of work the user has been doing most. */
export type CreatureActivityKind = 'study' | 'code' | 'balanced';

export interface CreatureStageInfo {
  stage: CreatureStage;
  /** Minimum creature XP to reach this stage. */
  minXP: number;
  /** Display label. */
  label: string;
  /** Relative sprite scale multiplier. */
  scale: number;
}

export interface CreatureFormInfo {
  form: CreatureForm;
  name: string;
  /** Short flavour description. */
  blurb: string;
  /** Accent hex used for glow / aura. */
  accent: string;
  /** Secondary hex used for details (armor, circuits, pages). */
  detail: string;
}

/** Per-day activity the creature observed (UTC day key → log). */
export interface CreatureDayLog {
  /** XP the creature was fed that day. */
  xp: number;
  /** Active minutes with a study app focused. */
  studyMinutes: number;
  /** Active minutes with a build app focused. */
  codeMinutes: number;
  /** All active minutes in the OS. */
  focusMinutes: number;
  /** True if the creature was sad at any point that day. */
  wasSad: boolean;
}

/** Record of the last stage transition (non-persisted, drives FX). */
export interface CreatureEvolutionEvent {
  from: CreatureStage;
  to: CreatureStage;
  at: number;
  /** Silent transitions (catch-up on load) skip cinematics + NEXUS lines. */
  silent: boolean;
}

/** Record of the last form change (non-persisted, drives FX). */
export interface CreatureFormChangeEvent {
  from: CreatureForm;
  to: CreatureForm;
  at: number;
}

/**
 * Durable creature data (spec 6.1: id, name, stage, form, mood, xp, level,
 * birthDate, dominantActivity) plus the bookkeeping the engine needs.
 */
export interface CreatureState {
  // ─── Identity ───
  id: string;
  name: string;
  /** ISO timestamp the egg first appeared (creature birth). */
  birthDate: string;

  // ─── Growth ───
  stage: CreatureStage;
  form: CreatureForm;
  mood: CreatureMood;
  /** Creature XP — fed by every user XP gain. */
  xp: number;
  /** Creature level, derived from creature XP. */
  level: number;
  dominantActivity: CreatureActivityKind;
  /** Whether the hatch cinematic has already played. */
  hasHatched: boolean;
  /** How many times the evolution form changed after hatching. */
  formChanges: number;

  // ─── Activity tracking (drives evolution form) ───
  /** Study minutes (and study points from other features). */
  studyPoints: number;
  /** Coding minutes (and code points from other features). */
  codePoints: number;
  /** UTC day key → what happened that day. Last 45 days are kept. */
  activityLog: Record<string, CreatureDayLog>;

  // ─── Interaction / mood ───
  /** Total times the user clicked / interacted with the creature. */
  interactions: number;
  /** ISO timestamp of the last user activity seen by the creature. */
  lastActiveAt: string;
  /** UTC day key on which a golden aura was earned; null = none. */
  goldenAuraDate: string | null;

  // ─── Sync bookkeeping ───
  /** User XP total at the last sync; null = never synced (seed on first run). */
  lastSyncedUserXP: number | null;
  /** Last day the streak-break check ran, and the streak seen then. */
  lastStreakCheck: { day: string; streak: number } | null;

  // ─── Transient (not persisted) ───
  /** Egg incubated + fed enough: the hatch cinematic may play. */
  eggReady: boolean;
  lastEvolution: CreatureEvolutionEvent | null;
  lastFormChange: CreatureFormChangeEvent | null;
}

export interface CreatureFeedOptions {
  /** Catch-up / seed feeds: no eating animation, no evolution cinematics. */
  silent?: boolean;
}

export interface CreatureActions {
  setName: (name: string) => void;
  setMood: (mood: CreatureMood, autoRevertMs?: number) => void;
  /** Feed creature XP (every user XP gain calls this). Returns amount fed. */
  feedXP: (amount: number, options?: CreatureFeedOptions) => number;
  /** Sync with the user's XP total; feeds the positive delta. Returns amount fed. */
  syncUserXP: (userXP: number, options?: CreatureFeedOptions) => number;
  /** Move to a stage (records the transition for FX). */
  evolve: (stage: CreatureStage, options?: CreatureFeedOptions) => void;
  /** Resolve stage + egg readiness from xp/days/hatch; evolves if needed. */
  checkEvolution: (options?: CreatureFeedOptions) => CreatureStage;
  registerActivity: (kind: 'study' | 'code', amount?: number) => void;
  /** Count one active minute; kind attributes it to study or code. */
  logFocusMinute: (kind: 'study' | 'code' | null) => void;
  registerInteraction: () => void;
  markActive: () => void;
  grantGoldenAura: () => void;
  markHatched: () => void;
  /** Ensure today's log exists (marks a session day) and prune old days. */
  touchToday: () => void;
  setStreakCheck: (day: string, streak: number) => void;

  // ─── Queries ───
  getDominantActivity: () => CreatureActivityKind;
  /** Form the creature WOULD take right now (dominant activity). */
  getEvolutionForm: () => CreatureForm;
  /** Form currently locked in (changes only on level-up / hatch). */
  getForm: () => CreatureForm;
  getDaysAlive: () => number;
  hasGoldenAura: () => boolean;
  getTodayLog: () => CreatureDayLog;
  /** Consecutive days (ending today or yesterday) fed and never sad. */
  getHappyStreak: () => number;
}

export type CreatureStore = CreatureState & CreatureActions;
