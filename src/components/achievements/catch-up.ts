// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Achievement Catch-Up
// Achievements already earned by saved data (quiz history, study
// days, notes, XP level, counters) — for progress made before a
// trigger existed or before its definition reached the catalogue
// ═══════════════════════════════════════════════════════════

import { useXPStore } from '@/stores/useXPStore';
import { TERMINAL_WARRIOR_TARGET } from '@/components/apps/terminal/terminal-achievements';
import { isUnlocked, levelAchievementsFor, type WiredAchievementId } from './award';
import { quizAchievementsFromHistory } from './quiz-achievements';
import { studyStreakAchievementsFromHistory } from './study-streak';
import { useAchievementProgressStore } from './progress-store';
import { CODE_LINES_TARGET, codeLabLineCount } from './code-lab';
import { GLOBAL_SHORTCUTS } from './useKeyboardAchievements';
import { CUSTOMIZE_TARGET, allAppsOpened } from './useOSAchievements';
import { MARATHON_MINUTES } from './useStudyTracker';

function hasStoredNotes(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const notes: unknown = JSON.parse(window.localStorage.getItem('warrior-notes') || '[]');
    return Array.isArray(notes) && notes.length > 0;
  } catch {
    return false;
  }
}

/** Locked achievements whose condition saved data already satisfies. */
export function collectCatchUpAchievements(): WiredAchievementId[] {
  const ids: WiredAchievementId[] = [];

  // Training Grounds quizzes (also back-fills the quiz counter the first time)
  ids.push(...quizAchievementsFromHistory());

  // Study streaks — the best streak in the history counts as "maintained"
  ids.push(...studyStreakAchievementsFromHistory());

  // Notes
  if (hasStoredNotes()) ids.push('first-note');

  // Code Lab
  if (codeLabLineCount() >= CODE_LINES_TARGET) ids.push('code-100-lines');

  // XP level
  ids.push(...levelAchievementsFor(useXPStore.getState().level));

  // Counters kept by the triggers themselves
  const progress = useAchievementProgressStore.getState();
  if (progress.terminalCommands >= TERMINAL_WARRIOR_TARGET) ids.push('terminal-warrior');
  if (progress.shortcutsUsed.includes('ctrl+k')) ids.push('command-palette');
  if (GLOBAL_SHORTCUTS.every((c) => progress.shortcutsUsed.includes(c))) ids.push('shortcut-master');
  if (progress.settingsChanged.length >= CUSTOMIZE_TARGET) ids.push('customize-os');
  if (Object.values(progress.studyMinutesByDay).some((m) => m >= MARATHON_MINUTES)) {
    ids.push('study-marathon');
  }
  if (allAppsOpened()) ids.push('all-apps');

  return [...new Set(ids)].filter((id) => !isUnlocked(id));
}
