// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Disintegrate Effect
// "Thanos snap" window close: when a visible window closes, its live
// DOM is captured to a canvas at that instant, cut into pixel blocks
// and the blocks peel away from the close-button corner, drifting up
// with random velocity, glowing in the app's accent colour and fading.
// Uses the same close signal as Phantom Windows (a diff of window ids
// in useWindowStore). Optional: off by default behind the
// useEffectsStore.disintegrateOnClose setting. Mount in the desktop phase.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef } from 'react';
import { useWindowStore } from '@/stores/useWindowStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useAppStore } from '@/stores/useAppStore';
import { accentForCategory } from '@/components/phantom/accent';
import type { WindowState } from '@/types/window';
import { rasterizeElement, roundRectPath } from './dom-raster';
import { playDisintegrateSound } from './effects-sfx';
import { useEffectsStore } from './useEffectsStore';
import { FX_IGNORE_SELECTOR, FX_Z, prefersReducedMotion, randRange, withAlpha } from './effects-utils';

const MAX_BLOCKS = 1800;
const MAX_BURSTS = 4;
const SWEEP_MS = 520;
const WINDOW_RADIUS = 16;

interface Block {
  sx: number;
  sy: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  sway: number;
  phase: number;
  delay: number;
  life: number;
}

interface Burst {
  snap: HTMLCanvasElement;
  scale: number;
  size: number;
  /** App accent colour used for the glow pass. */
  glow: string;
  blocks: Block[];
  startedAt: number;
  endsAt: number;
}

/** Finds the react-rnd element of a window (it carries the window's z-index inline). */
function findWindowElement(win: WindowState): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>('.react-draggable');
  for (const el of candidates) {
    if (el.closest(FX_IGNORE_SELECTOR)) continue;
    if (el.style.zIndex !== String(win.zIndex)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 20) continue;
    if (Math.abs(r.width - win.size.width) > win.size.width * 0.25) continue;
    return el;
  }
  return null;
}

