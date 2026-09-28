// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Creature Renderer
// Canvas sprite animation system. One requestAnimationFrame loop per
// sprite (throttled to ~30 fps) reads the latest props from a ref — no
// React state changes per frame. Moods:
//   idle → breathing   happy → bounce + sparkles   sad → dim + shiver
//   sleeping → ZzZ     dance → spin + flames        excited → spin + sparkles
//   eating → nom       curious → head tilt + "?"
// Stages grow the sprite, add detail (painters) and intensify effects.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { CREATURE_FORMS, useCreatureStore } from '@/stores/useCreatureStore';
import type { CreatureForm, CreatureMood, CreatureStage } from '@/types/creature';
import { FORM_PAINTERS, STAGE_DETAIL, paintEgg, type CreaturePose } from './CreatureEvolution';
import type { CreatureVitals } from './CreatureEngine';

const FRAME_MS = 1000 / 30;
const GOLD = '#ffc53d';
const MAX_PARTICLES = 90;

type FxKind = 'spark' | 'flame' | 'crumb' | 'z' | 'mote';

interface FxParticle {
  kind: FxKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
}

interface FxState {
  particles: FxParticle[];
  emitAcc: number;
  nextBlink: number;
  blinkUntil: number;
  lastT: number;
}

interface SpriteProps {
  form: CreatureForm;
  stage: CreatureStage;
  mood: CreatureMood;
  size: number;
  goldenAura: boolean;
  /** Egg crack progress 0..1 (egg stage only). */
  crack: number;
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  if (Number.isNaN(n)) return '0,240,255';
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function spawn(fx: FxState, p: FxParticle) {
  if (fx.particles.length < MAX_PARTICLES) fx.particles.push(p);
}

/** Draws one full frame of a creature sprite. */
function drawFrame(ctx: CanvasRenderingContext2D, P: SpriteProps, t: number, css: number, dpr: number, fx: FxState) {
  const dt = Math.min(0.1, Math.max(0, t - fx.lastT));
  fx.lastT = t;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, css, css);

  const unit = P.size / 40;
  const cx = css / 2;
  const cy = css / 2 + P.size * 0.06;
  const detail = STAGE_DETAIL[P.stage];
  const accent = P.goldenAura ? GOLD : CREATURE_FORMS[P.form].accent;
  const rgb = hexToRgb(accent);
  const isEgg = P.stage === 'egg';

  // ── Mood transform ──
  let dx = 0;
  let dy = 0;
  let rot = 0;
  let scale = 1;
  let alpha = 1;
  switch (P.mood) {
    case 'idle':
      scale = 1 + 0.03 * Math.sin(t * 2.4);
      break;
    case 'happy':
      dy = -Math.abs(Math.sin(t * 6)) * 6 * unit;
      scale = 1 + 0.04 * Math.abs(Math.cos(t * 6));
      break;
    case 'excited':
      rot = (t * Math.PI * 2 * 1.1) % (Math.PI * 2);
      dy = -Math.abs(Math.sin(t * 5)) * 2.5 * unit;
      scale = 1.08;
      break;
    case 'dance':
      rot = Math.sin(t * 7) * 0.4;
      dy = -Math.abs(Math.sin(t * 7)) * 4.5 * unit;
      scale = 1.06;
      break;
    case 'sad':
      dx = Math.sin(t * 57) * 0.8;
      dy = 1.2 * unit;
      scale = 0.95;
      alpha = 0.62;
      break;
    case 'sleeping':
      scale = 1 + 0.022 * Math.sin(t * 1.3);
      dy = 1.8 * unit;
      break;
    case 'eating':
      scale = 1 + 0.06 * Math.max(0, Math.sin(t * 14));
      break;
    case 'curious':
      rot = Math.sin(t * 3) * 0.2;
      break;
  }
  if (isEgg) {
    // The egg only wobbles; it doesn't bounce around.
    rot = P.mood === 'curious' || P.mood === 'eating' ? Math.sin(t * 16) * 0.12 : Math.sin(t * 1.6) * 0.04;
    dy = 0;
    dx = 0;
    scale = 1 + 0.03 * Math.sin(t * 2.2);
  }

