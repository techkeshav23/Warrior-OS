// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior Creature barrel
// Single drop-in export: <WarriorCreature/>. Mounts the engine,
// taskbar sprite, reactions, stats popup and hatch cinematic.
// Safe to place anywhere inside the desktop phase of page.tsx.
// ═══════════════════════════════════════════════════════════

export { WarriorCreature } from './WarriorCreature';
export { CreatureEngine, useCreatureVitals, EGG_INCUBATION_DAYS, IDLE_SLEEP_MS } from './CreatureEngine';
export type { CreatureVitals } from './CreatureEngine';
export { CreatureRenderer } from './CreatureRenderer';
export { EvolutionVisual } from './CreatureEvolution';
export { CreatureReactions, dispatchCreatureEvent } from './CreatureReactions';
export type { CreatureEventDetail } from './CreatureReactions';
export { CreatureStats } from './CreatureStats';
export { CreatureHatch, FIRST_PET_ACHIEVEMENT_ID } from './CreatureHatch';
