// ═══════════════════════════════════════════════════════════
// WARRIOR OS — "Battlefield Dusk" wallpaper (id: dusk)
// Canvas: a smoky ember sunset over layered silhouettes — far peaks in
// ember haze, a fortress ridge with smoke rising from the fires below
// it, and a near ridge of war banners that ripple in the wind. Layers
// are baked once (offscreen canvases) and slide with the pointer for
// depth; the live work per frame is a few drawImages, three banners,
// smoke puffs and drifting ash.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useRef } from 'react';
import type { WallpaperProps } from '@/types/wallpaper';
import { EMBER, INK, STEEL } from '@/styles/tokens';
import { glowSprite, makeLayer, rgb, seeded, useCanvasScene, type CanvasScene } from './canvas-scene';

const E = {
  100: rgb(EMBER[100]),
  200: rgb(EMBER[200]),
  300: rgb(EMBER[300]),
  400: rgb(EMBER[400]),
  500: rgb(EMBER[500]),
  600: rgb(EMBER[600]),
  700: rgb(EMBER[700]),
  800: rgb(EMBER[800]),
};
const INK_RGB = rgb(INK[950]);

/** Midpoint-displacement ridge: y values for n+1 evenly spaced x. */
function ridge(rand: () => number, n: number, rough: number, amp: number): number[] {
  const pts = new Array(n + 1).fill(0);
  pts[0] = (rand() - 0.5) * amp;
  pts[n] = (rand() - 0.5) * amp;
  let step = n;
  let a = amp;
  while (step > 1) {
    const half = step / 2;
    for (let i = half; i < n; i += step) {
      pts[i] = (pts[i - half] + pts[i + half]) / 2 + (rand() - 0.5) * a;
    }
    step = half;
    a *= rough;
  }
  return pts;
}

interface LayerSpec {
  canvas: HTMLCanvasElement;
  depth: number; // px of parallax at full pointer
  pad: number;
}

interface Banner {
  /** Position within the near layer, CSS px (before parallax). */
  x: number;
  top: number;
  pole: number;
  len: number;
  tall: number;
  phase: number;
  depth: number;
  color: string;
}

interface Puff {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  src: number;
}

interface Ash {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  seed: number;
}