  // ── Aura ──
  const pulse = 0.75 + 0.25 * Math.sin(t * 2);
  let auraAlpha = (isEgg ? 0.22 : 0.16 + detail * 0.32) * pulse * (P.goldenAura ? 1.5 : 1);
  if (P.mood === 'sad') auraAlpha *= 0.3;
  if (P.mood === 'dance' || P.mood === 'excited') auraAlpha *= 1.4;
  const auraR = P.size * (0.75 + detail * 0.2);
  const ag = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
  ag.addColorStop(0, `rgba(${rgb},${Math.min(0.8, auraAlpha)})`);
  ag.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = ag;
  ctx.beginPath();
  ctx.arc(cx, cy, auraR, 0, Math.PI * 2);
  ctx.fill();

  if (!isEgg && detail >= 0.85) {
    // Legendary+: rotating rune ring.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.6);
    ctx.strokeStyle = `rgba(${rgb},${0.35 + 0.2 * Math.sin(t * 3)})`;
    ctx.lineWidth = Math.max(1, unit * 0.6);
    ctx.setLineDash([unit * 2.2, unit * 1.6]);
    ctx.beginPath();
    ctx.arc(0, 0, P.size * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ── Body ──
  const pose: CreaturePose = {
    t,
    stage: P.stage,
    mood: P.mood,
    detail,
    eyesClosed: P.mood === 'sleeping' || t < fx.blinkUntil,
    mouthOpen: P.mood === 'eating' ? (Math.sin(t * 14) + 1) / 2 : P.mood === 'happy' ? 0.35 : 0,
    wingPhase:
      t * (P.mood === 'dance' || P.mood === 'excited' ? 14 : P.mood === 'happy' ? 10 : P.mood === 'sleeping' ? 1.5 : 4.5),
    breath:
      P.mood === 'dance' || P.mood === 'excited'
        ? 0.9 + 0.1 * Math.sin(t * 9)
        : detail >= 0.6 && t % 7 < 1.1 && P.mood !== 'sleeping' && P.mood !== 'sad'
          ? Math.sin(((t % 7) / 1.1) * Math.PI)
          : 0,
    lookX: P.mood === 'curious' ? Math.sin(t * 3) : 0.25,
    sad: P.mood === 'sad',
  };
  if (t >= fx.nextBlink) {
    fx.blinkUntil = t + 0.13;
    fx.nextBlink = t + 2.4 + Math.random() * 3;
  }

  ctx.save();
  ctx.translate(cx + dx, cy + dy);
  ctx.rotate(rot);
  ctx.scale(scale * unit, scale * unit);
  ctx.globalAlpha = alpha;
  if (P.mood === 'sad') ctx.filter = 'saturate(0.35) brightness(0.8)';
  if (isEgg) paintEgg(ctx, t, P.crack, accent);
  else FORM_PAINTERS[P.form](ctx, pose);
  ctx.filter = 'none';
  ctx.restore();

  if (!isEgg && P.stage === 'mythic') {
    // Mythic halo.
    ctx.save();
    ctx.strokeStyle = `rgba(255,215,64,${0.7 + 0.3 * Math.sin(t * 2.5)})`;
    ctx.lineWidth = Math.max(1, unit * 0.9);
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = unit * 4;
    ctx.beginPath();
    ctx.ellipse(cx + dx + unit * 5, cy + dy - P.size * 0.46, unit * 6, unit * 1.8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ── Particle emission ──
  const rate =
    P.mood === 'dance'
      ? 22
      : P.mood === 'excited'
        ? 16
        : P.mood === 'happy'
          ? 9
          : P.mood === 'eating'
            ? 7
            : P.mood === 'sleeping'
              ? 1.1
              : !isEgg && (detail >= 0.85 || P.goldenAura)
                ? 5
                : 0;
  fx.emitAcc += rate * dt;
  while (fx.emitAcc >= 1) {
    fx.emitAcc -= 1;
    const r = Math.random();
    if (P.mood === 'dance') {
      const a = Math.random() * Math.PI * 2;
      spawn(fx, {
        kind: r < 0.65 ? 'flame' : 'spark',
        x: cx + Math.cos(a) * P.size * 0.55,
        y: cy + Math.sin(a) * P.size * 0.35 + P.size * 0.1,
        vx: Math.cos(a) * 6,
        vy: -18 - Math.random() * 14,
        life: 0,
        max: 0.8 + Math.random() * 0.5,
        size: unit * (1.6 + Math.random() * 2),
      });
    } else if (P.mood === 'happy' || P.mood === 'excited') {
      spawn(fx, {
        kind: 'spark',
        x: cx + (Math.random() - 0.5) * P.size,
        y: cy - P.size * 0.2 + (Math.random() - 0.5) * P.size * 0.5,
        vx: (Math.random() - 0.5) * 12,
        vy: -14 - Math.random() * 10,
        life: 0,
        max: 0.7 + Math.random() * 0.4,
        size: unit * (1.2 + Math.random() * 1.4),
      });
    } else if (P.mood === 'eating') {
      spawn(fx, {
        kind: 'crumb',
        x: cx + P.size * 0.25 + (Math.random() - 0.5) * unit * 4,
        y: cy - P.size * 0.05,
        vx: (Math.random() - 0.3) * 14,
        vy: -6 - Math.random() * 6,
        life: 0,
        max: 0.9,
        size: unit * (0.7 + Math.random() * 0.6),
      });
    } else if (P.mood === 'sleeping') {
      spawn(fx, {
        kind: 'z',
        x: cx + P.size * 0.3,
        y: cy - P.size * 0.3,
        vx: 5,
        vy: -9,
        life: 0,
        max: 2.4,
        size: unit * 4,
      });
    } else {
      spawn(fx, {
        kind: 'mote',
        x: cx + (Math.random() - 0.5) * P.size * 1.1,
        y: cy + P.size * 0.3,
        vx: (Math.random() - 0.5) * 3,
        vy: -8 - Math.random() * 6,
        life: 0,
        max: 1.6 + Math.random(),
        size: unit * (0.6 + Math.random() * 0.8),
      });
    }
  }

  // ── Particle update + draw ──
  const next: FxParticle[] = [];
  for (const p of fx.particles) {
    p.life += dt;
    if (p.life >= p.max) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === 'crumb') p.vy += 40 * dt;
    const k = 1 - p.life / p.max;
    switch (p.kind) {
      case 'spark': {
        ctx.strokeStyle = `rgba(255,255,255,${k})`;
        ctx.lineWidth = Math.max(0.8, p.size * 0.35);
        ctx.beginPath();
        ctx.moveTo(p.x - p.size, p.y);
        ctx.lineTo(p.x + p.size, p.y);
        ctx.moveTo(p.x, p.y - p.size);
        ctx.lineTo(p.x, p.y + p.size);
        ctx.stroke();
        ctx.fillStyle = `rgba(${rgb},${k})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.45, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'flame': {
        const fg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 1.6);
        fg.addColorStop(0, `rgba(255,240,170,${k})`);
        fg.addColorStop(0.5, `rgba(255,140,0,${0.8 * k})`);
        fg.addColorStop(1, 'rgba(255,40,0,0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 1.6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'crumb': {
        ctx.fillStyle = `rgba(255,213,79,${k})`;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        break;
      }
      case 'z': {
        ctx.fillStyle = `rgba(180,170,255,${Math.min(1, k * 1.3)})`;
        ctx.font = `bold ${Math.round(p.size * (0.7 + (1 - k) * 0.6))}px monospace`;
        ctx.fillText(p.life > p.max * 0.5 ? 'Z' : 'z', p.x, p.y);
        break;
      }
      case 'mote': {
        ctx.fillStyle = `rgba(${rgb},${0.8 * k})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    next.push(p);
  }
  fx.particles = next;

  // Curious "?" and eating "nom".
  if (P.mood === 'curious') {
    ctx.fillStyle = `rgba(255,255,255,${0.75 + 0.25 * Math.sin(t * 5)})`;
    ctx.font = `bold ${Math.round(unit * 7)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('?', cx + P.size * 0.32, cy - P.size * 0.42 + Math.sin(t * 4) * unit);
  } else if (P.mood === 'eating' && Math.sin(t * 3) > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `bold ${Math.round(unit * 4.5)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('nom', cx + P.size * 0.35, cy - P.size * 0.38);
  }
}

// ─────────────────────────────────────────────────────────────
// <CreatureCanvas/> — reusable animated sprite
// ─────────────────────────────────────────────────────────────

export interface CreatureCanvasProps {
  form: CreatureForm;
  stage: CreatureStage;
  mood: CreatureMood;
  /** Base size in px (the canvas box is ~1.9× this to fit effects). */
  size: number;
  goldenAura: boolean;
  /** Egg crack 0..1 (only used while stage === 'egg'). */
  crack?: number;
  className?: string;
}

function CreatureCanvasInner({ form, stage, mood, size, goldenAura, crack = 0, className }: CreatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef<SpriteProps>({ form, stage, mood, size, goldenAura, crack });

  // Keep the loop's view of the props current (never read refs in render).
  useEffect(() => {
    propsRef.current = { form, stage, mood, size, goldenAura, crack };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let last = 0;
    const start = performance.now();
    const fx: FxState = { particles: [], emitAcc: 0, nextBlink: 1.5, blinkUntil: 0, lastT: 0 };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < FRAME_MS) return;
      last = now;
      const P = propsRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const css = Math.round(P.size * 1.9);
      const px = Math.round(css * dpr);
      if (canvas.width !== px || canvas.height !== px) {
        canvas.width = px;
        canvas.height = px;
      }
      drawFrame(ctx, P, (now - start) / 1000, css, dpr, fx);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const box = Math.round(size * 1.9);
  return (
    <canvas
      ref={canvasRef}
      width={box}
      height={box}
      className={cn('pointer-events-none block', className)}
      style={{ width: box, height: box }}
      aria-hidden
    />
  );
}

export const CreatureCanvas = memo(CreatureCanvasInner);

/** Backwards-compatible name used across the creature feature. */
export const EvolutionVisual = CreatureCanvas;

// ─────────────────────────────────────────────────────────────
// <CreatureRenderer/> — the taskbar sprite button
// ─────────────────────────────────────────────────────────────

/** Sprite size per stage (px) — the creature grows as it evolves. */
export const TASKBAR_SPRITE_SIZE: Record<CreatureStage, number> = {
  egg: 26,
  baby: 28,
  teen: 32,
  adult: 36,
  legendary: 40,
  mythic: 44,
};

/**
 * The lower part of the canvas (effects headroom) overlaps the taskbar
 * visually; the click target stops above it so tray buttons stay usable.
 */
export const TASKBAR_SPRITE_SINK = 14;

interface CreatureRendererProps {
  vitals: CreatureVitals;
  onClick: () => void;
}

function CreatureRendererInner({ vitals, onClick }: CreatureRendererProps) {
  const { stageInfo, form, formInfo, mood, stage, hasGoldenAura, eggReadyToHatch } = vitals;
  const name = useCreatureStore((s) => s.name);
  const size = TASKBAR_SPRITE_SIZE[stage];
  const box = Math.round(size * 1.9);

  const title =
    stage === 'egg'
      ? `${name} · a mysterious egg${eggReadyToHatch ? ' (it is cracking!)' : ''}`
      : `${name} · ${formInfo.name} (${stageInfo.label})`;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        'relative block overflow-visible',
        'transition-transform duration-150 hover:scale-110 active:scale-95 origin-bottom',
        'focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary rounded-full'
      )}
      style={{ width: box, height: box - TASKBAR_SPRITE_SINK }}
    >
      <span className="pointer-events-none absolute left-0" style={{ bottom: -TASKBAR_SPRITE_SINK }}>
        <CreatureCanvas
          form={form}
          stage={stage}
          mood={mood}
          size={size}
          goldenAura={hasGoldenAura}
          crack={eggReadyToHatch ? 0.25 : 0}
        />
      </span>
    </button>
  );
}

export const CreatureRenderer = memo(CreatureRendererInner);
