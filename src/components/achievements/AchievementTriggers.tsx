// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Achievement Triggers
// Invisible, mounted once in the desktop phase. Seeds the achievement
// catalogue, catches up on saved progress, pays the daily login bonus
// and runs every trigger not tied to one app: boot, levels, windows,
// workspaces, settings, shortcuts, Konami code, study time
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { useXPStore } from '@/stores/useXPStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import {
  checkWarriorComplete,
  syncAchievementCatalogue,
  unlock,
  utcDayKey,
  whenXPStoreReady,
} from './award';
import { collectCatchUpAchievements } from './catch-up';
import { useAchievementProgressStore } from './progress-store';
import { checkStudyStreak } from './study-streak';
import { useOSAchievements } from './useOSAchievements';
import { useKeyboardAchievements } from './useKeyboardAchievements';
import { useStudyTracker } from './useStudyTracker';

/** Let the desktop fade in before the first unlock / bonus appears. */
export const FIRST_BOOT_DELAY_MS = 2500;
/** Catch-up unlocks are spaced out so unlock effects don't pile on top of each other. */
export const CATCH_UP_SPACING_MS = 1500;
/** "Daily login +10 XP" (WARRIOR_HUB XP table), once per UTC day. */
export const DAILY_LOGIN_XP = 10;

function grantDailyLogin(): void {
  const today = utcDayKey();
  const progress = useAchievementProgressStore.getState();
  if (progress.lastLoginDay === today) return;
  progress.setLastLoginDay(today);
  useXPStore.getState().addXP(DAILY_LOGIN_XP, 'daily-login');
  useNotificationStore.getState().addNotification({
    type: 'success',
    title: 'Daily login bonus',
    message: `Welcome back, warrior. +${DAILY_LOGIN_XP} XP for showing up today.`,
    icon: '🗓️',
  });
}

export function AchievementTriggers() {
  // Startup: seed catalogue → first boot + daily login → staggered catch-up.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const timers: number[] = [];

    whenXPStoreReady(() => {
      if (cancelled) return;
      syncAchievementCatalogue();
      const catchUp = collectCatchUpAchievements();

      timers.push(
        window.setTimeout(() => {
          unlock('first-boot');
          grantDailyLogin();
          // Study already logged today (e.g. in an earlier session) keeps the streak + bonus current.
          checkStudyStreak();
        }, FIRST_BOOT_DELAY_MS)
      );
      catchUp.forEach((id, i) => {
        timers.push(
          window.setTimeout(() => unlock(id), FIRST_BOOT_DELAY_MS + (i + 1) * CATCH_UP_SPACING_MS)
        );
      });
      checkWarriorComplete();
    });

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  useOSAchievements();
  useKeyboardAchievements();
  useStudyTracker();

  return null;
}
