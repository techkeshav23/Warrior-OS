// ═══════════════════════════════════════════════════════════
// WARRIOR OS — "Ember Storm" wallpaper (id: embers)
// Canvas: forge sparks rise out of a buried glow through a dark steel
// haze. Sparks are short additive streaks that cool from white-hot to
// iron-red as they climb; slower embers drift and flicker; steel smoke
// rolls across. The pointer is a gentle updraft: nearby sparks swirl
// around it. Background + haze sprites are cached, so a frame is one
// drawImage plus a few hundred short strokes.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useRef } from 'react';
import type { WallpaperProps } from '@/types/wallpaper';
import { EMBER, INK, STEEL } from '@/styles/tokens';
import { glowSprite, makeLayer, rgb, useCanvasScene, type CanvasScene } from './canvas-scene';

const HOT = [EMBER[100], EMBER[200], EMBER[300], EMBER[400], EMBER[500], EMBER[600], EMBER[700]].map(rgb);
const STEEL_RGB = rgb(STEEL[500]);

interface Spark {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  w: number;
  seed: number;
  big: boolean;
}

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  seed: number;
  life: number;
  max: number;
}

interface Smoke {
  x: number;
  y: number;
  r: number;
  vx: number;
  a: number;
}

function createEmberStorm(): CanvasScene {
  let w = 1;
  let h = 1;
  let bg: HTMLCanvasElement | null = null;
  let smokeSprite: HTMLCanvasElement | null = null;
  let emberSprite: HTMLCanvasElement | null = null;
  let heatSprite: HTMLCanvasElement | null = null;
  let sparkSprite: HTMLCanvasElement | null = null;
  const sparks: Spark[] = [];
  const embers: Ember[] = [];
  const smoke: Smoke[] = [];
  let sparkCap = 200;
  let emberCap = 40;

  const spawnSpark = (s: Spark | null, anywhere: boolean): Spark => {
    // Most sparks rise from the forge bed (lower centre-left weighted).
    const bell = (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
    const x = w * (0.46 + bell * 1.5);
    const y = anywhere ? Math.random() * h : h + 10 + Math.random() * 40;
    const o = s ?? ({} as Spark);
    o.x = o.px = x;
    o.y = o.py = y;
    o.vx = (Math.random() - 0.5) * 30;
    o.vy = -(70 + Math.random() * 150);
    o.max = 2.4 + Math.random() * 3.6;
    o.life = anywhere ? Math.random() * o.max : 0;
    o.big = Math.random() < 0.14;
    o.w = o.big ? 1.4 + Math.random() * 1.1 : 0.6 + Math.random() * 1.0;
    o.seed = Math.random() * 1000;
    return o;
  };

  const spawnEmber = (e: Ember | null, anywhere: boolean): Ember => {
    const o = e ?? ({} as Ember);
    o.x = Math.random() * w;
    o.y = anywhere ? Math.random() * h : h + 20;
    o.vx = (Math.random() - 0.3) * 14;
    o.vy = -(14 + Math.random() * 30);
    o.r = 1.2 + Math.random() * 2.4;
    o.seed = Math.random() * 1000;
    o.max = 8 + Math.random() * 10;
    o.life = anywhere ? Math.random() * o.max : 0;
    return o;
  };

  return {
    resize(nw, nh, dpr) {
      w = nw;
      h = nh;
      const area = (w * h) / (1600 * 1000);
      sparkCap = Math.round(Math.max(110, Math.min(260, 190 * area)));
      emberCap = Math.round(Math.max(24, Math.min(60, 42 * area)));

      // ── Cached backdrop: steel night, buried forge glow, grain ──
      const { canvas, ctx } = makeLayer(w, h, Math.min(dpr, 1));
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, INK[950]);
      sky.addColorStop(0.45, STEEL[900]);
      sky.addColorStop(0.8, STEEL[850]);
      sky.addColorStop(1, '#1a0f0a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(w * 0.46, h * 1.1, 0, w * 0.46, h * 1.1, Math.max(w, h) * 0.75);
      glow.addColorStop(0, `rgba(${rgb(EMBER[400])}, 0.7)`);
      glow.addColorStop(0.2, `rgba(${rgb(EMBER[600])}, 0.42)`);
      glow.addColorStop(0.5, `rgba(${rgb(EMBER[700])}, 0.2)`);
      glow.addColorStop(0.8, `rgba(${rgb(EMBER[800])}, 0.08)`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      // Cold rim of light up top-left, like steel catching moonlight.
      const cold = ctx.createRadialGradient(w * 0.12, -h * 0.1, 0, w * 0.12, -h * 0.1, w * 0.6);
      cold.addColorStop(0, `rgba(${rgb(STEEL[400])}, 0.16)`);
      cold.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cold;
      ctx.fillRect(0, 0, w, h);
      // Vignette.
      const vig = ctx.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.3, w / 2, h * 0.55, Math.max(w, h) * 0.8);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, `rgba(${rgb(INK[950])}, 0.75)`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
      bg = canvas;

      smokeSprite = glowSprite(256, STEEL_RGB, 0.55);
      sparkSprite = glowSprite(48, HOT[2], 1);
      emberSprite = glowSprite(64, HOT[3], 1);
      heatSprite = glowSprite(256, HOT[5], 0.6);

      sparks.length = 0;
      embers.length = 0;
      smoke.length = 0;
      for (let i = 0; i < sparkCap; i++) sparks.push(spawnSpark(null, true));
      for (let i = 0; i < emberCap; i++) embers.push(spawnEmber(null, true));
      for (let i = 0; i < 9; i++) {
        smoke.push({
          x: Math.random() * w,
          y: h * (0.35 + Math.random() * 0.6),
          r: Math.max(w, h) * (0.22 + Math.random() * 0.25),
          vx: 6 + Math.random() * 10,
          a: 0.16 + Math.random() * 0.16,
        });
      }
    },

    frame(ctx, t, dt, input) {
      if (!bg) return;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.drawImage(bg, 0, 0, w, h);

      const px = (input.mx + 1) * 0.5 * w;
      const py = (input.my + 1) * 0.5 * h;
      const pulse = 0.85 + Math.sin(t * 0.9) * 0.08 + Math.sin(t * 2.3) * 0.05 + input.bass * 0.3;

      // ── Forge bed heat, breathing ──
      ctx.globalCompositeOperation = 'lighter';
      if (heatSprite) {
        ctx.globalAlpha = 0.35 * pulse;
        ctx.drawImage(heatSprite, w * 0.46 - w * 0.55, h * 0.78, w * 1.1, h * 0.5);
        ctx.globalAlpha = 0.18 * pulse;
        ctx.drawImage(heatSprite, w * 0.12 - w * 0.2, h * 0.86, w * 0.4, h * 0.3);
        ctx.drawImage(heatSprite, w * 0.82 - w * 0.2, h * 0.84, w * 0.4, h * 0.3);
      }

      // ── Steel haze rolling across (lit from below by the forge) ──
      ctx.globalCompositeOperation = 'lighter';
      if (smokeSprite) {
        for (const s of smoke) {
          s.x += s.vx * dt;
          if (s.x - s.r > w) s.x = -s.r;
          ctx.globalAlpha = s.a * 0.32 * (0.8 + Math.sin(t * 0.2 + s.r) * 0.2);
          ctx.drawImage(smokeSprite, s.x - s.r, s.y - s.r * 0.55, s.r * 2, s.r * 1.1);
        }
      }

      ctx.globalCompositeOperation = 'lighter';

      // ── Embers: slow, flickering motes ──
      if (emberSprite) {
        for (let i = 0; i < embers.length; i++) {
          const e = embers[i];
          e.life += dt;
          const sway = Math.sin(t * 0.6 + e.seed) * 10;
          e.x += (e.vx + sway) * dt;
          e.y += e.vy * dt * (1 + input.bass * 0.8);
          if (e.life > e.max || e.y < -30) spawnEmber(e, false);
          const k = e.life / e.max;
          const fade = Math.min(1, k * 6) * (1 - k);
          const flick = 0.6 + 0.4 * Math.sin(t * 7 + e.seed * 3) * Math.sin(t * 3.1 + e.seed);
          const size = e.r * 7;
          ctx.globalAlpha = Math.max(0, fade * flick * 0.55);
          ctx.drawImage(emberSprite, e.x - size / 2, e.y - size / 2, size, size);
          ctx.globalAlpha = Math.max(0, fade * flick);
          ctx.fillStyle = `rgb(${HOT[k < 0.4 ? 2 : 3]})`;
          ctx.fillRect(e.x - e.r * 0.35, e.y - e.r * 0.35, e.r * 0.7, e.r * 0.7);
        }
      }

      // ── Sparks: streaks that cool as they climb ──
      ctx.lineCap = 'round';
      const R = 190;
      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        s.life += dt;
        if (s.life > s.max || s.y < -20) {
          spawnSpark(s, false);
          continue;
        }
        // Turbulent updraft.
        const n = Math.sin(s.y * 0.012 + t * 1.3 + s.seed) + Math.sin(s.x * 0.009 - t * 0.7 + s.seed * 0.5);
        s.vx += n * 42 * dt;
        s.vx *= 1 - 0.9 * dt;
        s.vy -= 8 * dt;
        // Pointer: a soft swirl — push outward and around.
        const dx = s.x - px;
        const dy = s.y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < R * R && d2 > 1) {
          const d = Math.sqrt(d2);
          const f = (1 - d / R) * 260 * dt;
          s.vx += (dx / d) * f * 0.6 - (dy / d) * f;
          s.vy += (dy / d) * f * 0.6 + (dx / d) * f;
        }
        s.px = s.x;
        s.py = s.y;
        s.x += s.vx * dt;
        s.y += s.vy * dt * (1 + input.bass * 0.5);

        const k = s.life / s.max;
        const idx = Math.min(HOT.length - 1, Math.floor(k * HOT.length * 1.05));
        const alpha = Math.min(1, s.life * 4) * (1 - k * k);
        // Streak length follows speed (a motion-blurred spark).
        const tail = s.big ? 0.06 : 0.03 + (s.seed % 1) * 0.03;
        const tx = s.x - s.vx * tail;
        const ty = s.y - s.vy * tail;
        ctx.globalAlpha = alpha * 0.22;
        ctx.strokeStyle = `rgb(${HOT[Math.min(HOT.length - 1, idx + 1)]})`;
        ctx.lineWidth = s.w * 3.2;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = `rgb(${HOT[idx]})`;
        ctx.lineWidth = s.w;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        if (s.big && sparkSprite) {
          const g = 10 + s.w * 6;
          ctx.globalAlpha = alpha * 0.5;
          ctx.drawImage(sparkSprite, s.x - g / 2, s.y - g / 2, g, g);
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    },
  };
}

function EmberStormInner(props: WallpaperProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useCanvasScene(ref, props, createEmberStorm, { stillTime: 30 });
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

export const EmberStorm = memo(EmberStormInner);
