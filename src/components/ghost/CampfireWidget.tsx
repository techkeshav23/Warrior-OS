// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Campfire Widget
// Pixel-art campfire (drawn into an 80×64 buffer, scaled ×2.5 with
// image-rendering: pixelated). Flame size/brightness follows the online
// count: 1 = ember, 5 = campfire, 10 = bonfire, 20+ = inferno with
// sparks. Warrior silhouettes sit around it. Draggable (position is
// remembered). Procedural crackle via Web Audio when sound is enabled.
// War cry button opens the composer.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { Flame, GripVertical, Megaphone, Minus, Plus } from 'lucide-react';
import { useGhostStore } from '@/stores/useGhostStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getAudioContext } from '@/lib/audio-engine';
import type { CampfireStage } from '@/types/ghost';
import { cn } from '@/lib/utils';
import { WarCryComposer } from './WarCrySystem';

const PX_W = 80;
const PX_H = 64;
const SCALE = 2.5;
const W = PX_W * SCALE; // 200 css px
const H = PX_H * SCALE; // 160 css px
const STORAGE_KEY = 'warrior-campfire-pos';
const FRAME_MS = 1000 / 20; // pixel art reads best at a low frame rate

export function campfireStageFor(count: number): CampfireStage {
  if (count >= 20) return 'inferno';
  if (count >= 10) return 'bonfire';
  if (count >= 5) return 'fire';
  if (count >= 2) return 'small';
  return 'ember';
}

const STAGE_LABEL: Record<CampfireStage, string> = {
  ember: 'Ember',
  small: 'Small fire',
  fire: 'Campfire',
  bonfire: 'Bonfire',
  inferno: 'Inferno',
};

// Flame palette from white-hot core to smoke.
const PALETTE = ['#fff8e1', '#ffe082', '#ffca28', '#ffa000', '#ff6f00', '#e64a19', '#b71c1c', '#4e342e', '#3e2723'];

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  spark: boolean;
}

function loadPos(): { x: number; y: number } {
  const fallback =
    typeof window === 'undefined' ? { x: 40, y: 90 } : { x: Math.max(16, window.innerWidth - W - 40), y: 90 };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { x?: unknown; y?: unknown };
      if (typeof p.x === 'number' && typeof p.y === 'number') {
        // Keep it on screen if the viewport shrank.
        return {
          x: Math.min(Math.max(0, p.x), Math.max(0, window.innerWidth - W - 8)),
          y: Math.min(Math.max(0, p.y), Math.max(0, window.innerHeight - H - 110)),
        };
      }
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

/** Procedural crackle + low roar, scaled by the fire intensity. */
function useCampfireCrackle(enabled: boolean, volume: number, intensityRef: React.RefObject<number>) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    let ctx: AudioContext;
    try {
      ctx = getAudioContext();
    } catch {
      return;
    }
    const master = ctx.createGain();
    master.gain.value = Math.max(0, Math.min(1, volume)) * 0.35;
    master.connect(ctx.destination);

    // One second of white noise, reused by every pop + the roar bed.
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const roar = ctx.createBufferSource();
    roar.buffer = noise;
    roar.loop = true;
    const roarFilter = ctx.createBiquadFilter();
    roarFilter.type = 'lowpass';
    roarFilter.frequency.value = 380;
    const roarGain = ctx.createGain();
    roarGain.gain.value = 0;
    roar.connect(roarFilter);
    roarFilter.connect(roarGain);
    roarGain.connect(master);
    roar.start();

    let timer: ReturnType<typeof setTimeout> | null = null;
    const pop = () => {
      const intensity = intensityRef.current ?? 0;
      if (ctx.state === 'running') {
        const t = ctx.currentTime;
        roarGain.gain.setTargetAtTime(0.05 + intensity * 0.12, t, 0.5);
        const src = ctx.createBufferSource();
        src.buffer = noise;
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = 1400 + Math.random() * 3600;
        band.Q.value = 0.7 + Math.random() * 2.5;
        const g = ctx.createGain();
        const peak = (0.2 + Math.random() * 0.55) * (0.35 + intensity * 0.65);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.09);
        src.connect(band);
        band.connect(g);
        g.connect(master);
        src.start(t, Math.random() * 0.85, 0.14);
        src.stop(t + 0.16);
      }
      const gap = (70 + Math.random() * 420) / (0.45 + intensity * 1.6);
      timer = setTimeout(pop, gap);
    };
    timer = setTimeout(pop, 400);

    return () => {
      if (timer) clearTimeout(timer);
      try {
        roar.stop();
      } catch {
        /* already stopped */
      }
      master.disconnect();
    };
  }, [enabled, volume, intensityRef]);
}

