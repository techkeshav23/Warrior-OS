// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior Creature barrel
// Single drop-in export: <WarriorCreature/>. Mounts the engine,
// taskbar sprite, reactions, stats popup and hatch cinematic.
// Safe to place anywhere inside the desktop phase of page.tsx.
// ═══════════════════════════════════════════════════════════

export { WarriorCreature } from './WarriorCreature';
export {
  CreatureEngine,
  useCreatureVitals,
  reconcileCreatureAchievements,
  CREATURE_ACHIEVEMENT_IDS,
  EGG_INCUBATION_DAYS,
  IDLE_SLEEP_MS,
} from './CreatureEngine';
export type { CreatureVitals } from './CreatureEngine';
export { CreatureRenderer, CreatureCanvas, EvolutionVisual, TASKBAR_SPRITE_SIZE } from './CreatureRenderer';
export type { CreatureCanvasProps } from './CreatureRenderer';
export {
  FORM_PAINTERS,
  STAGE_DETAIL,
  paintEgg,
  CreatureFormBadge,
  determineEvolutionForm,
  dominantFromPoints,
} from './CreatureEvolution';
export type { CreaturePose, FormPainter } from './CreatureEvolution';
export {
  CreatureReactions,
  dispatchCreatureEvent,
  applyCreatureReaction,
  CREATURE_EVENT,
} from './CreatureReactions';
export type { CreatureEventDetail } from './CreatureReactions';
export { CreatureStats } from './CreatureStats';
export { CreatureHatch, FIRST_PET_ACHIEVEMENT_ID, HATCH_NEXUS_LINE } from './CreatureHatch';
export {
  CreatureIslandBadge,
  CreatureLockBadge,
  useCreatureIslandSignal,
} from './CreatureStatusBadges';
export type { CreatureIslandSignal, CreatureIslandTone } from './CreatureStatusBadges';
export {
  sayViaNexus,
  unlockPhase6Achievement,
  isAchievementUnlocked,
  onAchievementsSeeded,
  NEXUS_SAY_EVENT,
} from './osBridge';
export type { NexusSayDetail, NexusSayTone } from './osBridge';
