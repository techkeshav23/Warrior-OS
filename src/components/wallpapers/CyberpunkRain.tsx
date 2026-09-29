// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Cyberpunk Rain Wallpaper (id: matrix)
// Canvas: falling glyph columns in the FORGE HUD palette (a near-white
// head, plasma tails fading into ink), thin glass rain and a plasma
// horizon reflection that breathes with the bass. Calmer than a
// classic matrix: sparser columns, slower fall, low-alpha tails.
// Glyphs use the OS mono font. DPR-aware (≤ 1.5×).
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef } from 'react';
import type { WallpaperProps } from '@/types/wallpaper';
import { FG, INK, PLASMA } from '@/styles/tokens';

const MATRIX_CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789';
const COLUMN_WIDTH = 20;
const GLYPH_SIZE = 14;
const RAIN_DROP_COUNT = 40;
/** Share of columns falling at any moment; the rest wait their turn. */
const ACTIVE_SHARE = 0.55;

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
  /** Frames to wait before the next fall */
  wait: number;
}

function rgbTriplet(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

const INK_RGB = rgbTriplet(INK[950]);
const HEAD_RGB = rgbTriplet(FG.base);
const NECK_RGB = rgbTriplet(PLASMA[300]);
const TAIL_RGB = rgbTriplet(PLASMA[500]);
const RAIN_RGB = '148, 170, 205'; // the line token's hue

function randomChar(): string {
  return MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
}

function resetColumn(col: MatrixColumn, first: boolean, height: number) {
  col.charLen = Math.floor(Math.random() * 14) + 6;
  col.chars = Array.from({ length: col.charLen }, randomChar);
  // The first fall starts mid-screen, so the rain is there from frame one.
  col.y = first ? Math.random() * (height + 240) - 240 : -GLYPH_SIZE;
  col.speed = Math.random() * 1.3 + 0.9;
  col.wait = Math.random() < ACTIVE_SHARE ? 0 : Math.floor((first ? 0 : 60) + Math.random() * 420);
}

function createColumns(width: number, height: number): MatrixColumn[] {
  const cols: MatrixColumn[] = [];
  const count = Math.floor(width / COLUMN_WIDTH);
  for (let i = 0; i < count; i++) {
    const col: MatrixColumn = { x: i * COLUMN_WIDTH + 3, y: 0, speed: 1, chars: [], charLen: 0, wait: 0 };
    resetColumn(col, true, height);
    cols.push(col);
  }
  return cols;
}

function createRainDrops(width: number): RainDrop[] {
  const drops: RainDrop[] = [];
  for (let i = 0; i < RAIN_DROP_COUNT; i++) {
    drops.push({
      x: Math.random() * width,
      y: Math.random() * -400,
      speed: Math.random() * 3 + 5,
      length: Math.random() * 50 + 24,
      opacity: Math.random() * 0.08 + 0.03,
    });
  }
  return drops;
}

function CyberpunkRainInner({ bassLevel }: WallpaperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const columnsRef = useRef<MatrixColumn[]>([]);
  const dropsRef = useRef<RainDrop[]>([]);
  const animRef = useRef<number>(0);
  const bassRef = useRef(0);

  // Sync latest bass level into ref for the animation loop to consume.
  useEffect(() => {
    bassRef.current = bassLevel;
  }, [bassLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // The OS mono font (next/font exposes its family on <html>).
    const mono =
      getComputedStyle(document.documentElement).getPropertyValue('--font-jetbrains').trim() ||
      '"JetBrains Mono"';
    const font = `${GLYPH_SIZE}px ${mono}, ui-monospace, monospace`;

    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      columnsRef.current = createColumns(w, h);
      dropsRef.current = createRainDrops(w);
      ctx.fillStyle = INK[950];
      ctx.fillRect(0, 0, w, h);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      // Trails: fade the previous frame into ink.
      ctx.fillStyle = `rgba(${INK_RGB}, 0.16)`;
      ctx.fillRect(0, 0, w, h);

      ctx.font = font;
      const cols = columnsRef.current;
      const bass = bassRef.current;
      const bassBoost = 1 + bass * 0.4;

      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        if (col.wait > 0) {
          col.wait--;
          continue;
        }
        col.y += col.speed * bassBoost;

        for (let j = 0; j < col.charLen; j++) {
          const cy = col.y - j * GLYPH_SIZE * 1.15;
          if (cy < -GLYPH_SIZE || cy > h + GLYPH_SIZE) continue;

          const fade = Math.max(0, 1 - j / col.charLen);
          if (j === 0) ctx.fillStyle = `rgba(${HEAD_RGB}, 0.85)`;
          else if (j < 3) ctx.fillStyle = `rgba(${NECK_RGB}, ${0.55 * fade})`;
          else ctx.fillStyle = `rgba(${TAIL_RGB}, ${0.4 * fade * fade})`;

          if (Math.random() < 0.015) col.chars[j] = randomChar();
          ctx.fillText(col.chars[j], col.x, cy);
        }

        if (col.y - col.charLen * GLYPH_SIZE * 1.15 > h) resetColumn(col, false, h);
      }

      // Glass rain
      const drops = dropsRef.current;
      ctx.lineWidth = 1;
      for (let i = 0; i < drops.length; i++) {
        const drop = drops[i];
        drop.y += drop.speed;
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - 0.6, drop.y - drop.length);
        ctx.strokeStyle = `rgba(${RAIN_RGB}, ${drop.opacity})`;
        ctx.stroke();
        if (drop.y - drop.length > h) {
          drop.y = Math.random() * -120;
          drop.x = Math.random() * w;
        }
      }

      // Horizon reflection
      const reflectH = h * 0.12;
      const grad = ctx.createLinearGradient(0, h - reflectH, 0, h);
      grad.addColorStop(0, `rgba(${TAIL_RGB}, 0)`);
      grad.addColorStop(1, `rgba(${TAIL_RGB}, ${0.035 + bass * 0.05})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, h - reflectH, w, reflectH);

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

export const CyberpunkRain = memo(CyberpunkRainInner);
