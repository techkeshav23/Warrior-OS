// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Phantom Engine
// Detects window closes by diffing useWindowStore.windows and
// spawns a phantom ghost from the last-known window chrome.
// Renders nothing.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef } from 'react';
import { useWindowStore } from '@/stores/useWindowStore';
import { useAppStore } from '@/stores/useAppStore';
import { usePhantomStore } from '@/stores/usePhantomStore';
import { accentForCategory } from './accent';
import type { WindowState } from '@/types/window';

function PhantomEngineInner() {
  // Keep the last-seen snapshot of each window keyed by id.
  const prevWindowsRef = useRef<Map<string, WindowState>>(new Map());
  // Track which windows were resurrected by us so we don't re-ghost them
  // (resurrect closes the phantom explicitly).
  const initializedRef = useRef(false);

  useEffect(() => {
    // Seed the initial map without spawning phantoms for pre-existing windows.
    const seed = new Map<string, WindowState>();
    useWindowStore.getState().windows.forEach((w) => seed.set(w.id, { ...w }));
    prevWindowsRef.current = seed;
    initializedRef.current = true;

    const unsub = useWindowStore.subscribe((store) => {
      if (!initializedRef.current) return;
      const current = store.windows;
      const currentIds = new Set(current.map((w) => w.id));
      const prev = prevWindowsRef.current;

      // Any id present before but gone now = a closed window.
      prev.forEach((win, id) => {
        if (!currentIds.has(id)) {
          spawnFromWindow(win);
        }
      });

      // Refresh snapshot (position/size may have changed while open).
      const next = new Map<string, WindowState>();
      current.forEach((w) => next.set(w.id, { ...w }));
      prevWindowsRef.current = next;
    });

    return () => {
      unsub();
      initializedRef.current = false;
    };
  }, []);

  return null;
}

function spawnFromWindow(win: WindowState) {
  const app = useAppStore.getState().getApp(win.appId);
  const accent = accentForCategory(app?.category);
  usePhantomStore.getState().spawnPhantom({
    appId: win.appId,
    workspaceId: win.workspaceId,
    title: win.title,
    icon: win.icon,
    position: win.position,
    size: win.size,
    accent,
  });
}

export const PhantomEngine = PhantomEngineInner;
