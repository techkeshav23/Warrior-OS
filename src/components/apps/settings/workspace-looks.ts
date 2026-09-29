// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Workspace looks (Settings)
// Each workspace brings its own wallpaper + accent: WorkspaceManager
// applies the active workspace's pair whenever the active workspace or
// the workspace list changes. Settings edits those looks here.
//
// Before any edit, the active workspace takes whatever is on screen now
// (the wallpaper / accent the user last picked), so the re-apply that
// follows never visibly reverts anything; then the patch lands.
// Both writes go through useWorkspaceStore.updateWorkspace (persisted).
// ═══════════════════════════════════════════════════════════

import { useSettingsStore } from '@/stores/useSettingsStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import type { Workspace } from '@/types/workspace';

export type WorkspaceLook = Partial<Pick<Workspace, 'accentColor' | 'wallpaper'>>;

export function updateWorkspaceLook(workspaceId: string, patch: WorkspaceLook): void {
  const { wallpaper, accentColor } = useSettingsStore.getState();
  const store = useWorkspaceStore.getState();
  store.updateWorkspace(store.activeWorkspaceId, { wallpaper, accentColor });
  if (patch.wallpaper !== undefined || patch.accentColor !== undefined) {
    store.updateWorkspace(workspaceId, patch);
  }
}

/** Save the current on-screen look into the active workspace. */
export function saveLookToActiveWorkspace(): void {
  updateWorkspaceLook(useWorkspaceStore.getState().activeWorkspaceId, {});
}
