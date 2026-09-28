// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Desktop Widgets Layer
// One drop-in layer (<DesktopWidgets />) holding the clock, streak
// and daily-goal widgets. Each is draggable, remembers its
// position, can be switched off, and fades away while a maximized
// window covers the desktop. Mount once in the desktop phase.
// The Vitals and Campfire widgets live in their own features.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useEffect, useMemo } from 'react';
import { useWindowStore } from '@/stores/useWindowStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { ClockWidget } from './ClockWidget';
import { DraggableWidget } from './DraggableWidget';
import { StreakWidget } from './StreakWidget';
import { TargetWidget } from './TargetWidget';
import { useHabits, useIsClient, useNow, useViewportSize } from './hooks';
import { openApp, openTrainingGrounds, unlockAchievementWhenReady } from './os-events';
import { useWidgetStore, type WidgetId, type WidgetPosition } from './useWidgetStore';
import { computeStreak, utcDayKey } from './widget-data';

export const WIDGET_WIDTH = 240;

export const WIDGET_SIZES: Record<WidgetId, { width: number; height: number }> = {
  clock: { width: WIDGET_WIDTH, height: 128 },
  streak: { width: WIDGET_WIDTH, height: 116 },
  target: { width: WIDGET_WIDTH, height: 128 },
};

const STACK_ORDER: readonly WidgetId[] = ['clock', 'streak', 'target'];
const STACK_GAP = 12;
const RIGHT_MARGIN = 24;
const TASKBAR_HEIGHT = 48;
// The biometrics Vitals HUD sits at top:80 / right:24 (240px wide, the
// same column as these widgets, up to ≈252px tall once typing stats
// show). Default slots stack below it, or beside it when the screen is
// too short for a full column.
const BELOW_VITALS_Y = 344;
const BESIDE_VITALS_OFFSET = 240 + 16;
const TOP_Y = 80;

/** Default widget slots for a viewport (right-hand column). */
export function defaultWidgetSlots(width: number, height: number): Record<WidgetId, WidgetPosition> {
  const columnHeight =
    STACK_ORDER.reduce((sum, id) => sum + WIDGET_SIZES[id].height, 0) +
    STACK_GAP * (STACK_ORDER.length - 1);
  const fitsBelow = BELOW_VITALS_Y + columnHeight <= height - TASKBAR_HEIGHT - 8;
  const x = width - RIGHT_MARGIN - WIDGET_WIDTH - (fitsBelow ? 0 : BESIDE_VITALS_OFFSET);

  let y = fitsBelow ? BELOW_VITALS_Y : TOP_Y;
  const slots = {} as Record<WidgetId, WidgetPosition>;
  for (const id of STACK_ORDER) {
    slots[id] = { x, y };
    y += WIDGET_SIZES[id].height + STACK_GAP;
  }
  return slots;
}

const STREAK_ACHIEVEMENTS: ReadonlyArray<readonly [number, string]> = [
  [3, 'streak-3'],
  [7, 'streak-7'],
  [30, 'streak-30'],
  [100, 'streak-100'],
];

function DesktopWidgetsInner() {
  const isClient = useIsClient();
  const enabled = useWidgetStore((s) => s.enabled);
  const goalKind = useWidgetStore((s) => s.dailyGoalKind);
  const { width, height } = useViewportSize();

  // "Today" is the OS-wide UTC day key; a minute tick catches midnight.
  const now = useNow(60_000);
  const dayKey = utcDayKey(now);
  const habits = useHabits();
  const streak = useMemo(
    () => computeStreak(habits, Date.parse(`${dayKey}T12:00:00Z`)),
    [habits, dayKey]
  );
  const { current, longest, doneToday } = streak;

  // A maximized window owns the desktop: get out of its way.
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const covered = useWindowStore((s) =>
    s.windows.some((w) => w.workspaceId === activeWorkspaceId && w.isMaximized && !w.isMinimized)
  );

  const slots = useMemo(() => defaultWidgetSlots(width, height), [width, height]);

  // Streak achievements unlock the moment the streak reaches each mark
  // (even if the streak widget itself is switched off).
  useEffect(() => {
    const cleanups = STREAK_ACHIEVEMENTS.filter(([days]) => current >= days).map(([, id]) =>
      unlockAchievementWhenReady(id)
    );
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [current]);

  const openQuestPlanner = useCallback(() => openApp('study-planner'), []);
  // A card goal opens straight on the review queue; a focus goal on Training Grounds.
  const openGoalApp = useCallback(
    () => openTrainingGrounds(goalKind === 'cards' ? 'flashcards' : undefined),
    [goalKind]
  );

  if (!isClient || !(enabled.clock || enabled.streak || enabled.target)) return null;

  return (
    <div
      role="region"
      aria-label="Desktop widgets"
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 'var(--z-desktop)' }}
    >
      {enabled.clock && (
        <DraggableWidget
          id="clock"
          width={WIDGET_SIZES.clock.width}
          height={WIDGET_SIZES.clock.height}
          defaultPosition={slots.clock}
          hidden={covered}
        >
          <ClockWidget />
        </DraggableWidget>
      )}

      {enabled.streak && (
        <DraggableWidget
          id="streak"
          width={WIDGET_SIZES.streak.width}
          height={WIDGET_SIZES.streak.height}
          defaultPosition={slots.streak}
          hidden={covered}
          onOpen={openQuestPlanner}
          openHint="Double-click to open Quest Planner"
        >
          <StreakWidget current={current} longest={longest} doneToday={doneToday} />
        </DraggableWidget>
      )}

      {enabled.target && (
        <DraggableWidget
          id="target"
          width={WIDGET_SIZES.target.width}
          height={WIDGET_SIZES.target.height}
          defaultPosition={slots.target}
          hidden={covered}
          onOpen={openGoalApp}
          openHint={
            goalKind === 'cards' ? 'Double-click to review due cards' : 'Double-click to open Training Grounds'
          }
        >
          <TargetWidget habits={habits} dayKey={dayKey} />
        </DraggableWidget>
      )}
    </div>
  );
}

export const DesktopWidgets = memo(DesktopWidgetsInner);
