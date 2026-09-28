// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior Creature (composed drop-in)
// Fixed sprite anchored above the taskbar's right edge. Clicking it
// registers an interaction + toggles the stats popup. Also mounts the
// passive engine, reaction bridge, and the one-shot hatch cinematic.
// ═══════════════════════════════════════════════════════════

'use client';

import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCreatureStore } from '@/stores/useCreatureStore';
import { CreatureEngine, useCreatureVitals } from './CreatureEngine';
import { CreatureRenderer } from './CreatureRenderer';
import { CreatureReactions } from './CreatureReactions';
import { CreatureStats } from './CreatureStats';
import { CreatureHatch } from './CreatureHatch';

/**
 * Drop this once inside the desktop phase of page.tsx. Renders fixed —
 * needs no wrapper. Sits just above the taskbar, left of the system tray.
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

  return (
    <>
      {/* Passive systems (render nothing) */}
      <CreatureEngine />
      <CreatureReactions />

      {/* One-shot hatch cinematic */}
      <CreatureHatch vitals={vitals} />

      {/* Taskbar-anchored sprite + popup.
          Taskbar is 48px tall (h-12) at --z-taskbar (500); we sit just above it,
          offset from the right to clear the system tray/clock. */}
      <div
        className="fixed pointer-events-none"
        style={{
          right: 176,
          bottom: 44,
          zIndex: 'calc(var(--z-taskbar) + 1)',
        }}
      >
        <div className="relative flex flex-col items-center pointer-events-auto">
          {/* Stats popup floats above the sprite */}
          <AnimatePresence>
            {statsOpen && (
              <div className="absolute bottom-full mb-2 right-0">
                <CreatureStats vitals={vitals} onClose={() => setStatsOpen(false)} />
              </div>
            )}
          </AnimatePresence>

          {/* Egg pulse before hatch, otherwise the living sprite */}
          {vitals.stage === 'egg' && !vitals.isHatched ? (
            <motion.button
              type="button"
              onClick={handleClick}
              title="A mysterious egg..."
              aria-label="Creature egg"
              className="text-2xl leading-none focus:outline-none"
              style={{ filter: 'drop-shadow(0 0 8px #00f0ff)' }}
              animate={{ scale: [1, 1.12, 1], rotate: [-2, 2, -2] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              🥚
            </motion.button>
          ) : (
            <CreatureRenderer vitals={vitals} onClick={handleClick} />
          )}
        </div>
      </div>
    </>
  );
}
