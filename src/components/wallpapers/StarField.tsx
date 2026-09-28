// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Star Field Wallpaper
// Canvas: three depths of stars on deep ink with mouse parallax, a slow
// sidereal drift and gentle twinkle. Star colors follow temperature in
// the FORGE HUD palette (cool white, plasma-blue, a few warm ember
// stars); a handful of bright stars carry a fine four-point flare; a
// faint plasma / violet haze gives the sky depth. DPR-aware (≤ 1.5×).
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef } from 'react';
import type { WallpaperProps } from '@/types/wallpaper';
import { EMBER, FG, INK, PLASMA, VIZ } from '@/styles/tokens';

interface Star {
  x: number;
  y: number;
  z: number; // depth (0 far … 1 near) → parallax, size, drift
  size: number;
  brightness: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  color: string; // "r, g, b"
  flare: boolean;
}

/** Stars per 10 000 CSS px² (≈ 360 on a 1600 × 1000 screen). */
const DENSITY = 2.25;
const MAX_STARS = 560;

function rgbTriplet(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

const COOL_WHITE = rgbTriplet(FG.base);
const BLUE_WHITE = rgbTriplet(PLASMA[300]);
const WARM = rgbTriplet(EMBER[300]);
const HAZE_PLASMA = rgbTriplet(PLASMA[600]);
const HAZE_VIOLET = rgbTriplet(VIZ[2]);

function pickColor(): string {
  const r = Math.random();
  if (r < 0.72) return COOL_WHITE;
  if (r < 0.93) return BLUE_WHITE;
  return WARM;
}

function createStars(width: number, height: number): Star[] {
  const count = Math.min(MAX_STARS, Math.round((width * height * DENSITY) / 10000));
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const z = Math.random();
    const twinkles = Math.random() < 0.22;
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      z,
      size: 0.5 + Math.pow(Math.random(), 3) * 1.3 + z * 0.4,
      brightness: 0.4 + Math.random() * 0.55,
      twinkleSpeed: twinkles ? 0.6 + Math.random() * 1.6 : 0,
      twinkleOffset: Math.random() * Math.PI * 2,
      color: pickColor(),
      flare: false,
    });
  }
  // A few bright anchor stars with a fine flare.
  const anchors = Math.max(2, Math.round(count / 120));
  for (let i = 0; i < anchors; i++) {
    const s = stars[i];
    s.flare = true;
    s.size = 1.2 + Math.random() * 0.5;
    s.brightness = 0.85;
    s.z = 0.6 + Math.random() * 0.4;
    s.color = i % 3 === 2 ? WARM : BLUE_WHITE;
  }
  return stars;
}

function StarFieldInner({ mouseX, mouseY }: WallpaperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: mouseX, y: mouseY });

  // Sync latest mouse position into ref for the animation loop to consume.
  useEffect(() => {
    mouseRef.current.x = mouseX;
    mouseRef.current.y = mouseY;
  }, [mouseX, mouseY]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      starsRef.current = createStars(w, h);
    };
    resize();
    window.addEventListener('resize', resize);

    let last = performance.now();
    const draw = (time: number) => {
      const dt = Math.min(64, time - last);
      last = time;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const t = time * 0.001;

      ctx.fillStyle = INK[950];
      ctx.fillRect(0, 0, w, h);

      // Sky haze: plasma low-left, violet high-right, both barely there.
      const hazeA = ctx.createRadialGradient(w * 0.22 + mx * 12, h * 0.78 + my * 12, 0, w * 0.22, h * 0.78, w * 0.55);
      hazeA.addColorStop(0, `rgba(${HAZE_PLASMA}, 0.13)`);
      hazeA.addColorStop(1, `rgba(${HAZE_PLASMA}, 0)`);
      ctx.fillStyle = hazeA;
      ctx.fillRect(0, 0, w, h);
      const hazeB = ctx.createRadialGradient(w * 0.8 + mx * 18, h * 0.2 + my * 18, 0, w * 0.8, h * 0.2, w * 0.45);
      hazeB.addColorStop(0, `rgba(${HAZE_VIOLET}, 0.08)`);
      hazeB.addColorStop(1, `rgba(${HAZE_VIOLET}, 0)`);
      ctx.fillStyle = hazeB;
      ctx.fillRect(0, 0, w, h);

      const stars = starsRef.current;
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        // Slow sidereal drift, faster for nearer stars; wraps around.
        star.x -= (0.004 + star.z * 0.012) * dt;
        if (star.x < -4) star.x += w + 8;

        const parallax = star.z * 18;
        const sx = star.x + mx * parallax;
        const sy = star.y + my * parallax;

        let alpha = star.brightness;
        if (star.twinkleSpeed > 0) {
          alpha *= 0.55 + 0.45 * Math.sin(t * star.twinkleSpeed + star.twinkleOffset);
        }

        const size = star.size;
        if (size < 0.9) {
          // Tiny stars: a pixel square is cheaper than an arc and just as crisp.
          ctx.fillStyle = `rgba(${star.color}, ${alpha})`;
          ctx.fillRect(sx - size, sy - size, size * 2, size * 2);
          continue;
        }

        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${star.color}, ${alpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx, sy, size * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${star.color}, ${alpha * 0.07})`;
        ctx.fill();

        if (star.flare) {
          const len = 7 + size * 4;
          ctx.strokeStyle = `rgba(${star.color}, ${alpha * 0.35})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(sx - len, sy);
          ctx.lineTo(sx + len, sy);
          ctx.moveTo(sx, sy - len);
          ctx.lineTo(sx, sy + len);
          ctx.stroke();
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}

export const StarField = memo(StarFieldInner);
