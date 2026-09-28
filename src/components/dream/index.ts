// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dream barrel
// Single drop-in for the OS "dream" phase:
//   import DreamSequence from '@/components/dream';
//   <DreamSequence onComplete={nextPhase} />
// ═══════════════════════════════════════════════════════════

export { DreamSequence, default } from './DreamSequence';
export { DreamRenderer } from './DreamRenderer';
export { DreamNarration } from './DreamNarration';
export {
  buildDreamScene,
  buildDreamActivity,
  shouldPlayDream,
  DREAM_DURATION_MS,
} from './DreamEngine';