/** Stand-in window chrome when the DOM node can't be found. */
function paintWindowFallback(win: WindowState, accent: string, scale: number): HTMLCanvasElement {
  const { width, height } = win.size;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  ctx.beginPath();
  roundRectPath(ctx, 0, 0, width, height, WINDOW_RADIUS);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(15, 15, 25, 0.92)';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fillRect(0, 0, width, 36);
  ctx.strokeStyle = withAlpha(accent, 0.06);
  for (let y = 48; y < height; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#e4e4ef';
  ctx.font = '12px ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText(win.title, 12, 18);
  ctx.restore();
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundRectPath(ctx, 0.5, 0.5, width - 1, height - 1, WINDOW_RADIUS);
  ctx.stroke();
  return canvas;
}

function createBurst(win: WindowState): Burst | null {
  const app = useAppStore.getState().getApp(win.appId);
  const accent = accentForCategory(app?.category);
  const scale = Math.min(window.devicePixelRatio || 1, 2);

  const el = findWindowElement(win);
  let left = win.position.x;
  let top = win.position.y;
  let width = win.size.width;
  let height = win.size.height;
  let snap: HTMLCanvasElement | null = null;
  if (el) {
    const raster = rasterizeElement(el, { scale, radius: WINDOW_RADIUS, ignoreSelector: FX_IGNORE_SELECTOR });
    if (raster) {
      snap = raster.canvas;
      left = raster.left;
      top = raster.top;
      width = raster.width;
      height = raster.height;
    }
  }
  if (!snap) snap = paintWindowFallback(win, accent, scale);
  if (width < 1 || height < 1) return null;

  const size = Math.max(6, Math.ceil(Math.sqrt((width * height) / MAX_BLOCKS)));
  const blocks: Block[] = [];
  for (let by = 0; by < height; by += size) {
    for (let bx = 0; bx < width; bx += size) {
      // Skip the transparent rounded corners.
      const cx = Math.min(bx + size / 2, width);
      const cy = Math.min(by + size / 2, height);
      const inCornerX = cx < WINDOW_RADIUS || cx > width - WINDOW_RADIUS;
      const inCornerY = cy < WINDOW_RADIUS || cy > height - WINDOW_RADIUS;
      if (inCornerX && inCornerY) {
        const ccx = cx < WINDOW_RADIUS ? WINDOW_RADIUS : width - WINDOW_RADIUS;
        const ccy = cy < WINDOW_RADIUS ? WINDOW_RADIUS : height - WINDOW_RADIUS;
        if (Math.hypot(cx - ccx, cy - ccy) > WINDOW_RADIUS) continue;
      }
      // Sweep outward from the close button (top-right corner), with noise.
      const d = Math.hypot((width - cx) / width, cy / height) / Math.SQRT2;
      blocks.push({
        sx: bx,
        sy: by,
        x: left + bx,
        y: top + by,
        vx: randRange(10, 110),
        vy: randRange(-190, -50),
        sway: randRange(4, 16),
        phase: randRange(0, Math.PI * 2),
        delay: d * SWEEP_MS + randRange(0, 170),
        life: randRange(560, 920),
      });
    }
  }
  const lastEnd = blocks.reduce((m, b) => Math.max(m, b.delay + b.life), 0);
  const now = performance.now();
  return {
    snap,
    scale,
    size,
    glow: withAlpha(accent, 1),
    blocks,
    startedAt: now,
    endsAt: now + lastEnd,
  };
}

function drawBurst(ctx: CanvasRenderingContext2D, burst: Burst, now: number): void {
  const t = now - burst.startedAt;
  const { size, snap, scale } = burst;
  const sourceSize = size * scale;

  // Pass 1: the captured pixels.
  ctx.globalCompositeOperation = 'source-over';
  for (const b of burst.blocks) {
    const local = (t - b.delay) / b.life;
    if (local >= 1) continue;
    if (local <= 0) {
      ctx.globalAlpha = 1;
      ctx.drawImage(snap, b.sx * scale, b.sy * scale, sourceSize, sourceSize, b.x, b.y, size, size);
      continue;
    }
    const secs = (local * b.life) / 1000;
    const x = b.x + b.vx * secs + Math.sin(secs * 9 + b.phase) * b.sway * local;
    const y = b.y + b.vy * secs - 40 * secs * secs;
    const shrink = size * (1 - 0.55 * local);
    ctx.globalAlpha = (1 - local) * (1 - local);
    ctx.drawImage(snap, b.sx * scale, b.sy * scale, sourceSize, sourceSize, x, y, shrink, shrink);
  }

  // Pass 2: accent glow on the blocks in flight.
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = burst.glow;
  for (const b of burst.blocks) {
    const local = (t - b.delay) / b.life;
    if (local <= 0 || local >= 1) continue;
    const secs = (local * b.life) / 1000;
    const x = b.x + b.vx * secs + Math.sin(secs * 9 + b.phase) * b.sway * local;
    const y = b.y + b.vy * secs - 40 * secs * secs;
    const shrink = size * (1 - 0.55 * local);
    ctx.globalAlpha = 0.65 * local * (1 - local);
    ctx.fillRect(x, y, shrink, shrink);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

function DisintegrateLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const bursts: Burst[] = [];
    let raf = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
    };
    resize();

    const frame = (now: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (let i = bursts.length - 1; i >= 0; i--) {
        if (now >= bursts[i].endsAt) bursts.splice(i, 1);
      }
      for (const burst of bursts) drawBurst(ctx, burst, now);
      if (bursts.length > 0) {
        raf = requestAnimationFrame(frame);
      } else {
        raf = 0;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    const unsub = useWindowStore.subscribe((state, prev) => {
      if (state.windows === prev.windows) return;
      const closed = prev.windows.filter((w) => !state.windows.some((n) => n.id === w.id));
      if (closed.length === 0 || prefersReducedMotion()) return;
      const activeWorkspace = useWorkspaceStore.getState().activeWorkspaceId;
      let added = false;
      for (const win of closed) {
        // Only windows the user could actually see.
        if (win.isMinimized || win.workspaceId !== activeWorkspace) continue;
        if (bursts.length >= MAX_BURSTS) break;
        const burst = createBurst(win);
        if (burst) {
          bursts.push(burst);
          added = true;
        }
      }
      if (!added) return;
      playDisintegrateSound();
      if (!raf) raf = requestAnimationFrame(frame);
    });

    window.addEventListener('resize', resize);
    return () => {
      unsub();
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-fx-ignore=""
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ zIndex: FX_Z.disintegrate }}
    />
  );
}

function DisintegrateEffectInner() {
  const enabled = useEffectsStore((s) => s.disintegrateOnClose);
  return enabled ? <DisintegrateLayer /> : null;
}

export const DisintegrateEffect = memo(DisintegrateEffectInner);
