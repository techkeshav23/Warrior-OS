// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Cyberpunk Rain Wallpaper
// Canvas: falling matrix columns + glass rain drops + neon reflections
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef, useCallback } from 'react';
import type { WallpaperProps } from '@/types/wallpaper';

const MATRIX_CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン01';
const COLUMN_WIDTH = 16;
const RAIN_DROP_COUNT = 60;

interface RainDrop {
  x: number;
  y: number;
  speed: number;
  length: number;
  opacity: number;
}

interface MatrixColumn {
  x: number;
  y: number;
  speed: number;
  chars: string[];
  charLen: number;
}

function createColumns(width: number): MatrixColumn[] {
  const cols: MatrixColumn[] = [];
  const count = Math.floor(width / COLUMN_WIDTH);
  for (let i = 0; i < count; i++) {
    const charLen = Math.floor(Math.random() * 15) + 5;
    const chars: string[] = [];
    for (let j = 0; j < charLen; j++) {
      chars.push(MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]);
    }
    cols.push({
      x: i * COLUMN_WIDTH,
      y: Math.random() * -500,
      speed: Math.random() * 2 + 1.5,
      chars,
      charLen,
    });
  }
  return cols;
}

function createRainDrops(width: number): RainDrop[] {
  const drops: RainDrop[] = [];
  for (let i = 0; i < RAIN_DROP_COUNT; i++) {
    drops.push({
      x: Math.random() * width,
      y: Math.random() * -200,
      speed: Math.random() * 4 + 6,
      length: Math.random() * 60 + 30,
      opacity: Math.random() * 0.15 + 0.05,
    });
  }
  return drops;
}

function CyberpunkRainInner({ mouseX, bassLevel }: WallpaperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const columnsRef = useRef<MatrixColumn[]>([]);
  const dropsRef = useRef<RainDrop[]>([]);
  const animRef = useRef<number>(0);
  const frameRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Fade effect instead of clear (creates trails)
    ctx.fillStyle = 'rgba(0, 2, 8, 0.12)';
    ctx.fillRect(0, 0, w, h);

    frameRef.current++;

    // ─── Matrix columns ───
    ctx.font = `${COLUMN_WIDTH - 2}px monospace`;
    const cols = columnsRef.current;
    const bassBoost = 1 + bassLevel * 0.5;

    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      col.y += col.speed * bassBoost;

      for (let j = 0; j < col.charLen; j++) {
        const cy = col.y - j * COLUMN_WIDTH;
        if (cy < -COLUMN_WIDTH || cy > h + COLUMN_WIDTH) continue;

        // Head character is brightest
        const fade = j === 0 ? 1.0 : Math.max(0, 1 - j / col.charLen);

        if (j === 0) {
          ctx.fillStyle = `rgba(180, 255, 180, ${fade})`;
        } else {
          ctx.fillStyle = `rgba(0, ${Math.floor(180 * fade)}, ${Math.floor(80 * fade)}, ${fade * 0.6})`;
        }

        // Randomly change characters
        if (Math.random() < 0.02) {
          col.chars[j] = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
        }

        ctx.fillText(col.chars[j], col.x, cy);
      }

      // Reset when fully off-screen
      if (col.y - col.charLen * COLUMN_WIDTH > h) {
        col.y = Math.random() * -300;
        col.speed = Math.random() * 2 + 1.5;
      }
    }

    // ─── Rain drops ───
    const drops = dropsRef.current;
    for (let i = 0; i < drops.length; i++) {
      const drop = drops[i];
      drop.y += drop.speed;

      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - 0.5, drop.y - drop.length);
      ctx.strokeStyle = `rgba(120, 180, 255, ${drop.opacity})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      if (drop.y > h) {
        drop.y = Math.random() * -100;
        drop.x = Math.random() * w;
      }
    }

    // ─── Neon reflections at bottom ───
    const reflectH = h * 0.08;
    const grad = ctx.createLinearGradient(0, h - reflectH, 0, h);
    grad.addColorStop(0, 'rgba(0, 80, 60, 0.0)');
    grad.addColorStop(0.5, `rgba(0, ${Math.floor(100 + bassLevel * 100)}, 80, 0.04)`);
    grad.addColorStop(1, `rgba(0, ${Math.floor(60 + bassLevel * 80)}, 120, 0.08)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, h - reflectH, w, reflectH);

    // Subtle horizontal neon line
    ctx.beginPath();
    ctx.moveTo(0, h - reflectH);
    ctx.lineTo(w, h - reflectH);
    ctx.strokeStyle = `rgba(0, 200, 150, ${0.1 + bassLevel * 0.15})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    animRef.current = requestAnimationFrame(draw);
  }, [bassLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columnsRef.current = createColumns(canvas.width);
      dropsRef.current = createRainDrops(canvas.width);

      // Initial black fill
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000208';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    animRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
    />
  );
}

export const CyberpunkRain = memo(CyberpunkRainInner);