function CampfireWidgetInner() {
  const warriors = useGhostStore((s) => s.onlineWarriors);
  const mode = useGhostStore((s) => s.mode);
  const fireIntensity = useGhostStore((s) => s.campfireState.fireIntensity);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const soundVolume = useSettingsStore((s) => s.soundVolume);

  const onlineCount = useMemo(() => warriors.filter((w) => w.isOnline).length, [warriors]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intensityRef = useRef(fireIntensity);
  const countRef = useRef(onlineCount);
  const dragControls = useDragControls();

  const [pos] = useState(loadPos);
  // Current drag position (the initial state never changes; drags accumulate).
  const posRef = useRef(pos);
  const [collapsed, setCollapsed] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    intensityRef.current = fireIntensity;
    countRef.current = onlineCount;
  }, [fireIntensity, onlineCount]);

  useCampfireCrackle(soundEnabled && !collapsed && mode !== 'disabled', soundVolume, intensityRef);

  const handleDragEnd = useCallback((dx: number, dy: number) => {
    const next = { x: posRef.current.x + dx, y: posRef.current.y + dy };
    posRef.current = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  // ── Pixel-art render loop ──
  useEffect(() => {
    if (collapsed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = PX_W;
    canvas.height = PX_H;
    ctx.imageSmoothingEnabled = false;

    const cx = PX_W / 2;
    const baseY = PX_H - 12;
    let embers: Ember[] = [];
    let raf = 0;
    let last = 0;

    const px = (x: number, y: number, color: string, s = 1) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), s, s);
    };

    const render = (now: number) => {
      raf = requestAnimationFrame(render);
      if (now - last < FRAME_MS) return;
      last = now;
      const intensity = intensityRef.current;
      const count = countRef.current;
      const scale = 0.35 + intensity * 1.25; // flame size
      const spread = 3 + intensity * 9;
      const emit = 2 + Math.round(intensity * 9);

      ctx.clearRect(0, 0, PX_W, PX_H);

      // Ground glow (smooth gradient, pixelated by the upscale).
      const glow = ctx.createRadialGradient(cx, baseY, 1, cx, baseY, 14 + 26 * scale);
      glow.addColorStop(0, `rgba(255,140,40,${0.28 + intensity * 0.35})`);
      glow.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, PX_W, PX_H);

      // Stones ring.
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        px(cx + Math.cos(a) * 9, baseY + 3 + Math.sin(a) * -2.2, i % 2 === 0 ? '#5d5d6b' : '#44444f', 2);
      }
      // Logs (crossed).
      for (let i = -7; i <= 7; i++) {
        px(cx + i, baseY + 1 + Math.round(i * 0.25), '#6d4c41');
        px(cx + i, baseY + 1 - Math.round(i * 0.25), '#5d4037');
      }

      // Spawn flame pixels.
      for (let i = 0; i < emit; i++) {
        const inferno = intensity >= 0.99;
        embers.push({
          x: cx + (Math.random() - 0.5) * spread,
          y: baseY - 1,
          vx: (Math.random() - 0.5) * 0.25,
          vy: -(0.45 + Math.random() * 0.9) * (0.6 + scale * 0.55),
          life: 0,
          max: 10 + Math.random() * (10 + scale * 14),
          spark: inferno && Math.random() < 0.12,
        });
      }

      const next: Ember[] = [];
      for (const e of embers) {
        e.life += 1;
        if (e.life >= e.max) continue;
        e.x += e.vx + Math.sin((e.life + e.x) * 0.5) * (e.spark ? 0.4 : 0.15);
        e.y += e.spark ? e.vy * 1.8 : e.vy;
        // Pull the flame inward as it rises (teardrop silhouette).
        if (!e.spark) e.x += (cx - e.x) * 0.04;
        const t = e.life / e.max;
        if (e.spark) {
          px(e.x, e.y, t < 0.5 ? '#fff8e1' : '#ffca28');
        } else {
          const idx = Math.min(PALETTE.length - 1, Math.floor(t * PALETTE.length));
          px(e.x, e.y, PALETTE[idx], t < 0.35 ? 2 : 1);
        }
        next.push(e);
      }
      embers = next.slice(-600);

      // Warrior silhouettes around the fire (max 8), back row smaller.
      const seats = Math.min(count, 8);
      for (let i = 0; i < seats; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const row = Math.floor(i / 2);
        const back = row >= 2;
        const sx = Math.round(cx + side * (14 + (row % 2) * 9 + (back ? 4 : 0)));
        const sy = Math.round(baseY + 2 - (back ? 7 : 0));
        const body = back ? '#16121f' : '#0b0911';
        // head
        ctx.fillStyle = body;
        ctx.fillRect(sx - 1, sy - 9, 3, 3);
        // hunched torso facing the fire
        ctx.fillRect(sx - 2, sy - 6, 5, 4);
        ctx.fillRect(sx - 2 + (side < 0 ? 1 : -1), sy - 2, 5, 2);
        // rim light from the fire
        px(side < 0 ? sx + 1 : sx - 1, sy - 8, `rgba(255,160,60,${0.35 + intensity * 0.5})`);
      }
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [collapsed]);

  const stage = campfireStageFor(onlineCount);
  const simulated = mode === 'local';

  return (
    <motion.div
      className="glass-border pointer-events-auto fixed rounded-xl shadow-2xl"
      style={{
        left: 0,
        top: 0,
        zIndex: 'var(--z-desktop)',
        width: W + 2,
        background: 'rgba(8, 8, 14, 0.82)',
        backdropFilter: 'blur(14px)',
      }}
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      initial={{ x: pos.x, y: pos.y }}
      onDragEnd={(_, info) => handleDragEnd(info.offset.x, info.offset.y)}
    >
      {/* Drag handle / header */}
      <div
        className="flex cursor-grab items-center justify-between rounded-t-xl border-b border-white/10 bg-white/5 px-2 py-1 active:cursor-grabbing"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <span className="flex items-center gap-1 text-[10px] text-text-secondary">
          <GripVertical size={11} className="text-text-muted" />
          <Flame size={11} className="text-accent-warning" />
          {STAGE_LABEL[stage]}
          {simulated && <span className="rounded bg-accent-warning/15 px-1 text-[8px] text-accent-warning">OFFLINE</span>}
        </span>
        <span className="flex items-center gap-0.5">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setComposerOpen((o) => !o)}
            className={cn(
              'rounded p-1 transition-colors focus-ring',
              composerOpen ? 'text-accent-secondary' : 'text-text-muted hover:text-text-primary'
            )}
            aria-label="Send a war cry"
            title="Send a war cry"
          >
            <Megaphone size={11} />
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setCollapsed((c) => !c)}
            className="rounded p-1 text-text-muted transition-colors hover:text-text-primary focus-ring"
            aria-label={collapsed ? 'Expand campfire' : 'Collapse campfire'}
          >
            {collapsed ? <Plus size={11} /> : <Minus size={11} />}
          </button>
        </span>
      </div>

      {!collapsed && (
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={PX_W}
            height={PX_H}
            style={{ width: W, height: H, imageRendering: 'pixelated' }}
            className="block"
            aria-label={`${STAGE_LABEL[stage]}: ${onlineCount} warriors around the fire`}
          />
          <div className="pointer-events-none absolute bottom-1.5 left-0 right-0 text-center">
            <span className={cn('font-mono text-[10px]', onlineCount > 0 ? 'text-accent-warning text-glow-sm' : 'text-text-secondary')}>
              {onlineCount} around the fire{simulated ? ' (offline)' : ''}
            </span>
          </div>
        </div>
      )}

      <AnimatePresence>
        {composerOpen && (
          <motion.div
            className="border-t border-white/10 p-3"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <WarCryComposer compact />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export const CampfireWidget = memo(CampfireWidgetInner);
