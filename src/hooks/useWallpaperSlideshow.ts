// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Background slideshow + wallpaper shortcuts
// Mounted once on the desktop (WallpaperDirector):
//  • Slideshow: every N minutes (Settings → Appearance) move to the next
//    wallpaper in catalog order, or a random other one. Paused while the
//    tab is hidden. Off while adaptive wallpaper is on (it owns the
//    wallpaper then) and in lite mode (the desktop is the still Forge
//    Night there). Any wallpaper change restarts the countdown. Each
//    change is saved to the active workspace.
//  • Ctrl+Alt+W next wallpaper, Ctrl+Alt+Shift+W previous.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useMemo } from 'react';
import { useSettingsStore, type SlideshowInterval } from '@/stores/useSettingsStore';
import { useLiteMode } from '@/lib/lite-mode';
import { applyWallpaperToWorkspace, cycleWallpaperId, randomWallpaperId, stepWallpaper } from '@/lib/wallpaper-cycle';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

/** Global combos (useKeyboardShortcuts format) and their on-screen keys. */
export const NEXT_WALLPAPER_COMBO = 'ctrl+alt+w';
export const PREV_WALLPAPER_COMBO = 'ctrl+shift+alt+w';
export const NEXT_WALLPAPER_KEYS = ['Ctrl', 'Alt', 'W'];
export const PREV_WALLPAPER_KEYS = ['Ctrl', 'Alt', 'Shift', 'W'];

export type SlideshowBlocker = 'adaptive' | 'lite' | null;

/** Why the slideshow can't run right now (null = it can). */
export function useSlideshowBlocker(): SlideshowBlocker {
  const adaptive = useSettingsStore((s) => s.adaptiveWallpaper);
  const lite = useLiteMode();
  if (lite) return 'lite';
  if (adaptive) return 'adaptive';
  return null;
}

export function slideshowLabel(minutes: SlideshowInterval): string {
  if (minutes === 0) return 'Off';
  return minutes === 60 ? 'Every hour' : `Every ${minutes} min`;
}

export function useWallpaperSlideshow(): void {
  const interval = useSettingsStore((s) => s.slideshowInterval);
  const order = useSettingsStore((s) => s.slideshowOrder);
  const wallpaper = useSettingsStore((s) => s.wallpaper);
  const blocker = useSlideshowBlocker();
  const running = interval > 0 && blocker === null;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const current = useSettingsStore.getState().wallpaper;
      const next = order === 'shuffle' ? randomWallpaperId(current) : cycleWallpaperId(current, 1);
      if (next !== current) applyWallpaperToWorkspace(next, 'slideshow');
    }, interval * 60_000);
    return () => window.clearInterval(timer);
    // `wallpaper`: any change (manual or ours) restarts the countdown.
  }, [running, interval, order, wallpaper]);
}

export function useWallpaperShortcuts(): void {
  const shortcuts = useMemo(
    () => ({
      [NEXT_WALLPAPER_COMBO]: () => stepWallpaper(1, 'shortcut'),
      [PREV_WALLPAPER_COMBO]: () => stepWallpaper(-1, 'shortcut'),
    }),
    []
  );
  useKeyboardShortcuts(shortcuts);
}
