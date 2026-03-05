// ═══════════════════════════════════════════════════════════
// WARRIOR OS — WindowManager Component
// Renders all open windows and manages z-index stacking
// ═══════════════════════════════════════════════════════════

'use client';

import { useWindowStore } from '@/stores/useWindowStore';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { Window } from './Window';

export function WindowManager() {
  const windows = useWindowStore((s) => s.windows);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const registeredApps = useAppStore((s) => s.registeredApps);

  // Only show windows for the active workspace
  const visibleWindows = windows.filter(
    (w) => w.workspaceId === activeWorkspaceId && !w.isMinimized
  );

  return (
    <div className="absolute inset-0" style={{ zIndex: 'var(--z-window)' }}>
      {visibleWindows.map((windowState) => {
        const app = registeredApps.find((a) => a.id === windowState.appId);
        if (!app) return null;

        const AppComponent = app.component;

        return (
          <Window key={windowState.id} windowState={windowState}>
            <AppComponent />
          </Window>
        );
      })}
    </div>
  );
}
