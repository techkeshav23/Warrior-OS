// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Reality Decay Engine (barrel)
// Drop <RealityDecay /> once inside the desktop phase of page.tsx.
// It mounts the timer engine + all stage/break/repair overlays.
// <DecayTrayTimer /> belongs in the Taskbar system tray; Settings →
// Reality Decay reads and writes useDecayStore directly. SSR-safe.
// ═══════════════════════════════════════════════════════════

export { DecayEngine as RealityDecay } from './DecayEngine';
/** Alias of <RealityDecay/>: the single desktop mount for the decay engine. */
export { DecayEngine as DecayLayer } from './DecayEngine';

// Named sub-exports for downstream use (Settings panel, system tray).
export { DecayEngine } from './DecayEngine';
export {
  DecayStages,
  DecayStage1,
  DecayStage2,
  DecayStage3,
  DecayStage4,
  DecayStage5,
  decayFilterForStage,
} from './DecayStages';
export { BreakMode } from './BreakMode';
export { DecayRepair, REPAIR_XP } from './DecayRepair';
export { DecayTrayTimer, DECAY_STAGE_NAMES, formatStudyMinutes } from './DecayTrayTimer';
export { nexusSay, NEXUS_SAY_EVENT } from './nexus-say';
export type { NexusSayDetail, NexusSayTone } from './nexus-say';
export { DECAY_ACHIEVEMENTS } from './achievements';
export { installDecayDebug } from './debug';
export type { WarriorDecayDebug } from './debug';
