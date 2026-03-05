// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Window Store
// The core window manager — handles all window operations
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { WindowState, Position, Size } from '@/types/window';
import { generateId } from '@/lib/utils';

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

        const newWindow: WindowState = {
          id,
          title: config.title,
          icon: config.icon,
          appId: config.appId,
          workspaceId: config.workspaceId,
          position: config.position ?? getDefaultPosition(state.windows.length),
          size: config.size,
          minSize: config.minSize,
          isMinimized: false,
          isMaximized: false,
          isFocused: true,
          zIndex: topZ + 1,
        };

        state.windows.push(newWindow);
      });

      return id;
    },

    closeWindow: (id) =>
      set((state) => {
        state.windows = state.windows.filter((w) => w.id !== id);
        // Focus the next top window
        if (state.windows.length > 0) {
          const topWindow = state.windows.reduce((top, w) =>
            w.zIndex > top.zIndex ? w : top
          );
          topWindow.isFocused = true;
        }
      }),

    closeAllWindows: () =>
      set((state) => {
        state.windows = [];
      }),

    minimizeWindow: (id) =>
      set((state) => {
        const win = state.windows.find((w) => w.id === id);
        if (win) {
          win.isMinimized = true;
          win.isFocused = false;
          // Focus next visible window
          const visible = state.windows
            .filter((w) => !w.isMinimized && w.id !== id)
            .sort((a, b) => b.zIndex - a.zIndex);
          if (visible.length > 0) {
            visible[0].isFocused = true;
          }
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
            win.size = {
              width: typeof window !== 'undefined' ? window.innerWidth : 1920,
              height: typeof window !== 'undefined' ? window.innerHeight - 48 : 1032,
            };
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
  }))
);
