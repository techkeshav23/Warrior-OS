// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Reality Decay Engine (barrel)
// Drop <RealityDecay /> once inside the desktop phase of page.tsx.
// It mounts the timer engine + all stage/break/repair overlays.
// Fully self-contained and SSR-safe.
// ═══════════════════════════════════════════════════════════

export { DecayEngine as RealityDecay } from './DecayEngine';

// Named sub-exports for downstream use (e.g. Settings panel wiring / tray).
export { DecayEngine } from './DecayEngine';
export { DecayStages, decayFilterForStage } from './DecayStages';
export { BreakMode } from './BreakMode';
export { DecayRepair } from './DecayRepair';
