// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Study App Helpers
// "Studying" = an app of the 'study' category is on screen
// ═══════════════════════════════════════════════════════════

import { useAppStore } from '@/stores/useAppStore';
import { useWindowStore } from '@/stores/useWindowStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

/** Training Grounds, Flashcards, Notes, Quest Planner, Memory Palace — any app registered as 'study'. */
export function isStudyApp(appId: string): boolean {
  return useAppStore.getState().getApp(appId)?.category === 'study';
}

/** A study app window is visible: in the active workspace and not minimized. */
export function isStudyWindowVisible(): boolean {
  const { windows } = useWindowStore.getState();
  const { activeWorkspaceId } = useWorkspaceStore.getState();
  return windows.some(
    (w) => w.workspaceId === activeWorkspaceId && !w.isMinimized && isStudyApp(w.appId)
  );
}
