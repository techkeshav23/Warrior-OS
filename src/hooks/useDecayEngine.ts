// ═══════════════════════════════════════════════════════════
// WARRIOR OS — useDecayEngine Hook
// Drives the Reality Decay timer: starts on first user interaction,
// increments continuousStudyMinutes every minute, triggers decay
// stages at 120/150/180/210/240 min (offset-adjusted), and
// auto-pauses after 10 minutes of idle (no interaction).
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef } from 'react';
import { useDecayStore } from '@/stores/useDecayStore';

// Idle window: no interaction for this many ms => auto-pause the timer.
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const TICK_INTERVAL_MS = 60 * 1000; // 1 minute

/**
 * Mount once (from <RealityDecay />). Wires global interaction listeners and a
 * one-minute ticker. All store access goes through getState() inside handlers
 * so the effect never re-subscribes.
 */
export function useDecayEngine(): void {
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onInteraction = () => {
      const store = useDecayStore.getState();
      if (!store.enabled || store.isOnBreak || store.isRepairing) return;
      store.registerInteraction();
    };

    const events: Array<keyof WindowEventMap> = [
      'keydown',
      'mousedown',
      'pointerdown',
      'wheel',
      'touchstart',
    ];
    events.forEach((evt) =>
      window.addEventListener(evt, onInteraction, { passive: true })
    );

    // One-minute ticker. Handles idle auto-pause + stage progression.
    tickRef.current = setInterval(() => {
      const store = useDecayStore.getState();
      if (!store.enabled || store.isOnBreak || store.isRepairing) return;
      if (!store.isTracking) return;

      const last = store.lastInteractionAt;
      if (last !== null && Date.now() - last >= IDLE_TIMEOUT_MS) {
        // Idle too long — pause but keep accumulated minutes.
        store.pauseTracking();
        return;
      }

      store.tick();
    }, TICK_INTERVAL_MS);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, onInteraction));
      if (tickRef.current !== null) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, []);
}
