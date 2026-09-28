// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Phantom Resurrect
// Click a phantom → accent flash → the app reopens exactly where
// the ghost is now (its drifted position) and at its size, through
// the window API; a maximized window comes back maximized. Captured
// scroll offsets and form values are restored once the app renders.
// A reversed-close sound plays and NEXUS says "Resurrected."
// ═══════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { useWindowStore } from '@/stores/useWindowStore';
import {
  usePhantomStore,
  PHANTOM_LIFETIME_MS,
  PHANTOM_DRIFT_PX_PER_S,
} from '@/stores/usePhantomStore';
import { playSynthSample } from '@/lib/procedural-music/synth-samples';
import { nexusSay } from '@/components/decay/nexus-say';
import { findWindowElement, restoreWindowState } from './phantom-capture';
import { onPhantomResurrected } from './achievements';
import type { PhantomWindow, PhantomWindowData } from '@/types/phantom';
import type { Position } from '@/types/window';

const FLASH_MS = 320;
/** Apps render asynchronously; retry restoring state a few times. */
const RESTORE_ATTEMPTS_MS = [50, 250, 700, 1500];

interface FlashState {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  accent: string;
}

/** Where a drifting phantom is right now (it rises 2 px/s for its lifetime). */
export function phantomCurrentPosition(p: PhantomWindow, now: number): Position {
  const elapsed = Math.min(PHANTOM_LIFETIME_MS, Math.max(0, now - p.createdAt));
  return {
    x: p.position.x,
    y: Math.max(0, p.position.y - (elapsed / 1000) * PHANTOM_DRIFT_PX_PER_S),
  };
}

function scheduleStateRestore(windowId: string, data: PhantomWindowData): void {
  const total = data.scroll.length + data.fields.length;
  if (total === 0) return;
  const done = new Set<string>();
  RESTORE_ATTEMPTS_MS.forEach((delay) => {
    window.setTimeout(() => {
      if (done.size >= total) return;
      const win = useWindowStore.getState().getWindow(windowId);
      if (!win) return;
      const el = findWindowElement(win.zIndex);
      if (el) restoreWindowState(el, data, done);
    }, delay);
  });
}

/** Reopen the phantom's app with its geometry and state. */
function reopen(phantom: PhantomWindow, position: Position): void {
  const before = new Set(useWindowStore.getState().windows.map((w) => w.id));
  useAppStore.getState().launchApp(phantom.appId, phantom.workspaceId);
  const windows = useWindowStore.getState();
  const created = windows.windows.find((w) => !before.has(w.id));
  // Singleton apps that are already open just get focused — leave them be.
  if (!created) return;

  const { windowData } = phantom;
  if (windowData.wasMaximized) {
    const bounds = windowData.restoreBounds;
    if (bounds) {
      windows.updatePosition(created.id, bounds.position);
      windows.updateSize(created.id, bounds.size);
    }
    useWindowStore.getState().maximizeWindow(created.id);
  } else {
    windows.updatePosition(created.id, position);
    windows.updateSize(created.id, { ...phantom.size });
  }
  scheduleStateRestore(created.id, windowData);
}

/**
 * Provides a `resurrect(phantom)` callback and a flash element to render
 * inside the phantom layer.
 */
export function usePhantomResurrect() {
  const [flash, setFlash] = useState<FlashState | null>(null);

  const resurrect = (phantom: PhantomWindow) => {
    const live = usePhantomStore.getState().resurrectPhantom(phantom.id);
    if (!live) return; // already dissolving / resurrecting
    const position = phantomCurrentPosition(live, Date.now());

    playSynthSample('resurrect', 0.8);
    setFlash({
      id: live.id,
      x: position.x,
      y: position.y,
      width: live.size.width,
      height: live.size.height,
      accent: live.accent,
    });

    window.setTimeout(() => {
      reopen(live, position);
      usePhantomStore.getState().removePhantom(live.id);
      onPhantomResurrected(usePhantomStore.getState().recordResurrection());
      nexusSay('Resurrected.', 'success');
      setFlash((f) => (f && f.id === live.id ? null : f));
    }, FLASH_MS);
  };

  const flashOverlay = (
    <AnimatePresence>
      {flash && (
        <motion.div
          key={flash.id}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: [0, 0.9, 0], scale: [0.96, 1.01, 1] }}
          exit={{ opacity: 0 }}
          transition={{ duration: FLASH_MS / 1000, ease: 'easeOut' }}
          className="pointer-events-none absolute"
          style={{
            left: flash.x,
            top: flash.y,
            width: flash.width,
            height: flash.height,
            borderRadius: 'var(--radius-window)',
            border: `1px solid color-mix(in oklab, ${flash.accent} 60%, transparent)`,
            background: `radial-gradient(circle at 50% 50%, color-mix(in oklab, ${flash.accent} 34%, transparent), transparent 72%)`,
            boxShadow: `0 0 48px 6px color-mix(in oklab, ${flash.accent} 45%, transparent)`,
          }}
        />
      )}
    </AnimatePresence>
  );

  return { resurrect, flashOverlay };
}
