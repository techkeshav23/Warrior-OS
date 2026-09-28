// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dream Narration
// NEXUS whisper at bottom-centre (FORGE HUD): a mono "NEXUS" eyebrow
// over light sans text in fg, tinted by the dream's colour with a soft
// halo. For a 5-second dream the text fades in over 1s, stays 3s and
// fades out over 1s (the envelope scales with longer/shorter dreams).
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

export function DreamNarration({ lines, durationMs, color = '#e6edf7' }: DreamNarrationProps) {
  const total = Math.max(1, durationMs / 1000);
  const fade = Math.min(1, total * 0.2); // 1s of a 5s dream
  const inEnd = fade / total;
  const outStart = (total - fade) / total;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[16%] z-10 flex justify-center px-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: [0, 0.85, 0.85, 0], y: [10, 0, 0, -6] }}
        transition={{ duration: total, times: [0, inEnd, outStart, 1], ease: 'easeInOut' }}
        className="max-w-2xl text-center"
      >
        <p className="mb-3 flex items-center justify-center gap-2 font-mono text-2xs font-medium uppercase tracking-[0.32em]" style={{ color }}>
          <span aria-hidden className="h-px w-6 bg-current opacity-50" />
          NEXUS
          <span aria-hidden className="h-px w-6 bg-current opacity-50" />
        </p>
        {lines.map((line, i) => (
          <p
            key={`${i}-${line}`}
            className={
              i === 0
                ? 'text-xl font-light tracking-[0.01em] text-fg sm:text-2xl'
                : 'mt-2 text-sm font-light text-fg-muted sm:text-base'
            }
            style={{ textShadow: `0 0 28px ${color}55, 0 1px 12px rgba(4, 6, 11, 0.8)` }}
          >
            {line}
          </p>
        ))}
      </motion.div>
    </div>
  );
}
