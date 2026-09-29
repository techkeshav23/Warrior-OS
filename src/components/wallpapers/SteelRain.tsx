// ═══════════════════════════════════════════════════════════
// WARRIOR OS — "Steel Rain" wallpaper (id: steelrain)
// Canvas: a wall of brushed, riveted armor plate in a cold night storm.
// Beads of water cling to the metal, heavier drops slide down it in
// stop-and-go runs leaving wet trails, fine rain slants past in front,
// and every so often lightning floods the plate with cold light (its
// bolt mirrored in the steel). A far-off forge warms the lower corner.
// The plate (dark + lightning-lit versions, beads included) is baked
// once; a frame is two drawImages and a few hundred strokes.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useRef } from 'react';
import type { WallpaperProps } from '@/types/wallpaper';
import { EMBER, FG, INK, PLASMA, STEEL } from '@/styles/tokens';
import { makeLayer, rgb, seeded, useCanvasScene, type CanvasScene } from './canvas-scene';

const COLD = rgb(STEEL[200]);
const WHITE = rgb(FG.base);
const BOLT = rgb(PLASMA[300]);
const INK_RGB = rgb(INK[950]);

interface Drop {
  x: number;
  y: number;
  r: number;
  v: number;
  /** Seconds left in the current pause (drops cling, then let go). */
  hold: number;
  trail: number;
  seed: number;
}

interface Streak {
  x: number;
  y: number;
  len: number;
  v: number;
  a: number;
}

