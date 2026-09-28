// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior Creature (composed drop-in)
// Fixed sprite sitting on the taskbar's right side, next to the system
// tray. Clicking it registers an interaction + toggles the stats popup.
// Also mounts the engine, the reaction bridge and the hatch cinematic.
// ═══════════════════════════════════════════════════════════

'use client';

import { useCallback, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useCreatureStore } from '@/stores/useCreatureStore';
import { CreatureEngine, useCreatureVitals } from './CreatureEngine';
import { CreatureRenderer } from './CreatureRenderer';
import { CreatureReactions } from './CreatureReactions';
import { CreatureStats } from './CreatureStats';
import { CreatureHatch } from './CreatureHatch';

/**
 * Drop this once inside the desktop phase of page.tsx. Renders fixed —
 * needs no wrapper. Sits on the taskbar's top edge, left of the tray.
 */
export function WarriorCreature() {
  const vitals = useCreatureVitals();
  const registerInteraction = useCreatureStore((s) => s.registerInteraction);
  const setMood = useCreatureStore((s) => s.setMood);
  const [statsOpen, setStatsOpen] = useState(false);

  const handleClick = useCallback(() => {
    registerInteraction();
    // A poke perks it up if it was idle/asleep.
    const mood = useCreatureStore.getState().mood;
    if (mood === 'idle' || mood === 'sleeping') setMood('curious', 1600);
    setStatsOpen((o) => !o);
  }, [registerInteraction, setMood]);

  const closeStats = useCallback(() => setStatsOpen(false), []);

  return (
    <>
      {/* Background systems (render nothing) */}
      <CreatureEngine />
      <CreatureReactions />

      {/* One-shot hatch cinematic */}
      <CreatureHatch />

      {/* Taskbar is 48px (h-12) at --z-taskbar; the sprite sits on its top
          edge, offset from the right to clear the tray + clock. */}
      <div
        data-tour="creature"
        className="fixed pointer-events-none"
        style={{ right: 176, bottom: 44, zIndex: 'calc(var(--z-taskbar) + 1)' }}
      >
        <div className="relative flex flex-col items-center pointer-events-auto">
          <AnimatePresence>
            {statsOpen && (
              <div className="absolute bottom-full mb-1 right-0">
                <CreatureStats vitals={vitals} onClose={closeStats} />
              </div>
            )}
          </AnimatePresence>
          <CreatureRenderer vitals={vitals} onClick={handleClick} />
        </div>
      </div>
    </>
  );
}
