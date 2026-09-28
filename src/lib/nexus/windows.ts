// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Window Helpers
// Open-or-focus that respects workspaces, plus half-screen snapping
// and centering built on useWindowStore.updatePosition/updateSize.
// Browser-only (reads window.innerWidth) — call from handlers.
// ═══════════════════════════════════════════════════════════

import { useAppStore } from '@/stores/useAppStore';
import { useWindowStore } from '@/stores/useWindowStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import type { WindowState } from '@/types/window';

/** Taskbar height (h-12) — the same inset maximizeWindow uses. */
const TASKBAR_HEIGHT = 48;

export interface OpenAppResult {
  windowId: string;
  /** A brand-new window was created */
  created: boolean;
  /** The active workspace changed to reach an existing window */
  switchedWorkspace: boolean;
}

export interface OpenAppOptions {
  /** Always open a new window (non-singleton apps only). */
  forceNew?: boolean;
  /**
   * For singletons living in another workspace: close that window and
   * reopen it here instead of switching workspace.
   */
  relocate?: boolean;
}

function topmost(windows: WindowState[]): WindowState | undefined {
  return windows.reduce<WindowState | undefined>(
    (top, w) => (!top || w.zIndex > top.zIndex ? w : top),
    undefined
  );
}

/** All windows of an app, optionally limited to one workspace. */
export function findAppWindows(appId: string, workspaceId?: string): WindowState[] {
  return useWindowStore
    .getState()
    .windows.filter((w) => w.appId === appId && (workspaceId === undefined || w.workspaceId === workspaceId));
}

/**
 * Bring an app to the user: focus an existing window in the active
 * workspace, reach a singleton elsewhere, or launch a new window.
 * Returns null when the app id is not registered.
 */
export function openOrFocusApp(appId: string, options: OpenAppOptions = {}): OpenAppResult | null {
  const appStore = useAppStore.getState();
  const app = appStore.getApp(appId);
  if (!app) return null;

  const windowStore = useWindowStore.getState();
  const workspaceStore = useWorkspaceStore.getState();
  const activeWs = workspaceStore.activeWorkspaceId;

  const here = topmost(findAppWindows(appId, activeWs));
  if (here && !(options.forceNew && !app.singleton)) {
    windowStore.focusWindow(here.id);
    return { windowId: here.id, created: false, switchedWorkspace: false };
  }

  if (app.singleton) {
    const elsewhere = topmost(findAppWindows(appId));
    if (elsewhere) {
      if (options.relocate) {
        windowStore.closeWindow(elsewhere.id);
      } else {
        workspaceStore.switchWorkspace(elsewhere.workspaceId as typeof activeWs);
        windowStore.focusWindow(elsewhere.id);
        return { windowId: elsewhere.id, created: false, switchedWorkspace: true };
      }
    }
  }

  // No window of this app is reachable any more (a relocated singleton was
  // closed above), so launchApp opens a fresh one and tracks runningAppIds.
  const before = new Set(useWindowStore.getState().windows.map((w) => w.id));
  appStore.launchApp(appId, activeWs);
  const created = useWindowStore.getState().windows.find((w) => !before.has(w.id) && w.appId === appId);
  if (!created) return null;
  return { windowId: created.id, created: true, switchedWorkspace: false };
}

/**
 * Bring an already-open app window to the front, switching workspace if
 * it only lives elsewhere. Returns null when the app has no window.
 */
export function focusAppWindow(appId: string): OpenAppResult | null {
  const workspaceStore = useWorkspaceStore.getState();
  const activeWs = workspaceStore.activeWorkspaceId;
  const target = topmost(findAppWindows(appId, activeWs)) ?? topmost(findAppWindows(appId));
  if (!target) return null;
  const switchedWorkspace = target.workspaceId !== activeWs;
  if (switchedWorkspace) workspaceStore.switchWorkspace(target.workspaceId as typeof activeWs);
  useWindowStore.getState().focusWindow(target.id);
  return { windowId: target.id, created: false, switchedWorkspace };
}

function viewport(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 1440, height: 900 - TASKBAR_HEIGHT };
  return { width: window.innerWidth, height: Math.max(320, window.innerHeight - TASKBAR_HEIGHT) };
}

/** Snap a window to the left or right half of the desktop. */
export function snapWindow(windowId: string, side: 'left' | 'right'): void {
  const store = useWindowStore.getState();
  const win = store.getWindow(windowId);
  if (!win) return;
  if (win.isMaximized) store.restoreWindow(windowId);
  const { width: vw, height: vh } = viewport();
  const width = Math.max(win.minSize.width, Math.floor(vw / 2));
  const height = Math.max(win.minSize.height, vh);
  const x = side === 'left' ? 0 : Math.max(0, vw - width);
  store.updateSize(windowId, { width, height });
  store.updatePosition(windowId, { x, y: 0 });
}

/** Center a window, optionally growing it (never beyond the viewport). */
export function centerWindow(windowId: string, grow = 1): void {
  const store = useWindowStore.getState();
  const win = store.getWindow(windowId);
  if (!win) return;
  if (win.isMaximized) store.restoreWindow(windowId);
  const current = useWindowStore.getState().getWindow(windowId) ?? win;
  const { width: vw, height: vh } = viewport();
  const width = Math.min(vw, Math.max(current.minSize.width, Math.round(current.size.width * grow)));
  const height = Math.min(vh, Math.max(current.minSize.height, Math.round(current.size.height * grow)));
  store.updateSize(windowId, { width, height });
  store.updatePosition(windowId, {
    x: Math.max(0, Math.round((vw - width) / 2)),
    y: Math.max(0, Math.round((vh - height) / 2)),
  });
}
