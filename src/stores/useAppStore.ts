// ═══════════════════════════════════════════════════════════
// WARRIOR OS — App Store
// Manages running applications
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useWindowStore } from './useWindowStore';
import type { AppDefinition } from '@/types/app';

interface AppStore {
  registeredApps: AppDefinition[];
  runningAppIds: string[];    // app IDs currently running
  focusedAppId: string | null;

  // Actions
  registerApps: (apps: AppDefinition[]) => void;
  launchApp: (appId: string, workspaceId: string) => void;
  closeApp: (appId: string) => void;
  getApp: (appId: string) => AppDefinition | undefined;
  getRunningApps: () => AppDefinition[];
  isRunning: (appId: string) => boolean;
}

export const useAppStore = create<AppStore>()(
  immer((set, get) => ({
    registeredApps: [],
    runningAppIds: [],
    focusedAppId: null,

    registerApps: (apps) =>
      set((state) => {
        state.registeredApps = apps;
      }),

    launchApp: (appId, workspaceId) => {
      const state = get();
      const app = state.registeredApps.find((a) => a.id === appId);
      if (!app) return;

      // If singleton and already running, just focus it
      if (app.singleton !== false && state.runningAppIds.includes(appId)) {
        const windowStore = useWindowStore.getState();
        const existingWindow = windowStore.windows.find((w) => w.appId === appId);
        if (existingWindow) {
          windowStore.focusWindow(existingWindow.id);
          set((s) => { s.focusedAppId = appId; });
          return;
        }
      }

      // Open new window
      const windowStore = useWindowStore.getState();
      windowStore.openWindow({
        title: app.name,
        icon: app.icon,
        appId: app.id,
        workspaceId,
        size: app.defaultSize,
        minSize: app.minSize,
      });

      set((s) => {
        if (!s.runningAppIds.includes(appId)) {
          s.runningAppIds.push(appId);
        }
        s.focusedAppId = appId;
      });
    },

    closeApp: (appId) => {
      const windowStore = useWindowStore.getState();
      const appWindows = windowStore.windows.filter((w) => w.appId === appId);
      appWindows.forEach((w) => windowStore.closeWindow(w.id));

      set((state) => {
        state.runningAppIds = state.runningAppIds.filter((id) => id !== appId);
        if (state.focusedAppId === appId) {
          state.focusedAppId = null;
        }
      });
    },

    getApp: (appId) => get().registeredApps.find((a) => a.id === appId),

    getRunningApps: () => {
      const state = get();
      return state.registeredApps.filter((a) => state.runningAppIds.includes(a.id));
    },

    isRunning: (appId) => get().runningAppIds.includes(appId),
  }))
);
