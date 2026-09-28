// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Phantom Dissolve
// When a phantom goes unclicked for 8 s it breaks into pixel blocks
// cut from its own snapshot, tinted with the app's accent colour,
// which scatter outward and float up while fading — slower and more
// ethereal than a window close. Canvas-based (one draw loop, ~500
// blocks); the loop is cancelled and canvases are released on unmount.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef } from 'react';
import { PHANTOM_FADE_MS } from '@/stores/usePhantomStore';
import type { PhantomWindow } from '@/types/phantom';

interface PhantomDissolveProps {
  phantom: PhantomWindow;
  /** Called once the dissolve animation completes */
  onComplete: (id: string) => void;
}

/** Room around the ghost for particles to scatter into. */
const PAD = 90;
/** Ghost opacity the particles start from (matches the drifting card). */
const START_ALPHA = 0.32;

interface Block {
  sx: number;
  sy: number;
  vx: number;
  vy: number;
  delay: number;
  life: number;
  spin: number;
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function PhantomDissolveInner({ phantom, onComplete }: PhantomDissolveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  const { id, accent, snapshot } = phantom;
  const { width, height } = phantom.size;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    canvas.width = w + PAD * 2;
    canvas.height = h + PAD * 2;

    const rnd = seededRandom(hashSeed(id));
    const blockSize = Math.max(10, Math.min(28, Math.round(Math.sqrt((w * h) / 520))));
    const cols = Math.ceil(w / blockSize);
    const rows = Math.ceil(h / blockSize);
    const cx = w / 2;
    const cy = h / 2;
    const blocks: Block[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sx = c * blockSize;
        const sy = r * blockSize;
        const dx = sx + blockSize / 2 - cx;
        const dy = sy + blockSize / 2 - cy;
        const mag = Math.hypot(dx, dy) || 1;
        const speed = 18 + rnd() * 46; // px/s outward
        blocks.push({
          sx,
          sy,
          vx: (dx / mag) * speed + (rnd() - 0.5) * 14,
          vy: (dy / mag) * speed - 14 - rnd() * 18, // bias upward
          // Erodes from the top down, with plenty of randomness.
          delay: rnd() * 0.55 + (r / Math.max(1, rows)) * 0.45,
          life: 0.9 + rnd() * 0.8,
          spin: 0.5 + rnd() * 0.5,
        });
      }
    }
    const total = Math.max(...blocks.map((b) => b.delay + b.life), PHANTOM_FADE_MS / 1000);

    // Accent-tinted copy of the snapshot, cut into blocks every frame.
    let source: HTMLCanvasElement | null = null;
    let cancelled = false;
    if (snapshot) {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        const off = document.createElement('canvas');
        off.width = w;
        off.height = h;
        const octx = off.getContext('2d');
        if (!octx) return;
        octx.drawImage(img, 0, 0, w, h);
        octx.globalCompositeOperation = 'source-atop';
        octx.fillStyle = accent;
        octx.globalAlpha = 0.45;
        octx.fillRect(0, 0, w, h);
        source = off;
      };
      img.src = snapshot;
    }

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = accent;
      for (const b of blocks) {
        const local = t - b.delay;
        let x = b.sx;
        let y = b.sy;
        let alpha = START_ALPHA;
        let size = blockSize;
        if (local > 0) {
          const p = local / b.life;
          if (p >= 1) continue;
          x += b.vx * local;
          y += b.vy * local - 12 * local * local; // float up, accelerating
          alpha = START_ALPHA * Math.pow(1 - p, 1.4);
          size = blockSize * (1 - 0.55 * p * b.spin);
        }
        ctx.globalAlpha = alpha;
        if (source) {
          ctx.drawImage(source, b.sx, b.sy, blockSize, blockSize, PAD + x, PAD + y, size, size);
        } else {
          ctx.fillRect(PAD + x, PAD + y, size, size);
        }
      }
      if (t < total) {
        raf = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onCompleteRef.current(id);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      const released = source as HTMLCanvasElement | null;
      if (released) {
        released.width = 0;
        released.height = 0;
      }
      source = null;
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [id, accent, snapshot, width, height]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute"
      style={{ left: -PAD, top: -PAD, width: width + PAD * 2, height: height + PAD * 2 }}
    />
  );
}

export const PhantomDissolve = PhantomDissolveInner;
