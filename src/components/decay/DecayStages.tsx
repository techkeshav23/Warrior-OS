// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Decay Stages (visual layers)
// Stages 1-5 rendered as fixed, pointer-events:none overlays / filters.
// Global color/blur filters are applied via a CSS variable on a wrapper
// (see DecayEngine) rather than mutating document.body directly.
// ═══════════════════════════════════════════════════════════

'use client';

import { motion, AnimatePresence } from 'framer-motion';

// Z-index just below cursor but above windows/overlays so effects are visible.
const DECAY_Z = 940;

/**
 * Compute the CSS `filter` string that should be applied to the whole desktop
 * tree for a given decay stage. Applied by DecayEngine to a wrapper element.
 * Stage 1: subtle warm hue-rotate + desaturate.
 * Stage 2: adds 0.3px blur (text softness).
 * Stage 3+: keeps stage 1/2 filters (vignette handled by overlay layer).
 */
export function decayFilterForStage(stage: number): string {
  if (stage <= 0) return 'none';
  const parts: string[] = [];
  // Stage 1 warmth
  parts.push('hue-rotate(5deg)');
  parts.push('saturate(0.95)');
  if (stage >= 2) {
    parts.push('blur(0.3px)');
  }
  if (stage >= 3) {
    // Accent shifts warmer — nudge hue a touch more toward amber.
    parts.push('sepia(0.08)');
  }
  return parts.join(' ');
}

// ─── Stage 3: red/orange edge vignette ───
function VignetteLayer({ stage }: { stage: number }) {
  // Intensity ramps 0 -> 1 as we go from stage 3 to stage 5.
  const intensity =
    stage < 3 ? 0 : Math.min(1, 0.4 + (stage - 3) * 0.3);
  return (
    <motion.div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: DECAY_Z }}
      initial={{ opacity: 0 }}
      animate={{ opacity: intensity }}
      transition={{ duration: 15, ease: 'easeInOut' }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 55%, rgba(255,61,0,0.28) 88%, rgba(255,23,68,0.42) 100%)',
        }}
      />
    </motion.div>
  );
}

// ─── Stage 4: subtle heartbeat pulse tint (visual companion to audio) ───
function HeartbeatLayer() {
  return (
    <motion.div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: DECAY_Z }}
      animate={{ opacity: [0.0, 0.06, 0.0] }}
      transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(255,23,68,0.35) 0%, transparent 70%)',
        }}
      />
    </motion.div>
  );
}

// ─── Stage 5: hairline cracks (SVG overlay) ───
const CRACK_PATHS: string[] = [
  'M0 180 L260 240 L410 200 L640 320 L900 260 L1200 360',
  'M1440 120 L1180 200 L980 160 L760 300 L520 240 L200 380 L0 340',
  'M700 0 L680 160 L740 300 L700 460 L760 640 L720 810',
  'M300 0 L360 220 L300 420 L380 650 L320 900',
  'M1100 0 L1040 260 L1120 520 L1060 780 L1120 900',
];

function CracksLayer({ closing }: { closing: boolean }) {
  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: DECAY_Z + 1 }}
    >
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="decay-crack-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>
        {CRACK_PATHS.map((d, i) => (
          <motion.path
            key={i}
            d={d}
            fill="none"
            stroke="rgba(230,235,255,0.55)"
            strokeWidth={1}
            filter="url(#decay-crack-glow)"
            initial={{ pathLength: closing ? 1 : 0, opacity: 0 }}
            animate={{
              pathLength: closing ? 0 : 1,
              opacity: closing ? 0 : 0.9,
            }}
            transition={{
              duration: closing ? 2.2 : 1.6,
              delay: i * (closing ? 0.05 : 0.12),
              ease: 'easeInOut',
            }}
          />
        ))}
      </svg>
    </div>
  );
}

interface DecayStagesProps {
  stage: number;
  /** When true, cracks animate closed (repair). */
  repairing?: boolean;
}

/**
 * Renders the per-stage overlay layers for the current decay stage.
 * Color/blur filters live on the DecayEngine wrapper; this handles the
 * additive visual layers (vignette, heartbeat pulse, cracks).
 */
export function DecayStages({ stage, repairing = false }: DecayStagesProps) {
  return (
    <AnimatePresence>
      {stage >= 3 && !repairing && (
        <VignetteLayer key="vignette" stage={stage} />
      )}
      {stage >= 4 && !repairing && <HeartbeatLayer key="heartbeat" />}
      {(stage >= 5 || repairing) && (
        <CracksLayer key="cracks" closing={repairing} />
      )}
    </AnimatePresence>
  );
}
