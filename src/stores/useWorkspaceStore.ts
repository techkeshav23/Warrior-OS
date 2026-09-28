// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Workspace Store
// Manages 3 parallel desktop workspaces. Each workspace carries its own
// look (wallpaper + accent), which WorkspaceManager applies whenever the
// active workspace or the looks change.
//
// Persisted (localStorage "warrior-os-workspaces"): the active workspace
// and each workspace's name / icon / look, so a reload comes back to the
// user's last look. Open-window ids are session-only (windows are not
// persisted). Stored accents pass through resolveAccent(), so legacy
// neon values land on the FORGE HUD palette; unknown wallpapers fall back
// to the workspace default.
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import type { Workspace, WorkspaceId, WorkspacePatch } from '@/types/workspace';
import { DEFAULT_WORKSPACES } from '@/types/workspace';
import { WALLPAPER_IDS } from '@/stores/useSettingsStore';
import { resolveAccent } from '@/styles/tokens';

interface WorkspaceStore {
  workspaces: Workspace[];
  activeWorkspaceId: WorkspaceId;
  /**
   * True once a look has been saved into the workspaces (by Settings, the
   * desktop menu, or WorkspaceManager seeding them from the current look).
   * Until then WorkspaceManager must not paint the defaults over the
   * user's current wallpaper / accent.
   */
  looksSaved: boolean;

  // Queries
  getActiveWorkspace: () => Workspace;
  getWorkspace: (id: WorkspaceId) => Workspace;

  // Actions
  switchWorkspace: (id: WorkspaceId) => void;
  /** Change a workspace's name / icon / wallpaper / accent. */
  updateWorkspace: (id: WorkspaceId | string, patch: WorkspacePatch) => void;
  addWindowToWorkspace: (workspaceId: WorkspaceId, windowId: string) => void;
  removeWindowFromWorkspace: (workspaceId: WorkspaceId, windowId: string) => void;
}

const WORKSPACE_IDS = DEFAULT_WORKSPACES.map((w) => w.id) as WorkspaceId[];

function isWorkspaceId(value: unknown): value is WorkspaceId {
  return typeof value === 'string' && (WORKSPACE_IDS as string[]).includes(value);
}

function isWallpaperId(value: unknown): value is string {
  return typeof value === 'string' && (WALLPAPER_IDS as readonly string[]).includes(value);
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

interface PersistedWorkspaces {
  activeWorkspaceId: WorkspaceId;
  looksSaved: boolean;
  workspaces: Workspace[];
}

/** Stored data → valid state: every default workspace, in order, on-palette. */
function sanitize(persisted: unknown): PersistedWorkspaces {
  const raw = (persisted && typeof persisted === 'object' ? persisted : {}) as Partial<{
    activeWorkspaceId: unknown;
    looksSaved: unknown;
    workspaces: unknown;
  }>;
  const saved = Array.isArray(raw.workspaces) ? (raw.workspaces as Partial<Workspace>[]) : [];
  const workspaces = DEFAULT_WORKSPACES.map((def) => {
    const stored = saved.find((w) => w && w.id === def.id);
    return {
      ...def,
      name: nonEmpty(stored?.name) ?? def.name,
      icon: nonEmpty(stored?.icon) ?? def.icon,
      accentColor: resolveAccent(stored?.accentColor ?? def.accentColor),
      wallpaper: isWallpaperId(stored?.wallpaper) ? stored.wallpaper : def.wallpaper,
      openWindowIds: [],
    };
  });
  return {
    activeWorkspaceId: isWorkspaceId(raw.activeWorkspaceId) ? raw.activeWorkspaceId : 'study',
    looksSaved: raw.looksSaved === true,
    workspaces,
  };
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    immer((set, get) => ({
      workspaces: DEFAULT_WORKSPACES,
      activeWorkspaceId: 'study' as WorkspaceId,
      looksSaved: false,

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

      updateWorkspace: (id, patch) =>
        set((state) => {
          const ws = state.workspaces.find((w) => w.id === id);
          if (!ws) return;
          const name = nonEmpty(patch.name);
          const icon = nonEmpty(patch.icon);
          if (name) ws.name = name;
          if (icon) ws.icon = icon;
          if (patch.accentColor !== undefined) ws.accentColor = resolveAccent(patch.accentColor);
          if (patch.wallpaper !== undefined && isWallpaperId(patch.wallpaper)) ws.wallpaper = patch.wallpaper;
          if (patch.accentColor !== undefined || patch.wallpaper !== undefined) state.looksSaved = true;
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
    })),
    {
      name: 'warrior-os-workspaces',
      version: 1,
      partialize: (state): PersistedWorkspaces => ({
        activeWorkspaceId: state.activeWorkspaceId,
        looksSaved: state.looksSaved,
        workspaces: state.workspaces.map((w) => ({ ...w, openWindowIds: [] })),
      }),
      // v0 never shipped (the store was session-only); any older or odd
      // shape is rebuilt from the defaults by sanitize().
      migrate: (persisted) => sanitize(persisted) as unknown as WorkspaceStore,
      merge: (persisted, current) => ({ ...current, ...sanitize(persisted) }),
    }
  )
);
