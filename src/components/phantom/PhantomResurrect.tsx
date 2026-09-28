// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Phantom Resurrect
// Click a phantom → flash → relaunch the app via useAppStore.
// Exposes a hook that returns a resurrect handler + flash overlay.
// ═══════════════════════════════════════════════════════════

'use client';

import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { usePhantomStore } from '@/stores/usePhantomStore';
import { useSound } from '@/hooks/useSound';
import { SOUND_EFFECTS } from '@/lib/constants';
import type { Phantom } from '@/types/phantom';

interface FlashState {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  accent: string;
}

/**
 * Provides a `resurrect(phantom)` callback and a `flash` element to render.
 * On resurrect: plays a reversed-close (unlock) sound, relaunches the app
 * through the existing app-launch store, and removes the phantom.
 */
export function usePhantomResurrect() {
  const [flash, setFlash] = useState<FlashState | null>(null);
  const { play } = useSound();

  const resurrect = useCallback(
    (phantom: Phantom) => {
      const store = usePhantomStore.getState();
      // Guard: only act on drifting phantoms.
      const live = store.getPhantom(phantom.id);
      if (!live || live.status !== 'drifting') return;

      store.setStatus(phantom.id, 'resurrecting');

      // Resurrection sound — reverse-of-close feel (unlock chime).
      try {
        play(SOUND_EFFECTS.UNLOCK);
      } catch {
        // sounds are best-effort
      }

      setFlash({
        id: phantom.id,
        x: phantom.position.x,
        y: phantom.position.y,
        width: phantom.size.width,
        height: phantom.size.height,
        accent: phantom.accent,
      });

      // After the flash, relaunch the app and drop the phantom.
      window.setTimeout(() => {
        useAppStore.getState().launchApp(phantom.appId, phantom.workspaceId);
        usePhantomStore.getState().removePhantom(phantom.id);
        setFlash((f) => (f && f.id === phantom.id ? null : f));
      }, 320);
    },
    [play]
  );

  const flashOverlay = (
    <AnimatePresence>
      {flash && (
        <motion.div
          key={flash.id}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: [0, 0.9, 0], scale: [0.92, 1.04, 1] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: 'easeOut' }}
          className="pointer-events-none fixed"
          style={{
            left: flash.x,
            top: flash.y,
            width: flash.width,
            height: flash.height,
            zIndex: 60,
            borderRadius: 12,
            background: `radial-gradient(circle at 50% 50%, ${flash.accent}55, transparent 70%)`,
            boxShadow: `0 0 60px 12px ${flash.accent}aa`,
          }}
        />
      )}
    </AnimatePresence>
  );

  return { resurrect, flashOverlay };
}
