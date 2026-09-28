// ═══════════════════════════════════════════════════════════
// WARRIOR OS — useDecayEngine Hook
// Drives the Reality Decay timer: starts on the first user
// interaction after boot or a break, accumulates active study time
// from the wall clock (accurate even when timers are throttled),
// triggers decay stages at 120/150/180/210/240 min (offset-adjusted),
// and auto-pauses after 10 minutes without any interaction.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { useDecayStore } from '@/stores/useDecayStore';

/** How often the engine re-evaluates (stage changes land within this). */
const TICK_INTERVAL_MS = 15_000;
/** Interactions are coalesced: at most one store write per this window. */
const INTERACTION_THROTTLE_MS = 5_000;

/**
 * Mount once (from <RealityDecay />). Wires passive global interaction
 * listeners and the ticker. All store access goes through getState()
 * inside handlers so the effect never re-subscribes.
 */
export function useDecayEngine(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let lastRegistered = 0;

    const onInteraction = () => {
      const store = useDecayStore.getState();
      if (!store.enabled || store.isOnBreak || store.isRepairing) return;
      const now = Date.now();
      if (store.isTracking && now - lastRegistered < INTERACTION_THROTTLE_MS) return;
      lastRegistered = now;
      store.registerInteraction();
    };

    const events: Array<keyof WindowEventMap> = ['keydown', 'pointerdown', 'wheel', 'touchstart'];
    const opts: AddEventListenerOptions = { passive: true, capture: true };
    events.forEach((evt) => window.addEventListener(evt, onInteraction, opts));

    const tick = () => useDecayStore.getState().tick(Date.now());
    const id = window.setInterval(tick, TICK_INTERVAL_MS);
    // Catch up immediately when the tab becomes visible again.
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, onInteraction, opts));
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(id);
    };
  }, []);
}
