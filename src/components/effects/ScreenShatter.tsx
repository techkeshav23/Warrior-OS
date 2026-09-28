// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Screen Shatter
// Canvas glass-break: the screen image cracks from the impact point
// into a spider-web of triangle shards that fly out with velocity,
// spin, flip and gravity, revealing what is behind.
//
//   <ScreenShatter active onDone />       standalone (captures the page)
//   <ScreenShatterLayer />                root mount: plays on every
//                                          lock → desktop phase change
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useOSStore } from '@/stores/useOSStore';
import { useXPStore } from '@/stores/useXPStore';
import { OWNER } from '@/config/owner';
import { getOwnerInitials } from '@/components/showcase/OwnerCard';
import { rasterizeElement } from './dom-raster';
import { playShatterSound } from './effects-sfx';
import {
  FX_IGNORE_SELECTOR,
  FX_Z,
  prefersReducedMotion,
  randRange,
  resolveDisplayFontFamily,
  smoothstep,
} from './effects-utils';

export interface ShatterImpact {
  x: number;
  y: number;
}

export interface ScreenShatterProps {
  /** Rising edge starts the break. */
  active: boolean;
  /** Called once every shard has left the screen (immediately under reduced motion). */
  onDone?: () => void;
  /** Pre-captured screen image (viewport sized). Omitted → captured from `source` on activation. */
  snapshot?: HTMLCanvasElement | null;
  /** Element to capture when no snapshot is given (default: document.body). */
  source?: HTMLElement | null;
  /** Viewport point where the glass breaks (default: centre of the screen). */
  impact?: ShatterImpact | null;
}

const SHATTER_MS = 1750;
const CRACK_MS = 150;
const GRAVITY = 2600; // px/s²
const LOCK_BACKGROUND = '#050508';

interface Pt {
  x: number;
  y: number;
}

interface Shard {
  tex: HTMLCanvasElement;
  ox: number;
  oy: number;
  cx: number;
  cy: number;
  vx: number;
  vy: number;
  spin: number;
  tilt: number;
  tiltSpeed: number;
  delay: number;
}

interface Crack {
  a: Pt;
  b: Pt;
  c: Pt;
  dist: number;
}

// ─── Standalone component ───

