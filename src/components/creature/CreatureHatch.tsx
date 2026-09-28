// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Creature Hatch cinematic
// Plays once when the egg is ready (incubated into day 3 AND fed
// 100 XP): cracks appear → light bursts through them → the shell
// shatters → particle explosion → the baby emerges and hops → NEXUS:
// "Your companion has arrived. Take care of it." + "First Pet".
// Non-blocking overlay (pointer-events: none).
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCreatureStore } from '@/stores/useCreatureStore';
import { CreatureCanvas } from './CreatureRenderer';
import { paintEgg } from './CreatureEvolution';
import { PLASMA } from '@/styles/tokens';
import { sayViaNexus, unlockPhase6Achievement } from './osBridge';

type Phase = 'idle' | 'crack' | 'burst' | 'emerge' | 'done';

/** Achievement unlocked when the creature hatches. */
export const FIRST_PET_ACHIEVEMENT_ID = 'first-pet';
export const HATCH_NEXUS_LINE = 'Your companion has arrived. Take care of it.';

const T_BURST = 2400;
const T_EMERGE = 3300;
const T_FINISH = 6600;
const CANVAS = 380;
const EGG_SCALE = 6.5;

interface Shard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  hue: number;
}

/** Egg → cracks → shards + sparks, driven by one rAF loop. */
function HatchEggCanvas({ phase }: { phase: Phase }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<Phase>(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CANVAS * dpr;
    canvas.height = CANVAS * dpr;

    let raf = 0;
    let seenPhase: Phase = 'idle';
    let phaseStart = performance.now();
    let last = phaseStart;
    let shards: Shard[] = [];
    let sparks: Spark[] = [];
    const c = CANVAS / 2;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const ph = phaseRef.current;
      if (ph !== seenPhase) {
        seenPhase = ph;
        phaseStart = now;
        if (ph === 'burst') {
          shards = Array.from({ length: 14 }, (_, i) => {
            const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
            const sp = 160 + Math.random() * 220;
            return {
              x: c + Math.cos(a) * 30,
              y: c + Math.sin(a) * 40,
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp - 80,
              rot: Math.random() * Math.PI,
              vr: (Math.random() - 0.5) * 12,
              size: 14 + Math.random() * 18,
            };
          });
          sparks = Array.from({ length: 70 }, () => {
            const a = Math.random() * Math.PI * 2;
            const sp = 60 + Math.random() * 320;
            return {
              x: c,
              y: c,
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp,
              life: 0,
              max: 0.6 + Math.random() * 0.9,
              hue: Math.random() < 0.6 ? 186 : 262,
            };
          });
        }
      }
      const pt = (now - phaseStart) / 1000;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, CANVAS, CANVAS);

      if (ph === 'crack') {
        const p = Math.min(1, pt / (T_BURST / 1000));
        const shake = 0.015 + 0.09 * p * p;
        ctx.save();
        ctx.translate(c, c + 10);
        ctx.rotate(Math.sin(pt * 38) * shake);
        ctx.scale(EGG_SCALE, EGG_SCALE);
        paintEgg(ctx, pt, Math.min(1, p * 1.15), PLASMA[400]);
        ctx.restore();
        // Growing inner glow.
        const g = ctx.createRadialGradient(c, c, 0, c, c, 170);
        g.addColorStop(0, `rgba(160,250,255,${0.25 * p})`);
        g.addColorStop(1, 'rgba(0,240,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, CANVAS, CANVAS);
      }

      if (ph === 'burst' || ph === 'emerge') {
        // Flash.
        if (ph === 'burst') {
          const f = Math.min(1, pt / 0.7);
          const r = 30 + f * 230;
          const fg = ctx.createRadialGradient(c, c, 0, c, c, r);
          fg.addColorStop(0, `rgba(255,255,255,${1 - f})`);
          fg.addColorStop(0.5, `rgba(0,240,255,${0.6 * (1 - f)})`);
          fg.addColorStop(1, 'rgba(0,240,255,0)');
          ctx.fillStyle = fg;
          ctx.beginPath();
          ctx.arc(c, c, r, 0, Math.PI * 2);
          ctx.fill();
        }
        // Shell shards.
        for (const s of shards) {
          s.vy += 420 * dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.rot += s.vr * dt;
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(s.rot);
          ctx.globalAlpha = Math.max(0, 1 - pt / 1.4);
          ctx.fillStyle = '#e4edf5';
          ctx.strokeStyle = 'rgba(120,140,160,0.9)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-s.size / 2, 0);
          ctx.lineTo(0, -s.size / 2.4);
          ctx.lineTo(s.size / 2, -s.size / 6);
          ctx.lineTo(s.size / 3, s.size / 3);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        // Particle explosion.
        ctx.globalCompositeOperation = 'lighter';
        const alive: Spark[] = [];
        for (const s of sparks) {
          s.life += dt;
          if (s.life >= s.max) continue;
          s.vx *= 0.97;
          s.vy = s.vy * 0.97 + 30 * dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          const k = 1 - s.life / s.max;
          ctx.fillStyle = `hsla(${s.hue},100%,70%,${k})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 1.5 + 2.5 * k, 0, Math.PI * 2);
          ctx.fill();
          alive.push(s);
        }
        sparks = alive;
        ctx.globalCompositeOperation = 'source-over';
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} style={{ width: CANVAS, height: CANVAS }} className="absolute" aria-hidden />;
}

function finishHatch() {
  const c = useCreatureStore.getState();
  c.markHatched();
  unlockPhase6Achievement(FIRST_PET_ACHIEVEMENT_ID);
  sayViaNexus(HATCH_NEXUS_LINE, 'success');
}

function CreatureHatchInner() {
  const eggReady = useCreatureStore((s) => s.eggReady);
  const hasHatched = useCreatureStore((s) => s.hasHatched);
  const form = useCreatureStore((s) => s.getEvolutionForm());
  const [phase, setPhase] = useState<Phase>('idle');

  // Timeline runs from timers (no synchronous setState in the effect body).
  // Re-arms correctly under StrictMode's mount → unmount → mount.
  useEffect(() => {
    if (!eggReady || hasHatched) return;
    const timers: ReturnType<typeof setTimeout>[] = [
      setTimeout(() => setPhase('crack'), 0),
      setTimeout(() => setPhase('burst'), T_BURST),
      setTimeout(() => setPhase('emerge'), T_EMERGE),
      setTimeout(() => {
        finishHatch();
        setPhase('done');
      }, T_FINISH),
    ];
    return () => timers.forEach(clearTimeout);
  }, [eggReady, hasHatched]);

  const show = phase === 'crack' || phase === 'burst' || phase === 'emerge';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="hatch-overlay"
          className="fixed inset-0 flex items-center justify-center pointer-events-none"
          style={{
            zIndex: 'var(--z-modal)',
            background: 'radial-gradient(circle, color-mix(in srgb, var(--color-ink-850) 55%, transparent) 0%, color-mix(in srgb, var(--color-ink-950) 88%, transparent) 70%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          aria-live="polite"
        >
          <div className="relative flex items-center justify-center" style={{ width: CANVAS, height: CANVAS }}>
            <HatchEggCanvas phase={phase} />
            {phase === 'emerge' && (
              <motion.div
                className="relative"
                initial={{ scale: 0, opacity: 0, y: 30 }}
                animate={{ scale: [0, 1.25, 1], opacity: 1, y: [30, -18, 0] }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
              >
                <CreatureCanvas form={form} stage="baby" mood="happy" size={92} goldenAura={false} />
              </motion.div>
            )}
          </div>
          {phase === 'emerge' && (
            <motion.div
              className="absolute left-0 right-0 text-center font-mono"
              style={{ top: 'calc(50% + 200px)' }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.6 }}
            >
              <span className="hud-label mb-1.5 block text-fg-muted">NEXUS</span>
              <span className="text-sm font-medium text-accent text-glow-sm">{HATCH_NEXUS_LINE}</span>
            </motion.div>
          )}
          {phase === 'crack' && (
            <motion.p
              className="absolute left-0 right-0 text-center font-display text-xs tracking-[0.4em] text-accent/80"
              style={{ top: 'calc(50% + 200px)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.6, 1] }}
              transition={{ duration: 2 }}
            >
              SOMETHING IS HATCHING
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const CreatureHatch = memo(CreatureHatchInner);
