// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dream Narration
// NEXUS whisper at bottom-centre: Orbitron, 50% opacity. For a 5-second
// dream the text fades in over 1s, stays 3s and fades out over 1s
// (the envelope scales with longer/shorter dreams).
// ═══════════════════════════════════════════════════════════

'use client';

import { motion } from 'framer-motion';

interface DreamNarrationProps {
  /** Lines shown together (1–2 short sentences). */
  lines: string[];
  /** Total dream duration in ms. */
  durationMs: number;
  /** Accent colour for a subtle text glow. */
  color?: string;
}

export function DreamNarration({ lines, durationMs, color = '#e4e4ef' }: DreamNarrationProps) {
  const total = Math.max(1, durationMs / 1000);
  const fade = Math.min(1, total * 0.2); // 1s of a 5s dream
  const inEnd = fade / total;
  const outStart = (total - fade) / total;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[16%] z-10 flex justify-center px-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: [0, 0.5, 0.5, 0], y: [10, 0, 0, -6] }}
        transition={{ duration: total, times: [0, inEnd, outStart, 1], ease: 'easeInOut' }}
        className="font-display max-w-3xl text-center tracking-wide"
        style={{ color, textShadow: `0 0 24px ${color}66, 0 0 8px ${color}55` }}
      >
        {lines.map((line, i) => (
          <p key={`${i}-${line}`} className={i === 0 ? 'text-lg sm:text-xl md:text-2xl' : 'mt-2 text-sm sm:text-base md:text-lg'}>
            {line}
          </p>
        ))}
      </motion.div>
    </div>
  );
}