function ScreenShatterInner({ active, onDone, snapshot, source, impact }: ScreenShatterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  const impactX = impact?.x;
  const impactY = impact?.y;

  // Layout effect: frame 0 is painted before the browser shows the page
  // underneath, so the break starts from an intact-looking screen.
  useLayoutEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (prefersReducedMotion()) {
      const t = window.setTimeout(() => onDoneRef.current?.(), 0);
      return () => window.clearTimeout(t);
    }

    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const t = window.setTimeout(() => onDoneRef.current?.(), 0);
      return () => window.clearTimeout(t);
    }

    const snap = snapshot ?? captureScreen(source ?? document.body);
    const snapScale = snap.width / w;
    const ix = impactX ?? w / 2;
    const iy = impactY ?? h * 0.45;
    const maxR = Math.hypot(Math.max(ix, w - ix), Math.max(iy, h - iy));
    const triangles = buildTriangles(w, h, ix, iy, maxR);
    const shards = buildShards(triangles, snap, snapScale, w, h, ix, iy, maxR);
    const cracks: Crack[] = triangles
      .map(([a, b, c]) => ({ a, b, c, dist: Math.hypot((a.x + b.x + c.x) / 3 - ix, (a.y + b.y + c.y) / 3 - iy) }))
      .sort((p, q) => p.dist - q.dist);

    const draw = (elapsed: number) => {
      const t = elapsed / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = 1;

      // Dark backdrop hides whatever is still fading underneath, then lets
      // the incoming screen show through the gaps.
      const backdrop = t < 0.42 ? 1 : Math.max(0, 1 - (t - 0.42) / 0.75);
      if (backdrop > 0) {
        ctx.globalAlpha = backdrop;
        ctx.fillStyle = '#020207';
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }

      if (elapsed < CRACK_MS) {
        ctx.drawImage(snap, 0, 0, w, h);
        const front = (elapsed / CRACK_MS) * maxR * 1.15;
        ctx.beginPath();
        for (const c of cracks) {
          if (c.dist > front) break;
          ctx.moveTo(c.a.x, c.a.y);
          ctx.lineTo(c.b.x, c.b.y);
          ctx.lineTo(c.c.x, c.c.y);
          ctx.closePath();
        }
        ctx.strokeStyle = 'rgba(160, 235, 255, 0.35)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(240, 252, 255, 0.9)';
        ctx.lineWidth = 1;
        ctx.stroke();
        const flash = 1 - elapsed / CRACK_MS;
        const glow = ctx.createRadialGradient(ix, iy, 0, ix, iy, 220);
        glow.addColorStop(0, `rgba(255, 255, 255, ${0.9 * flash})`);
        glow.addColorStop(0.35, `rgba(160, 235, 255, ${0.35 * flash})`);
        glow.addColorStop(1, 'rgba(160, 235, 255, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(ix - 220, iy - 220, 440, 440);
        return;
      }

      for (const s of shards) {
        const tau = t - s.delay;
        if (tau <= 0) {
          ctx.setTransform(dpr, 0, 0, dpr, dpr * s.cx, dpr * s.cy);
          ctx.globalAlpha = 1;
          ctx.drawImage(s.tex, -s.ox, -s.oy);
          continue;
        }
        const x = s.cx + s.vx * tau;
        const y = s.cy + s.vy * tau + 0.5 * GRAVITY * tau * tau;
        if (y - s.tex.height > h + 40) continue;
        const alpha = 1 - smoothstep(0.55, 1.35, tau);
        if (alpha <= 0) continue;
        const angle = s.spin * tau;
        const flip = Math.cos(s.tilt + s.tiltSpeed * tau);
        const sx = Math.abs(flip) < 0.08 ? (flip < 0 ? -0.08 : 0.08) : flip;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        ctx.setTransform(dpr * cos * sx, dpr * sin * sx, -dpr * sin, dpr * cos, dpr * x, dpr * y);
        ctx.globalAlpha = alpha;
        ctx.drawImage(s.tex, -s.ox, -s.oy);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
    };

    draw(0);
    playShatterSound();

    let raf = 0;
    let finished = false;
    const start = performance.now();
    const loop = (now: number) => {
      const elapsed = now - start;
      if (elapsed >= SHATTER_MS) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        finished = true;
        onDoneRef.current?.();
        return;
      }
      draw(elapsed);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      if (!finished) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [active, snapshot, source, impactX, impactY]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      data-fx-ignore=""
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 h-screen w-screen"
      style={{ zIndex: FX_Z.shatter }}
    />
  );
}

export const ScreenShatter = memo(ScreenShatterInner);

// ─── Root layer: lock → desktop ───

interface ShatterRun {
  id: number;
  snapshot: HTMLCanvasElement;
  impact: ShatterImpact;
}

/**
 * Mount once at the root (outside the phase AnimatePresence). On every
 * lock → desktop change it captures the live lock screen synchronously,
 * before React swaps phases, and shatters it over the incoming desktop.
 * The glass breaks where the user clicked to unlock (centre for Enter).
 */
