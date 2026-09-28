// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dream barrel
// Drop-in for the OS "dream" phase:
//   import { DreamSequence, decideInitialPhase } from '@/components/dream';
//   const bootReady = useDreamBootPhase(); // boot | dream | lock, decided once
//   <DreamSequence onComplete={() => setPhase('lock')} />
// ═══════════════════════════════════════════════════════════

export { DreamSequence, default } from './DreamSequence';
export { DreamRenderer } from './DreamRenderer';
export { DreamNarration } from './DreamNarration';
export { DreamTransition, DREAM_FADE_MS, DREAM_BLACK_HOLD_MS } from './DreamTransition';
export {
  buildDreamScene,
  buildDreamActivity,
  decideInitialPhase,
  dreamsEnabled,
  shouldPlayDream,
  DREAM_DURATION_MS,
  VOID_AFTER_DAYS,
} from './DreamEngine';
export {
  loadDreamJournal,
  recordDreamSeen,
  reconcileDreamAchievements,
  DREAM_ACHIEVEMENT_IDS,
} from './dreamJournal';
export { useDreamBootPhase } from './useDreamBoot';
