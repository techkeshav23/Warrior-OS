// ═══════════════════════════════════════════════════════════
// WARRIOR OS — DecayEngine (master controller)
// Reads useDecayStore, runs the timer hook, orchestrates stage visuals,
// fires NEXUS notifications on stage transitions, plays the stage-4
// heartbeat, force-triggers the break at stage 5, and drives the
// break -> repair -> restored lifecycle.
//
// The global color/blur "decay grade" is applied via a fixed overlay
// using backdrop-filter — it grades everything rendered behind it
// WITHOUT mutating document.body (SSR-safe, self-contained).
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Howl } from 'howler';
import { useDecayStore } from '@/stores/useDecayStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useDecayEngine } from '@/hooks/useDecayEngine';
import { DecayStages } from './DecayStages';
import { BreakMode } from './BreakMode';
import { DecayRepair } from './DecayRepair';

// Below cursor (9999) / modal (950) but grading windows + wallpaper behind it.
const GRADE_Z = 935;

// NEXUS lines per stage (index 1..5).
const STAGE_MESSAGES: Record<number, { title: string; message: string; icon: string }> = {
  1: {
    title: 'NEXUS',
    message: 'Two hours of focus. Impressive. Stay sharp.',
    icon: '🌡️',
  },
  2: {
    title: 'NEXUS',
    message: 'Something feels off... the world is slowing.',
    icon: '🌫️',
  },
  3: {
    title: 'NEXUS',
    message: 'Reality is warming at the edges. Consider a pause.',
    icon: '🔥',
  },
  4: {
    title: 'NEXUS',
    message: 'Warrior. Your focus is legendary. But your body is mortal.',
    icon: '❤️',
  },
  5: {
    title: 'NEXUS',
    message: '5-minute break. NOW.',
    icon: '💀',
  },
};

/** Grade filter string for the backdrop overlay (applied behind it). */
function gradeFilter(stage: number): string {
  if (stage <= 0) return 'none';
  const parts = ['hue-rotate(5deg)', 'saturate(0.95)'];
  if (stage >= 2) parts.push('blur(0.3px)');
  if (stage >= 3) parts.push('sepia(0.08)');
  return parts.join(' ');
}

function DecayEngineInner() {
  useDecayEngine(); // wires interaction listeners + 1-min ticker

  const enabled = useDecayStore((s) => s.enabled);
  const stage = useDecayStore((s) => s.decayStage);
  const isOnBreak = useDecayStore((s) => s.isOnBreak);
  const isRepairing = useDecayStore((s) => s.isRepairing);

  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const soundVolume = useSettingsStore((s) => s.soundVolume);

  const prevStageRef = useRef(0);
  const heartbeatRef = useRef<Howl | null>(null);

  // ─── Stage transition side effects (NEXUS notifications + force break) ───
  useEffect(() => {
    if (!enabled) {
      prevStageRef.current = 0;
      return;
    }
    const prev = prevStageRef.current;
    if (stage > prev) {
      const msg = STAGE_MESSAGES[stage];
      if (msg) {
        useNotificationStore.getState().addNotification({
          type: stage >= 4 ? 'warning' : 'system',
          title: msg.title,
          message: msg.message,
          icon: msg.icon,
          autoDismiss: stage >= 4 ? 0 : 6000,
        });
      }
      // Stage 5 force-triggers the break.
      if (stage >= 5 && !isOnBreak && !isRepairing) {
        useDecayStore.getState().triggerBreak();
      }
    }
    prevStageRef.current = stage;
  }, [stage, enabled, isOnBreak, isRepairing]);

  // ─── Stage 4 heartbeat sound (Howler, low volume, looping) ───
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const wantHeartbeat = enabled && soundEnabled && stage >= 4 && !isOnBreak;

    if (wantHeartbeat && !heartbeatRef.current) {
      try {
        const howl = new Howl({
          src: ['/sounds/heartbeat.mp3'],
          loop: true,
          volume: Math.min(0.1, soundVolume),
          html5: true,
          onloaderror: () => {},
          onplayerror: () => {},
        });
        howl.play();
        heartbeatRef.current = howl;
      } catch {
        /* missing audio — ignore */
      }
    } else if (!wantHeartbeat && heartbeatRef.current) {
      try {
        heartbeatRef.current.stop();
        heartbeatRef.current.unload();
      } catch {
        /* noop */
      }
      heartbeatRef.current = null;
    }
  }, [enabled, soundEnabled, soundVolume, stage, isOnBreak]);

  // Stop heartbeat on unmount.
  useEffect(() => {
    return () => {
      if (heartbeatRef.current) {
        try {
          heartbeatRef.current.stop();
          heartbeatRef.current.unload();
        } catch {
          /* noop */
        }
        heartbeatRef.current = null;
      }
    };
  }, []);

  // ─── Break lifecycle handlers ───
  const handleBreakComplete = () => {
    useDecayStore.getState().repairOS(); // sets isRepairing, clears break
  };

  const handleRepairDone = () => {
    useDecayStore.getState().finishRepair(); // resets minutes + stage 0
  };

  if (!enabled) return null;

  const filter = gradeFilter(isRepairing ? 0 : stage);

  return (
    <>
      {/* Global color/blur grade — grades everything BEHIND this overlay. */}
      <motion.div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: GRADE_Z,
          WebkitBackdropFilter: filter,
        }}
        initial={false}
        animate={{
          backdropFilter: filter,
          opacity: filter === 'none' ? 0 : 1,
        }}
        transition={{ duration: isRepairing ? 3 : 2, ease: 'easeInOut' }}
      />

      {/* Additive stage layers (vignette / heartbeat pulse / cracks) */}
      <DecayStages stage={stage} repairing={isRepairing} />

      {/* Break overlay */}
      <AnimatePresence>
        {isOnBreak && (
          <BreakMode key="break-mode" onComplete={handleBreakComplete} />
        )}
      </AnimatePresence>

      {/* Repair flourish */}
      <AnimatePresence>
        {isRepairing && (
          <DecayRepair key="decay-repair" onDone={handleRepairDone} />
        )}
      </AnimatePresence>
    </>
  );
}

export function DecayEngine() {
  return <DecayEngineInner />;
}
