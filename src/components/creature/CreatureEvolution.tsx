// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Creature Evolution (the 3 forms)
// Procedural canvas painters for the evolution forms:
//   Scholar Phoenix — blue fire bird, book wings, floating formulas
//   Code Serpent    — green circuit-pattern snake, binary rain
//   Warrior Dragon  — red + gold dragon, armor plating, flame breath
// plus the egg. Each stage adds detail (size is applied by the
// renderer). Form determination (dominant study vs coding activity)
// runs on every creature level-up inside useCreatureStore.feedXP.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import {
  CREATURE_FORMS,
  determineEvolutionForm,
  dominantFromPoints,
} from '@/stores/useCreatureStore';
import type { CreatureForm, CreatureMood, CreatureStage } from '@/types/creature';

export { determineEvolutionForm, dominantFromPoints };

/** Everything a painter needs for one frame (units: 1 = size/40 px). */
export interface CreaturePose {
  /** Seconds since the sprite started animating. */
  t: number;
  stage: CreatureStage;
  mood: CreatureMood;
  /** 0 (baby) … 1 (mythic): how much detail / how many effects. */
  detail: number;
  /** Eyes shut this frame (blink or sleep). */
  eyesClosed: boolean;
  /** 0..1 mouth opening (eating nom). */
  mouthOpen: number;
  /** Wing flap phase in radians. */
  wingPhase: number;
  /** 0..1 flame-breath strength (dragon). */
  breath: number;
  /** -1..1 horizontal gaze. */
  lookX: number;
  sad: boolean;
}

/** Stage → detail level. */
export const STAGE_DETAIL: Record<CreatureStage, number> = {
  egg: 0,
  baby: 0,
  teen: 0.35,
  adult: 0.65,
  legendary: 0.85,
  mythic: 1,
};

const TAU = Math.PI * 2;

// ─────────────────────────────────────────────────────────────
// Shared drawing helpers
// ─────────────────────────────────────────────────────────────

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, pose: CreaturePose, iris: string) {
  if (pose.eyesClosed) {
    ctx.strokeStyle = 'rgba(10,10,20,0.9)';
    ctx.lineWidth = r * 0.45;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y - r * 0.25, r * 0.85, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    return;
  }
  ellipse(ctx, x, y, r, r * 1.08);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  const px = x + pose.lookX * r * 0.28;
  const py = y + (pose.sad ? r * 0.22 : 0);
  ellipse(ctx, px, py, r * 0.6, r * 0.66);
  ctx.fillStyle = iris;
  ctx.fill();
  ellipse(ctx, px, py, r * 0.3, r * 0.34);
  ctx.fillStyle = '#05050a';
  ctx.fill();
  ellipse(ctx, px - r * 0.22, py - r * 0.28, r * 0.18, r * 0.18);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  if (pose.sad) {
    ctx.strokeStyle = 'rgba(10,10,20,0.85)';
    ctx.lineWidth = r * 0.3;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r * 1.25);
    ctx.lineTo(x + r * 0.8, y - r * 1.65);
    ctx.stroke();
  }
}

/** A flickering flame tongue from (x,y) pointing at `angle`. */
function flameTongue(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
  inner: string,
  outer: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const g = ctx.createLinearGradient(0, 0, length, 0);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -width);
  ctx.quadraticCurveTo(length * 0.55, -width * 1.1, length, 0);
  ctx.quadraticCurveTo(length * 0.55, width * 1.1, 0, width);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
// Scholar Phoenix
// ─────────────────────────────────────────────────────────────

const FORMULA_GLYPHS = ['∑', '∫', 'π', 'λ', '∂', '√', 'Δ', '∞'];

