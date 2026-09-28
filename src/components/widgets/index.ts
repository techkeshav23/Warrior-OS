// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Desktop Widgets barrel
// Drop-in: <DesktopWidgets /> (mount once in the desktop phase).
// Settings: <WidgetSettings /> or useWidgetStore directly.
// ═══════════════════════════════════════════════════════════

export { DesktopWidgets, WIDGET_SIZES, defaultWidgetSlots } from './DesktopWidgets';
export { WidgetSettings } from './WidgetSettings';
export { ClockWidget } from './ClockWidget';
export { StreakWidget } from './StreakWidget';
export { TargetWidget, TARGET_ACHIEVEMENT_ID, DAILY_TARGET_XP } from './TargetWidget';
export {
  useWidgetStore,
  WIDGET_IDS,
  WIDGET_LABELS,
  TARGET_MIN,
  TARGET_MAX,
  TARGET_STEP,
  TARGET_DEFAULT,
} from './useWidgetStore';
export type { WidgetId, WidgetPosition } from './useWidgetStore';
export { unlockAchievementWhenReady, nexusSay, NEXUS_SAY_EVENT } from './os-events';
export type { NexusTone, NexusSayDetail } from './os-events';
