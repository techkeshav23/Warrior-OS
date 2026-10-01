// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior 3D: OS events → warrior actions
// Mounted once on the desktop. Listens to the stores the celebrations
// already use and makes every mounted warrior react:
//   level up             → 'powerup'  (when its celebration starts)
//   achievement unlocked → 'victory'  (cinematic or toast)
//   Reality Decay stage 5 → 'hurt'    (once per climb to 5)
// Only imports the tiny action bus, never the 3D stage itself.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { useXPStore } from '@/stores/useXPStore';
import { useDecayStore } from '@/stores/useDecayStore';
import { useEffectsStore, type Celebration } from '@/components/effects/useEffectsStore';
import { playWarriorAction } from './store';

function celebrating(match: (c: Celebration) => boolean): boolean {
  const fx = useEffectsStore.getState();
  return (fx.current !== null && match(fx.current)) || fx.queue.some(match);
}

export function WarriorEventsBridge(): null {
  useEffect(() => {
    const timers = new Set<number>();
    const later = (fn: () => void) => {
      // Next tick: the celebration layers route the same store change first.
      const id = window.setTimeout(() => {
        timers.delete(id);
        fn();
      }, 0);
      timers.add(id);
    };
    const cheered = new Set<string>();

    // A queued celebration reaching the screen → act with it.
    const unsubFx = useEffectsStore.subscribe((state, prev) => {
      const cur = state.current;
      if (!cur || cur.key === prev.current?.key) return;
      if (cur.kind === 'levelup') playWarriorAction('powerup');
      else {
        cheered.add(cur.achievement.id);
        playWarriorAction('victory');
      }
    });

    // No celebration queued (effect off, reduced motion, toast-only rarity) → act now.
    const unsubXP = useXPStore.subscribe((state, prev) => {
      if (state.level > prev.level) {
        later(() => {
          if (!celebrating((c) => c.kind === 'levelup')) playWarriorAction('powerup');
        });
      }
      const unlock = state.recentUnlock;
      if (unlock && unlock !== prev.recentUnlock && !cheered.has(unlock.id)) {
        const id = unlock.id;
        later(() => {
          if (cheered.has(id)) return;
          if (celebrating((c) => c.kind === 'achievement' && c.achievement.id === id)) return;
          cheered.add(id);
          playWarriorAction('victory');
        });
      }
    });

    const unsubDecay = useDecayStore.subscribe((state, prev) => {
      if (state.decayStage >= 5 && prev.decayStage < 5) playWarriorAction('hurt');
    });

    return () => {
      unsubFx();
      unsubXP();
      unsubDecay();
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);
  return null;
}

export default WarriorEventsBridge;
