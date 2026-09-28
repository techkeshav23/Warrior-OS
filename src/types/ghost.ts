// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Ghost Warriors Types
// Anonymous multiplayer presence: Firebase Realtime Database when
// configured, an explicitly-labelled local simulation otherwise.
// ═══════════════════════════════════════════════════════════

/**
 * An anonymous warrior currently online (real self, real peer, or a
 * clearly-flagged simulated ghost).
 */
export interface GhostWarrior {
  anonymousId: string; // e.g. "Warrior#4821"
  studyHoursToday: number; // focused hours today
  quizzesToday: number; // quiz submissions today
  streak: number; // day streak
  isOnline: boolean;
  lastSeen: string; // ISO timestamp
  isSelf?: boolean; // true for the local user's own presence
  isSimulated?: boolean; // true for local-simulation ghosts (never real people)
  isLocalTab?: boolean; // another open tab of this browser (local mode)
}

/**
 * An anonymous war cry broadcast to all warriors.
 */
export interface WarCry {
  id: string;
  message: string;
  timestamp: string; // ISO timestamp
  anonymousId: string; // sender
  isSelf?: boolean; // sent by the local user
  /** True when the cry only reached this device (local/offline mode). */
  isLocalOnly?: boolean;
  /** True for cries from simulated warriors (local/offline mode only). */
  isSimulated?: boolean;
}

/**
 * Campfire visual state, derived from the online count.
 */
export interface CampfireState {
  onlineCount: number;
  fireIntensity: number; // 0..1 normalized flame size/brightness
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

/**
 * Where presence data comes from right now.
 *  - disabled:   Ghost Warriors switched off in Settings
 *  - connecting: Firebase RTDB configured, connection in progress
 *  - realtime:   live Firebase RTDB presence (real people)
 *  - local:      no database configured (or unreachable) → offline campfire:
 *                real presence of this browser's other open tabs (via
 *                BroadcastChannel) + deterministic, SIM-labelled warriors
 */
export type GhostPresenceMode = 'disabled' | 'connecting' | 'realtime' | 'local';

/** The stats the local warrior publishes about themselves. */
export interface GhostSelfStats {
  studyHoursToday: number;
  quizzesToday: number;
  streak: number;
}

/** Lifetime counters used for Ghost Warrior achievements. */
export interface GhostLifetimeStats {
  warCriesSent: number;
  /** Minutes spent online in realtime mode while other warriors were online. */
  minutesWithOthers: number;
  /** Highest simultaneous real online count seen. */
  maxOnlineSeen: number;
}
