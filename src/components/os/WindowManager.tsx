// ═══════════════════════════════════════════════════════════
// WARRIOR OS — WindowManager Component
// Renders all open windows and manages z-index stacking.
// App crashes are caught inside each window (see Window.tsx); if a
// window's own chrome fails, that one window is closed and the OS
// carries on.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { useWindowStore } from '@/stores/useWindowStore';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { LayerBoundary } from '@/components/showcase/AppErrorBoundary';
import { Window } from './Window';
import { AnimatePresence } from 'framer-motion';

export function WindowManager() {
  const windows = useWindowStore((s) => s.windows);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const registeredApps = useAppStore((s) => s.registeredApps);
  const syncRunningAppsFromWindows = useAppStore((s) => s.syncRunningAppsFromWindows);

  useEffect(() => {
    syncRunningAppsFromWindows(windows);
  }, [windows, syncRunningAppsFromWindows]);

  // Maximized windows track the browser size.
  useEffect(() => {
    const onResize = () => useWindowStore.getState().fitMaximizedToViewport();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Only show windows for the active workspace
  const visibleWindows = windows.filter(
    (w) => w.workspaceId === activeWorkspaceId && !w.isMinimized
  );

  return (
    // pointer-events-none: the full-screen layer must not swallow clicks meant
    // for the desktop icons beneath it; each Window re-enables pointer events.
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 'var(--z-window)' }}>
      <AnimatePresence>
        {visibleWindows.map((windowState) => {
          const app = registeredApps.find((a) => a.id === windowState.appId);
          if (!app) return null;

          const AppComponent = app.component;
          const windowId = windowState.id;

          return (
            <LayerBoundary
              key={windowId}
              name={`${app.name} window`}
              onError={() => useWindowStore.getState().closeWindow(windowId)}
            >
              <Window windowState={windowState}>
                <AppComponent />
              </Window>
            </LayerBoundary>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
