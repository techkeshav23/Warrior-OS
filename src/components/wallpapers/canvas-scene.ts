// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Canvas wallpaper loop (shared by the forge wallpapers)
// One place for what every animated wallpaper must get right:
//  · DPR-aware backing store (capped), rebuilt on resize
//  · the loop pauses while the tab is hidden and resumes without a jump
//  · prefers-reduced-motion → one still frame (redrawn on resize only)
//  · frame time is clamped, so a stalled tab never "fast-forwards"
//  · everything is torn down on unmount
// A scene is plain imperative code: resize() rebuilds caches, frame()
// paints one frame at time t (seconds) with step dt (seconds).
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type { WallpaperProps } from '@/types/wallpaper';

export interface SceneInput {
  /** Pointer, smoothed, -1…1 (0 = centre). */
  mx: number;
  my: number;
  /** Raw pointer target, -1…1. */
  tx: number;
  ty: number;
  bass: number;
  energy: number;
}

export interface CanvasScene {
  /** Size changed (CSS px) — rebuild caches. dpr = backing-store scale. */
  resize(w: number, h: number, dpr: number): void;
  /** Paint one frame. The context is already scaled to CSS px. */
  frame(ctx: CanvasRenderingContext2D, t: number, dt: number, input: SceneInput): void;
}

export interface SceneOptions {
  /** Backing-store scale cap (default 1.5). */
  maxDpr?: number;
  /** Scene time used for the reduced-motion still frame (default 12 s). */
  stillTime?: number;
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(REDUCED_MOTION).matches
    : false;
}

/** hex → "r, g, b" for rgba() strings. */
export function rgb(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** Deterministic PRNG (mulberry32) so cached layers look the same every build. */
export function seeded(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An offscreen canvas at the given CSS size and scale (context pre-scaled). */
export function makeLayer(w: number, h: number, dpr: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { canvas, ctx };
}

/** A soft round glow sprite (radial falloff), drawn once and stamped with drawImage. */
export function glowSprite(size: number, rgbTriplet: string, core = 1): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, `rgba(${rgbTriplet}, ${core})`);
  grad.addColorStop(0.25, `rgba(${rgbTriplet}, ${core * 0.45})`);
  grad.addColorStop(0.6, `rgba(${rgbTriplet}, ${core * 0.1})`);
  grad.addColorStop(1, `rgba(${rgbTriplet}, 0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/**
 * Drive a CanvasScene on a <canvas>. `create` runs once per mount (client
 * only). Wallpaper props are read through a ref, so re-renders from the
 * pointer / audio never restart the loop.
 */
export function useCanvasScene(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  props: WallpaperProps,
  create: () => CanvasScene,
  options: SceneOptions = {},
) {
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });
  const createRef = useRef(create);
  const { maxDpr = 1.5, stillTime = 12 } = options;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const scene = createRef.current();
    const reduce = prefersReducedMotion();
    const input: SceneInput = { mx: 0, my: 0, tx: 0, ty: 0, bass: 0, energy: 0 };

    let raf = 0;
    let last = 0;
    let t = reduce ? stillTime : 0;
    let dpr = 1;

    const paint = (dt: number) => {
      const p = propsRef.current;
      input.tx = Number.isFinite(p.mouseX) ? p.mouseX : 0;
      input.ty = Number.isFinite(p.mouseY) ? p.mouseY : 0;
      const k = reduce ? 1 : 1 - Math.exp(-dt * 3.2);
      input.mx += (input.tx - input.mx) * k;
      input.my += (input.ty - input.my) * k;
      input.bass = p.bassLevel || 0;
      input.energy = p.overallLevel || 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene.frame(ctx, t, dt, input);
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      scene.resize(w, h, dpr);
      if (reduce || !raf) paint(0);
    };

    const loop = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
      last = now;
      t += dt;
      paint(dt);
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (reduce || raf || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    resize();
    start();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [canvasRef, maxDpr, stillTime]);
}
