// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Window Store
// The core window manager — handles all window operations
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { WindowState, Position, Size } from '@/types/window';
import { generateId } from '@/lib/utils';
import { useWorkspaceStore } from './useWorkspaceStore';

interface WindowStore {
  windows: WindowState[];

  // Queries
  getWindow: (id: string) => WindowState | undefined;
  getFocusedWindow: () => WindowState | undefined;
  getTopZIndex: () => number;
  getWindowsByWorkspace: (workspaceId: string) => WindowState[];

  // Actions
  openWindow: (config: {
    title: string;
    icon: string;
    appId: string;
    workspaceId: string;
    size: Size;
    minSize: Size;
    position?: Position;
  }) => string;
  closeWindow: (id: string) => void;
  closeAllWindows: () => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updatePosition: (id: string, position: Position) => void;
  updateSize: (id: string, size: Size) => void;
  toggleMinimize: (id: string) => void;
  /** Browser resized: keep maximized windows filling the desktop area. */
  fitMaximizedToViewport: () => void;
}

/** Fixed taskbar along the bottom of the screen (Taskbar.tsx, h-12). */
const TASKBAR_HEIGHT = 48;

/** The desktop area windows live in: the viewport above the taskbar. */
function desktopArea(): Size {
  if (typeof window === 'undefined') return { width: 1920, height: 1080 - TASKBAR_HEIGHT };
  return {
    width: window.innerWidth,
    height: Math.max(0, window.innerHeight - TASKBAR_HEIGHT),
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Hand focus to the topmost visible window of the active workspace (after
 * the focused one closed or minimized), never to a minimized window or one
 * on another workspace.
 */
function focusTopVisible(windows: WindowState[]) {
  const activeWs = useWorkspaceStore.getState().activeWorkspaceId;
  let top: WindowState | undefined;
  for (const w of windows) {
    w.isFocused = false;
    if (w.isMinimized || w.workspaceId !== activeWs) continue;
    if (!top || w.zIndex > top.zIndex) top = w;
  }
  if (top) top.isFocused = true;
}

/**
 * Calculate a centered position with slight offset per window
 */
function getDefaultPosition(windowCount: number): Position {
  const offsetX = 80 + (windowCount % 6) * 30;
  const offsetY = 60 + (windowCount % 6) * 30;
  return { x: offsetX, y: offsetY };
}

export const useWindowStore = create<WindowStore>()(
  immer((set, get) => ({
    windows: [],

    getWindow: (id) => get().windows.find((w) => w.id === id),

    getFocusedWindow: () => get().windows.find((w) => w.isFocused),

    getTopZIndex: () => {
      const windows = get().windows;
      if (windows.length === 0) return 100;
      return Math.max(...windows.map((w) => w.zIndex));
    },

    getWindowsByWorkspace: (workspaceId) =>
      get().windows.filter((w) => w.workspaceId === workspaceId),

    openWindow: (config) => {
      const id = generateId('win');
      const topZ = get().getTopZIndex();

      set((state) => {
        // Unfocus all other windows
        state.windows.forEach((w) => {
          w.isFocused = false;
        });

        // Fit the window inside the desktop area (above the taskbar) so its
        // title bar and Close button are always on screen. A screen smaller
        // than the app's minimum size gets the window maximized instead.
        const area = desktopArea();
        const wanted = config.position ?? getDefaultPosition(state.windows.length);
        const tooSmall = area.width < config.minSize.width || area.height < config.minSize.height;
        const size: Size = {
          width: Math.min(config.size.width, area.width),
          height: Math.min(config.size.height, area.height),
        };
        const position: Position = {
          x: clamp(wanted.x, 0, area.width - size.width),
          y: clamp(wanted.y, 0, area.height - size.height),
        };

        const newWindow: WindowState = {
          id,
          title: config.title,
          icon: config.icon,
          appId: config.appId,
          workspaceId: config.workspaceId,
          position: tooSmall ? { x: 0, y: 0 } : position,
          size: tooSmall ? area : size,
          minSize: config.minSize,
          isMinimized: false,
          isMaximized: tooSmall,
          isFocused: true,
          zIndex: topZ + 1,
          ...(tooSmall && { preMaximize: { position, size: { ...config.size } } }),
        };

        state.windows.push(newWindow);
      });

      return id;
    },

    closeWindow: (id) =>
      set((state) => {
        const closing = state.windows.find((w) => w.id === id);
        state.windows = state.windows.filter((w) => w.id !== id);
        // Closing the focused window focuses the next visible one
        if (closing?.isFocused) focusTopVisible(state.windows);
      }),

    closeAllWindows: () =>
      set((state) => {
        state.windows = [];
      }),

    minimizeWindow: (id) =>
      set((state) => {
        const win = state.windows.find((w) => w.id === id);
        if (win) {
          const wasFocused = win.isFocused;
          win.isMinimized = true;
          win.isFocused = false;
          // Focus next visible window
          if (wasFocused) focusTopVisible(state.windows);
        }
      }),

    maximizeWindow: (id) =>
      set((state) => {
        const win = state.windows.find((w) => w.id === id);
        if (win) {
          if (!win.isMaximized) {
            win.preMaximize = {
              position: { ...win.position },
              size: { ...win.size },
            };
            win.isMaximized = true;
            win.position = { x: 0, y: 0 };
            win.size = desktopArea();
          }
        }
      }),

    restoreWindow: (id) =>
      set((state) => {
        const win = state.windows.find((w) => w.id === id);
        if (win && win.isMaximized && win.preMaximize) {
          win.position = win.preMaximize.position;
          win.size = win.preMaximize.size;
          win.isMaximized = false;
          win.preMaximize = undefined;
        }
      }),

    focusWindow: (id) =>
      set((state) => {
        const topZ = Math.max(...state.windows.map((w) => w.zIndex), 100);
        state.windows.forEach((w) => {
          if (w.id === id) {
            w.isFocused = true;
            w.zIndex = topZ + 1;
            w.isMinimized = false; // Unminimize when focusing
          } else {
            w.isFocused = false;
          }
        });
      }),

    updatePosition: (id, position) =>
      set((state) => {
        const win = state.windows.find((w) => w.id === id);
        if (win) {
          win.position = position;
        }
      }),

    updateSize: (id, size) =>
      set((state) => {
        const win = state.windows.find((w) => w.id === id);
        if (win) {
          win.size = size;
        }
      }),

    toggleMinimize: (id) =>
      set((state) => {
        const win = state.windows.find((w) => w.id === id);
        if (win) {
          if (win.isMinimized) {
            win.isMinimized = false;
            const topZ = Math.max(...state.windows.map((w) => w.zIndex), 100);
            win.zIndex = topZ + 1;
            win.isFocused = true;
            state.windows.forEach((w) => {
              if (w.id !== id) w.isFocused = false;
            });
          } else if (win.isFocused) {
            win.isMinimized = true;
            win.isFocused = false;
            focusTopVisible(state.windows);
          } else {
            const topZ = Math.max(...state.windows.map((w) => w.zIndex), 100);
            win.zIndex = topZ + 1;
            win.isFocused = true;
            state.windows.forEach((w) => {
              if (w.id !== id) w.isFocused = false;
            });
          }
        }
      }),

    fitMaximizedToViewport: () =>
      set((state) => {
        const area = desktopArea();
        state.windows.forEach((w) => {
          if (!w.isMaximized) return;
          if (w.size.width === area.width && w.size.height === area.height) return;
          w.position = { x: 0, y: 0 };
          w.size = { ...area };
        });
      }),
  }))
);
