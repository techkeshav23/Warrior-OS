// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Wallpaper cycling
// One place that steps / shuffles / applies wallpapers, shared by the
// desktop menu, the background picker, Ctrl+Alt+W, the slideshow and
// NEXUS. The list is read from the Settings catalog (WALLPAPERS) every
// call, so wallpapers added there are picked up automatically.
//
// Applying a wallpaper also saves it as the active workspace's look
// (WorkspaceManager repaints that look on every switch and reload).
// ═══════════════════════════════════════════════════════════

import { WALLPAPERS, resolveWallpaper, wallpaperLabel } from '@/components/apps/settings/wallpapers';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

/** Window event fired after a wallpaper is applied with `announce` (the desktop HUD chip listens). */
export const WALLPAPER_HUD_EVENT = 'warrior:wallpaper-changed';

export interface WallpaperHudDetail {
  id: string;
  label: string;
  /** 1-based position in the catalog. */
  index: number;
  total: number;
  /** What caused it, for the chip's caption. */
  source: 'shortcut' | 'slideshow' | 'menu' | 'picker' | 'nexus';
}

export function wallpaperIds(): string[] {
  return WALLPAPERS.map((w) => w.id);
}

/** The wallpaper `step` places away from `current` in catalog order (wraps). */
export function cycleWallpaperId(current: string, step: number): string {
  const ids = wallpaperIds();
  if (!ids.length) return current;
  const at = Math.max(0, ids.indexOf(resolveWallpaper(current)));
  return ids[(((at + step) % ids.length) + ids.length) % ids.length];
}

/** Any wallpaper except `current` (when there is more than one). */
export function randomWallpaperId(current: string): string {
  const ids = wallpaperIds();
  const others = ids.filter((id) => id !== resolveWallpaper(current));
  const pool = others.length ? others : ids;
  return pool[Math.floor(Math.random() * pool.length)] ?? current;
}

/** Set the wallpaper and save it into the active workspace's look. */
export function applyWallpaperToWorkspace(
  id: string,
  announce?: WallpaperHudDetail['source']
): void {
  const settings = useSettingsStore.getState();
  settings.setWallpaper(id);
  const workspaces = useWorkspaceStore.getState();
  workspaces.updateWorkspace(workspaces.activeWorkspaceId, {
    wallpaper: id,
    accentColor: settings.accentColor,
  });
  if (announce && typeof window !== 'undefined') {
    const ids = wallpaperIds();
    const detail: WallpaperHudDetail = {
      id,
      label: wallpaperLabel(id),
      index: ids.indexOf(resolveWallpaper(id)) + 1,
      total: ids.length,
      source: announce,
    };
    window.dispatchEvent(new CustomEvent<WallpaperHudDetail>(WALLPAPER_HUD_EVENT, { detail }));
  }
}

/** Step to the next (1) or previous (-1) wallpaper and save it. Returns the new id. */
export function stepWallpaper(step: 1 | -1, announce?: WallpaperHudDetail['source']): string {
  const next = cycleWallpaperId(useSettingsStore.getState().wallpaper, step);
  applyWallpaperToWorkspace(next, announce);
  return next;
}
