// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Study Tracker
// Counts minutes of active study (a study app is on screen and the
// user interacted recently) → Focused Mind, Study Marathon,
// Night Owl, Early Bird; keeps study minutes per UTC day
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { checkStudyHourAchievements, unlock, utcDayKey } from './award';
import { useAchievementProgressStore } from './progress-store';
import { isStudyWindowVisible } from './study-apps';
import { STUDY_DAY_MIN_MINUTES, checkStudyStreak } from './study-streak';

export const STUDY_TICK_MS = 60_000;
/** An interaction within this window still counts as studying (reading included). */
export const ACTIVE_WINDOW_MS = 5 * 60_000;
/** This many idle / off-study minutes in a row end a "straight" session. */
export const SESSION_BREAK_MINUTES = 5;
/** "Focused Mind": study for 1 hour straight. */
export const FOCUSED_MIND_MINUTES = 60;
/** "Study Marathon": 5 hours of study in one (UTC) day. */
export const MARATHON_MINUTES = 300;

const HOUR_CHECK_THROTTLE_MS = 30_000;
const INTERACTION_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/** Only one tracker may count minutes, even if the triggers get mounted twice. */
let activeTrackers = 0;

/** Mount once (from AchievementTriggers). */
export function useStudyTracker(): void {
  useEffect(() => {
    if (typeof window === 'undefined' || activeTrackers > 0) return;
    activeTrackers += 1;
    let lastInteraction = Date.now();
    let lastHourCheck = 0;
    let sessionMinutes = 0;
    let offMinutes = 0;

    // The first study interaction past midnight / before 7 AM is the exact unlock moment.
    const onInteraction = () => {
      const now = Date.now();
      lastInteraction = now;
      if (now - lastHourCheck < HOUR_CHECK_THROTTLE_MS) return;
      lastHourCheck = now;
      if (isStudyWindowVisible()) checkStudyHourAchievements(new Date(now));
    };

    const tick = () => {
      const now = Date.now();
      const studying =
        document.visibilityState === 'visible' &&
        now - lastInteraction < ACTIVE_WINDOW_MS &&
        isStudyWindowVisible();

      if (!studying) {
        offMinutes += 1;
        if (offMinutes >= SESSION_BREAK_MINUTES) sessionMinutes = 0;
        return;
      }

      offMinutes = 0;
      sessionMinutes += 1;
      const todayMinutes = useAchievementProgressStore
        .getState()
        .addStudyMinute(utcDayKey(new Date(now)));

      checkStudyHourAchievements(new Date(now));
      if (sessionMinutes >= FOCUSED_MIND_MINUTES) unlock('study-1hr');
      if (todayMinutes >= MARATHON_MINUTES) unlock('study-marathon');
      // Enough study time makes today count for the study streak.
      if (todayMinutes === STUDY_DAY_MIN_MINUTES) checkStudyStreak();
    };

    for (const type of INTERACTION_EVENTS) {
      window.addEventListener(type, onInteraction, { capture: true, passive: true });
    }
    const intervalId = window.setInterval(tick, STUDY_TICK_MS);

    return () => {
      activeTrackers -= 1;
      for (const type of INTERACTION_EVENTS) {
        window.removeEventListener(type, onInteraction, { capture: true });
      }
      window.clearInterval(intervalId);
    };
  }, []);
}
