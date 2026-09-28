// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Decay Stages (visual layers)
// One component per stage, all pointer-events:none and fixed:
//   Stage 1 (120 min) warm colour grade — hue-rotate(5deg) saturate(.95)
//   Stage 2 (150 min) 0.3px softness on everything, window glass +5 %
//                     opaque, world time-scale 0.5 for particles
//   Stage 3 (180 min) red/orange edge vignette ramping over 15 minutes,
//                     accent colour drifting from cyan toward amber
//   Stage 4 (210 min) heartbeat pulse + taskbar micro-vibration
//                     (the Howler heartbeat audio lives in DecayEngine)
//   Stage 5 (240 min) hairline SVG cracks, windows shudder when pressed
// While repairing, cracks draw closed and every layer fades out.
// Global CSS tweaks are scoped <style> elements that exist only while
// their stage is active, so nothing leaks once the OS is repaired.
// ═══════════════════════════════════════════════════════════

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { DECAY_BASE_THRESHOLDS, DECAY_VIGNETTE_RAMP_MINUTES } from '@/stores/useDecayStore';

// Grade sits just below the stage overlays; both stay under BreakMode (960).
const GRADE_Z = 935;
const DECAY_Z = 940;

/**
 * CSS filter for the global grade at a given stage.
 * Stage 1: warm hue shift + slight desaturation. Stage 2+: adds 0.3px blur.
 */
export function decayFilterForStage(stage: number): string {
  if (stage <= 0) return 'none';
  const parts = ['hue-rotate(5deg)', 'saturate(0.95)'];
  if (stage >= 2) parts.push('blur(0.3px)');
  return parts.join(' ');
}

// ─── Stage 1 (+ stage-2 softness): global colour grade ───
export function DecayStage1({ stage, repairing }: { stage: number; repairing: boolean }) {
  if (stage < 1) return null;
  const filter = decayFilterForStage(stage);
  return (
    <motion.div
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: GRADE_Z, backdropFilter: filter, WebkitBackdropFilter: filter }}
      initial={{ opacity: 0 }}
      animate={{ opacity: repairing ? 0 : 1 }}
      // Creep in slowly so the warrior "barely notices"; repair restores in 3 s.
      transition={{ duration: repairing ? 3 : 20, ease: 'easeInOut' }}
      aria-hidden
    />
  );
}

// ─── Stage 2: slower world + heavier glass ───
// Windows paint their glass inline at rgba(15,15,25,0.85); +5 % opacity → 0.90.
const STAGE2_CSS = `
:root { --decay-time-scale: 0.5; }
.react-draggable > div:has(> .window-drag-handle) {
  background-color: rgba(15, 15, 25, 0.9) !important;
}`;

export function DecayStage2({ active }: { active: boolean }) {
  if (!active) return null;
  return <style data-warrior-decay="stage-2">{STAGE2_CSS}</style>;
}

// ─── Stage 3: edge vignette (15-minute ramp) + accent warming ───
function vignetteIntensity(minutes: number, thresholdOffset: number): number {
  const start = DECAY_BASE_THRESHOLDS[2] + thresholdOffset;
  return Math.max(0, Math.min(1, (minutes - start) / DECAY_VIGNETTE_RAMP_MINUTES));
}

/** Only plain hex colours are interpolated into the injected CSS. */
function safeHex(color: string): string {
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : '#00f0ff';
}

