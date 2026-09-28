// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Phantom Engine
// Watches useWindowStore for closed windows. Zustand notifies
// synchronously inside closeWindow(), before React removes the DOM,
// so the engine can still read the window: it captures scroll + form
// state, starts a DOM snapshot, and spawns a phantom (max 5; the
// oldest expires). It also owns every phantom's 8 s lifetime timer,
// so ghosts dissolve on schedule even while not rendered.
// Renders nothing.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { useWindowStore } from '@/stores/useWindowStore';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import {
  usePhantomStore,
  PHANTOM_LIFETIME_MS,
  PHANTOM_FADE_MS,
} from '@/stores/usePhantomStore';
import { playSynthSample } from '@/lib/procedural-music/synth-samples';
import { accentForCategory } from './accent';
import { captureWindowState, findWindowElement, snapshotWindow } from './phantom-capture';
import { onPhantomSpawned, onPhantomDissolved } from './achievements';
import type { WindowState } from '@/types/window';
import type { PhantomWindowData } from '@/types/phantom';

/** More than this many windows closing in one update = a bulk close (no ghosts). */
const BULK_CLOSE_LIMIT = 2;

function spawnFromWindow(win: WindowState): void {
  // Only windows the warrior could actually see leave a ghost.
  if (win.isMinimized) return;
  if (win.workspaceId !== useWorkspaceStore.getState().activeWorkspaceId) return;

  const app = useAppStore.getState().getApp(win.appId);
  const el = findWindowElement(win.zIndex);
  const windowData: PhantomWindowData = el
    ? captureWindowState(el, win.isMaximized)
    : { scroll: [], fields: [], wasMaximized: win.isMaximized };
  if (win.isMaximized && win.preMaximize) {
    windowData.restoreBounds = {
      position: { ...win.preMaximize.position },
      size: { ...win.preMaximize.size },
    };
  }

  const id = usePhantomStore.getState().spawnPhantom({
    appId: win.appId,
    workspaceId: win.workspaceId,
    title: win.title,
    icon: win.icon,
    position: win.position,
    size: win.size,
    accent: accentForCategory(app?.category),
    windowData,
    snapshotPending: el !== null,
  });
  onPhantomSpawned();

  if (el) {
    // Clone + serialise happen synchronously right here; decoding is async.
    snapshotWindow(el, win.size.width, win.size.height)
      .then((url) => usePhantomStore.getState().setSnapshot(id, url, url ? 'ready' : 'unavailable'))
      .catch(() => usePhantomStore.getState().setSnapshot(id, null, 'unavailable'));
  }
}

function PhantomEngineInner() {
  // ─── Close detection ───
  useEffect(() => {
    const unsub = useWindowStore.subscribe((state, prev) => {
      if (state.windows === prev.windows) return;
      const closed = prev.windows.filter((w) => !state.windows.some((n) => n.id === w.id));
      if (closed.length === 0 || closed.length > BULK_CLOSE_LIMIT) return;
      closed.forEach(spawnFromWindow);
    });
    return unsub;
  }, []);

  // ─── Lifetime: drift 8 s → dissolve → removal fallback ───
  useEffect(() => {
    const timers = new Map<string, number[]>();

    const schedule = (id: string, createdAt: number) => {
      if (timers.has(id)) return;
      const dissolveIn = Math.max(0, createdAt + PHANTOM_LIFETIME_MS - Date.now());
      const dissolve = window.setTimeout(() => {
        const store = usePhantomStore.getState();
        const live = store.getPhantom(id);
        if (!live || live.state !== 'drifting') return;
        store.setPhantomState(id, 'dissolving');
        playSynthSample('whoosh', 0.45); // gentle whoosh
        onPhantomDissolved(store.recordDissolve());
      }, dissolveIn);
      // If the dissolve isn't rendered (e.g. another workspace), clean up anyway.
      const cleanup = window.setTimeout(() => {
        const live = usePhantomStore.getState().getPhantom(id);
        if (live && live.state === 'dissolving') usePhantomStore.getState().removePhantom(id);
      }, dissolveIn + PHANTOM_FADE_MS + 1500);
      timers.set(id, [dissolve, cleanup]);
    };

    usePhantomStore.getState().phantoms.forEach((p) => schedule(p.id, p.createdAt));

    const unsub = usePhantomStore.subscribe((state, prev) => {
      if (state.phantoms === prev.phantoms) return;
      state.phantoms.forEach((p) => schedule(p.id, p.createdAt));
      // Forget timers for phantoms that are gone.
      timers.forEach((ids, id) => {
        if (!state.phantoms.some((p) => p.id === id)) {
          ids.forEach((t) => window.clearTimeout(t));
          timers.delete(id);
        }
      });
    });

    return () => {
      unsub();
      timers.forEach((ids) => ids.forEach((t) => window.clearTimeout(t)));
      timers.clear();
    };
  }, []);

  // Phantoms (and their snapshot blobs) never outlive the layer.
  useEffect(() => {
    return () => usePhantomStore.getState().clearPhantoms();
  }, []);

  return null;
}

export const PhantomEngine = PhantomEngineInner;
