// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dream Sequence (orchestrator)
// Drop-in for the OS "dream" phase. Builds the scene from
// localStorage, plays the renderer + narration for ~5s, fades to
// black, then calls onComplete(). First-ever users skip instantly.
//
//   phase === 'dream' → <DreamSequence onComplete={nextPhase} />
//
// Respects the settings "dreams" toggle when present (via a light
// localStorage read of warrior-os-settings) but NEVER blocks the OS:
// if disabled or first-ever, it calls onComplete immediately.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { DreamScene, DreamSequenceProps } from '@/types/dream';
import { buildDreamScene, shouldPlayDream, DREAM_DURATION_MS } from './DreamEngine';
import { DreamRenderer } from './DreamRenderer';
import { DreamNarration } from './DreamNarration';

const FADE_OUT_MS = 500; // dream fades to black
const BLACK_HOLD_MS = 500; // pure black beat before next phase

/** Read the persisted dreams toggle without importing the settings store. */
function dreamsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem('warrior-os-settings');
    if (!raw) return true;
    const blob = JSON.parse(raw) as { state?: { dreams?: boolean } };
    // Default ON unless explicitly disabled.
    return blob?.state?.dreams !== false;
  } catch {
    return true;
  }
}

type Stage = 'idle' | 'playing' | 'fading' | 'done';

/**
 * Decide the initial render state once, synchronously. Runs in a lazy
 * useState initializer so we never setState inside an effect. All of the
 * readers below are SSR-safe (they no-op / return defaults on the server),
 * and this component is only mounted client-side for the 'dream' phase.
 */
function decideInitial(sceneProp?: DreamScene): { stage: Stage; scene: DreamScene | null } {
  if (sceneProp) return { stage: 'playing', scene: sceneProp };
  if (typeof window === 'undefined') return { stage: 'idle', scene: null };
  if (!dreamsEnabled() || !shouldPlayDream()) return { stage: 'done', scene: null };
  return { stage: 'playing', scene: buildDreamScene() };
}

function DreamSequence({ onComplete, scene: sceneProp, skippable = true }: DreamSequenceProps) {
  const [initial] = useState(() => decideInitial(sceneProp));
  const [stage, setStage] = useState<Stage>(initial.stage);
  const [scene] = useState<DreamScene | null>(initial.scene);
  const [fade, setFade] = useState(1);
  const completedRef = useRef(false);

  const finish = useMemo(
    () => () => {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete();
    },
    [onComplete]
  );

  // If we decided to skip on mount, complete on the next tick (effect, not render).
  useEffect(() => {
    if (initial.stage === 'done') finish();
  }, [initial.stage, finish]);

  // Timeline: play → fade → black hold → complete.
  useEffect(() => {
    if (stage !== 'playing' || !scene) return;
    const duration = scene.durationMs ?? DREAM_DURATION_MS;
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(
      setTimeout(() => {
        setStage('fading');
        setFade(0);
      }, duration)
    );
    timers.push(
      setTimeout(() => {
        finish();
        setStage('done');
      }, duration + FADE_OUT_MS + BLACK_HOLD_MS)
    );

    return () => timers.forEach(clearTimeout);
  }, [stage, scene, finish]);

  // Skip on click / Escape.
  const handleSkip = useMemo(
    () => () => {
      if (!skippable) return;
      setFade(0);
      setStage('done');
      finish();
    },
    [skippable, finish]
  );

  useEffect(() => {
    if (!skippable || stage === 'idle' || stage === 'done') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') handleSkip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [skippable, stage, handleSkip]);

  if (stage === 'idle' || stage === 'done' || !scene) {
    // Render an inert black backdrop while deciding / after finishing so
    // there is never a flash of underlying content.
    return <div className="absolute inset-0 z-[200] bg-black" aria-hidden="true" />;
  }

  return (
    <AnimatePresence>
      <motion.div
        key="dream"
        className="absolute inset-0 z-[200] overflow-hidden bg-black"
        onClick={handleSkip}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
        role="presentation"
      >
        <DreamRenderer scene={scene} fade={fade} />
        <DreamNarration
          lines={scene.narration}
          durationMs={scene.durationMs}
          color={scene.primaryColor}
        />

        {/* Fade-to-black overlay driven by `fade`. */}
        <motion.div
          className="pointer-events-none absolute inset-0 z-[210] bg-black"
          animate={{ opacity: fade === 0 ? 1 : 0 }}
          transition={{ duration: FADE_OUT_MS / 1000, ease: 'easeInOut' }}
        />

        {skippable && (
          <div className="pointer-events-none absolute bottom-6 right-8 z-[220] font-mono text-xs text-white/25">
            press esc to skip
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default DreamSequence;
export { DreamSequence };