function createBattlefieldDusk(): CanvasScene {
  let w = 1;
  let h = 1;
  let sky: HTMLCanvasElement | null = null;
  let layers: LayerSpec[] = [];
  let smokeSprite: HTMLCanvasElement | null = null;
  let emberSprite: HTMLCanvasElement | null = null;
  let banners: Banner[] = [];
  let sources: { x: number; y: number; depth: number }[] = [];
  const puffs: Puff[] = [];
  const ash: Ash[] = [];

  const paintRidge = (
    ctx: CanvasRenderingContext2D,
    lw: number,
    base: number,
    amp: number,
    rough: number,
    seed: number,
    fill: string | CanvasGradient,
  ) => {
    const rand = seeded(seed);
    const n = 256;
    const pts = ridge(rand, n, rough, amp);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i <= n; i++) ctx.lineTo((i / n) * lw, base + pts[i]);
    ctx.lineTo(lw, h);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    return pts;
  };

  return {
    resize(nw, nh, dpr) {
      w = nw;
      h = nh;
      const d = Math.min(dpr, 1.25);

      // ── Sky: ink zenith → smoke steel → ember horizon, low sun ──
      const s = makeLayer(w, h, Math.min(dpr, 1));
      const g = s.ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, INK[950]);
      g.addColorStop(0.22, STEEL[900]);
      g.addColorStop(0.42, '#1d1614');
      g.addColorStop(0.56, `rgb(${E[800]})`);
      g.addColorStop(0.66, `rgb(${E[700]})`);
      g.addColorStop(0.72, `rgb(${E[600]})`);
      g.addColorStop(1, `rgb(${E[800]})`);
      s.ctx.fillStyle = g;
      s.ctx.fillRect(0, 0, w, h);
      const sunX = w * 0.64;
      const sunY = h * 0.6;
      const halo = s.ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.max(w, h) * 0.55);
      halo.addColorStop(0, `rgba(${E[400]}, 0.6)`);
      halo.addColorStop(0.08, `rgba(${E[500]}, 0.4)`);
      halo.addColorStop(0.3, `rgba(${E[600]}, 0.2)`);
      halo.addColorStop(1, `rgba(${E[800]}, 0)`);
      s.ctx.fillStyle = halo;
      s.ctx.fillRect(0, 0, w, h);
      const sr = Math.min(w, h) * 0.042;
      const disc = s.ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sr);
      disc.addColorStop(0, `rgb(${E[100]})`);
      disc.addColorStop(0.45, `rgb(${E[200]})`);
      disc.addColorStop(0.85, `rgb(${E[300]})`);
      disc.addColorStop(0.96, `rgb(${E[400]})`);
      disc.addColorStop(1, `rgba(${E[400]}, 0)`);
      s.ctx.fillStyle = disc;
      s.ctx.beginPath();
      s.ctx.arc(sunX, sunY, sr, 0, Math.PI * 2);
      s.ctx.fill();
      // Long smoke bands across the sun.
      const rand = seeded(90);
      for (let i = 0; i < 14; i++) {
        const y = h * (0.28 + rand() * 0.34);
        const bw = w * (0.3 + rand() * 0.6);
        const bx = rand() * w - bw * 0.3;
        const bh = h * (0.008 + rand() * 0.02);
        const band = s.ctx.createLinearGradient(bx, 0, bx + bw, 0);
        const a = 0.25 + rand() * 0.35;
        band.addColorStop(0, `rgba(${INK_RGB}, 0)`);
        band.addColorStop(0.5, `rgba(${rgb(STEEL[900])}, ${a})`);
        band.addColorStop(1, `rgba(${INK_RGB}, 0)`);
        s.ctx.fillStyle = band;
        s.ctx.beginPath();
        s.ctx.ellipse(bx + bw / 2, y, bw / 2, bh, 0, 0, Math.PI * 2);
        s.ctx.fill();
      }
      sky = s.canvas;

      // ── Far peaks (ember haze) ──
      const mk = (depth: number) => {
        const pad = depth + 4;
        const l = makeLayer(w + pad * 2, h, d);
        return { l, pad, lw: w + pad * 2 };
      };
      const far = mk(8);
      const farFill = far.l.ctx.createLinearGradient(0, h * 0.45, 0, h);
      farFill.addColorStop(0, '#3a1c12');
      farFill.addColorStop(0.35, `rgb(${E[800]})`);
      farFill.addColorStop(1, STEEL[850]);
      paintRidge(far.l.ctx, far.lw, h * 0.6, h * 0.32, 0.58, 11, farFill);
      // Atmospheric mist at its feet.
      const mist = far.l.ctx.createLinearGradient(0, h * 0.62, 0, h * 0.8);
      mist.addColorStop(0, `rgba(${E[600]}, 0)`);
      mist.addColorStop(1, `rgba(${E[700]}, 0.35)`);
      far.l.ctx.fillStyle = mist;
      far.l.ctx.fillRect(0, h * 0.62, far.lw, h * 0.38);

      // ── Fortress ridge ──
      const mid = mk(20);
      const mctx = mid.l.ctx;
      const midFill = mctx.createLinearGradient(0, h * 0.6, 0, h);
      midFill.addColorStop(0, '#120c0b');
      midFill.addColorStop(1, INK[950]);
      const midPts = paintRidge(mctx, mid.lw, h * 0.75, h * 0.1, 0.5, 29, midFill);
      const yAt = (pts: number[], lw: number, base: number, x: number) =>
        base + pts[Math.max(0, Math.min(256, Math.round((x / lw) * 256)))];
      // Fortress on the ridge, left of the sun.
      const fx = mid.pad + w * 0.3;
      const fy = Math.min(yAt(midPts, mid.lw, h * 0.75, fx - 80), yAt(midPts, mid.lw, h * 0.75, fx + 80)) + 6;
      const u = Math.max(0.7, Math.min(1.4, h / 1000));
      mctx.fillStyle = '#140e0d';
      const tower = (x: number, tw: number, th: number) => {
        mctx.fillRect(x - tw / 2, fy - th, tw, th + 40 * u);
        // Crenellations.
        const m = Math.max(3, Math.round(tw / (7 * u)));
        const cw = tw / (m * 2 - 1);
        for (let i = 0; i < m; i++) mctx.fillRect(x - tw / 2 + i * cw * 2, fy - th - 6 * u, cw, 6 * u);
      };
      mctx.fillRect(fx - 120 * u, fy - 38 * u, 240 * u, 60 * u); // curtain wall
      {
        const m = 17;
        const cw = (240 * u) / (m * 2 - 1);
        for (let i = 0; i < m; i++) mctx.fillRect(fx - 120 * u + i * cw * 2, fy - 44 * u, cw, 6 * u);
      }
      tower(fx - 120 * u, 30 * u, 70 * u);
      tower(fx + 120 * u, 30 * u, 64 * u);
      tower(fx - 30 * u, 44 * u, 108 * u); // keep
      tower(fx + 34 * u, 26 * u, 86 * u);
      // Spire on the keep.
      mctx.beginPath();
      mctx.moveTo(fx - 12 * u, fy - 114 * u);
      mctx.lineTo(fx - 30 * u + 0, fy - 150 * u);
      mctx.lineTo(fx - 48 * u + 36 * u, fy - 114 * u);
      mctx.fill();
      // Lit windows: tiny ember slits.
      mctx.fillStyle = `rgba(${E[400]}, 0.85)`;
      for (const [wx, wy] of [
        [-36, -80],
        [-24, -80],
        [-30, -58],
        [34, -60],
        [-120, -48],
        [120, -44],
      ])
        mctx.fillRect(fx + wx * u - 1.2 * u, fy + wy * u, 2.4 * u, 6 * u);
      // Fire glow at the fortress base.
      const fire = mctx.createRadialGradient(fx, fy + 10 * u, 0, fx, fy + 10 * u, 260 * u);
      fire.addColorStop(0, `rgba(${E[500]}, 0.35)`);
      fire.addColorStop(1, `rgba(${E[700]}, 0)`);
      mctx.globalCompositeOperation = 'lighter';
      mctx.fillStyle = fire;
      mctx.fillRect(fx - 300 * u, fy - 200 * u, 600 * u, 400 * u);
      mctx.globalCompositeOperation = 'source-over';
      const midMist = mctx.createLinearGradient(0, h * 0.78, 0, h);
      midMist.addColorStop(0, `rgba(${E[800]}, 0)`);
      midMist.addColorStop(1, `rgba(${E[800]}, 0.4)`);
      mctx.fillStyle = midMist;
      mctx.fillRect(0, h * 0.78, mid.lw, h * 0.22);

      // ── Near ridge (black) with banner poles and planted spears ──
      const near = mk(40);
      const nctx = near.l.ctx;
      const nearBase = h * 0.88;
      const nearPts = paintRidge(nctx, near.lw, nearBase, h * 0.1, 0.52, 53, INK[950]);
      // Rim light from the sun on the crest.
      nctx.save();
      nctx.beginPath();
      for (let i = 0; i <= 256; i++) nctx.lineTo((i / 256) * near.lw, nearBase + nearPts[i]);
      nctx.strokeStyle = `rgba(${E[400]}, 0.35)`;
      nctx.lineWidth = 1.2;
      nctx.stroke();
      nctx.restore();
      const spearRand = seeded(71);
      nctx.strokeStyle = INK[950];
      nctx.lineCap = 'butt';
      for (let i = 0; i < 26; i++) {
        const x = spearRand() * near.lw;
        const y = yAt(nearPts, near.lw, nearBase, x) + 4;
        const len = (18 + spearRand() * 46) * u;
        const lean = (spearRand() - 0.5) * 0.5;
        nctx.lineWidth = 1.6 * u;
        nctx.beginPath();
        nctx.moveTo(x, y);
        nctx.lineTo(x + lean * len, y - len);
        nctx.stroke();
        nctx.fillStyle = INK[950];
        nctx.beginPath();
        nctx.moveTo(x + lean * len - 2.5 * u, y - len);
        nctx.lineTo(x + lean * (len + 10 * u), y - len - 10 * u);
        nctx.lineTo(x + lean * len + 2.5 * u, y - len);
        nctx.fill();
      }
      banners = [];
      const bSpots = [0.12, 0.2, 0.83];
      bSpots.forEach((bx, i) => {
        const x = near.pad + w * bx;
        const ground = yAt(nearPts, near.lw, nearBase, x) + 4;
        const pole = (i === 1 ? 190 : 250 - i * 20) * u;
        nctx.lineWidth = 3 * u;
        nctx.beginPath();
        nctx.moveTo(x, ground);
        nctx.lineTo(x, ground - pole);
        nctx.stroke();
        nctx.fillStyle = INK[950];
        nctx.beginPath();
        nctx.moveTo(x - 4 * u, ground - pole);
        nctx.lineTo(x, ground - pole - 14 * u);
        nctx.lineTo(x + 4 * u, ground - pole);
        nctx.fill();
        // Cross-bar.
        nctx.fillRect(x - 2 * u, ground - pole + 4 * u, (i === 1 ? 50 : 70) * u, 3 * u);
        banners.push({
          x,
          top: ground - pole + 5.5 * u,
          pole: x,
          len: (i === 1 ? 50 : 70) * u,
          tall: (i === 1 ? 92 : 128) * u,
          phase: i * 1.7,
          depth: 40,
          color: i === 1 ? '#3a0f06' : `rgb(${E[800]})`,
        });
      });

      layers = [
        { canvas: far.l.canvas, depth: 8, pad: far.pad },
        { canvas: mid.l.canvas, depth: 20, pad: mid.pad },
        { canvas: near.l.canvas, depth: 40, pad: near.pad },
      ];
      sources = [
        { x: mid.pad + w * 0.3 - 150 * u, y: fy + 6, depth: 20 },
        { x: mid.pad + w * 0.3 + 170 * u, y: fy + 12, depth: 20 },
        { x: mid.pad + w * 0.9, y: h * 0.78, depth: 20 },
      ];

      smokeSprite = glowSprite(128, rgb(STEEL[850]), 0.7);
      emberSprite = glowSprite(32, E[300], 1);
      puffs.length = 0;
      // Pre-warm the smoke columns so the first frame already has them.
      for (let i = 0; i < 60; i++) {
        const src = i % sources.length;
        const k = Math.random();
        puffs.push(makePuff(src, k));
      }
      ash.length = 0;
      const ashN = Math.round(Math.min(90, Math.max(40, (w * h) / 22000)));
      for (let i = 0; i < ashN; i++)
        ash.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: 8 + Math.random() * 18,
          vy: -(4 + Math.random() * 12),
          r: 0.6 + Math.random() * 1.4,
          seed: Math.random() * 100,
        });
    },

    frame(ctx, t, dt, input) {
      if (!sky) return;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.drawImage(sky, input.mx * -3, input.my * -2, w + 6, h + 4);

      const wind = 1 + Math.sin(t * 0.35) * 0.35 + input.bass * 0.6;

      for (let li = 0; li < layers.length; li++) {
        const L = layers[li];
        const ox = -L.pad - input.mx * L.depth;
        const oy = -input.my * L.depth * 0.25;
        ctx.globalAlpha = 1;
        ctx.drawImage(L.canvas, ox, oy, L.canvas.width / (L.canvas.width / (w + L.pad * 2)), h);

        // Smoke rises between the fortress ridge and the near ridge.
        if (li === 1 && smokeSprite) {
          for (let i = 0; i < puffs.length; i++) {
            const p = puffs[i];
            p.life += dt;
            if (p.life > p.max) {
              puffs[i] = makePuff(p.src, 0);
              continue;
            }
            const k = p.life / p.max;
            p.x += (p.vx + wind * 14 * k) * dt;
            p.y += p.vy * dt;
            p.r += dt * 14;
            const a = Math.sin(Math.min(1, k * 1.4) * Math.PI) * 0.16 * (1 - k * 0.5);
            ctx.globalAlpha = a;
            const r = p.r;
            ctx.drawImage(smokeSprite, p.x + ox - r, p.y + oy - r, r * 2, r * 2);
          }
          // Embers lifted by the fires.
          if (emberSprite) {
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < sources.length; i++) {
              const sx = sources[i].x + ox;
              for (let j = 0; j < 6; j++) {
                const ph = (t * 0.18 + j / 6 + i * 0.37) % 1;
                const x = sx + Math.sin(ph * 9 + j) * 18 + ph * 60 * wind;
                const y = sources[i].y + oy - ph * h * 0.28;
                ctx.globalAlpha = (1 - ph) * 0.8;
                ctx.drawImage(emberSprite, x - 4, y - 4, 8, 8);
              }
            }
            ctx.globalCompositeOperation = 'source-over';
          }
        }
        // Banners ripple on the near ridge.
        if (li === 2) {
          for (const b of banners) drawBanner(ctx, b, t, wind, ox, oy);
        }
      }

      // Drifting ash in front of everything.
      ctx.globalCompositeOperation = 'lighter';
      for (const a of ash) {
        a.x += (a.vx * wind + Math.sin(t + a.seed) * 6) * dt;
        a.y += a.vy * dt;
        if (a.x > w + 10) a.x = -10;
        if (a.y < -10) a.y = h + 10;
        const tw = 0.35 + 0.35 * Math.sin(t * 2.4 + a.seed * 7);
        ctx.globalAlpha = tw;
        ctx.fillStyle = a.seed > 70 ? `rgb(${E[300]})` : `rgb(${E[500]})`;
        ctx.fillRect(a.x + input.mx * -30, a.y, a.r, a.r);
      }
      ctx.globalCompositeOperation = 'source-over';

      // Vignette.
      ctx.globalAlpha = 1;
      const vig = ctx.createRadialGradient(w * 0.55, h * 0.55, Math.min(w, h) * 0.35, w * 0.55, h * 0.55, Math.max(w, h) * 0.8);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, `rgba(${INK_RGB}, 0.6)`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    },
  };

  function makePuff(src: number, k: number): Puff {
    const s = sources[src];
    const max = 9 + Math.random() * 6;
    const life = k * max;
    return {
      src,
      x: s.x + (Math.random() - 0.5) * 30 + life * 10,
      y: s.y - life * 20,
      r: 40 + Math.random() * 30 + life * 14,
      vx: 4 + Math.random() * 6,
      vy: -(16 + Math.random() * 10),
      life,
      max,
    };
  }

  function drawBanner(ctx: CanvasRenderingContext2D, b: Banner, t: number, wind: number, ox: number, oy: number) {
    const x0 = b.pole + ox;
    const y0 = b.top + oy;
    const seg = 10;
    const amp = 9 * wind;
    const top: [number, number][] = [];
    const bot: [number, number][] = [];
    for (let i = 0; i <= seg; i++) {
      const u = i / seg;
      const wave = Math.sin(u * 5 - t * 3.2 * wind + b.phase) * amp * u;
      top.push([x0 + u * b.len, y0 + wave * 0.4]);
      // Swallow-tail: the free edge is notched.
      const tail = b.tall - (i === seg ? b.tall * 0.25 : 0);
      bot.push([x0 + u * b.len + wave * 0.5, y0 + tail + wave]);
    }
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(top[0][0], top[0][1]);
    for (const p of top) ctx.lineTo(p[0], p[1]);
    // Notch between the two tails.
    const last = bot[seg];
    ctx.lineTo(last[0], last[1] + b.tall * 0.25);
    ctx.lineTo(last[0] - b.len * 0.22, last[1] - b.tall * 0.05);
    for (let i = seg - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1] + (i > seg * 0.7 ? b.tall * 0.25 * ((i - seg * 0.7) / (seg * 0.3)) : 0));
    ctx.closePath();
    ctx.fillStyle = b.color;
    ctx.fill();
    // Sun-lit folds.
    const g = ctx.createLinearGradient(x0, 0, x0 + b.len, 0);
    for (let i = 0; i <= 4; i++) {
      const s = Math.sin(i * 1.3 - t * 3.2 * wind + b.phase);
      g.addColorStop(i / 4, `rgba(${E[500]}, ${Math.max(0, s) * 0.35})`);
    }
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = `rgba(${E[400]}, 0.45)`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Sigil: a forged chevron riding the cloth.
    const mid = Math.round(seg * 0.5);
    const cx = (top[mid][0] + bot[mid][0]) / 2;
    const cy = top[mid][1] + b.tall * 0.42;
    const sz = b.len * 0.22;
    ctx.beginPath();
    ctx.moveTo(cx - sz, cy - sz * 0.6);
    ctx.lineTo(cx, cy + sz * 0.3);
    ctx.lineTo(cx + sz, cy - sz * 0.6);
    ctx.moveTo(cx - sz, cy + sz * 0.1);
    ctx.lineTo(cx, cy + sz);
    ctx.lineTo(cx + sz, cy + sz * 0.1);
    ctx.strokeStyle = `rgba(${E[300]}, 0.55)`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function BattlefieldDuskInner(props: WallpaperProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useCanvasScene(ref, props, createBattlefieldDusk, { maxDpr: 1.25, stillTime: 20 });
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

export const BattlefieldDusk = memo(BattlefieldDuskInner);