/** Brushed, riveted plate. lit = the lightning-flash version. */
function paintPlate(w: number, h: number, dpr: number, lit: boolean, seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeLayer(w, h, dpr);
  const rand = seeded(seed);

  const base = ctx.createLinearGradient(0, 0, w * 0.4, h);
  if (lit) {
    base.addColorStop(0, STEEL[300]);
    base.addColorStop(0.5, STEEL[400]);
    base.addColorStop(1, STEEL[600]);
  } else {
    base.addColorStop(0, STEEL[500]);
    base.addColorStop(0.4, STEEL[600]);
    base.addColorStop(1, STEEL[800]);
  }
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // Brushing: thousands of fine horizontal strokes, light and dark.
  const lines = Math.round(h * 2.4);
  for (let i = 0; i < lines; i++) {
    const y = rand() * h;
    const x = rand() * w * 1.2 - w * 0.2;
    const len = w * (0.08 + rand() * 0.5);
    const light = rand() > 0.5;
    ctx.fillStyle = light ? `rgba(${COLD}, ${(lit ? 0.1 : 0.08) * rand()})` : `rgba(${INK_RGB}, ${0.1 * rand()})`;
    ctx.fillRect(x, y, len, rand() > 0.85 ? 1.2 : 0.6);
  }

  // Anisotropic sheen: a broad cold band across the brushing.
  const sheen = ctx.createLinearGradient(0, h * 0.1, 0, h * 0.7);
  sheen.addColorStop(0, `rgba(${COLD}, 0)`);
  sheen.addColorStop(0.45, `rgba(${COLD}, ${lit ? 0.3 : 0.2})`);
  sheen.addColorStop(0.55, `rgba(${COLD}, ${lit ? 0.24 : 0.14})`);
  sheen.addColorStop(1, `rgba(${COLD}, 0)`);
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);

  // Plate seams (bevelled) and rivets.
  const seamsY = [h * 0.34, h * 0.78];
  const seamsX = [w * 0.27, w * 0.71];
  const bevel = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.strokeStyle = `rgba(${INK_RGB}, 0.85)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(${COLD}, ${lit ? 0.35 : 0.12})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1 + (y1 === y2 ? 0 : 1.5), y1 + (y1 === y2 ? 1.5 : 0));
    ctx.lineTo(x2 + (y1 === y2 ? 0 : 1.5), y2 + (y1 === y2 ? 1.5 : 0));
    ctx.stroke();
  };
  for (const y of seamsY) bevel(0, y, w, y);
  bevel(seamsX[0], 0, seamsX[0], seamsY[0]);
  bevel(seamsX[1], seamsY[0], seamsX[1], seamsY[1]);
  bevel(seamsX[0] + w * 0.12, seamsY[1], seamsX[0] + w * 0.12, h);
  const rivet = (x: number, y: number) => {
    const g = ctx.createRadialGradient(x - 1.2, y - 1.2, 0, x, y, 4.2);
    g.addColorStop(0, lit ? FG.base : STEEL[300]);
    g.addColorStop(0.45, lit ? STEEL[300] : STEEL[500]);
    g.addColorStop(1, STEEL[900]);
    ctx.fillStyle = `rgba(${INK_RGB}, 0.6)`;
    ctx.beginPath();
    ctx.arc(x + 1, y + 1.5, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 3.6, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const y of seamsY) for (let x = 36; x < w; x += 96) rivet(x, y - 14);
  for (const y of seamsY) for (let x = 36; x < w; x += 96) rivet(x, y + 16);

  // Beads of water clinging to the plate.
  const beads = Math.round((w * h) / 2600);
  for (let i = 0; i < beads; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 0.6 + rand() * rand() * 3.2;
    ctx.fillStyle = `rgba(${INK_RGB}, ${lit ? 0.25 : 0.35})`;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.35, r, r * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${lit ? WHITE : COLD}, ${lit ? 0.5 : 0.16})`;
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Vignette (night) — the lit plate keeps more of its light.
  const vig = ctx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.2, w * 0.5, h * 0.45, Math.max(w, h) * 0.78);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, `rgba(${INK_RGB}, ${lit ? 0.45 : 0.62})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  return canvas;
}

function createSteelRain(): CanvasScene {
  let w = 1;
  let h = 1;
  let plate: HTMLCanvasElement | null = null;
  let plateLit: HTMLCanvasElement | null = null;
  const drops: Drop[] = [];
  const streaks: Streak[] = [];
  let nextFlash = 5;
  let flashAt = -100;
  let bolt: [number, number][][] = [];
  let forge: CanvasGradient | null = null;

  const resetDrop = (d: Drop | null, anywhere: boolean): Drop => {
    const o = d ?? ({} as Drop);
    o.x = Math.random() * w;
    o.y = anywhere ? Math.random() * h : -10 - Math.random() * h * 0.3;
    o.r = 2 + Math.random() * 2.6;
    o.v = 0;
    o.hold = Math.random() * 3;
    o.trail = anywhere ? Math.random() * 120 : 0;
    o.seed = Math.random() * 100;
    return o;
  };

  const resetStreak = (s: Streak | null, anywhere: boolean): Streak => {
    const o = s ?? ({} as Streak);
    o.x = Math.random() * (w + 200) - 100;
    o.y = anywhere ? Math.random() * h : -40;
    o.len = 14 + Math.random() * 30;
    o.v = 900 + Math.random() * 700;
    o.a = 0.05 + Math.random() * 0.12;
    return o;
  };

  const makeBolt = () => {
    // Main jagged channel + a couple of forks, in plate space.
    const paths: [number, number][][] = [];
    let x = w * (0.2 + Math.random() * 0.6);
    let y = -10;
    const main: [number, number][] = [[x, y]];
    while (y < h * (0.55 + Math.random() * 0.3)) {
      x += (Math.random() - 0.5) * 60;
      y += 18 + Math.random() * 30;
      main.push([x, y]);
      if (Math.random() < 0.12 && paths.length < 3) {
        const fork: [number, number][] = [[x, y]];
        let fx = x;
        let fy = y;
        const dir = Math.random() < 0.5 ? -1 : 1;
        for (let k = 0; k < 6; k++) {
          fx += dir * (10 + Math.random() * 30);
          fy += 14 + Math.random() * 24;
          fork.push([fx, fy]);
        }
        paths.push(fork);
      }
    }
    paths.unshift(main);
    return paths;
  };

  /** 0…1 light of the current strike: two quick pulses and a tail. */
  const flashLevel = (t: number) => {
    const d = t - flashAt;
    if (d < 0 || d > 1.4) return 0;
    const p1 = Math.exp(-d * 18);
    const p2 = d > 0.16 ? Math.exp(-(d - 0.16) * 9) * 0.85 : 0;
    const p3 = d > 0.42 ? Math.exp(-(d - 0.42) * 12) * 0.45 : 0;
    return Math.min(1, p1 + p2 + p3);
  };

  return {
    resize(nw, nh, dpr) {
      w = nw;
      h = nh;
      const d = Math.min(dpr, 1.25);
      plate = paintPlate(w + 24, h + 24, d, false, 404);
      plateLit = paintPlate(w + 24, h + 24, d, true, 404);
      drops.length = 0;
      streaks.length = 0;
      const area = (w * h) / (1600 * 1000);
      const nd = Math.round(Math.max(50, Math.min(140, 95 * area)));
      const ns = Math.round(Math.max(120, Math.min(320, 220 * area)));
      for (let i = 0; i < nd; i++) drops.push(resetDrop(null, true));
      for (let i = 0; i < ns; i++) streaks.push(resetStreak(null, true));
      forge = null;
    },

    frame(ctx, t, dt, input) {
      if (!plate || !plateLit) return;
      // Strike scheduling (the still frame shows a strike mid-flash).
      if (dt === 0 && flashAt < 0) {
        flashAt = t - 0.2;
        bolt = makeBolt();
      } else if (t > nextFlash) {
        flashAt = t;
        nextFlash = t + 7 + Math.random() * 11;
        bolt = makeBolt();
      }
      const f = flashLevel(t);

      const ox = -12 - input.mx * 10;
      const oy = -12 - input.my * 8;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.drawImage(plate, ox, oy, w + 24, h + 24);
      if (f > 0.01) {
        ctx.globalAlpha = f * 0.85;
        ctx.drawImage(plateLit, ox, oy, w + 24, h + 24);
      }

      // Distant forge warming the lower-left of the plate.
      if (!forge) {
        forge = ctx.createRadialGradient(w * 0.05, h * 1.05, 0, w * 0.05, h * 1.05, Math.max(w, h) * 0.55);
        forge.addColorStop(0, `rgba(${rgb(EMBER[600])}, 0.26)`);
        forge.addColorStop(0.4, `rgba(${rgb(EMBER[700])}, 0.1)`);
        forge.addColorStop(1, `rgba(${rgb(EMBER[800])}, 0)`);
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.85 + Math.sin(t * 0.8) * 0.15;
      ctx.fillStyle = forge;
      ctx.fillRect(0, 0, w, h);

      // Bolt reflection in the steel.
      if (f > 0.05 && bolt.length) {
        ctx.globalAlpha = f;
        ctx.lineJoin = 'round';
        for (let i = 0; i < bolt.length; i++) {
          const path = bolt[i];
          for (const [lw, a, col] of [
            [14, 0.08, BOLT],
            [4, 0.25, BOLT],
            [i === 0 ? 1.6 : 0.9, 0.9, WHITE],
          ] as const) {
            ctx.strokeStyle = `rgba(${col}, ${a})`;
            ctx.lineWidth = lw;
            ctx.beginPath();
            for (let k = 0; k < path.length; k++) {
              const [px, py] = path[k];
              if (k === 0) ctx.moveTo(px + ox + 12, py + oy + 12);
              else ctx.lineTo(px + ox + 12, py + oy + 12);
            }
            ctx.stroke();
          }
        }
      }
      ctx.globalCompositeOperation = 'source-over';

      // Drops sliding down the plate: cling, let go, run, leave a wet trail.
      const light = 0.25 + f * 0.75;
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        if (d.hold > 0) {
          d.hold -= dt;
          d.v *= 0.8;
        } else {
          d.v = Math.min(260, d.v + (140 + d.r * 40) * dt);
          if (Math.random() < dt * 0.6) d.hold = 0.2 + Math.random() * 1.6;
        }
        const dy = d.v * dt;
        d.y += dy;
        d.x += Math.sin(d.y * 0.05 + d.seed) * dy * 0.12;
        d.trail = Math.min(220, d.trail + dy * 0.9);
        if (d.hold > 0) d.trail = Math.max(0, d.trail - dt * 25);
        if (d.y - d.trail > h + 10) resetDrop(d, false);

        const x = d.x + ox + 12;
        const y = d.y + oy + 12;
        if (d.trail > 2) {
          // Wet metal is darker, with a thin glint along one edge.
          const x0 = x - Math.sin((d.y - d.trail) * 0.05 + d.seed) * 2;
          const wet = ctx.createLinearGradient(0, y - d.trail, 0, y);
          wet.addColorStop(0, `rgba(${INK_RGB}, 0)`);
          wet.addColorStop(1, `rgba(${INK_RGB}, 0.32)`);
          ctx.strokeStyle = wet;
          ctx.lineWidth = d.r * 1.5;
          ctx.beginPath();
          ctx.moveTo(x0, y - d.trail);
          ctx.lineTo(x, y);
          ctx.stroke();
          const glint = ctx.createLinearGradient(0, y - d.trail, 0, y);
          glint.addColorStop(0, `rgba(${COLD}, 0)`);
          glint.addColorStop(1, `rgba(${COLD}, ${0.12 + light * 0.25})`);
          ctx.strokeStyle = glint;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(x0 - d.r * 0.45, y - d.trail);
          ctx.lineTo(x - d.r * 0.45, y);
          ctx.stroke();
        }
        // Drop body: dark lens with a bright highlight.
        ctx.fillStyle = `rgba(${INK_RGB}, 0.55)`;
        ctx.beginPath();
        ctx.ellipse(x, y + d.r * 0.3, d.r, d.r * 1.25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${COLD}, ${0.12 + light * 0.2})`;
        ctx.beginPath();
        ctx.ellipse(x, y, d.r * 0.8, d.r * 1.05, 0, 0, Math.PI * 2);
        ctx.fill();
        // Refracted light pooling at the bottom of the lens.
        ctx.fillStyle = `rgba(${COLD}, ${0.25 + light * 0.3})`;
        ctx.beginPath();
        ctx.ellipse(x + d.r * 0.15, y + d.r * 0.6, d.r * 0.5, d.r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${WHITE}, ${0.45 + light * 0.5})`;
        ctx.beginPath();
        ctx.ellipse(x - d.r * 0.3, y - d.r * 0.3, d.r * 0.3, d.r * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Fine rain slanting past, in front of the plate.
      ctx.lineCap = 'round';
      ctx.lineWidth = 1;
      const slant = 0.16 + input.mx * 0.05;
      ctx.strokeStyle = `rgba(${COLD}, 1)`;
      for (let i = 0; i < streaks.length; i++) {
        const s = streaks[i];
        s.y += s.v * dt;
        s.x += s.v * slant * dt;
        if (s.y > h + 40) resetStreak(s, false);
        ctx.globalAlpha = Math.min(1, s.a * (1 + f * 3));
        ctx.beginPath();
        ctx.moveTo(s.x - s.len * slant, s.y - s.len);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }

      // Cold wash on the flash.
      if (f > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = f * 0.12;
        ctx.fillStyle = `rgb(${BOLT})`;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    },
  };
}

function SteelRainInner(props: WallpaperProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useCanvasScene(ref, props, createSteelRain, { maxDpr: 1.5, stillTime: 9 });
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

export const SteelRain = memo(SteelRainInner);
