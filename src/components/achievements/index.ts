// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Achievements barrel
// Drop-in: <AchievementTriggers /> (mount once in the desktop phase).
// Helpers other features can use: unlock(), the progress store
// (study minutes per day), the study streak, and the pending-event
// (deep link) delivery helpers.
// ═══════════════════════════════════════════════════════════

export { AchievementTriggers } from './AchievementTriggers';
export { unlock, isUnlocked, syncAchievementCatalogue, utcDayKey } from './award';
export type { WiredAchievementId } from './award';
export { useAchievementProgressStore } from './progress-store';
export { collectStudyDays, checkStudyStreak, recordStudyAction } from './study-streak';
export { currentStreak, longestStreak } from './day-streak';
export {
  consumePendingEvent,
  sendPendingEvent,
  usePendingEventListener,
  PENDING_EVENT_PREFIX,
} from './pending-events';
export type { DetailParser, PendingEventListenerOptions } from './pending-events';
export {
  trackEvent,
  getEventStats,
  reconcileAchievementEvents,
  useAchievementEventsStore,
  ACHIEVEMENT_EVENT_RULES,
} from '@/lib/achievement-events';
export type { AchievementEventName, EventDetail, EventStats } from '@/lib/achievement-events';
