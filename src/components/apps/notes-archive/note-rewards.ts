// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Note Rewards
// "Create note +5 XP" (capped per day) and the First Page achievement
// ═══════════════════════════════════════════════════════════

import { useXPStore } from '@/stores/useXPStore';
import { unlock, utcDayKey } from '@/components/achievements/award';
import { useAchievementProgressStore } from '@/components/achievements/progress-store';
import { checkStudyStreak } from '@/components/achievements/study-streak';

export const NOTE_CREATE_XP = 5;
/** Notes that pay creation XP per UTC day, so spamming "+" can't farm XP. */
export const NOTE_XP_DAILY_CAP = 10;

/** Call right after a new note has been saved. */
export function rewardNoteCreated(): void {
  unlock('first-note');
  if (useAchievementProgressStore.getState().claimNoteXp(utcDayKey(), NOTE_XP_DAILY_CAP)) {
    useXPStore.getState().addXP(NOTE_CREATE_XP, 'note');
  }
  // Writing a note is study activity for the day's streak.
  checkStudyStreak();
}
