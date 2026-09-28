// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dream Narration
// NEXUS whisper text: Orbitron, ~50% opacity, fades in over 1s,
// holds, fades out over 1s. Cycles through the scene's narration
// lines across the dream duration.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface DreamNarrationProps {
  lines: string[];
  /** Total dream duration in ms — narration is spread across this. */
  durationMs: number;
  /** Accent color for a subtle text glow. */
  color?: string;
}

export function DreamNarration({ lines, durationMs, color = '#e4e4ef' }: DreamNarrationProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (lines.length <= 1) return;
    // Divide the dream evenly across the lines, leaving the last line to
    // linger until the scene ends.
    const per = durationMs / lines.length;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i < lines.length; i++) {
      timers.push(setTimeout(() => setIndex(i), per * i));
    }
    return () => timers.forEach(clearTimeout);
  }, [lines, durationMs]);

  const current = lines[index] ?? lines[0] ?? '';

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[18%] z-10 flex justify-center px-8">
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
          animate={{ opacity: 0.5, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
          transition={{
            opacity: { duration: 1, ease: 'easeInOut' },
            y: { duration: 1, ease: 'easeOut' },
            filter: { duration: 1, ease: 'easeOut' },
          }}
          className="font-display max-w-2xl text-center text-lg tracking-wide sm:text-xl md:text-2xl"
          style={{
            color,
            textShadow: `0 0 24px ${color}55, 0 0 8px ${color}44`,
          }}
        >
          {current}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
