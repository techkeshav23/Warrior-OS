// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Particle Assembly
// Small glowing particles fly in from random positions (or burst out
// of the centre) along curved paths and assemble a word sampled from
// text drawn on an offscreen canvas. Letters lock in left to right,
// each one glitching into existence with an RGB split, then the word
// glows and onComplete fires. Used by the boot sequence ("WARRIOR").
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { easeInOutCubic, prefersReducedMotion, randRange, resolveDisplayFontFamily } from './effects-utils';

export interface ParticleAssemblyProps {
  /** Word to assemble. */
  text?: string;
  /** Particle + glow colour (hex). */
  color?: string;
  /** 'random': particles start anywhere on screen; 'center': they burst out of the middle first. */
  from?: 'random' | 'center';
  /** Time for the particles to assemble the word (ms). */
  durationMs?: number;
  /** How long the finished word glows before onComplete (ms). */
  holdMs?: number;
  className?: string;
  onComplete?: () => void;
}

interface Particle {
  sx: number;
  sy: number;
  cx: number;
  cy: number;
  tx: number;
  ty: number;
  delay: number;
  flight: number;
  size: number;
  phase: number;
  letter: number;
}

const TARGET_PARTICLES = 1900;
const FONT_WAIT_MS = 700;
const GLOW_MS = 350;
const FLASH_MS = 220;

function makeSprite(color: string, px: number): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = px;
  sprite.height = px;
  const ctx = sprite.getContext('2d');
  if (ctx) {
    const r = px / 2;
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.25, color);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, px, px);
  }
  return sprite;
}

