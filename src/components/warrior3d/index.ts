// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior 3D (public API)
// ═══════════════════════════════════════════════════════════
//   <WarriorStage variant="hero" | "hall" | "card" … />   drop-in stage
//   playWarriorAction(action, stageId?)                  make it move
//   useWarriorProgress() / useWarriorModel()             data + model status
// The R3F canvas itself is loaded client-side only (next/dynamic, ssr:false).

export { WarriorStage } from './WarriorStage';
export type { WarriorStageProps } from './WarriorStage';
export { WarriorFallback } from './WarriorFallback';
export { playWarriorAction, useWarriorActionStore } from './store';
export type { WarriorActionRequest } from './store';
export {
  useWarriorProgress,
  useHabitStreak,
  lookForProgress,
  tierForLevel,
  tierInfo,
  WARRIOR_TIERS,
} from './progress';
export type { WarriorProgressOverrides, WarriorTierInfo } from './progress';
export {
  useWarriorModel,
  useWarriorModelStore,
  ensureWarriorModel,
  mapClips,
  WARRIOR_MODEL_URL,
  WARRIOR_HEIGHT,
} from './model';
export type { WarriorModelStatus, WarriorModelAsset, WarriorModelInfo } from './model';
export { ACTION_DURATION } from './pose';
export { WARRIOR_ACTIONS, WARRIOR_ONE_SHOTS, isOneShot } from './types';
export type {
  WarriorAction,
  WarriorBaseAction,
  WarriorTier,
  WarriorVariant,
  WarriorProgress,
  WarriorLook,
} from './types';
