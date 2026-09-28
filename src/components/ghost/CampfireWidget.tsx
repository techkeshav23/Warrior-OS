// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Campfire Widget
// Canvas campfire whose flame scales with the online warrior count.
// Warrior silhouettes sit around it. Draggable on the desktop.
// Optional ambient crackle when sound is enabled.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { Flame, GripVertical } from 'lucide-react';
import { useGhostStore } from '@/stores/useGhostStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import type { CampfireStage } from '@/types/ghost';
import { cn } from '@/lib/utils';

const W = 200;
const H = 160;
const STORAGE_KEY = 'warrior-campfire-pos';

function stageFor(count: number): CampfireStage {
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

interface Particle {
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  spark: boolean;
}

function loadPos(): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 40, y: 200 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as { x: number; y: number };
  } catch {
    /* ignore */
  }
  return { x: 40, y: 200 };
}

function CampfireWidgetInner() {
  const onlineCount = useGhostStore((s) => s.getOnlineCount());
  const fireIntensity = useGhostStore((s) => s.campfireState.fireIntensity);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const intensityRef = useRef(fireIntensity);
  const countRef = useRef(onlineCount);
  const dragControls = useDragControls();

  const [pos] = useState(loadPos);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    intensityRef.current = fireIntensity;
    countRef.current = onlineCount;
  }, [fireIntensity, onlineCount]);

  const persistPos = useCallback((x: number, y: number) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y }));
    } catch {
      /* ignore */
    }
  }, []);

  // ── Canvas animation loop ──
  useEffect(() => {
    if (collapsed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const cx = W / 2;
    const baseY = H - 30;

    const render = () => {
      const intensity = intensityRef.current;
      const count = countRef.current;
      const flameScale = 0.4 + intensity * 1.6; // 0.4 .. 2.0
      const emitRate = 1 + Math.round(intensity * 6);

      ctx.clearRect(0, 0, W, H);

      // ground glow
      const glow = ctx.createRadialGradient(cx, baseY, 2, cx, baseY, 60 * flameScale);
      glow.addColorStop(0, `rgba(255,150,40,${0.25 + intensity * 0.4})`);
      glow.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      // logs
      ctx.strokeStyle = '#5a3a1e';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 16, baseY + 4);
      ctx.lineTo(cx + 16, baseY - 2);
      ctx.moveTo(cx - 16, baseY - 2);
      ctx.lineTo(cx + 16, baseY + 4);
      ctx.stroke();

      // spawn flame particles
      for (let i = 0; i < emitRate; i++) {
        const spread = 10 * flameScale;
        particlesRef.current.push({
          x: cx + (Math.random() - 0.5) * spread,
          y: baseY,
          vy: -(0.6 + Math.random() * 1.4) * flameScale,
          life: 0,
          maxLife: 30 + Math.random() * 30,
          size: (3 + Math.random() * 4) * flameScale,
          spark: intensity > 0.9 && Math.random() < 0.15, // inferno sparks
        });
      }

      // update + draw
      const next: Particle[] = [];
      for (const p of particlesRef.current) {
        p.life += 1;
        p.y += p.vy;
        p.x += Math.sin(p.life * 0.2) * 0.6;
        p.vy *= 0.99;
        const t = p.life / p.maxLife;
        if (t >= 1) continue;

        if (p.spark) {
          ctx.fillStyle = `rgba(255,240,180,${1 - t})`;
          ctx.fillRect(p.x, p.y, 1.5, 1.5);
        } else {
          // color from white-hot core → orange → red → smoke
          let color: string;
          if (t < 0.3) color = `rgba(255,255,${200 - t * 300},${1 - t})`;
          else if (t < 0.65) color = `rgba(255,${180 - t * 120},20,${1 - t})`;
          else color = `rgba(${120 - t * 60},${60 - t * 40},40,${(1 - t) * 0.6})`;
          const r = p.size * (1 - t * 0.4);
          ctx.beginPath();
          ctx.fillStyle = color;
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        next.push(p);
      }
      // cap particle array
      particlesRef.current = next.slice(-400);

      // warrior silhouettes around the fire (up to 6)
      const seats = Math.min(count, 6);
      ctx.fillStyle = 'rgba(10,8,18,0.85)';
      for (let i = 0; i < seats; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const rank = Math.floor(i / 2);
        const sx = cx + side * (36 + rank * 20);
        const sy = baseY - 4 - rank * 2;
        ctx.beginPath();
        ctx.arc(sx, sy - 12, 4, 0, Math.PI * 2); // head
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(sx - 6, sy);
        ctx.quadraticCurveTo(sx, sy - 14, sx + 6, sy); // hunched body
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(rafRef.current);
  }, [collapsed]);

  const stage = stageFor(onlineCount);

  return (
    <motion.div
      className="glass-dark glass-border pointer-events-auto fixed rounded-xl shadow-2xl"
      style={{ zIndex: 'var(--z-desktop)', width: W + 4 }}
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      initial={{ x: pos.x, y: pos.y }}
      onDragEnd={(_, info) => persistPos(pos.x + info.offset.x, pos.y + info.offset.y)}
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
        </span>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="rounded px-1 text-[10px] text-text-muted transition-colors hover:text-text-primary focus-ring"
          aria-label={collapsed ? 'Expand campfire' : 'Collapse campfire'}
        >
          {collapsed ? '▢' : '—'}
        </button>
      </div>

      {!collapsed && (
        <div className="relative">
          <canvas
            ref={canvasRef}
            style={{ width: W, height: H }}
            className="block rounded-b-xl"
          />
          <div className="pointer-events-none absolute bottom-1.5 left-0 right-0 text-center">
            <span
              className={cn(
                'font-mono text-[10px]',
                onlineCount > 0 ? 'text-accent-warning text-glow-sm' : 'text-text-muted'
              )}
            >
              {onlineCount} around the fire{soundEnabled ? ' · 🔊' : ''}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export const CampfireWidget = memo(CampfireWidgetInner);