export function DecayStage3({
  minutes,
  thresholdOffset,
  accentBase,
  repairing,
}: {
  minutes: number;
  thresholdOffset: number;
  accentBase: string;
  repairing: boolean;
}) {
  const intensity = vignetteIntensity(minutes, thresholdOffset);
  const opacity = 0.3 + 0.7 * intensity;
  const warmth = Math.round(25 + 45 * intensity); // % of amber mixed into the accent
  return (
    <>
      <motion.div
        className="pointer-events-none fixed inset-0"
        style={{
          zIndex: DECAY_Z,
          background:
            'radial-gradient(ellipse at center, transparent 52%, rgba(255,86,0,0.22) 80%, rgba(255,23,68,0.42) 100%)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: repairing ? 0 : opacity }}
        exit={{ opacity: 0, transition: { duration: 3, ease: 'easeOut' } }}
        // Each minute nudges the target; a 60 s linear glide makes it continuous.
        transition={{ duration: repairing ? 3 : 60, ease: repairing ? 'easeOut' : 'linear' }}
        aria-hidden
      />
      {!repairing && (
        <style data-warrior-decay="stage-3">{`:root{--accent-primary:color-mix(in oklab, ${safeHex(accentBase)} ${100 - warmth}%, #ffab00 ${warmth}%) !important;}`}</style>
      )}
    </>
  );
}

// ─── Stage 4: heartbeat pulse + taskbar micro-vibration ───
const STAGE4_CSS = `
@keyframes warrior-decay-vibrate {
  0%, 100% { translate: 0 0; }
  25% { translate: 0.5px 0; }
  75% { translate: -0.5px 0; }
}
[data-warrior-taskbar],
div.fixed.bottom-0.left-0.right-0.h-12[style*="--z-taskbar"] {
  animation: warrior-decay-vibrate 0.14s linear infinite;
}`;

export function DecayStage4({ active }: { active: boolean }) {
  return (
    <>
      {active && <style data-warrior-decay="stage-4">{STAGE4_CSS}</style>}
      <AnimatePresence>
        {active && (
          <motion.div
            key="decay-heartbeat"
            className="pointer-events-none fixed inset-0"
            style={{
              zIndex: DECAY_Z,
              background: 'radial-gradient(ellipse at center, rgba(255,23,68,0.32) 0%, transparent 70%)',
            }}
            initial={{ opacity: 0 }}
            // lub … dub … rest — one cycle per second, matching the 60 bpm audio loop
            animate={{ opacity: [0, 0.07, 0.01, 0.05, 0] }}
            exit={{ opacity: 0, transition: { duration: 1 } }}
            transition={{ duration: 1, times: [0, 0.1, 0.25, 0.36, 0.7], repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Stage 5: hairline cracks + shuddering windows ───
interface CrackPath {
  d: string;
  width: number;
  delay: number;
  opacity: number;
}

/** Deterministic PRNG so the crack pattern is identical on every render. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Radiating, branching fracture lines from three impact points. */
function generateCracks(seed: number, w: number, h: number): CrackPath[] {
  const rnd = seededRandom(seed);
  const impacts = [
    { x: w * 0.2 + rnd() * 80, y: h * 0.24 + rnd() * 60 },
    { x: w * 0.8 - rnd() * 90, y: h * 0.32 + rnd() * 80 },
    { x: w * 0.5 + rnd() * 80 - 40, y: h * 0.78 - rnd() * 60 },
  ];
  const out: CrackPath[] = [];
  const fmt = (n: number) => n.toFixed(1);

  impacts.forEach((c, ci) => {
    const rays = 5 + Math.floor(rnd() * 3);
    for (let r = 0; r < rays; r++) {
      let angle = (r / rays) * Math.PI * 2 + rnd() * 0.6;
      let x = c.x;
      let y = c.y;
      let d = `M${fmt(x)} ${fmt(y)}`;
      const segments = 6 + Math.floor(rnd() * 6);
      for (let s = 0; s < segments; s++) {
        angle += (rnd() - 0.5) * 0.7;
        const len = 22 + rnd() * 60;
        x += Math.cos(angle) * len;
        y += Math.sin(angle) * len;
        d += ` L${fmt(x)} ${fmt(y)}`;
        if (rnd() < 0.28) {
          let bx = x;
          let by = y;
          let ba = angle + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.6);
          let bd = `M${fmt(bx)} ${fmt(by)}`;
          const branchSegs = 2 + Math.floor(rnd() * 3);
          for (let b = 0; b < branchSegs; b++) {
            ba += (rnd() - 0.5) * 0.6;
            const bl = 12 + rnd() * 30;
            bx += Math.cos(ba) * bl;
            by += Math.sin(ba) * bl;
            bd += ` L${fmt(bx)} ${fmt(by)}`;
          }
          out.push({ d: bd, width: 0.6, delay: 0.4 + ci * 0.25 + s * 0.08, opacity: 0.55 });
        }
        if (x < -40 || x > w + 40 || y < -40 || y > h + 40) break;
      }
      out.push({ d, width: 1.1, delay: ci * 0.25 + r * 0.04, opacity: 0.85 });
    }
    // Small jagged ring around the impact point.
    const ringR = 10 + rnd() * 8;
    let ring = '';
    for (let k = 0; k <= 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const rr = ringR * (0.75 + rnd() * 0.5);
      ring += `${k === 0 ? 'M' : ' L'}${fmt(c.x + Math.cos(a) * rr)} ${fmt(c.y + Math.sin(a) * rr)}`;
    }
    out.push({ d: ring, width: 0.8, delay: ci * 0.25, opacity: 0.7 });
  });
  return out;
}

const CRACK_W = 1440;
const CRACK_H = 900;
const CRACKS: CrackPath[] = generateCracks(0xdeca5, CRACK_W, CRACK_H);

const STAGE5_CSS = `
@keyframes warrior-decay-shudder {
  0%, 100% { translate: 0 0; }
  20% { translate: -2px 1px; }
  40% { translate: 2px -1px; }
  60% { translate: -1px -1px; }
  80% { translate: 1px 1px; }
}
.react-draggable:has(> div > .window-drag-handle):active {
  animation: warrior-decay-shudder 0.28s linear 1;
}`;

export function DecayStage5({ closing }: { closing: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: DECAY_Z + 1 }} aria-hidden>
      {!closing && <style data-warrior-decay="stage-5">{STAGE5_CSS}</style>}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${CRACK_W} ${CRACK_H}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="warrior-decay-crack-glow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="0.7" />
          </filter>
        </defs>
        {CRACKS.map((c, i) => (
          <g key={i}>
            {/* dark under-stroke gives the fracture depth */}
            <motion.path
              d={c.d}
              fill="none"
              stroke="rgba(0,0,0,0.45)"
              strokeWidth={c.width + 1.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: closing ? 1 : 0, opacity: 0 }}
              animate={{ pathLength: closing ? 0 : 1, opacity: closing ? 0 : c.opacity * 0.8 }}
              transition={{
                duration: closing ? 2.2 : 1.4,
                delay: closing ? (i % 12) * 0.03 : c.delay,
                ease: 'easeInOut',
              }}
            />
            <motion.path
              d={c.d}
              fill="none"
              stroke="rgba(232,238,255,0.8)"
              strokeWidth={c.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#warrior-decay-crack-glow)"
              initial={{ pathLength: closing ? 1 : 0, opacity: 0 }}
              animate={{ pathLength: closing ? 0 : 1, opacity: closing ? 0 : c.opacity }}
              transition={{
                duration: closing ? 2.2 : 1.4,
                delay: closing ? (i % 12) * 0.03 : c.delay,
                ease: 'easeInOut',
              }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Composition ───
interface DecayStagesProps {
  stage: number;
  /** Continuous study minutes (drives the stage-3 vignette ramp). */
  minutes: number;
  thresholdOffset: number;
  /** The accent colour to warm from (the user's current accent). */
  accentBase: string;
  /** When true, cracks animate closed and every layer fades out. */
  repairing?: boolean;
}

/** Renders every active stage layer for the current decay stage. */
export function DecayStages({
  stage,
  minutes,
  thresholdOffset,
  accentBase,
  repairing = false,
}: DecayStagesProps) {
  return (
    <>
      <DecayStage1 stage={stage} repairing={repairing} />
      <DecayStage2 active={stage >= 2 && !repairing} />
      <AnimatePresence>
        {stage >= 3 && (
          <DecayStage3
            key="decay-stage-3"
            minutes={minutes}
            thresholdOffset={thresholdOffset}
            accentBase={accentBase}
            repairing={repairing}
          />
        )}
      </AnimatePresence>
      <DecayStage4 active={stage >= 4 && !repairing} />
      {stage >= 5 && <DecayStage5 closing={repairing} />}
    </>
  );
}