function ScreenShatterLayerInner() {
  const [run, setRun] = useState<ShatterRun | null>(null);

  useEffect(() => {
    let lastPointer: { x: number; y: number; at: number } | null = null;
    let counter = 0;
    const onPointerDown = (e: PointerEvent) => {
      lastPointer = { x: e.clientX, y: e.clientY, at: Date.now() };
    };
    window.addEventListener('pointerdown', onPointerDown, true);

    const unsub = useOSStore.subscribe((state, prev) => {
      if (prev.phase !== 'lock' || state.phase !== 'desktop') return;
      if (prefersReducedMotion()) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const recent = lastPointer && Date.now() - lastPointer.at < 4000 ? lastPointer : null;
      const impact = recent ? { x: recent.x, y: recent.y } : { x: w / 2, y: h * 0.45 };
      counter += 1;
      setRun({ id: counter, snapshot: captureScreen(document.body), impact });
    });

    return () => {
      unsub();
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, []);

  if (!run) return null;
  return (
    <ScreenShatter
      key={run.id}
      active
      snapshot={run.snapshot}
      impact={run.impact}
      onDone={() => setRun(null)}
    />
  );
}

export const ScreenShatterLayer = memo(ScreenShatterLayerInner);

// ─── Capture ───

/**
 * Viewport-sized image of the live page. Falls back to a painted lock
 * screen when the capture comes back (nearly) empty, e.g. when the lock
 * screen already faded out before the phase changed.
 */
function captureScreen(root: HTMLElement): HTMLCanvasElement {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const raster = rasterizeElement(root, {
    rect: { left: 0, top: 0, width: w, height: h },
    scale,
    background: LOCK_BACKGROUND,
    ignoreSelector: FX_IGNORE_SELECTOR,
  });
  if (raster && raster.words >= 3) return raster.canvas;
  return paintLockScreen(w, h, scale);
}

/** Recreation of the lock screen's look: gradient, particles, clock, owner avatar, name. */
function paintLockScreen(w: number, h: number, scale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#050510');
  bg.addColorStop(0.5, '#0a0a20');
  bg.addColorStop(1, '#050510');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
  for (let i = 0; i < 30; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, 0.5 + Math.random() * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const now = new Date();
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const date = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const { level } = useXPStore.getState();
  const display = resolveDisplayFontFamily();
  const cx = w / 2;
  const cy = h / 2;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e4e4ef';
  ctx.font = `700 72px ${display}`;
  ctx.fillText(time, cx, cy - 190);
  ctx.fillStyle = '#8888a0';
  ctx.font = '14px ui-monospace, monospace';
  ctx.fillText(date, cx, cy - 138);

  const avatarY = cy - 50;
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, avatarY, 64, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, avatarY, 56, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#111118';
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
  ctx.beginPath();
  ctx.arc(cx, avatarY, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Owner initials, cyan → violet like the lock screen avatar.
  const initials = getOwnerInitials(OWNER.name);
  const initialsFill = ctx.createLinearGradient(cx - 24, avatarY - 18, cx + 24, avatarY + 18);
  initialsFill.addColorStop(0, '#00f0ff');
  initialsFill.addColorStop(1, '#7b61ff');
  ctx.fillStyle = initialsFill;
  ctx.font = `700 30px ${display}`;
  ctx.fillText(initials, cx, avatarY + 1, 80);

  ctx.fillStyle = '#00f0ff';
  ctx.font = '700 12px ui-monospace, monospace';
  ctx.fillText(`Lv.${level}`, cx, avatarY + 50);

  ctx.font = `700 20px ${display}`;
  ctx.fillText(OWNER.name.toUpperCase(), cx, cy + 40, w - 48);
  paintOwnerLine(ctx, cx, cy + 64, w - 48);
  ctx.fillStyle = '#00f0ff';
  ctx.font = '12px ui-monospace, monospace';
  ctx.fillText('Authenticating...', cx, cy + 120);

  const vignette = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.35, cx, cy, Math.hypot(cx, cy));
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
  return canvas;
}

/** "@handle · tagline" centred on (cx, y): handle in cyan, tagline muted, like the lock screen. */
function paintOwnerLine(ctx: CanvasRenderingContext2D, cx: number, y: number, maxWidth: number): void {
  const handle = `@${OWNER.handle}`;
  const tagline = OWNER.tagline ? ` · ${OWNER.tagline}` : '';
  ctx.save();
  ctx.font = '12px ui-monospace, monospace';
  const handleWidth = ctx.measureText(handle).width;
  const total = handleWidth + ctx.measureText(tagline).width;
  const fit = total > maxWidth ? maxWidth / total : 1;
  ctx.translate(cx - (total * fit) / 2, y);
  ctx.scale(fit, 1);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0, 240, 255, 0.8)';
  ctx.fillText(handle, 0, 0);
  ctx.fillStyle = '#555566';
  ctx.fillText(tagline, handleWidth, 0);
  ctx.restore();
}

// ─── Geometry ───

/** Spider-web fracture: jittered spokes × geometric rings around the impact. */
function buildTriangles(w: number, h: number, ix: number, iy: number, maxR: number): Pt[][] {
  const spokes = 15 + Math.floor(Math.random() * 5);
  const angles = Array.from({ length: spokes }, (_, j) => (j / spokes) * Math.PI * 2 + randRange(-0.12, 0.12)).sort(
    (a, b) => a - b
  );
  const radii: number[] = [];
  let r = randRange(26, 42);
  while (r < maxR) {
    radii.push(r);
    r *= randRange(1.45, 1.75);
  }
  // Outer ring far enough out that its polygon covers every screen corner.
  radii.push(maxR * 1.12 + 40);

  const outer = radii.length - 1;
  const rings: Pt[][] = radii.map((radius, k) =>
    angles.map((angle) => {
      const a = k === outer ? angle : angle + randRange(-0.05, 0.05);
      const rr = k === outer ? radius : radius * randRange(0.9, 1.1);
      return { x: ix + Math.cos(a) * rr, y: iy + Math.sin(a) * rr };
    })
  );

  const tris: Pt[][] = [];
  const center = { x: ix, y: iy };
  for (let j = 0; j < spokes; j++) {
    tris.push([center, rings[0][j], rings[0][(j + 1) % spokes]]);
  }
  for (let k = 1; k < rings.length; k++) {
    for (let j = 0; j < spokes; j++) {
      const j1 = (j + 1) % spokes;
      const a = rings[k - 1][j];
      const b = rings[k - 1][j1];
      const c = rings[k][j1];
      const d = rings[k][j];
      if (Math.random() < 0.5) tris.push([a, b, c], [a, c, d]);
      else tris.push([a, b, d], [b, c, d]);
    }
  }
  return tris.filter((t) => {
    const minX = Math.min(t[0].x, t[1].x, t[2].x);
    const maxX = Math.max(t[0].x, t[1].x, t[2].x);
    const minY = Math.min(t[0].y, t[1].y, t[2].y);
    const maxY = Math.max(t[0].y, t[1].y, t[2].y);
    return maxX > 0 && minX < w && maxY > 0 && minY < h;
  });
}

/** Pre-renders each shard's slice of the screen (with a glass sheen and edge). */
function buildShards(
  tris: Pt[][],
  snap: HTMLCanvasElement,
  snapScale: number,
  w: number,
  h: number,
  ix: number,
  iy: number,
  maxR: number
): Shard[] {
  const shards: Shard[] = [];
  for (const tri of tris) {
    const minX = Math.max(0, Math.floor(Math.min(tri[0].x, tri[1].x, tri[2].x)));
    const minY = Math.max(0, Math.floor(Math.min(tri[0].y, tri[1].y, tri[2].y)));
    const maxX = Math.min(w, Math.ceil(Math.max(tri[0].x, tri[1].x, tri[2].x)));
    const maxY = Math.min(h, Math.ceil(Math.max(tri[0].y, tri[1].y, tri[2].y)));
    const bw = maxX - minX;
    const bh = maxY - minY;
    if (bw < 1 || bh < 1) continue;

    const tex = document.createElement('canvas');
    tex.width = bw;
    tex.height = bh;
    const t = tex.getContext('2d');
    if (!t) continue;
    t.beginPath();
    t.moveTo(tri[0].x - minX, tri[0].y - minY);
    t.lineTo(tri[1].x - minX, tri[1].y - minY);
    t.lineTo(tri[2].x - minX, tri[2].y - minY);
    t.closePath();
    t.save();
    t.clip();
    t.drawImage(snap, minX * snapScale, minY * snapScale, bw * snapScale, bh * snapScale, 0, 0, bw, bh);
    const sheen = t.createLinearGradient(0, 0, bw, bh);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    sheen.addColorStop(1, 'rgba(160, 225, 255, 0.07)');
    t.fillStyle = sheen;
    t.fillRect(0, 0, bw, bh);
    t.restore();
    t.strokeStyle = 'rgba(225, 248, 255, 0.55)';
    t.lineWidth = 1;
    t.stroke();

    const cx = (tri[0].x + tri[1].x + tri[2].x) / 3;
    const cy = (tri[0].y + tri[1].y + tri[2].y) / 3;
    const dx = cx - ix;
    const dy = cy - iy;
    const dist = Math.hypot(dx, dy) || 1;
    const near = 1 - Math.min(1, dist / Math.max(1, maxR));
    const speed = randRange(160, 380) + 950 * near * near;
    shards.push({
      tex,
      ox: cx - minX,
      oy: cy - minY,
      cx,
      cy,
      vx: (dx / dist) * speed + randRange(-50, 50),
      vy: (dy / dist) * speed - randRange(60, 240),
      spin: randRange(-6, 6) * (0.4 + near),
      tilt: randRange(-0.4, 0.4),
      tiltSpeed: randRange(-7, 7),
      delay: CRACK_MS / 1000 + dist / 5200 + randRange(0, 0.05),
    });
  }
  return shards;
}
