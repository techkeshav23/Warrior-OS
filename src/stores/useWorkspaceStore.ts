// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Workspace Store
// Manages 3 parallel desktop workspaces
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Workspace, WorkspaceId } from '@/types/workspace';
import { DEFAULT_WORKSPACES } from '@/types/workspace';

interface WorkspaceStore {
  workspaces: Workspace[];
  activeWorkspaceId: WorkspaceId;

  // Queries
  getActiveWorkspace: () => Workspace;
  getWorkspace: (id: WorkspaceId) => Workspace;

  // Actions
  switchWorkspace: (id: WorkspaceId) => void;
  addWindowToWorkspace: (workspaceId: WorkspaceId, windowId: string) => void;
  removeWindowFromWorkspace: (workspaceId: WorkspaceId, windowId: string) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  immer((set, get) => ({
    workspaces: DEFAULT_WORKSPACES,
    activeWorkspaceId: 'study' as WorkspaceId,

    getActiveWorkspace: () => {
      const state = get();
      return state.workspaces.find((w) => w.id === state.activeWorkspaceId) ?? state.workspaces[0];
    },

    getWorkspace: (id) => {
      return get().workspaces.find((w) => w.id === id) ?? get().workspaces[0];
    },

    switchWorkspace: (id) =>
      set((state) => {
        state.activeWorkspaceId = id;
      }),

    addWindowToWorkspace: (workspaceId, windowId) =>
      set((state) => {
        const ws = state.workspaces.find((w) => w.id === workspaceId);
        if (ws && !ws.openWindowIds.includes(windowId)) {
          ws.openWindowIds.push(windowId);
        }
      }),

    removeWindowFromWorkspace: (workspaceId, windowId) =>
      set((state) => {
        const ws = state.workspaces.find((w) => w.id === workspaceId);
        if (ws) {
          ws.openWindowIds = ws.openWindowIds.filter((id) => id !== windowId);
        }
      }),
  }))
);
