// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dream Transition
// Dream → lock screen: the dream fades to black over 0.5s, holds 0.5s
// of pure black, then calls onComplete (the page switches to the lock
// screen, which fades in from black). Timing runs from a timer, never
// from render.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export const DREAM_FADE_MS = 500;
export const DREAM_BLACK_HOLD_MS = 500;

interface DreamTransitionProps {
  /** Starts the fade-to-black when it becomes true. */
  active: boolean;
  /** Called once the black hold has elapsed. */
  onComplete: () => void;
  fadeMs?: number;
  holdMs?: number;
}

export function DreamTransition({
  active,
  onComplete,
  fadeMs = DREAM_FADE_MS,
  holdMs = DREAM_BLACK_HOLD_MS,
}: DreamTransitionProps) {
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => onCompleteRef.current(), fadeMs + holdMs);
    return () => clearTimeout(timer);
  }, [active, fadeMs, holdMs]);

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-30 bg-ink-950"
      initial={false}
      animate={{ opacity: active ? 1 : 0 }}
      transition={{ duration: fadeMs / 1000, ease: 'easeInOut' }}
      aria-hidden
    />
  );
}