function ParticleAssemblyInner({
  text = 'WARRIOR',
  color = '#00f0ff',
  from = 'random',
  durationMs = 2000,
  holdMs = 450,
  className,
  onComplete,
}: ParticleAssemblyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cancelled = false;
    let raf = 0;
    const timers: number[] = [];

    const box = canvas.getBoundingClientRect();
    const w = Math.max(1, box.width || window.innerWidth);
    const h = Math.max(1, box.height || window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const family = resolveDisplayFontFamily();
    const letters = Array.from(text);
    let fontSize = Math.min(130, w / Math.max(4, letters.length * 0.95));
    const font = () => `900 ${fontSize}px ${family}`;

    const run = () => {
      if (cancelled) return;

      // ─── Lay out the word and measure each letter ───
      const measure = document.createElement('canvas').getContext('2d');
      if (!measure) return;
      measure.font = font();
      const spacing = fontSize * 0.08;
      let textWidth = measure.measureText(text).width + spacing * (letters.length - 1);
      if (textWidth > w * 0.88) {
        fontSize *= (w * 0.88) / textWidth;
        measure.font = font();
        textWidth = measure.measureText(text).width + fontSize * 0.08 * (letters.length - 1);
      }
      const gap = fontSize * 0.08;
      const left = (w - textWidth) / 2;
      const baselineY = h / 2;
      const letterX: number[] = [];
      let cursor = left;
      for (const ch of letters) {
        letterX.push(cursor);
        cursor += measure.measureText(ch).width + gap;
      }

      // ─── Sample the glyph pixels ───
      const sample = document.createElement('canvas');
      sample.width = Math.ceil(w);
      sample.height = Math.ceil(h);
      const sctx = sample.getContext('2d', { willReadFrequently: true });
      if (!sctx) return;
      sctx.font = font();
      sctx.textBaseline = 'middle';
      sctx.fillStyle = '#fff';
      letters.forEach((ch, i) => sctx.fillText(ch, letterX[i], baselineY));
      const top = Math.max(0, Math.floor(baselineY - fontSize));
      const bandH = Math.min(sample.height - top, Math.ceil(fontSize * 2));
      const pixels = sctx.getImageData(0, top, sample.width, bandH).data;
      let filled = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 128) filled++;
      const step = Math.max(2, Math.round(Math.sqrt(filled / TARGET_PARTICLES)));

      const letterStagger = letters.length > 1 ? (durationMs * 0.35) / (letters.length - 1) : 0;
      const particles: Particle[] = [];
      for (let y = 0; y < bandH; y += step) {
        for (let x = 0; x < sample.width; x += step) {
          if (pixels[(y * sample.width + x) * 4 + 3] <= 128) continue;
          let letter = 0;
          while (letter + 1 < letterX.length && x >= letterX[letter + 1]) letter++;
          const tx = x;
          const ty = y + top;
          const scatterX = randRange(0, w);
          const scatterY = randRange(0, h);
          const centre = from === 'center';
          particles.push({
            sx: centre ? w / 2 + randRange(-3, 3) : scatterX,
            sy: centre ? h / 2 + randRange(-3, 3) : scatterY,
            // Control point: a random point for bursts, a sideways bow otherwise.
            cx: centre ? scatterX : (scatterX + tx) / 2 + randRange(-140, 140),
            cy: centre ? scatterY : (scatterY + ty) / 2 + randRange(-140, 140),
            tx,
            ty,
            delay: letter * letterStagger + randRange(0, durationMs * 0.1),
            flight: randRange(durationMs * 0.4, durationMs * 0.5),
            size: randRange(1.1, 2.1),
            phase: randRange(0, Math.PI * 2),
            letter,
          });
        }
      }
      if (particles.length === 0) {
        onCompleteRef.current?.();
        return;
      }

      const lockAt = letters.map(() => 0);
      for (const p of particles) lockAt[p.letter] = Math.max(lockAt[p.letter], p.delay + p.flight);
      const assembledAt = Math.max(...lockAt);
      const sprite = makeSprite(color, Math.round(16 * dpr));

      const drawWord = (alpha: number, blur: number) => {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha;
        ctx.shadowColor = color;
        ctx.shadowBlur = blur * dpr;
        ctx.fillStyle = color;
        ctx.font = font();
        ctx.textBaseline = 'middle';
        letters.forEach((ch, i) => ctx.fillText(ch, letterX[i], baselineY));
        ctx.restore();
      };

      if (prefersReducedMotion()) {
        ctx.globalCompositeOperation = 'lighter';
        for (const p of particles) {
          const s = p.size * 2.6;
          ctx.drawImage(sprite, p.tx - s / 2, p.ty - s / 2, s, s);
        }
        drawWord(0.35, fontSize * 0.25);
        timers.push(window.setTimeout(() => onCompleteRef.current?.(), holdMs + 400));
        return;
      }

      const startedAt = performance.now();
      const endAt = assembledAt + GLOW_MS + holdMs;
      let completed = false;

      const frame = (now: number) => {
        const t = now - startedAt;
        // Fade the previous frame into trails (canvas stays transparent).
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';

        for (const p of particles) {
          const local = (t - p.delay) / p.flight;
          if (local <= 0) {
            if (from === 'center') continue;
            ctx.globalAlpha = 0.25;
            const s0 = p.size * 2;
            ctx.drawImage(sprite, p.sx - s0 / 2, p.sy - s0 / 2, s0, s0);
            continue;
          }
          let x: number;
          let y: number;
          let alpha: number;
          if (local >= 1) {
            x = p.tx;
            y = p.ty;
            alpha = 0.8 + 0.2 * Math.sin(t * 0.008 + p.phase);
          } else {
            const e = easeInOutCubic(local);
            const inv = 1 - e;
            x = inv * inv * p.sx + 2 * inv * e * p.cx + e * e * p.tx;
            y = inv * inv * p.sy + 2 * inv * e * p.cy + e * e * p.ty;
            alpha = 0.3 + 0.7 * local;
          }
          const s = p.size * 2.6;
          ctx.globalAlpha = alpha;
          ctx.drawImage(sprite, x - s / 2, y - s / 2, s, s);
        }

        // Each letter glitches in with an RGB split as its last particle lands.
        ctx.font = font();
        ctx.textBaseline = 'middle';
        letters.forEach((ch, i) => {
          const since = t - lockAt[i];
          if (since < 0 || since > FLASH_MS) return;
          const k = 1 - since / FLASH_MS;
          const dx = 7 * k;
          ctx.globalAlpha = 0.55 * k;
          ctx.fillStyle = '#ff2a55';
          ctx.fillText(ch, letterX[i] - dx, baselineY + (Math.random() - 0.5) * 3 * k);
          ctx.fillStyle = '#00e5ff';
          ctx.fillText(ch, letterX[i] + dx, baselineY);
          ctx.globalAlpha = 0.4 * k;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(ch, letterX[i], baselineY);
        });
        ctx.globalAlpha = 1;

        if (t > assembledAt) {
          drawWord(Math.min(1, (t - assembledAt) / GLOW_MS) * 0.35, fontSize * 0.25);
        }

        if (t >= endAt) {
          if (!completed) {
            completed = true;
            onCompleteRef.current?.();
          }
          return;
        }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };

    // Wait (briefly) for the display font so the sampled glyphs are Orbitron.
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    if (fonts && typeof fonts.load === 'function') {
      const timeout = new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, FONT_WAIT_MS));
      });
      Promise.race([fonts.load(font()).then(() => undefined), timeout])
        .catch(() => undefined)
        .then(run);
    } else {
      run();
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [text, color, from, durationMs, holdMs]);

  return (
    <canvas
      ref={canvasRef}
      aria-label={text}
      role="img"
      className={cn('pointer-events-none', className)}
    />
  );
}

export const ParticleAssembly = memo(ParticleAssemblyInner);
