// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Star Field Wallpaper
// Canvas-based stars with parallax on mouse move + twinkling
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef } from 'react';
import type { WallpaperProps } from '@/types/wallpaper';

interface Star {
  x: number;
  y: number;
  z: number; // depth layer (0-1) for parallax
  size: number;
  brightness: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

const STAR_COUNT = 400;
const TWINKLE_STARS = 80; // how many stars twinkle

function createStars(width: number, height: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      z: Math.random(),
      size: Math.random() * 1.8 + 0.3,
      brightness: Math.random() * 0.6 + 0.4,
      twinkleSpeed: i < TWINKLE_STARS ? Math.random() * 2 + 1 : 0,
      twinkleOffset: Math.random() * Math.PI * 2,
    });
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

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      starsRef.current = createStars(canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = (time: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      ctx.fillStyle = '#020208';
      ctx.fillRect(0, 0, w, h);

      const stars = starsRef.current;
      const t = time * 0.001;

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        const parallaxFactor = star.z * 20;
        const sx = star.x + mx * parallaxFactor;
        const sy = star.y + my * parallaxFactor;

        let alpha = star.brightness;
        if (star.twinkleSpeed > 0) {
          alpha *= 0.5 + 0.5 * Math.sin(t * star.twinkleSpeed + star.twinkleOffset);
        }

        const size = star.size * (1 + star.z * 0.5);
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`;
        ctx.fill();

        if (size > 1.2) {
          ctx.beginPath();
          ctx.arc(sx, sy, size * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(150, 180, 255, ${alpha * 0.1})`;
          ctx.fill();
        }
      }

      const grad = ctx.createRadialGradient(
        w * 0.5 + mx * 30,
        h * 0.5 + my * 30,
        0,
        w * 0.5,
        h * 0.5,
        w * 0.4
      );
      grad.addColorStop(0, 'rgba(30, 0, 80, 0.06)');
      grad.addColorStop(0.5, 'rgba(0, 40, 100, 0.03)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
    />
  );
}

export const StarField = memo(StarFieldInner);
