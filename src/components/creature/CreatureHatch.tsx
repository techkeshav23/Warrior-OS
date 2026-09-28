// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Creature Hatch cinematic
// Full-screen overlay that plays once when the egg is ready
// (incubated 2+ days AND XP >= baby threshold). Cracks → light
// burst → particle explosion → baby emerges → happy hop.
// On finish: marks hatched, unlocks "First Pet" achievement,
// and emits a NEXUS notification.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCreatureStore } from '@/stores/useCreatureStore';
import { useXPStore } from '@/stores/useXPStore';
import type { CreatureVitals } from './CreatureEngine';
import { EvolutionVisual } from './CreatureEvolution';

interface CreatureHatchProps {
  vitals: CreatureVitals;
}

type Phase = 'idle' | 'crack' | 'burst' | 'emerge' | 'done';

/** Achievement id the integration agent must add to ACHIEVEMENTS. */
export const FIRST_PET_ACHIEVEMENT_ID = 'first-pet';

function CreatureHatchInner({ vitals }: CreatureHatchProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const markHatched = useCreatureStore((s) => s.markHatched);
  const startedRef = useRef(false);

  const finish = useCallback(() => {
    markHatched();
    // Unlock achievement (safe no-op if id not seeded).
    try {
      useXPStore.getState().unlockAchievement(FIRST_PET_ACHIEVEMENT_ID);
    } catch {
      /* ignore */
    }
    // NEXUS notification via custom event (assistant/toast systems may listen).
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('warrior:nexus', {
          detail: {
            message: 'Your companion has arrived. Take care of it.',
            source: 'NEXUS',
          },
        })
      );
    }
    setPhase('done');
  }, [markHatched]);

  // Kick off + run the whole cinematic timeline when the egg becomes ready.
  // Scheduling happens inside timers (async), so no synchronous setState in
  // the effect body — the state machine advances on its own schedule.
  useEffect(() => {
    if (!vitals.eggReadyToHatch || startedRef.current) return;
    startedRef.current = true;

    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase('crack'), 0));
    timers.push(setTimeout(() => setPhase('burst'), 1600));
    timers.push(setTimeout(() => setPhase('emerge'), 2600));
    timers.push(setTimeout(() => finish(), 5200));

    return () => timers.forEach(clearTimeout);
  }, [vitals.eggReadyToHatch, finish]);

  const show = phase !== 'idle' && phase !== 'done';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="hatch-overlay"
          className="fixed inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 'var(--z-modal)', background: 'radial-gradient(circle, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.9) 100%)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Egg / crack phase */}
          {phase === 'crack' && (
            <motion.div
              className="text-8xl relative"
              animate={{ rotate: [-4, 4, -6, 6, -3, 3, 0], scale: [1, 1.05, 1] }}
              transition={{ duration: 1.6, ease: 'easeInOut' }}
              style={{ filter: 'drop-shadow(0 0 24px #00f0ff)' }}
            >
              🥚
              <motion.span
                className="absolute inset-0 flex items-center justify-center text-8xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0, 0.8, 0.4, 0.9] }}
                transition={{ duration: 1.6 }}
              >
                💥
              </motion.span>
            </motion.div>
          )}

          {/* Light burst + particle explosion */}
          {phase === 'burst' && (
            <div className="relative flex items-center justify-center">
              <motion.div
                className="absolute rounded-full"
                style={{ background: 'radial-gradient(circle, #ffffff 0%, #00f0ff 40%, transparent 70%)' }}
                initial={{ width: 40, height: 40, opacity: 1 }}
                animate={{ width: 520, height: 520, opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              />
              {Array.from({ length: 18 }).map((_, i) => {
                const angle = (i / 18) * Math.PI * 2;
                return (
                  <motion.span
                    key={i}
                    className="absolute text-lg"
                    style={{ color: i % 2 === 0 ? '#00f0ff' : '#7b61ff' }}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{
                      x: Math.cos(angle) * 220,
                      y: Math.sin(angle) * 220,
                      opacity: 0,
                      scale: 0.4,
                    }}
                    transition={{ duration: 0.95, ease: 'easeOut' }}
                  >
                    ✦
                  </motion.span>
                );
              })}
            </div>
          )}

          {/* Baby emerges + first happy hop */}
          {phase === 'emerge' && (
            <div className="flex flex-col items-center gap-4">
              <motion.div
                initial={{ scale: 0, opacity: 0, y: 20 }}
                animate={{ scale: [0, 1.3, 1], opacity: 1, y: [20, -10, 0] }}
                transition={{ duration: 1, ease: 'easeOut' }}
              >
                <EvolutionVisual form={vitals.form} stage="baby" mood="happy" size={72} goldenAura={false} />
              </motion.div>
              <motion.div
                className="text-center font-mono text-sm text-accent-primary"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <span className="text-text-muted text-[11px] block mb-1">NEXUS</span>
                Your companion has arrived. Take care of it.
              </motion.div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const CreatureHatch = memo(CreatureHatchInner);
