// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dream boot hook (spec 6.68)
// Picks the phase a page load starts in, once, on the client:
//   first-ever session       → 'boot'  (boot → lock → desktop)
//   returning, dreams on     → 'dream' (dream → lock → desktop)
//   returning, dreams off    → 'lock'
// Returns `ready` = false until decided, so the page can render nothing
// (instead of flashing the boot screen) for that first frame.
// ═══════════════════════════════════════════════════════════

'use client';

import { useLayoutEffect, useSyncExternalStore } from 'react';
import { useOSStore } from '@/stores/useOSStore';
import { decideInitialPhase } from './DreamEngine';

let decidedThisLoad = false;

const noopSubscribe = () => () => {};

export function useDreamBootPhase(): boolean {
  // false during SSR + hydration, true once running in the browser.
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // Layout effect: the phase is steered before the first visible paint.
  useLayoutEffect(() => {
    if (decidedThisLoad) return;
    decidedThisLoad = true;
    let phase: ReturnType<typeof decideInitialPhase> = 'boot';
    try {
      phase = decideInitialPhase();
    } catch {
      phase = 'boot';
    }
    // Only steer a fresh load (never yank a user out of lock/desktop).
    if (useOSStore.getState().phase === 'boot' && phase !== 'boot') {
      useOSStore.getState().setPhase(phase);
    }
  }, []);

  return ready;
}
