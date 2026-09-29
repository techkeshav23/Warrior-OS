// ═══════════════════════════════════════════════════════════
// WARRIOR OS — ScreenEffects Component
// The CRT look, on the desktop background only: faint plasma dust
// drifting up, now and then an ember spark rising from below, fine
// scanlines and a soft vignette. Sits at z-index 0 before the workspace
// (above the wallpaper, below icons, widgets and windows), so app
// content stays crisp. Off when CRT is off and always off in lite mode;
// under prefers-reduced-motion the particles stay still (not drawn).
// DPR-aware canvas (capped at 2x).
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useLiteMode } from '@/lib/lite-mode';
import { EMBER, PLASMA } from '@/styles/tokens';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  /** Peak alpha */
  alpha: number;
  life: number;
  maxLife: number;
  ember: boolean;
  /** Phase for sway / flicker */
  phase: number;
}

const DUST_COUNT = 26;
const EMBER_COUNT = 5;

/** '#2fd6f5' → '47, 214, 245' */
function rgbTriplet(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

const DUST_RGB = rgbTriplet(PLASMA[300]);
const EMBER_RGB = rgbTriplet(EMBER[400]);
const EMBER_CORE_RGB = rgbTriplet(EMBER[300]);

export function ScreenEffects() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const crtEffect = useSettingsStore((s) => s.crtEffect);
  const lite = useLiteMode();
  const enabled = crtEffect && !lite;

  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const spawn = (ember: boolean, anywhere: boolean): Particle => {
      const maxLife = ember ? 240 + Math.random() * 220 : 420 + Math.random() * 420;
      return {
        x: Math.random() * w,
        // Embers rise from the lower third; dust starts anywhere.
        y: anywhere ? Math.random() * h : ember ? h * (0.72 + Math.random() * 0.3) : h + 6,
        vx: (Math.random() - 0.5) * (ember ? 0.18 : 0.08),
        vy: ember ? -(0.35 + Math.random() * 0.45) : -(0.05 + Math.random() * 0.16),
        size: ember ? 0.8 + Math.random() * 0.9 : 0.5 + Math.random() * 0.9,
        alpha: ember ? 0.3 + Math.random() * 0.3 : 0.08 + Math.random() * 0.16,
        life: anywhere ? Math.random() * maxLife : 0,
        maxLife,
        ember,
        phase: Math.random() * Math.PI * 2,
      };
    };

    const particles: Particle[] = [];
    for (let i = 0; i < DUST_COUNT; i++) particles.push(spawn(false, true));
    for (let i = 0; i < EMBER_COUNT; i++) particles.push(spawn(true, true));

    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life++;
        p.phase += p.ember ? 0.09 : 0.012;
        p.x += p.vx + Math.sin(p.phase) * (p.ember ? 0.22 : 0.06);
        p.y += p.vy;

        // Fade in over the first 15% of life, out over the last 25%.
        const t = p.life / p.maxLife;
        const envelope = t < 0.15 ? t / 0.15 : t > 0.75 ? Math.max(0, (1 - t) / 0.25) : 1;
        const flicker = p.ember ? 0.75 + 0.25 * Math.sin(p.phase * 2.3) : 1;
        const a = p.alpha * envelope * flicker;

        if (p.ember) {
          // soft halo + hot core
          ctx.fillStyle = `rgba(${EMBER_RGB}, ${a * 0.18})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(${EMBER_CORE_RGB}, ${a})`;
        } else {
          ctx.fillStyle = `rgba(${DUST_RGB}, ${a})`;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        if (p.life >= p.maxLife || p.y < -12 || p.x < -12 || p.x > w + 12) {
          particles[i] = spawn(p.ember, false);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      ctx.clearRect(0, 0, w, h);
    };
  }, [enabled]);

  if (!enabled) return null;

  // z-index 0, rendered before the workspace: the whole CRT look stays on
  // the desktop background (above the wallpaper, below icons and windows),
  // so app content is never striped or dimmed.
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex: 0 }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* Fine scanlines: 1px of ink every 3px, barely there */}
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent 0 2px, color-mix(in oklab, var(--color-ink-950) 22%, transparent) 2px 3px)',
        }}
      />
      {/* Vignette: settle the corners into ink */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 120% 90% at 50% 45%, transparent 55%, color-mix(in oklab, var(--color-ink-950) 55%, transparent) 100%)',
        }}
      />
    </div>
  );
}