/** One open-book wing: two fanned pages hinged at the shoulder. */
function bookWing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  lift: number,
  mirror: 1 | -1,
  edge: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(mirror, 1);
  ctx.rotate(-0.55 - lift);
  for (let page = 0; page < 2; page++) {
    const spread = page === 0 ? -0.18 : 0.22;
    ctx.save();
    ctx.rotate(spread);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, -size * 0.28);
    ctx.lineTo(-size * 0.92, size * 0.42);
    ctx.lineTo(0, size * 0.5);
    ctx.closePath();
    ctx.fillStyle = page === 0 ? '#dff6ff' : '#c4ecff';
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 0.7;
    ctx.stroke();
    // text lines on the page
    ctx.strokeStyle = 'rgba(0,90,160,0.55)';
    ctx.lineWidth = 0.45;
    for (let l = 1; l <= 3; l++) {
      const f = l / 4;
      ctx.beginPath();
      ctx.moveTo(-size * 0.15, -size * 0.04 + f * size * 0.42);
      ctx.lineTo(-size * 0.8, -size * 0.2 + f * size * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

function paintPhoenix(ctx: CanvasRenderingContext2D, p: CreaturePose) {
  const d = p.detail;
  const accent = '#00d8ff';
  const deep = '#0050d0';
  const light = '#b8f6ff';

  // Floating formulas orbit behind the bird (adult+).
  if (d >= 0.6) {
    const n = 3 + Math.round((d - 0.6) * 10);
    ctx.font = `${4.2 + d * 1.4}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const a = p.t * 0.7 + (i / n) * TAU;
      const r = 17 + Math.sin(p.t * 1.3 + i) * 1.5;
      ctx.fillStyle = `rgba(184,246,255,${0.45 + 0.35 * Math.sin(p.t * 2 + i)})`;
      ctx.fillText(FORMULA_GLYPHS[i % FORMULA_GLYPHS.length], Math.cos(a) * r, Math.sin(a) * r * 0.75);
    }
  }

  // Tail of blue fire.
  const tongues = 3 + Math.round(d * 3);
  for (let i = 0; i < tongues; i++) {
    const spread = (i - (tongues - 1) / 2) * 0.3;
    const len = (8 + d * 8) * (0.82 + 0.18 * Math.sin(p.t * 9 + i * 1.7));
    flameTongue(ctx, -5, 4, Math.PI * 0.82 + spread, len, 2.4 + d * 1.2, 'rgba(0,216,255,0.95)', 'rgba(0,80,208,0)');
  }

  const flap = Math.sin(p.wingPhase) * (0.3 + 0.2 * d);
  const wingSize = 6 + d * 7;
  bookWing(ctx, -1, -1, wingSize, flap, 1, accent);

  // Body.
  const g = ctx.createRadialGradient(-1, -1, 1, 0, 2, 10 + d * 2);
  g.addColorStop(0, light);
  g.addColorStop(0.55, accent);
  g.addColorStop(1, deep);
  ellipse(ctx, 0, 2, 8 + d * 1.5, 7.5 + d * 1.3);
  ctx.fillStyle = g;
  ctx.fill();
  ellipse(ctx, 1.5, 4.5, 4.3, 3.6);
  ctx.fillStyle = 'rgba(223,246,255,0.55)';
  ctx.fill();

  bookWing(ctx, 1, 0, wingSize * 0.9, -flap * 0.8, -1, accent);

  // Head.
  const hx = 5 + d;
  const hy = -6.5 - d * 1.5;
  const hr = 5 + d * 0.7;
  if (d > 0.3) {
    for (let i = 0; i < 3; i++) {
      const len = (3 + d * 3) * (0.8 + 0.2 * Math.sin(p.t * 10 + i * 2));
      flameTongue(ctx, hx - 1 + i * 1.4, hy - hr + 1, -Math.PI / 2 - 0.4 + i * 0.35, len, 1.2, 'rgba(120,235,255,0.95)', 'rgba(0,120,255,0)');
    }
  }
  const hg = ctx.createRadialGradient(hx - 1.5, hy - 1.5, 0.5, hx, hy, hr);
  hg.addColorStop(0, light);
  hg.addColorStop(1, accent);
  ellipse(ctx, hx, hy, hr, hr);
  ctx.fillStyle = hg;
  ctx.fill();

  // Beak (opens while eating).
  const open = p.mouthOpen * 1.6;
  ctx.fillStyle = '#ffd740';
  ctx.beginPath();
  ctx.moveTo(hx + hr - 0.8, hy - 0.8 - open * 0.4);
  ctx.lineTo(hx + hr + 3.4, hy + 0.3);
  ctx.lineTo(hx + hr - 0.8, hy + 0.9);
  ctx.closePath();
  ctx.fill();
  if (open > 0.1) {
    ctx.beginPath();
    ctx.moveTo(hx + hr - 0.8, hy + 1.1);
    ctx.lineTo(hx + hr + 2.6, hy + 1.2 + open);
    ctx.lineTo(hx + hr - 0.6, hy + 1.8 + open * 0.6);
    ctx.closePath();
    ctx.fillStyle = '#ffb300';
    ctx.fill();
  }
  eye(ctx, hx + 1.2, hy - 0.8, 1.7, p, '#1565c0');
}

// ─────────────────────────────────────────────────────────────
// Code Serpent
// ─────────────────────────────────────────────────────────────

function paintSerpent(ctx: CanvasRenderingContext2D, p: CreaturePose) {
  const d = p.detail;
  const green = '#00e676';
  const dark = '#00843d';
  const trace = '#b9f6ca';

  // Binary rain behind the serpent (adult+).
  if (d >= 0.6) {
    ctx.font = '3.6px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cols = 5;
    for (let c = 0; c < cols; c++) {
      for (let k = 0; k < 3; k++) {
        const y = ((p.t * (10 + c * 1.5) + c * 7 + k * 12) % 40) - 20;
        const bit = (Math.floor(p.t * 3 + c * 3 + k) % 2 === 0) ? '1' : '0';
        ctx.fillStyle = `rgba(0,230,118,${0.18 + 0.3 * (1 - Math.abs(y) / 20)})`;
        ctx.fillText(bit, -16 + c * 8, y);
      }
    }
  }

  const segs = 7 + Math.round(d * 7);
  const len = 24 + d * 9;
  const amp = 3 + d * 1.2;
  const speed = p.mood === 'sleeping' ? 0.6 : p.mood === 'dance' || p.mood === 'excited' ? 6 : 3;
  const pts: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < segs; i++) {
    const f = i / (segs - 1);
    const x = -len / 2 + f * (len - 5);
    const y = 5 + Math.sin(x * 0.33 - p.t * speed) * amp * (0.4 + 0.6 * (1 - f));
    pts.push({ x, y, r: 1.4 + f * (3.6 + d * 0.9) });
  }

  // Body segments, tail → head.
  for (let i = 0; i < pts.length; i++) {
    const s = pts[i];
    const g = ctx.createRadialGradient(s.x - s.r * 0.3, s.y - s.r * 0.4, 0.2, s.x, s.y, s.r);
    g.addColorStop(0, '#7dffb3');
    g.addColorStop(0.6, green);
    g.addColorStop(1, dark);
    ellipse(ctx, s.x, s.y, s.r, s.r);
    ctx.fillStyle = g;
    ctx.fill();
    // Circuit traces on the scales.
    if (d > 0.2 && i % 2 === 0) {
      const pulse = d >= 0.85 ? 0.55 + 0.45 * Math.sin(p.t * 4 + i) : 0.8;
      ctx.strokeStyle = `rgba(185,246,202,${pulse})`;
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.moveTo(s.x - s.r * 0.5, s.y);
      ctx.lineTo(s.x, s.y);
      ctx.lineTo(s.x + s.r * 0.35, s.y - s.r * 0.45);
      ctx.stroke();
      ellipse(ctx, s.x + s.r * 0.35, s.y - s.r * 0.45, 0.35, 0.35);
      ctx.fillStyle = trace;
      ctx.fill();
    }
  }

  // Head.
  const head = pts[pts.length - 1];
  const hx = head.x + 3.5;
  const hy = head.y - 3 - d;
  if (d >= 0.6) {
    // Hood.
    ellipse(ctx, hx - 1.5, hy + 0.5, 5 + d * 1.5, 6 + d * 1.5);
    ctx.fillStyle = 'rgba(0,132,61,0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(185,246,202,0.7)';
    ctx.lineWidth = 0.4;
    ctx.stroke();
  }
  // Neck bridge.
  ctx.strokeStyle = green;
  ctx.lineWidth = head.r * 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(head.x, head.y);
  ctx.quadraticCurveTo(head.x + 2, head.y - 1, hx - 1, hy + 1);
  ctx.stroke();
  const hg = ctx.createRadialGradient(hx - 1, hy - 1.5, 0.5, hx, hy, 5.5);
  hg.addColorStop(0, '#9dffc6');
  hg.addColorStop(1, green);
  ellipse(ctx, hx, hy, 4.8 + d * 0.6, 3.8 + d * 0.4, -0.15);
  ctx.fillStyle = hg;
  ctx.fill();

  // Forked tongue flicks (or a wide nom while eating).
  if (!p.eyesClosed && (Math.sin(p.t * 2.7) > 0.55 || p.mouthOpen > 0.3)) {
    const tx = hx + 4.6;
    const ty = hy + 1;
    ctx.strokeStyle = '#ff1744';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + 3, ty);
    ctx.lineTo(tx + 4.2, ty - 1);
    ctx.moveTo(tx + 3, ty);
    ctx.lineTo(tx + 4.2, ty + 1);
    ctx.stroke();
  }
  eye(ctx, hx + 1.2, hy - 1, 1.5, p, '#00c853');
  if (d >= 0.85) {
    // Crown of circuitry.
    ctx.strokeStyle = `rgba(185,246,202,${0.6 + 0.4 * Math.sin(p.t * 3)})`;
    ctx.lineWidth = 0.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(hx + i * 1.6, hy - 3.6);
      ctx.lineTo(hx + i * 2, hy - 6);
      ctx.stroke();
      ellipse(ctx, hx + i * 2, hy - 6.3, 0.5, 0.5);
      ctx.fillStyle = trace;
      ctx.fill();
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Warrior Dragon
// ─────────────────────────────────────────────────────────────

function batWing(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, lift: number, front: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.4 - lift);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size * 0.35, -size);
  ctx.lineTo(-size * 0.55, -size * 0.55);
  ctx.lineTo(-size * 0.85, -size * 0.8);
  ctx.lineTo(-size * 0.95, -size * 0.3);
  ctx.lineTo(-size * 1.15, -size * 0.35);
  ctx.lineTo(-size * 0.7, size * 0.2);
  ctx.closePath();
  ctx.fillStyle = front ? 'rgba(200,30,60,0.95)' : 'rgba(140,16,40,0.95)';
  ctx.fill();
  ctx.strokeStyle = '#ffd740';
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size * 0.35, -size);
  ctx.moveTo(0, 0);
  ctx.lineTo(-size * 0.85, -size * 0.8);
  ctx.moveTo(0, 0);
  ctx.lineTo(-size * 1.15, -size * 0.35);
  ctx.stroke();
  ctx.restore();
}

function paintDragon(ctx: CanvasRenderingContext2D, p: CreaturePose) {
  const d = p.detail;
  const red = '#ff3d57';
  const deep = '#8e0f28';
  const gold = '#ffd740';

  // Tail with a golden spade.
  const sway = Math.sin(p.t * 2.2) * 1.5;
  ctx.strokeStyle = red;
  ctx.lineWidth = 3 + d;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, 6);
  ctx.quadraticCurveTo(-14, 10 + sway, -17, 3 + sway);
  ctx.stroke();
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.moveTo(-17, 3 + sway);
  ctx.lineTo(-19.5, 0 + sway);
  ctx.lineTo(-16.2, -0.5 + sway);
  ctx.lineTo(-15.2, 2.6 + sway);
  ctx.closePath();
  ctx.fill();

  const flap = Math.sin(p.wingPhase) * (0.3 + 0.25 * d);
  const wingSize = 7 + d * 7;
  batWing(ctx, -2, -2, wingSize, flap, false);

  // Body.
  const g = ctx.createRadialGradient(-1, 0, 1, 0, 3, 11 + d * 2);
  g.addColorStop(0, '#ff8a9a');
  g.addColorStop(0.5, red);
  g.addColorStop(1, deep);
  ellipse(ctx, 0, 3, 8.5 + d * 1.5, 7.5 + d * 1.2);
  ctx.fillStyle = g;
  ctx.fill();

  // Belly plates.
  ctx.strokeStyle = 'rgba(255,215,64,0.85)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(2.5, 5 + i * 2, 3.8 - i * 0.6, 1.3, 0, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  // Armor plating along the back (teen+).
  if (d > 0.3) {
    const plates = 3 + Math.round(d * 3);
    for (let i = 0; i < plates; i++) {
      const a = Math.PI * 1.15 + (i / Math.max(1, plates - 1)) * Math.PI * 0.6;
      const bx = Math.cos(a) * (8.5 + d);
      const by = 3 + Math.sin(a) * (7.5 + d);
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = gold;
      ctx.beginPath();
      ctx.moveTo(-1.4, 0);
      ctx.lineTo(1.4, 0);
      ctx.lineTo(0.7, -2.2 - d);
      ctx.lineTo(-0.7, -2.2 - d);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#b28704';
      ctx.lineWidth = 0.3;
      ctx.stroke();
      ctx.restore();
    }
  }

  batWing(ctx, 1, -1, wingSize * 0.85, -flap * 0.7, true);

  // Head.
  const hx = 6 + d;
  const hy = -5.5 - d;
  // Horns.
  ctx.fillStyle = gold;
  for (let i = 0; i < 2; i++) {
    const ox = hx - 2.5 + i * 2.2;
    ctx.beginPath();
    ctx.moveTo(ox, hy - 3);
    ctx.lineTo(ox - 1.2 - d * 1.5, hy - 7 - d * 2.5);
    ctx.lineTo(ox + 0.9, hy - 3.2);
    ctx.closePath();
    ctx.fill();
  }
  const hg = ctx.createRadialGradient(hx - 1, hy - 1.5, 0.5, hx, hy, 6);
  hg.addColorStop(0, '#ff8a9a');
  hg.addColorStop(1, red);
  ellipse(ctx, hx, hy, 4.8 + d * 0.5, 4.3 + d * 0.4);
  ctx.fillStyle = hg;
  ctx.fill();
  // Snout + jaw.
  const open = p.mouthOpen * 1.8 + p.breath * 1.4;
  ellipse(ctx, hx + 4.2, hy + 0.6 - open * 0.25, 3.2, 1.9);
  ctx.fillStyle = red;
  ctx.fill();
  ellipse(ctx, hx + 3.8, hy + 2.2 + open * 0.5, 2.8, 1.2);
  ctx.fillStyle = deep;
  ctx.fill();
  ellipse(ctx, hx + 6, hy - 0.2, 0.35, 0.35);
  ctx.fillStyle = '#3a0010';
  ctx.fill();
  eye(ctx, hx + 0.5, hy - 1.2, 1.6, p, '#ffab00');

  // Flame breath.
  if (p.breath > 0.02) {
    const mx = hx + 6.5;
    const my = hy + 1.4;
    const blobs = 9;
    for (let i = 0; i < blobs; i++) {
      const f = i / blobs;
      const dist = 2 + f * (12 + d * 6) * p.breath;
      const wob = Math.sin(p.t * 20 + i * 1.9) * (0.6 + f * 2);
      const r = 1 + f * 2.6;
      const fg = ctx.createRadialGradient(mx + dist, my + wob, 0, mx + dist, my + wob, r);
      fg.addColorStop(0, `rgba(255,245,200,${0.95 * p.breath})`);
      fg.addColorStop(0.45, `rgba(255,171,0,${0.8 * p.breath})`);
      fg.addColorStop(1, 'rgba(255,61,0,0)');
      ctx.fillStyle = fg;
      ellipse(ctx, mx + dist, my + wob, r, r);
      ctx.fill();
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Egg
// ─────────────────────────────────────────────────────────────

/**
 * The egg. `crack` 0..1 reveals zig-zag cracks; above 0.45 light rays
 * leak through them.
 */
export function paintEgg(ctx: CanvasRenderingContext2D, t: number, crack: number, glow: string) {
  ctx.save();
  // Egg shell.
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.bezierCurveTo(8.5, -15, 11.5, 1, 11, 6);
  ctx.bezierCurveTo(10.5, 13.5, 5.5, 16, 0, 16);
  ctx.bezierCurveTo(-5.5, 16, -10.5, 13.5, -11, 6);
  ctx.bezierCurveTo(-11.5, 1, -8.5, -15, 0, -15);
  ctx.closePath();
  const g = ctx.createRadialGradient(-3.5, -6, 1, 0, 2, 17);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.55, '#dfe9f3');
  g.addColorStop(1, '#8fa3b8');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = glow;
  ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 2.2);
  ctx.lineWidth = 0.9;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Spots.
  ctx.fillStyle = 'rgba(0,160,210,0.28)';
  const spots: [number, number, number][] = [
    [-4, -4, 2.2],
    [4.5, 2, 2.8],
    [-2.5, 9, 1.8],
    [5, -8, 1.4],
  ];
  for (const [x, y, r] of spots) {
    ellipse(ctx, x, y, r, r * 0.8);
    ctx.fill();
  }

  if (crack > 0) {
    const path: [number, number][] = [
      [-10, 1],
      [-6, -2],
      [-3, 2],
      [0, -2.5],
      [3, 1.5],
      [6.5, -2],
      [10.5, 1],
    ];
    const n = Math.max(2, Math.ceil(path.length * Math.min(1, crack * 1.4)));
    ctx.strokeStyle = 'rgba(40,40,60,0.9)';
    ctx.lineWidth = 0.7;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(path[0][0], path[0][1]);
    for (let i = 1; i < n && i < path.length; i++) ctx.lineTo(path[i][0], path[i][1]);
    ctx.stroke();
    if (crack > 0.45) {
      // Light bursting through the cracks.
      const strength = Math.min(1, (crack - 0.45) / 0.55);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 1; i < path.length - 1; i++) {
        const [x, y] = path[i];
        const len = 6 + strength * 14 + Math.sin(t * 12 + i) * 2;
        const rg = ctx.createLinearGradient(x, y, x, y - len);
        rg.addColorStop(0, `rgba(255,255,255,${0.9 * strength})`);
        rg.addColorStop(1, 'rgba(0,240,255,0)');
        ctx.strokeStyle = rg;
        ctx.lineWidth = 1 + strength;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (i % 2 === 0 ? 1 : -1) * len * 0.3, y - len);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.restore();
}

export type FormPainter = (ctx: CanvasRenderingContext2D, pose: CreaturePose) => void;

/** Form → painter. */
export const FORM_PAINTERS: Record<CreatureForm, FormPainter> = {
  phoenix: paintPhoenix,
  serpent: paintSerpent,
  dragon: paintDragon,
};

// ─────────────────────────────────────────────────────────────
// Small form chip (used by the stats popup)
// ─────────────────────────────────────────────────────────────

interface CreatureFormBadgeProps {
  form: CreatureForm;
  stage: CreatureStage;
}

function CreatureFormBadgeInner({ form, stage }: CreatureFormBadgeProps) {
  const info = CREATURE_FORMS[form];
  if (stage === 'egg') {
    return <span className="text-[11px] font-mono text-text-secondary">Unhatched egg</span>;
  }
  return (
    <span className="text-[11px] font-mono" style={{ color: info.accent }} title={info.blurb}>
      {info.name}
    </span>
  );
}

export const CreatureFormBadge = memo(CreatureFormBadgeInner);
