// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Calendar achievements
// "Master Planner": plan ten events. Called right after an event is
// created and again whenever the Calendar opens (idempotent).
// ═══════════════════════════════════════════════════════════

import { useCalendarStore } from '@/stores/useCalendarStore';
import { useXPStore } from '@/stores/useXPStore';

export const CALENDAR_PLANNER_ACHIEVEMENT_ID = 'calendar-ten-events';
export const CALENDAR_PLANNER_TARGET = 10;

/** Events counted towards Master Planner (never decreases when events are deleted). */
export function plannedEventCount(eventsPlanned: number, storedEvents: number): number {
  return Math.max(eventsPlanned, storedEvents);
}

export function checkCalendarPlannerAchievement(): void {
  const { eventsPlanned, events } = useCalendarStore.getState();
  if (plannedEventCount(eventsPlanned, events.length) >= CALENDAR_PLANNER_TARGET) {
    useXPStore.getState().unlockAchievement(CALENDAR_PLANNER_ACHIEVEMENT_ID);
  }
}
