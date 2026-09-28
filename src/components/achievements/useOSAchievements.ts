// ═══════════════════════════════════════════════════════════
// WARRIOR OS — OS Achievements
// Store subscriptions: level milestones, True Warrior, Multitasker,
// App Explorer, Space Traveler, Make It Yours, study-app opens,
// Centurion Coder (Code Lab lines)
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { useXPStore } from '@/stores/useXPStore';
import { useWindowStore } from '@/stores/useWindowStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useAppStore } from '@/stores/useAppStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import type { WindowState } from '@/types/window';
import {
  checkLevelAchievements,
  checkStudyHourAchievements,
  checkWarriorComplete,
  unlock,
} from './award';
import { useAchievementProgressStore } from './progress-store';
import { isStudyApp } from './study-apps';
import { CODE_LAB_APP_ID, checkCodeLabLines } from './code-lab';

/** "Multitasker": windows open at the same time. */
export const MULTI_WINDOW_TARGET = 5;
/** "Make It Yours": different settings changed. */
export const CUSTOMIZE_TARGET = 3;
/** How often an open Code Lab's saved snippet is re-counted. */
const CODE_LAB_CHECK_MS = 60_000;

/** Settings the OS also writes by itself (workspace switch, adaptive wallpaper, NEXUS modes). */
const AUTO_WRITTEN_SETTINGS: ReadonlySet<string> = new Set(['wallpaper', 'accentColor']);
/** Wallpaper/accent writes this soon after a workspace switch or adaptive toggle are automatic. */
const AUTO_WRITE_GRACE_MS = 1500;
/** WorkspaceManager and adaptive wallpaper write both when the desktop mounts. */
const MOUNT_GRACE_MS = 3000;

/** "App Explorer": every registered app has been opened at least once. */
export function allAppsOpened(): boolean {
  const registered = useAppStore.getState().registeredApps;
  if (registered.length === 0) return false;
  const opened = new Set(useAchievementProgressStore.getState().appsOpened);
  return registered.every((a) => opened.has(a.id));
}

function handleWindowChanges(windows: readonly WindowState[], previous: readonly WindowState[]): void {
  if (windows.length >= MULTI_WINDOW_TARGET) unlock('multi-window');

  // Closing Code Lab: its snippet is saved, count the lines written.
  const stillOpen = new Set(windows.map((w) => w.id));
  if (previous.some((w) => w.appId === CODE_LAB_APP_ID && !stillOpen.has(w.id))) checkCodeLabLines();

  const known = new Set(previous.map((w) => w.id));
  const opened = windows.filter((w) => !known.has(w.id));
  if (opened.length === 0) return;

  const progress = useAchievementProgressStore.getState();
  let studyAppOpened = false;
  for (const w of opened) {
    progress.addAppOpened(w.appId);
    if (isStudyApp(w.appId)) studyAppOpened = true;
  }
  // Opening a study app past midnight / before 7 AM is studying at that hour.
  if (studyAppOpened) checkStudyHourAchievements();
  if (allAppsOpened()) unlock('all-apps');
}

/** Mount once (from AchievementTriggers). Store writes are deferred out of other stores' listeners. */
export function useOSAchievements(): void {
  // XP → Rising Warrior / Battle Hardened / The Ascendant; any unlock → True Warrior.
  useEffect(() => {
    return useXPStore.subscribe((state, prev) => {
      if (state.level !== prev.level) {
        queueMicrotask(() => checkLevelAchievements(useXPStore.getState().level));
      }
      if (state.achievements !== prev.achievements) queueMicrotask(checkWarriorComplete);
    });
  }, []);

  // Windows → Multitasker, App Explorer, study hour on opening a study app.
  useEffect(() => {
    handleWindowChanges(useWindowStore.getState().windows, []);
    return useWindowStore.subscribe((state, prev) => {
      if (state.windows === prev.windows) return;
      const current = state.windows;
      const previous = prev.windows;
      queueMicrotask(() => handleWindowChanges(current, previous));
    });
  }, []);

  // Code Lab open → re-count the saved snippet every minute (Centurion Coder).
  useEffect(() => {
    const id = window.setInterval(() => {
      if (useWindowStore.getState().windows.some((w) => w.appId === CODE_LAB_APP_ID)) {
        checkCodeLabLines();
      }
    }, CODE_LAB_CHECK_MS);
    return () => window.clearInterval(id);
  }, []);

  // Workspaces → Space Traveler (all three visited in this session).
  useEffect(() => {
    const visited = new Set<string>([useWorkspaceStore.getState().activeWorkspaceId]);
    return useWorkspaceStore.subscribe((state, prev) => {
      if (state.activeWorkspaceId === prev.activeWorkspaceId) return;
      visited.add(state.activeWorkspaceId);
      if (state.workspaces.length > 0 && state.workspaces.every((w) => visited.has(w.id))) {
        queueMicrotask(() => unlock('all-workspaces'));
      }
    });
  }, []);

  // Settings → Make It Yours (3 different settings changed by the user).
  useEffect(() => {
    let autoWritesUntil = Date.now() + MOUNT_GRACE_MS;

    const unsubscribeWorkspace = useWorkspaceStore.subscribe((state, prev) => {
      if (state.activeWorkspaceId !== prev.activeWorkspaceId) {
        autoWritesUntil = Date.now() + AUTO_WRITE_GRACE_MS;
      }
    });

    const unsubscribeSettings = useSettingsStore.subscribe((state, prev) => {
      const changed = (Object.keys(state) as Array<keyof typeof state>).filter(
        (key) => typeof state[key] !== 'function' && state[key] !== prev[key]
      );
      if (changed.length === 0) return;

      const now = Date.now();
      // Turning adaptive wallpaper on makes the OS pick a wallpaper right after.
      if (changed.includes('adaptiveWallpaper')) autoWritesUntil = now + AUTO_WRITE_GRACE_MS;
      // Wallpaper/accent count only when changed from the Settings app, outside automatic windows.
      const settingsFocused = useWindowStore.getState().getFocusedWindow()?.appId === 'settings';
      const userChanges = changed
        .map((key) => String(key))
        .filter((key) => !AUTO_WRITTEN_SETTINGS.has(key) || (settingsFocused && now >= autoWritesUntil));
      if (userChanges.length === 0) return;

      queueMicrotask(() => {
        const progress = useAchievementProgressStore.getState();
        for (const key of userChanges) progress.addSettingChanged(key);
        if (useAchievementProgressStore.getState().settingsChanged.length >= CUSTOMIZE_TARGET) {
          unlock('customize-os');
        }
      });
    });

    return () => {
      unsubscribeWorkspace();
      unsubscribeSettings();
    };
  }, []);
}
