// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Effects Barrel Export
// Root mounts: GlitchTransition, ScreenShatterLayer, LevelUpEffect,
// AchievementCinematic. Desktop mount: DisintegrateEffect.
// Boot screen: ParticleAssembly.
// ═══════════════════════════════════════════════════════════

export { AudioReactive } from './AudioReactive';
export { CursorTrail } from './CursorTrail';

export { AchievementCinematic } from './AchievementCinematic';
export { LevelUpEffect } from './LevelUpEffect';
export { ScreenShatter, ScreenShatterLayer } from './ScreenShatter';
export type { ScreenShatterProps, ShatterImpact } from './ScreenShatter';
export { GlitchTransition } from './GlitchTransition';
export { ParticleAssembly } from './ParticleAssembly';
export type { ParticleAssemblyProps } from './ParticleAssembly';
export { DisintegrateEffect } from './DisintegrateEffect';

export { useEffectsStore, holdCelebrations } from './useEffectsStore';
export type { Celebration, AchievementCelebration, LevelUpCelebration } from './useEffectsStore';
export {
  mergeAchievements,
  seedAchievements,
  GALLERY_ACHIEVEMENT_ID,
  COMPLETIONIST_ACHIEVEMENT_ID,
  LEVEL_MILESTONES,
  COLLECTOR_MILESTONES,
} from './achievement-sync';
export { rasterizeElement } from './dom-raster';
export type { Raster, RasterOptions, RasterRect } from './dom-raster';
