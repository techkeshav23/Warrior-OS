// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Ghost presence barrel
// ═══════════════════════════════════════════════════════════

export { getSessionWarriorId, WARRIOR_ID_PATTERN } from './identity';
export { computeSelfStats } from './selfStats';
export { sendWarCry, sanitizeWarCry, getGhostTransport, setGhostTransport } from './transport';
export type { GhostTransport, WarCrySendResult } from './transport';
export { startLocalPresence, isBroadcastChannelSupported } from './local';
export { simulatedWarriors, simulatedWarCries, SIM_ROSTER_SIZE } from './simulation';
export {
  startGhostPresence,
  reconcileGhostAchievements,
  GHOST_ACHIEVEMENT_IDS,
  BAND_OF_BROTHERS_MINUTES,
  CAMPFIRE_STORIES_ONLINE,
} from './engine';
