// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Guided Tour: auto start
// Starts the tour once per browser, when the desktop has settled: a
// few seconds after it appears, once the first-boot achievement
// cinematic (and anything queued behind it) has played, while the tab
// is visible and the command bar is closed. Celebrations that keep
// coming stop being waited on after MAX_WAIT_MS.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { useOSStore } from '@/stores/useOSStore';
import { useTourStore } from '@/stores/useTourStore';
import { useXPStore } from '@/stores/useXPStore';
import { useEffectsStore } from '@/components/effects/useEffectsStore';
import { isCommandBarOpen } from './dom';

/** Desktop fade-in and unlock transition; the first-boot unlock lands at ~2.5 s. */
export const TOUR_START_DELAY_MS = 2800;
/** The OS must stay quiet this long before the tour appears. */
const CALM_MS = 600;
const POLL_MS = 400;
/** Stop waiting for achievement / level-up celebrations after this long. */
const MAX_WAIT_MS = 15_000;

/** A celebration is playing or queued, or first boot is still waiting for its unlock. */
function celebrating(): boolean {
  const fx = useEffectsStore.getState();
  if (fx.current !== null || fx.queue.length > 0) return true;
  const firstBoot = useXPStore.getState().achievements.find((a) => a.id === 'first-boot');
  return firstBoot !== undefined && !firstBoot.unlockedAt;
}

export function useTourAutoStart(): void {
  const phase = useOSStore((s) => s.phase);
  const status = useTourStore((s) => s.status);
  const active = useTourStore((s) => s.active);

  useEffect(() => {
    if (phase !== 'desktop' || status !== 'pending' || active) return;

    const enteredAt = Date.now();
    let calmSince = 0;
    let timer = 0;

    const check = () => {
      const now = Date.now();
      const busy =
        document.visibilityState === 'hidden' ||
        isCommandBarOpen() ||
        (celebrating() && now - enteredAt < MAX_WAIT_MS);

      if (busy) {
        calmSince = 0;
      } else {
        if (!calmSince) calmSince = now;
        if (now - calmSince >= CALM_MS) {
          useTourStore.getState().autoStart(); // re-checks the (hydrated) status
          return;
        }
      }
      timer = window.setTimeout(check, POLL_MS);
    };

    timer = window.setTimeout(check, TOUR_START_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [phase, status, active]);
}
