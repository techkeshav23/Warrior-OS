// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Ghost Warriors Types
// Anonymous multiplayer presence (local simulation)
// ═══════════════════════════════════════════════════════════

/**
 * An anonymous warrior currently "online" (real self or simulated ghost).
 */
export interface GhostWarrior {
  anonymousId: string;      // e.g. "Warrior#4821"
  studyHoursToday: number;  // hours studied today
  quizzesToday: number;     // quizzes completed today
  streak: number;           // day streak
  isOnline: boolean;
  lastSeen: string;         // ISO timestamp
  isSelf?: boolean;         // true for the local user's own presence
}

/**
 * An anonymous war cry broadcast to all warriors.
 */
export interface WarCry {
  id: string;
  message: string;
  timestamp: string;        // ISO timestamp
  anonymousId: string;      // sender
  isSelf?: boolean;         // sent by the local user
}

/**
 * Campfire visual state, derived from the online count.
 */
export interface CampfireState {
  onlineCount: number;
  fireIntensity: number;    // 0..1 normalized flame size/brightness
}

/**
 * Fire stage buckets used by the campfire widget.
 */
export type CampfireStage = 'ember' | 'small' | 'fire' | 'bonfire' | 'inferno';

/**
 * A pre-made war cry option shown in the composer.
 */
export interface WarCryPreset {
  label: string;
  message: string;
}
